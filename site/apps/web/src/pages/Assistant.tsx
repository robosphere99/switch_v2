import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  createChat,
  listChats,
  listMessages,
  sendMessage,
  confirmProposal,
  type AssistantMessage,
} from "../api/assistant";
import { listHomes } from "../api/homes";
import { getAutomationSuggestions, type AutomationSuggestion } from "../api/devices";
import { createSchedule } from "../api/schedules";
import { RichText } from "../components/RichText";

const EXAMPLES = [
  "turn on the fan",
  "pankha band karo",
  "saare lights on karo",
  "TV on karo",
  "all devices off karo",
];

export function Assistant() {
  const queryClient = useQueryClient();
  const [chatId, setChatId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [newChatHome, setNewChatHome] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const homes = useQuery({ queryKey: ["homes"], queryFn: listHomes });
  const myHomes = homes.data?.success ? homes.data.data : [];

  const chats = useQuery({ queryKey: ["assistant", "chats"], queryFn: listChats });

  // auto-open the most recent chat
  useEffect(() => {
    if (chatId === null && chats.data?.success && chats.data.data.length > 0) {
      setChatId(chats.data.data[0].id);
    }
  }, [chats.data, chatId]);

  const messages = useQuery({
    queryKey: ["assistant", "messages", chatId],
    queryFn: () => listMessages(chatId!),
    enabled: chatId !== null,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  const invalidateChats = () => {
    queryClient.invalidateQueries({ queryKey: ["assistant", "chats"] });
  };

  const newChat = useMutation({
    mutationFn: () => createChat(Number(newChatHome)),
    onSuccess: (res) => {
      if (res.success) {
        setChatId(res.data.id);
        setNewChatHome("");
        invalidateChats();
      }
    },
  });

  const send = useMutation({
    mutationFn: (content: string) => sendMessage(chatId!, content),
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["assistant", "messages", chatId] });
      invalidateChats();
    },
  });

  const confirm = useMutation({
    mutationFn: (messageId: number) => confirmProposal(chatId!, messageId),
    onSuccess: () => {
      setConfirmingId(null);
      queryClient.invalidateQueries({ queryKey: ["assistant", "messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });

  // Active chat ka home → usage-pattern automation suggestions (Phase 7)
  const activeChat = chats.data?.success
    ? chats.data.data.find((c) => c.id === chatId)
    : undefined;
  const suggestionsHomeId = activeChat?.homeId ?? null;
  const suggestions = useQuery({
    queryKey: ["automations", "suggestions", suggestionsHomeId],
    queryFn: () => getAutomationSuggestions(suggestionsHomeId!),
    enabled: suggestionsHomeId !== null,
  });
  const suggestionList: AutomationSuggestion[] = suggestions.data?.success
    ? suggestions.data.data
    : [];

  const createSuggestion = useMutation({
    mutationFn: (s: AutomationSuggestion) =>
      createSchedule(suggestionsHomeId!, {
        deviceId: s.deviceId,
        action: s.action,
        type: "daily",
        runAt: buildRunAt(s.time),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations", "suggestions", suggestionsHomeId] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });

  const msgList = messages.data?.success ? messages.data.data : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">🤖 AI Assist</h1>
          <p className="mt-1 text-sm text-gray-500">
            Natural language me bolo — device on/off. Pehle confirm, phir execute. (Hindi + English)
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={newChatHome}
            onChange={(e) => setNewChatHome(e.target.value)}
            className="rounded-lg border border-brand/20 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="">Select home…</option>
            {myHomes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => newChat.mutate()}
            disabled={!newChatHome}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            + New Chat
          </button>
        </div>
      </div>

      {chats.data?.success && chats.data.data.length === 0 && (
        <div className="rounded-xl border border-brand/20 bg-night-800 p-8 text-center">
          <p className="mb-2 text-lg">👋 Kuch bhi bolo!</p>
          <p className="mb-6 text-sm text-gray-500">Pehle home select karke "New Chat" banao, phir command do.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setInput(ex)}
                className="rounded-full border border-brand/30 bg-night-900 px-3 py-1.5 text-xs text-brand hover:bg-brand/10"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {chatId !== null && (
        <>
        {suggestionList.length > 0 && (
          <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <h2 className="mb-3 text-lg font-bold">💡 Suggested automations</h2>
            <p className="mb-4 text-sm text-gray-500">
              Aapke usage patterns se — ek click me daily schedule banao. Dashboard → Timers se edit/disable kar sakte ho.
            </p>
            <div className="space-y-2">
              {suggestionList.map((s) => (
                <div
                  key={`${s.deviceId}-${s.time}-${s.action}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-night-800 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      ⏰ {s.deviceName} — {s.time} baje {s.action === "on" ? "ON" : "OFF"}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">{s.reason}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
                      {Math.round(s.confidence * 100)}% confident
                    </span>
                    <button
                      onClick={() => createSuggestion.mutate(s)}
                      disabled={createSuggestion.isPending}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-night-950 hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {createSuggestion.isPending ? "Creating…" : "+ Daily schedule"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Chat list */}
          <div className="hidden lg:block">
            <div className="space-y-2">
              {chats.data?.success &&
                chats.data.data.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setChatId(c.id)}
                    className={`w-full truncate rounded-lg border px-3 py-2 text-left text-sm ${
                      c.id === chatId ? "border-brand bg-brand/15 text-brand" : "border-gray-200 bg-night-800 text-gray-600 hover:border-gray-500"
                    }`}
                  >
                    💬 {c.title}
                  </button>
                ))}
            </div>
          </div>

          {/* Thread */}
          <div className="flex h-[70vh] flex-col rounded-xl border border-gray-200 bg-night-800">
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {msgList.length === 0 && (
                <p className="text-center text-sm text-gray-500">Message bhejo — jaise "saare lights band karo"</p>
              )}
              {msgList.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  confirming={confirmingId === m.id}
                  onConfirm={() => {
                    setConfirmingId(m.id);
                    confirm.mutate(m.id);
                  }}
                />
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-gray-200 p-4">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && input.trim() && chatId) send.mutate(input.trim());
                  }}
                  placeholder='Try: "saare lights off karo" / "TV on karo"'
                  className="flex-1 rounded-lg border border-brand/20 bg-night-900 px-4 py-2.5 text-sm outline-none focus:border-brand"
                />
                <button
                  onClick={() => send.mutate(input.trim())}
                  disabled={!input.trim() || send.isPending}
                  className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Send
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500 hover:border-brand hover:text-brand"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

/** "07:00" → aaj ki date pe wo time (daily schedule ka base — server next occurrence normalize karta hai). */
function buildRunAt(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toISOString();
}

function MessageBubble({
  message,
  confirming,
  onConfirm,
}: {
  message: AssistantMessage;
  confirming: boolean;
  onConfirm: () => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm border border-gray-200 bg-night-900 text-gray-700"
        }`}
      >
        <RichText text={message.content} className="whitespace-pre-line" />
        {!isUser && message.proposal && message.proposal.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {message.proposal.map((p) => (
              <div key={p.deviceId} className="flex items-center justify-between gap-3 rounded-lg bg-night-800 px-3 py-1.5 text-xs">
                <span>{p.deviceName}</span>
                <span className={`rounded px-1.5 py-0.5 font-bold ${p.action === "on" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                  {p.action === "on" ? "ON" : "OFF"}
                </span>
              </div>
            ))}
            <button
              onClick={onConfirm}
              disabled={confirming}
              className="w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-night-950 hover:bg-green-500 disabled:opacity-50"
            >
              {confirming ? "Executing…" : "✅ Confirm & Execute"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
