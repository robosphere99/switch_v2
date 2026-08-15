import { useEffect, useState } from "react";
import { submitSupport, getMySupportTickets } from "../api/public";
import { getMyOrders, type Order } from "../api/shop";

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<Array<{ id: number; subject: string; message: string; status: string; createdAt: string }>>([]);
  const [form, setForm] = useState({ subject: SUBJECTS[0], orderNumber: "", phone: "", message: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

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
        <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">🛠️ Support</span>
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        Aapke account se seedha humari team ko message — order, warranty, OTA setup, kuch bhi. Ticket number ke saath
        track ho jata hai.
      </p>

      {msg && (
        <div className={`mb-6 rounded-lg border p-4 text-sm ${msg.ok ? "border-green-500/40 bg-green-900/30 text-green-700" : "border-red-500/40 bg-red-900/30 text-red-600"}`}>
          {msg.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Form */}
        <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-semibold">📩 New Ticket</h2>

          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Subject</label>
          <select
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="mb-4 w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm"
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Order (optional)</label>
          <select
            value={form.orderNumber}
            onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
            className="mb-4 w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm"
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
            className="mb-4 w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm"
          />

          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Message *</label>
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            required
            rows={4}
            placeholder="Kya help chahiye? Device ka serial, kya hua, kab se…"
            className="mb-4 w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm"
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
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm">
            <h2 className="mb-3 text-lg font-semibold">📞 Seedha baat karo</h2>
            <div className="space-y-2 text-gray-600">
              <p>📧 <span className="text-brand">support@switchnest.in</span></p>
              <p>📱 WhatsApp: <span className="text-brand">+91 98765 43210</span></p>
              <p>📍 SwitchNest Labs, Sector 62, Noida, UP 201309</p>
              <p>🕐 Mon–Sat · 9:00 AM – 7:00 PM</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm">
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

      {/* My tickets */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">🗂️ Meri Tickets ({tickets.length})</h2>
        {tickets.length === 0 ? (
          <p className="text-sm text-gray-500">Abhi koi ticket nahi — upar se naya ticket kholo.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
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
