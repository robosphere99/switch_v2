import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  createChat,
  listMessages,
  sendMessage,
  confirmProposal,
  type AssistantMessage,
} from "../api/assistant";
import { listHomes } from "../api/homes";
import { RichText } from "../components/RichText";
import { AutomationSuggestions } from "../components/AutomationSuggestions";
import { Home as HomeIcon } from "lucide-react";

const EXAMPLES = [
  "turn on the fan",
  "bedroom ki light on karo",
  "saare lights off karo",
  "TV on karo",
  "all devices off",
];

export function Assistant() {
  const queryClient = useQueryClient();
  const [activeHomeId, setActiveHomeId] = useState<number | null>(null);
  const [chatId, setChatId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const homes = useQuery({ queryKey: ["homes"], queryFn: listHomes });
  const myHomes = homes.data?.success ? homes.data.data : [];

  const openHomeThread = useMutation({
    mutationFn: (hId: number) => createChat(hId),
    onSuccess: (res, hId) => {
      if (res.success) {
        setChatId(res.data.id);
        setActiveHomeId(hId);
      }
    },
  });

  // Auto-open the first home
  useEffect(() => {
    if (activeHomeId === null && myHomes.length > 0) {
      openHomeThread.mutate(myHomes[0].id);
    }
  }, [myHomes, activeHomeId]);

  const messages = useQuery({
    queryKey: ["assistant", "messages", chatId],
    queryFn: () => listMessages(chatId!),
    enabled: chatId !== null,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  const send = useMutation({
    mutationFn: (content: string) => sendMessage(chatId!, content),
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["assistant", "messages", chatId] });
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

  const msgList = messages.data?.success ? messages.data.data : [];
  const loading = openHomeThread.isPending;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">🤖 AI Assist</h1>
        <p className="mt-1 text-sm text-gray-500">
          Natural language se devices control karein. Ek ghar, ek persistent ai conversation thread.
        </p>
      </div>

      {myHomes.length === 0 && homes.isSuccess && (
        <div className="rounded-xl border border-brand/20 bg-night-800 p-8 text-center">
          <p className="mb-2 text-lg">🏡 Koi ghar nahi mila!</p>
          <p className="text-sm text-gray-500">Pehle Home banayein phir assistant use karein.</p>
        </div>
      )}

      {myHomes.length > 0 && (
        <>
          {activeHomeId !== null && <AutomationSuggestions homeId={activeHomeId} />}
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            {/* Sidebar: Home List */}
            <div className="hidden lg:block">
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                Your Homes
              </div>
              <div className="space-y-2">
                {myHomes.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => openHomeThread.mutate(h.id)}
                    className={`flex w-full items-center gap-2 truncate rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-all ${h.id === activeHomeId
                        ? "border-brand bg-brand/10 text-brand shadow-sm shadow-brand/20"
                        : "border-gray-200 bg-night-800 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                      }`}
                  >
                    <HomeIcon className="h-4 w-4 opacity-70" />
                    {h.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Chat Thread */}
            <div className="flex h-[72vh] flex-col overflow-hidden rounded-xl border border-gray-200 bg-night-800 shadow-sm">
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {loading && msgList.length === 0 && (
                  <div className="text-center mt-10 text-brand animate-pulse">Loading AI thread...</div>
                )}
                {!loading && msgList.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <p className="text-sm text-gray-400 mb-6">Hello! Commands bhej kar is ghar ko control karein.</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {EXAMPLES.map((ex) => (
                        <button
                          key={ex}
                          onClick={() => setInput(ex)}
                          className="rounded-full border border-brand/30 bg-night-900 px-3 py-1.5 text-xs text-brand hover:bg-brand/10 transition"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
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

              <div className="border-t border-gray-200 p-4 bg-night-900/50">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && input.trim() && chatId) send.mutate(input.trim());
                    }}
                    placeholder='Ye try karein: "saare lights off karo..."'
                    className="flex-1 rounded-lg border border-brand/20 bg-night-900 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                  <button
                    onClick={() => send.mutate(input.trim())}
                    disabled={!input.trim() || send.isPending}
                    className="rounded-lg bg-brand px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    {send.isPending ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
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
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${isUser ? "rounded-br-sm bg-brand text-white shadow-md shadow-brand/10" : "rounded-bl-sm border border-gray-200 bg-night-900 text-gray-700"
          }`}
      >
        <RichText text={message.content} className="whitespace-pre-line" />
        {!isUser && message.proposal && message.proposal.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-gray-200/20 pt-3">
            {message.proposal.map((p) => (
              <div key={p.deviceId} className="flex items-center justify-between gap-3 rounded-lg bg-night-800 px-3 py-2 text-xs border border-gray-200/5">
                <span className="font-semibold text-gray-300">{p.deviceName}</span>
                <span className={`rounded px-2 py-0.5 font-bold ${p.action === "on" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                  {p.action === "on" ? "ON" : "OFF"}
                </span>
              </div>
            ))}
            <button
              onClick={onConfirm}
              disabled={confirming}
              className="mt-2 w-full rounded-lg bg-emerald-600/90 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50"
            >
              {confirming ? "Executing…" : "✅ Confirm Action"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
