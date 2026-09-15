import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  createChat,
  listMessages,
  sendMessage,
  confirmProposal,
} from "../api/assistant";
import { listHomes } from "../api/homes";
import { MessageBubble } from "../components/assistant/MessageBubble";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Home as HomeIcon, Bot, Send, Sparkles } from "lucide-react";

const EXAMPLES = [
  "turn on the fan",
  "turn on bedroom light",
  "turn off all switches",
  "living room AC on",
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
    <div className="page-enter mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-brand font-bold text-xs uppercase tracking-wider mb-1">
          <Sparkles className="h-4 w-4" />
          <span>Intelligent Control</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          AI Home Assistant
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Control rooms, toggles, and multi-device routines using natural conversation.
        </p>
      </div>

      {myHomes.length === 0 && homes.isSuccess && (
        <EmptyState
          icon={<HomeIcon className="h-8 w-8 text-slate-400" />}
          title="No Homes Found"
          description="You need to be part of a home before using the AI Assistant to control devices."
        />
      )}

      {myHomes.length > 0 && (
        <>
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            {/* Sidebar: Home List */}
            <div className="space-y-2">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                Select Home
              </div>
              <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
                {myHomes.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => openHomeThread.mutate(h.id)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition shrink-0 lg:shrink w-full ${
                      h.id === activeHomeId
                        ? "border-brand/40 bg-brand/10 text-brand shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                    }`}
                  >
                    <HomeIcon className="h-4 w-4 opacity-70 shrink-0" />
                    <span className="truncate">{h.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Chat Thread */}
            <div className="flex h-[72vh] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {/* Messages Body */}
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {loading && msgList.length === 0 && (
                  <div className="flex h-full items-center justify-center text-sm font-medium text-brand animate-pulse">
                    Connecting to home thread...
                  </div>
                )}

                {!loading && msgList.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center text-center p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-3">
                      <Bot className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      How can I help you?
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                      You can ask in plain English or Hindi to toggle appliances, query statuses, or run grouped actions.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 max-w-md">
                      {EXAMPLES.map((ex) => (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => setInput(ex)}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand hover:text-brand transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          "{ex}"
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

              {/* Chat Input Bar */}
              <div className="border-t border-slate-100 p-3.5 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (input.trim() && chatId) send.mutate(input.trim());
                  }}
                  className="flex gap-2.5"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder='Type a command: "Turn off all lights in living room"...'
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!input.trim() || send.isPending}
                    loading={send.isPending}
                    rightIcon={<Send className="h-4 w-4" />}
                  >
                    Send
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
