import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bell, BellOff, CheckCheck, Pin, PinOff, Trash2, Send, MessageSquare, HelpCircle, Phone, Mail, MapPin, Clock } from "lucide-react";
import {
  submitSupport,
  getMySupportTickets,
  getMySupportChat,
  sendSupportReply,
  deleteMySupportMessage,
  clearMySupportChat,
  getMySupportSettings,
  setMySupportSettings,
  type SupportAttachment,
  type SupportChatSetting,
  type SupportMessage,
} from "../api/public";
import { getMyOrders, type Order } from "../api/shop";
import { getAttachmentUrl } from "../api/client";
import { useSiteStore } from "../stores/site";
import { getSocket } from "../lib/socket";
import { AttachmentPicker } from "../components/AttachmentPicker";
import { AttachmentBubble } from "../components/AttachmentBubble";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import { Badge } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import { Skeleton } from "../components/ui/Skeleton";

const SUBJECTS = [
  "Order / Delivery Help",
  "Product Question",
  "Warranty / Return",
  "OTA / Setup Help",
  "Device Not Working",
  "Feedback / Suggestion",
  "Other",
];

export function Support() {
  const siteSettings = useSiteStore((s) => s.settings);
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<Array<{ id: number; subject: string; message: string; status: string; createdAt: string }>>([]);
  const [form, setForm] = useState({ subject: SUBJECTS[0], orderNumber: "", phone: "", message: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // Support chat state
  const [chatMsgs, setChatMsgs] = useState<SupportMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatAttachment, setChatAttachment] = useState<SupportAttachment | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatSettings, setChatSettings] = useState<SupportChatSetting[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatSectionRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const draftFromUrl = searchParams.get("draft");
  useEffect(() => {
    if (!draftFromUrl) return;
    setChatDraft(draftFromUrl);
    setSearchParams({}, { replace: true });
    requestAnimationFrame(() => {
      chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      chatInputRef.current?.focus();
    });
  }, [draftFromUrl, setSearchParams]);

  const refreshChat = () =>
    getMySupportChat()
      .then((c) => {
        setChatMsgs(c.messages);
        setChatLoading(false);
      })
      .catch(() => setChatLoading(false));

  useEffect(() => {
    refreshChat();
    getMySupportSettings().then(setChatSettings).catch(() => {});

    const handleNewMessage = () => refreshChat();
    const activeSocket = getSocket();
    activeSocket.on("support:new", handleNewMessage);
    return () => {
      activeSocket.off("support:new", handleNewMessage);
    };
  }, []);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMsgs]);

  const mySetting = chatSettings[0];

  const toggleMute = async () => {
    if (!mySetting) return;
    try {
      const s = await setMySupportSettings({ peerUserId: mySetting.peerUserId, muted: !mySetting.mutedAt });
      setChatSettings((prev) =>
        prev.map((p) => (p.peerUserId === s.peerUserId ? { ...p, mutedAt: s.mutedAt } : p))
      );
    } catch {
      /* ignore */
    }
  };

  const togglePin = async () => {
    if (!mySetting) return;
    try {
      const s = await setMySupportSettings({ peerUserId: mySetting.peerUserId, pinned: !mySetting.pinnedAt });
      setChatSettings((prev) =>
        prev.map((p) => (p.peerUserId === s.peerUserId ? { ...p, pinnedAt: s.pinnedAt } : p))
      );
    } catch {
      /* ignore */
    }
  };

  const deleteMessage = async (id: number) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      await deleteMySupportMessage(id);
      await refreshChat();
    } catch {
      setChatError(true);
    }
  };

  const clearChat = async () => {
    if (!confirm("Are you sure you want to clear your entire support chat history?")) return;
    try {
      await clearMySupportChat();
      await refreshChat();
    } catch {
      setChatError(true);
    }
  };

  const sendChat = async (text: string, attachment: SupportAttachment | null) => {
    setChatBusy(true);
    setChatError(false);
    try {
      await sendSupportReply(text, attachment);
      setChatDraft("");
      setChatAttachment(null);
      await refreshChat();
    } catch {
      setChatError(true);
    } finally {
      setChatBusy(false);
    }
  };

  const refreshTickets = () => getMySupportTickets().then((t) => setTickets(t));

  useEffect(() => {
    Promise.all([getMyOrders().catch(() => []), refreshTickets()])
      .then(([o]) => setOrders(o))
      .catch((e) => setMsg({ ok: false, text: String((e as Error).message ?? e) }))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const t = await submitSupport({
        subject: form.subject,
        message: form.message.trim(),
        phone: form.phone.trim() || undefined,
        orderNumber: form.orderNumber || undefined,
      });
      setMsg({ ok: true, text: `Ticket #${t.id} submitted! Our support engineering team will respond shortly.` });
      setForm({ subject: SUBJECTS[0], orderNumber: "", phone: "", message: "" });
      await refreshTickets();
    } catch (err) {
      setMsg({ ok: false, text: String((err as Error).message ?? err) });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="page-enter mx-auto max-w-4xl px-4 py-12 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Help & Support Center
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Direct assistance for hardware configuration, orders, warranties, and firmware questions.
        </p>
      </div>

      {msg && (
        <div className="mb-6">
          <Alert variant={msg.ok ? "success" : "danger"} onClose={() => setMsg(null)}>
            {msg.text}
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ticket Form Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
            Submit Support Ticket
          </h2>

          <form onSubmit={submit} className="space-y-4">
            <Select
              label="Subject / Topic"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>

            <Select
              label="Related Order (Optional)"
              value={form.orderNumber}
              onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
            >
              <option value="">— No specific order —</option>
              {orders.map((o) => (
                <option key={o.id} value={o.orderNumber}>
                  #{o.orderNumber} ({o.status})
                </option>
              ))}
            </Select>

            <Input
              label="Contact Phone (Optional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />

            <Textarea
              label="Detailed Message *"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              required
              rows={4}
              placeholder="Describe what help you need or describe the issue..."
            />

            <Button
              type="submit"
              variant="primary"
              disabled={busy || !form.message.trim()}
              loading={busy}
              className="w-full"
            >
              Submit Ticket
            </Button>
          </form>
        </div>

        {/* Contact info & Quick FAQ */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">
              Direct Engineering Contacts
            </h2>
            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand shrink-0" />
                <span>{siteSettings.supportEmail || "support@switchnest.com"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-brand shrink-0" />
                <span>WhatsApp / Phone: {siteSettings.supportPhone || "+91-9999999999"}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand shrink-0" />
                <span>{siteSettings.supportAddress || "SwitchNest Lab, Sector 62, Noida"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand shrink-0" />
                <span>{siteSettings.supportHours || "Mon-Sat: 10:00 AM - 7:00 PM IST"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-brand" /> Quick FAQ
            </h2>
            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Board not connecting to WiFi?</p>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Connect to board's hotspot ("SwitchNest-IoT"), open 192.168.4.1 in browser, and save your WiFi SSID/password.
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">How do I claim a hardware serial?</p>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Scan the sticker on the box or enter the serial code on the Activate page to bind it to your home.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Support Chat Thread */}
      <div ref={chatSectionRef} className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-brand" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Live Support Chat</h2>
            {mySetting?.mutedAt && <Badge variant="neutral" size="sm">Muted</Badge>}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={togglePin}
              className={`rounded-lg p-2 transition ${
                mySetting?.pinnedAt ? "bg-brand/10 text-brand" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
              title={mySetting?.pinnedAt ? "Unpin chat" : "Pin chat"}
            >
              {mySetting?.pinnedAt ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={toggleMute}
              className={`rounded-lg p-2 transition ${
                mySetting?.mutedAt ? "bg-brand/10 text-brand" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
              title={mySetting?.mutedAt ? "Unmute notifications" : "Mute notifications"}
            >
              {mySetting?.mutedAt ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={clearChat}
              className="rounded-lg p-2 text-slate-400 hover:text-rose-500 transition-colors"
              title="Clear chat thread"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex h-72 flex-col gap-2.5 overflow-y-auto rounded-xl border border-slate-200/70 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          {chatLoading && <p className="m-auto text-xs text-slate-400">Loading conversation…</p>}
          {!chatLoading && chatMsgs.length === 0 && (
            <p className="m-auto text-xs text-slate-400">No messages yet. Send a message to start chatting with support.</p>
          )}
          {chatMsgs.map((m) => (
            <div key={m.id} className="group relative flex flex-col">
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
                  m.senderRole === "user"
                    ? "self-end rounded-br-sm bg-brand text-white shadow-sm"
                    : "self-start rounded-bl-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-sm"
                }`}
              >
                <div className="text-[10px] font-bold uppercase opacity-75 mb-0.5">
                  {m.senderRole === "user" ? "You" : "SwitchNest Support"}
                </div>
                {m.message && <div className="whitespace-pre-wrap leading-relaxed">{m.message}</div>}
                {m.attachmentName && m.attachmentType && (m.attachmentData || m.attachmentPath) && (
                  <AttachmentBubble
                    name={m.attachmentName}
                    type={m.attachmentType}
                    data={m.attachmentData}
                    url={getAttachmentUrl(m)}
                  />
                )}
                <div className="mt-1 flex items-center justify-end gap-1 text-right text-[9px] opacity-65">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {m.senderRole === "user" && (
                    <CheckCheck className={`h-3 w-3 ${m.readByAdmin ? "text-sky-300" : "opacity-75"}`} />
                  )}
                </div>
              </div>

              {m.senderRole === "user" && (
                <button
                  type="button"
                  onClick={() => deleteMessage(m.id)}
                  className="absolute right-0 top-0 rounded p-1 text-slate-400 opacity-0 transition hover:text-rose-500 group-hover:opacity-100"
                  title="Delete message"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = chatDraft.trim();
            if ((t || chatAttachment) && !chatBusy) sendChat(t, chatAttachment);
          }}
          className="mt-3 flex gap-2"
        >
          <AttachmentPicker value={chatAttachment} onChange={setChatAttachment} />
          <input
            ref={chatInputRef}
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            placeholder="Type your message to support..."
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 outline-none transition focus:border-brand dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <Button
            type="submit"
            size="sm"
            variant="primary"
            disabled={chatBusy || (!chatDraft.trim() && !chatAttachment)}
            loading={chatBusy}
            rightIcon={<Send className="h-3.5 w-3.5" />}
          >
            Send
          </Button>
        </form>
        {chatError && <p className="mt-2 text-xs text-rose-500">Failed to send message. Please try again.</p>}
      </div>

      {/* Ticket History */}
      <div className="mt-8">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">
          Your Support Tickets ({tickets.length})
        </h2>
        {tickets.length === 0 ? (
          <p className="text-xs text-slate-400">No active support tickets.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                      #{t.id} · {t.subject}
                    </span>
                    <Badge variant={t.status === "done" ? "success" : t.status === "read" ? "info" : "warning"} size="sm">
                      {t.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {t.message}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {new Date(t.createdAt).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
