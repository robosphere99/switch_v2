import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bell, BellOff, CheckCheck, Copy, Inbox, Pin, PinOff, Search, Send, Trash2, UserRound } from "lucide-react";
import {
  clearSupportConversation,
  deleteSupportMessage,
  getSupportConversations,
  getSupportMessages,
  getSupportSettings,
  markAllSupportRead,
  sendSupportMessage,
  setSupportSettings,
  type SupportAttachment,
  type SupportConversation,
} from "../api/admin";
import { AttachmentBubble } from "./AttachmentBubble";
import { getAttachmentUrl } from "../api/client";
import { AttachmentPicker } from "./AttachmentPicker";
import { SupportUserContext } from "./SupportUserContext";
import { getSocket } from "../lib/socket";
import { parseNotificationBody } from "../lib/notificationBody";

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

/**
 * WhatsApp-style admin support inbox:
 * left = conversations (per user), right = us user ka thread + reply box.
 * Thread khulte hi readByAdmin mark hota hai → Admin button ka badge hat jata hai.
 */
export function AdminSupport({
  selectedUserId,
  onSelectUser,
}: {
  selectedUserId: number | null;
  onSelectUser: (id: number | null) => void;
}) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<SupportAttachment | null>(null);
  // Desktop pe right-panel default open; mobile pe drawer default band (chat dikhna chahiye pehle).
  const [showContext, setShowContext] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversations = useQuery({
    queryKey: ["support", "admin", "conversations"],
    queryFn: getSupportConversations,
    refetchInterval: 10_000,
  });

  // Chat settings — mute/pin per user
  const chatSettings = useQuery({
    queryKey: ["support", "admin", "settings"],
    queryFn: getSupportSettings,
  });
  const settingsMap = useMemo(() => {
    const m = new Map<number, { mutedAt: string | null; pinnedAt: string | null }>();
    (chatSettings.data?.success ? chatSettings.data.data.settings : []).forEach((s) =>
      m.set(s.peerUserId, { mutedAt: s.mutedAt, pinnedAt: s.pinnedAt }),
    );
    return m;
  }, [chatSettings.data]);

  // Realtime — user naya message bheje to list turant refresh
  useEffect(() => {
    const socket = getSocket();
    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: ["support", "admin", "conversations"] });
    socket.on("support:new", refresh);
    return () => {
      socket.off("support:new", refresh);
    };
  }, [queryClient]);

  const list = conversations.data?.success ? conversations.data.data : null;

  const filtered = useMemo(() => {
    if (!list) return [];
    const needle = q.trim().toLowerCase();
    const base = needle
      ? list.conversations.filter(
          (c) =>
            c.username.toLowerCase().includes(needle) ||
            (c.email ?? "").toLowerCase().includes(needle),
        )
      : list.conversations;
    // Pinned pehle, phir latest message ke hisaab se
    return [...base].sort((a, b) => {
      const pa = settingsMap.get(a.userId)?.pinnedAt ? 1 : 0;
      const pb = settingsMap.get(b.userId)?.pinnedAt ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
    });
  }, [list, q, settingsMap]);

  const selected: SupportConversation | null =
    list?.conversations.find((c) => c.userId === selectedUserId) ?? null;
  const set = selectedUserId != null ? settingsMap.get(selectedUserId) : undefined;

  const chat = useQuery({
    queryKey: ["support", "admin", "chat", selectedUserId],
    queryFn: () => getSupportMessages(selectedUserId!),
    enabled: selectedUserId != null,
    refetchInterval: 5000,
  });

  // Thread khula → server ne readByAdmin mark kiya → badge + list turant refresh
  useEffect(() => {
    if (chat.data?.success) {
      queryClient.invalidateQueries({ queryKey: ["support", "admin", "unread"] });
      queryClient.invalidateQueries({ queryKey: ["support", "admin", "conversations"] });
    }
  }, [chat.data, queryClient]);

  const msgs = chat.data?.success ? chat.data.data.messages : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, selectedUserId]);

  const send = useMutation({
    mutationFn: (args: { message: string; attachment: SupportAttachment | null }) =>
      sendSupportMessage(selectedUserId!, args.message, args.attachment),
    onSuccess: () => {
      setDraft("");
      setAttachment(null);
      queryClient.invalidateQueries({ queryKey: ["support", "admin", "chat", selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["support", "admin", "conversations"] });
    },
  });

  const markAll = useMutation({
    mutationFn: markAllSupportRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support", "admin", "unread"] });
      queryClient.invalidateQueries({ queryKey: ["support", "admin", "conversations"] });
    },
  });

  const setSettings = useMutation({
    mutationFn: (input: { peerUserId: number; muted?: boolean; pinned?: boolean }) =>
      setSupportSettings(input.peerUserId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support", "admin", "settings"] });
    },
  });

  const deleteMsg = useMutation({
    mutationFn: (id: number) => deleteSupportMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support", "admin", "chat", selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["support", "admin", "conversations"] });
    },
  });

  const clearChat = useMutation({
    mutationFn: (userId: number) => clearSupportConversation(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support", "admin", "chat", selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["support", "admin", "conversations"] });
    },
  });

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-night-800">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <h2 className="font-semibold">
          💬 Support Inbox{" "}
          <span className="text-sm font-normal text-gray-500">
            ({list ? list.conversations.length : "…"} conversations)
          </span>
        </h2>
        {list && list.totalUnread > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-600 transition hover:bg-amber-500/10 disabled:opacity-50"
            title="Saari chats read mark karo — Admin button ka badge hat jayega"
          >
            ✓ Mark all read ({list.totalUnread})
          </button>
        )}
      </div>

      <div className="flex h-[65vh] flex-col md:flex-row">
        {/* Left — conversation list (mobile: sirf tab jab koi chat na khuli ho — WhatsApp jaisa) */}
        <div
          className={`${selectedUserId == null ? "flex" : "hidden md:flex"} w-full shrink-0 flex-col border-b border-gray-200 md:w-80 md:border-b-0 md:border-r`}
        >
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search chats…"
                className="w-full rounded-lg border border-gray-200 bg-night-900 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.isLoading && (
              <p className="px-4 py-8 text-center text-sm text-gray-500">Loading…</p>
            )}
            {!conversations.isLoading && filtered.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Inbox className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                <p className="text-sm text-gray-500">
                  {q.trim()
                    ? "Koi chat match nahi hui."
                    : "Abhi koi baat nahi hui — user support me message karega to yahan aayega."}
                </p>
              </div>
            )}
            {filtered.map((c) => {
              const active = c.userId === selectedUserId;
              const body = parseNotificationBody(c.lastPreview);
              const set = settingsMap.get(c.userId);
              return (
                <button
                  key={c.userId}
                  onClick={() => onSelectUser(c.userId)}
                  className={`flex w-full items-start gap-3 px-3 py-3 text-left transition ${
                    active
                      ? "bg-brand/15"
                      : "hover:bg-night-700"
                  }`}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(c.userId)}`}
                  >
                    {c.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {set?.pinnedAt && <Pin className="h-3 w-3 shrink-0 text-brand" />}
                        {set?.mutedAt && <BellOff className="h-3 w-3 shrink-0 text-gray-500" />}
                        <span className="truncate text-sm font-semibold text-gray-700">
                          {c.username}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] text-gray-500">
                        {formatTime(c.lastAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-xs ${
                          c.unreadCount > 0 ? "font-medium text-gray-700" : "text-gray-500"
                        }`}
                      >
                        {c.lastSenderRole === "admin" ? (
                          <CheckCheck className="mr-1 inline h-3 w-3 text-brand" />
                        ) : null}
                        {body.text || "📎 attachment"}
                      </span>
                      {c.unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                          {c.unreadCount > 9 ? "9+" : c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right — thread */}
        {selectedUserId == null ? (
          <div className="hidden flex-1 items-center justify-center md:flex">
            <div className="text-center">
              <Inbox className="mx-auto mb-3 h-10 w-10 text-gray-600" />
              <p className="text-sm text-gray-500">
                Left se koi user chuno — uska chat yahan khulega
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* Thread + right-side user context (WhatsApp contact-info jaisa) */}
            <div className="flex min-w-0 flex-1 flex-col">
            {/* Thread header */}
            <div className="flex items-center gap-3 border-b border-gray-200 bg-night-900 px-4 py-2.5">
              {/* Mobile back — chats list pe wapas */}
              <button
                onClick={() => onSelectUser(null)}
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-night-700 hover:text-brand md:hidden"
                title="Chats wapas"
                aria-label="Back to chats"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(selectedUserId)}`}
              >
                {selected?.username.slice(0, 1).toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-700">
                  {selected?.username ?? `User #${selectedUserId}`}
                </p>
                {selected?.email && (
                  <p className="truncate text-[11px] text-gray-500">{selected.email}</p>
                )}
              </div>
              {chat.data?.success && chat.data.data.unread > 0 && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                  {chat.data.data.unread} unread
                </span>
              )}
              {/* Pin + Mute + Clear — WhatsApp-style chat actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setSettings.mutate({ peerUserId: selectedUserId, pinned: !set?.pinnedAt })}
                  className={`rounded-lg p-1.5 transition ${
                    set?.pinnedAt ? "bg-brand/15 text-brand" : "text-gray-500 hover:bg-night-700 hover:text-brand"
                  }`}
                  title={set?.pinnedAt ? "Unpin" : "Pin — sabse upar rakho"}
                >
                  {set?.pinnedAt ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setSettings.mutate({ peerUserId: selectedUserId, muted: !set?.mutedAt })}
                  className={`rounded-lg p-1.5 transition ${
                    set?.mutedAt ? "bg-brand/15 text-brand" : "text-gray-500 hover:bg-night-700 hover:text-brand"
                  }`}
                  title={set?.mutedAt ? "Unmute — notifications wapas" : "Mute — is user ki notifications band"}
                >
                  {set?.mutedAt ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Saara chat ${selected?.username ?? "is user"} ke saath clear karein?`)) {
                      clearChat.mutate(selectedUserId);
                    }
                  }}
                  className="rounded-lg p-1.5 text-gray-500 transition hover:bg-red-500/10 hover:text-red-400"
                  title="Clear chat — poora thread hat jayega"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => setShowContext((v) => !v)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                  showContext
                    ? "border-brand/50 bg-brand/15 text-brand"
                    : "border-gray-200 text-gray-500 hover:bg-night-700"
                }`}
                title={showContext ? "User info band karo" : "User ka order/home/device context dikhao"}
              >
                <UserRound className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Info</span>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-2 overflow-y-auto bg-night-900/60 p-4">
              {chat.isLoading && (
                <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
              )}
              {!chat.isLoading && msgs.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-500">
                  Koi message nahi — pehla message bhejo 👇
                </p>
              )}
              {msgs.map((m) => (
                <div key={m.id} className="group relative">
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      m.senderRole === "admin"
                        ? "ml-auto rounded-br-sm bg-brand text-white"
                        : "mr-auto rounded-bl-sm border border-gray-200 bg-night-800 text-gray-200"
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase opacity-70">
                      {m.senderRole === "admin" ? "Admin" : m.senderName || "User"}
                    </div>
                    {m.message && <div className="whitespace-pre-wrap">{m.message}</div>}
                    {m.attachmentName && m.attachmentType && (m.attachmentData || m.attachmentPath) && (
                      <AttachmentBubble
                        name={m.attachmentName}
                        type={m.attachmentType}
                        data={m.attachmentData}
                        url={getAttachmentUrl(m)}
                      />
                    )}
                    <div className={`mt-0.5 flex items-center justify-end gap-1 text-right text-[10px] opacity-60`}>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {/* Read receipt — single ✓ = sent, double ✓✓ = user ne padha */}
                      {m.senderRole === "admin" &&
                        (m.readByUser ? (
                          <CheckCheck className="h-3 w-3 text-blue-300" />
                        ) : (
                          <CheckCheck className="h-3 w-3 opacity-70" />
                        ))}
                    </div>
                  </div>
                  {/* Copy + delete — desktop hover pe, mobile pe hamesha visible (touch pe hover nahi hota) */}
                  <div className="absolute right-0 top-0 z-10 flex items-center gap-1 rounded-lg bg-night-800/95 p-1 shadow-lg opacity-0 transition group-hover:opacity-100 max-md:opacity-100">
                    {m.message && (
                      <button
                        onClick={() => navigator.clipboard?.writeText(m.message)}
                        className="rounded-md bg-night-700 p-1 text-gray-400 shadow hover:text-brand"
                        title="Copy"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm("Message delete karein? (dono side se gayab)")) deleteMsg.mutate(m.id);
                      }}
                      className="rounded-md bg-night-700 p-1 text-gray-400 shadow hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const t = draft.trim();
                if ((t || attachment) && !send.isPending) {
                  send.mutate({ message: t, attachment });
                }
              }}
              className="flex items-center gap-2 border-t border-gray-200 bg-night-900 p-3"
            >
              <AttachmentPicker value={attachment} onChange={setAttachment} />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="User ko message likho… (Enter se bhejo)"
                className="flex-1 rounded-full border border-gray-200 bg-night-800 px-4 py-2 text-sm text-gray-200 outline-none placeholder:text-gray-500 focus:border-brand"
              />
              <button
                type="submit"
                disabled={send.isPending || (!draft.trim() && !attachment)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:brightness-110 disabled:opacity-40"
                title="Bhejo"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            {send.isError && (
              <p className="px-4 pb-2 text-xs text-red-500">Bhejne me dikkat — dobara try karo.</p>
            )}
          </div>

            {/* Right — user context (orders / homes / devices / boards):
                desktop = right column, mobile = full-screen drawer (Info button se) */}
            {showContext && (
              <>
                <div className="hidden md:block">
                  <SupportUserContext userId={selectedUserId} onClose={() => setShowContext(false)} />
                </div>
                <div
                  className="fixed inset-0 z-40 bg-night-950/70 md:hidden"
                  onClick={() => setShowContext(false)}
                >
                  <div
                    className="flex h-full w-full flex-col"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SupportUserContext userId={selectedUserId} onClose={() => setShowContext(false)} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
