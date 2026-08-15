import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bell, BellOff, CheckCheck, Pin, PinOff, Trash2 } from "lucide-react";
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
import { AttachmentPicker } from "../components/AttachmentPicker";
import { AttachmentBubble } from "../components/AttachmentBubble";

const SUBJECTS = [
  "Order / Delivery Help",
  "Product Question",
  "Warranty / Return",
  "OTA / Setup Help",
  "Device Not Working",
  "Feedback / Suggestion",
  "Other",
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  new: { label: "🆕 New", cls: "bg-blue-500/20 text-blue-700" },
  read: { label: "📖 Read", cls: "bg-amber-500/20 text-amber-600" },
  done: { label: "✅ Done", cls: "bg-green-500/20 text-green-700" },
};

export function Support() {
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

  // Notification click se aaya draft → chat input mein pre-fill + focus + scroll
  const draftFromUrl = searchParams.get("draft");
  const [draftApplied, setDraftApplied] = useState(false);
  useEffect(() => {
    if (!draftFromUrl) return;
    setChatDraft(draftFromUrl);
    setDraftApplied(true);
    setSearchParams({}, { replace: true });
    requestAnimationFrame(() => {
      chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      chatInputRef.current?.focus();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, []);

  const mySetting = chatSettings[0];

  const toggleMute = async () => {
    if (!mySetting) return;
    try {
      const s = await setMySupportSettings({ peerUserId: mySetting.peerUserId, muted: !mySetting.mutedAt });
      setChatSettings((prev) =>
        prev.map((p) => (p.peerUserId === s.peerUserId ? { ...p, mutedAt: s.mutedAt } : p)),
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
        prev.map((p) => (p.peerUserId === s.peerUserId ? { ...p, pinnedAt: s.pinnedAt } : p)),
      );
    } catch {
      /* ignore */
    }
  };

  const deleteMessage = async (id: number) => {
    if (!confirm("Apna message delete karein? (dono side se gayab)")) return;
    try {
      await deleteMySupportMessage(id);
      await refreshChat();
    } catch {
      setChatError(true);
    }
  };

  const clearChat = async () => {
    if (!confirm("Poora support chat clear karein? (dono side se gayab)")) return;
    try {
      await clearMySupportChat();
      await refreshChat();
    } catch {
      setChatError(true);
    }
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs.length]);

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

  const refreshTickets = () =>
    getMySupportTickets().then((t) => setTickets(t));

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
      setMsg({ ok: true, text: `Ticket #${t.id} mil gaya — humari team jald hi reply karegi (status: new).` });
      setForm({ subject: SUBJECTS[0], orderNumber: "", phone: "", message: "" });
      await refreshTickets();
    } catch (err) {
      setMsg({ ok: false, text: String((err as Error).message ?? err) });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-brand">🛠️ Support</span>
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        Aapke account se seedha humari team ko message — order, warranty, OTA setup, kuch bhi. Ticket number ke saath
        track ho jata hai.
      </p>

      {msg && (
        <div className={`mb-6 rounded-lg border p-4 text-sm ${msg.ok ? "border-green-500/40 bg-green-50 text-green-700" : "border-red-500/40 bg-red-50 text-red-600"}`}>
          {msg.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Form */}
        <form onSubmit={submit} className="rounded-xl border border-gray-200 bg-night-800 p-6">
          <h2 className="mb-4 text-lg font-semibold">📩 New Ticket</h2>

          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Subject</label>
          <select
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Order (optional)</label>
          <select
            value={form.orderNumber}
            onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
            className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">— Koi order nahi —</option>
            {orders.map((o) => (
              <option key={o.id} value={o.orderNumber}>{o.orderNumber} · {o.status}</option>
            ))}
          </select>

          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Phone (optional)</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+91 …"
            className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          />

          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Message *</label>
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            required
            rows={4}
            placeholder="Kya help chahiye? Device ka serial, kya hua, kab se…"
            className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          />

          <button
            type="submit"
            disabled={busy || !form.message.trim()}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Bhej rahe hain…" : "📨 Send Message"}
          </button>
        </form>

        {/* Contact info + FAQ */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-night-800 p-6 text-sm">
            <h2 className="mb-3 text-lg font-semibold">📞 Seedha baat karo</h2>
            <div className="space-y-2 text-gray-600">
              <p>📧 <span className="text-brand">support@switchnest.in</span></p>
              <p>📱 WhatsApp: <span className="text-brand">+91 98765 43210</span></p>
              <p>📍 SwitchNest Labs, Sector 62, Noida, UP 201309</p>
              <p>🕐 Mon–Sat · 9:00 AM – 7:00 PM</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-night-800 p-6 text-sm">
            <h2 className="mb-3 text-lg font-semibold">❓ Quick FAQ</h2>
            <div className="space-y-3 text-gray-600">
              <div>
                <p className="font-semibold text-night-950">Board WiFi se connect nahi ho raha?</p>
                <p className="text-gray-500">Board ke web panel me jao (AP mode me SwitchNest-IoT WiFi) → WiFi page se SSID + password daalo.</p>
              </div>
              <div>
                <p className="font-semibold text-night-950">Serial activate kaise karein?</p>
                <p className="text-gray-500">Box ke sticker ka QR scan karo ya /activate pe serial daalo → home choose → Activate.</p>
              </div>
              <div>
                <p className="font-semibold text-night-950">Firmware update kaise hota hai?</p>
                <p className="text-gray-500">Bilkul khud — hum naya version publish karte hain, board WiFi pe OTA se update ho jata hai. Koi USB nahi.</p>
              </div>
              <div>
                <p className="font-semibold text-night-950">Warranty kaise milegi?</p>
                <p className="text-gray-500">Serial claim karte hi 1 saal warranty start. 🛡️ Warranty page se claim karo.</p>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Support chat — seedha team se baat */}
      <div ref={chatSectionRef} className="mt-8 rounded-xl border border-gray-200 bg-night-800 p-6">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">💬 Support Chat</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={togglePin}
              className={`rounded-lg p-2 transition ${mySetting?.pinnedAt ? "bg-brand/15 text-brand" : "text-gray-500 hover:bg-night-700 hover:text-brand"}`}
              title={mySetting?.pinnedAt ? "Unpin" : "Pin"}
            >
              {mySetting?.pinnedAt ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
            </button>
            <button
              onClick={toggleMute}
              className={`rounded-lg p-2 transition ${mySetting?.mutedAt ? "bg-brand/15 text-brand" : "text-gray-500 hover:bg-night-700 hover:text-brand"}`}
              title={mySetting?.mutedAt ? "Unmute — notifications wapas" : "Mute — notifications band"}
            >
              {mySetting?.mutedAt ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            </button>
            <button
              onClick={clearChat}
              className="rounded-lg p-2 text-gray-500 transition hover:bg-red-500/10 hover:text-red-400"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Seedha humari team se baat karo — ticket kholne ki zaroorat nahi. Message bhejo, support reply karega (bell 🔔 me bhi pata chalega).
          {mySetting?.mutedAt && <span className="ml-2 text-gray-400">🔕 muted</span>}
        </p>
        <div className="flex h-72 flex-col gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3">
          {chatLoading && <p className="m-auto text-sm text-gray-500">Loading…</p>}
          {!chatLoading && chatMsgs.length === 0 && (
            <p className="m-auto text-sm text-gray-500">Koi message nahi — pehla message bhejo 👇</p>
          )}
          {chatMsgs.map((m) => (
            <div key={m.id} className="group relative">
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.senderRole === "user"
                    ? "self-end rounded-br-sm bg-brand text-white"
                    : "self-start rounded-bl-sm border border-gray-200 bg-white text-gray-800"
                }`}
              >
                <div className="text-[10px] font-bold uppercase opacity-70">{m.senderRole === "user" ? "Aap" : "Support"}</div>
                {m.message && <div className="whitespace-pre-wrap">{m.message}</div>}
                {m.attachmentName && m.attachmentType && m.attachmentData && (
                  <AttachmentBubble name={m.attachmentName} type={m.attachmentType} data={m.attachmentData} />
                )}
                <div className="mt-0.5 flex items-center justify-end gap-1 text-right text-[10px] opacity-60">
                  {new Date(m.createdAt).toLocaleString()}
                  {/* Read receipt — apna message: ✓ sent, ✓✓ blue = admin ne padha */}
                  {m.senderRole === "user" &&
                    (m.readByAdmin ? (
                      <CheckCheck className="h-3 w-3 text-blue-300" />
                    ) : (
                      <CheckCheck className="h-3 w-3 opacity-70" />
                    ))}
                </div>
              </div>
              {/* Apna message delete — desktop pe hover pe, mobile pe hamesha visible (touch pe hover nahi hota) */}
              {m.senderRole === "user" && (
                <button
                  onClick={() => deleteMessage(m.id)}
                  className="absolute right-0 top-0 z-10 rounded-md bg-white p-1 text-gray-500 shadow-lg opacity-0 transition hover:text-red-500 focus:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                  title="Delete message"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>
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
            placeholder="Message likho… (Enter se bhejo)"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={chatBusy || (!chatDraft.trim() && !chatAttachment)}
            className="rounded-lg bg-brand px-4 py-2 text-white disabled:opacity-40"
          >
            Send
          </button>
        </form>
        {draftApplied && chatDraft.trim() && (
          <p className="mt-2 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs text-brand">
            📝 Notification se draft tayyar hai — edit karke <b>Enter</b> dabao.
          </p>
        )}
        {chatError && <p className="mt-2 text-xs text-red-500">Bhejne me dikkat — dobara try karo.</p>}
      </div>

      {/* My tickets */}

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">🗂️ Meri Tickets ({tickets.length})</h2>
        {tickets.length === 0 ? (
          <p className="text-sm text-gray-500">Abhi koi ticket nahi — upar se naya ticket kholo.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-xl border border-gray-200 bg-night-800 p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-night-950">#{t.id} · {t.subject}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[t.status]?.cls ?? ""}`}>
                    {STATUS_BADGE[t.status]?.label ?? t.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{t.message}</p>
                <p className="mt-1 text-xs text-gray-500">{new Date(t.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
