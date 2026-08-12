import { useEffect, useState } from "react";
import {
  fileWarrantyClaim,
  getMyWarranty,
  type WarrantyClaimRow,
  type WarrantyDevice,
} from "../api/shop";

const CLAIM_BADGE: Record<string, { label: string; cls: string }> = {
  submitted: { label: "🕐 Submitted", cls: "bg-amber-500/20 text-amber-300" },
  approved: { label: "✅ Approved", cls: "bg-green-500/20 text-green-300" },
  rejected: { label: "❌ Rejected", cls: "bg-red-500/20 text-red-300" },
  resolved: { label: "🔧 Resolved", cls: "bg-blue-500/20 text-blue-300" },
};

const STATUS_LABEL: Record<string, string> = {
  active: "🟢 Active",
  claimed: "🟠 Claim Filed",
  closed: "⚪ Closed",
};

export function Warranty() {
  const [serials, setSerials] = useState<WarrantyDevice[]>([]);
  const [claims, setClaims] = useState<WarrantyClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ serialCode: "", reason: "not_working", description: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    getMyWarranty().then((d) => {
      setSerials(d.serials);
      setClaims(d.claims);
    });

  useEffect(() => {
    refresh()
      .catch((e) => setMsg({ ok: false, text: String((e as Error).message ?? e) }))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const c = await fileWarrantyClaim({
        serialCode: form.serialCode.trim().toUpperCase(),
        reason: form.reason,
        description: form.description.trim() || undefined,
      });
      setMsg({ ok: true, text: `Claim #${c.id} filed — support team review karega.` });
      setForm({ serialCode: "", reason: "not_working", description: "" });
      await refresh();
    } catch (err) {
      setMsg({ ok: false, text: String((err as Error).message ?? err) });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">🛡️ Warranty</span>
      </h1>
      <p className="mb-6 text-sm text-gray-400">
        Serial claim ke din se <span className="text-brand-light">1 saal</span> ki warranty. Koi device kharab ho to
        claim file karo — support team approve karke resolution dega.
      </p>

      {msg && (
        <div className={`mb-6 rounded-lg border p-4 text-sm ${msg.ok ? "border-green-500/40 bg-green-900/30 text-green-300" : "border-red-500/40 bg-red-900/30 text-red-300"}`}>
          {msg.text}
        </div>
      )}

      {/* My devices */}
      <h2 className="mb-3 text-xl font-bold">Meri Devices ({serials.length})</h2>
      {serials.length === 0 ? (
        <div className="rounded-xl border border-brand/20 bg-night-800 p-8 text-center text-sm text-gray-400">
          Koi claimed device nahi. <a href="/activate" className="text-brand-light underline">Serial activate karo</a>.
        </div>
      ) : (
        <div className="mb-8 space-y-3">
          {serials.map((s) => (
            <div key={s.serialCode} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/20 bg-night-800 p-4">
              <div>
                <div className="font-bold text-white">{s.product?.name ?? s.productName}</div>
                <div className="text-xs text-gray-500">
                  <code className="text-brand-light">{s.serialCode}</code> · {s.product?.modelCode ?? s.modelCode}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-semibold ${STATUS_LABEL[s.warrantyStatus]?.startsWith("🟢") ? "text-green-400" : "text-amber-400"}`}>
                  {STATUS_LABEL[s.warrantyStatus] ?? s.warrantyStatus}
                </div>
                <div className="text-xs text-gray-500">
                  {s.warrantyExpiresAt ? `expires ${new Date(s.warrantyExpiresAt).toLocaleDateString()}` : "no expiry set"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Claim form */}
      <h2 className="mb-3 text-xl font-bold">Naya Warranty Claim</h2>
      <form onSubmit={submit} className="mb-8 rounded-xl border border-brand/20 bg-night-800 p-6">
        <label className="mb-1 block text-sm text-gray-400">Serial Code *</label>
        <select
          value={form.serialCode}
          onChange={(e) => setForm((f) => ({ ...f, serialCode: e.target.value }))}
          required
          className="mb-4 w-full rounded-lg border border-brand/30 bg-night-700 px-3 py-2 text-sm text-white"
        >
          <option value="">— choose device —</option>
          {serials.map((s) => (
            <option key={s.serialCode} value={s.serialCode}>
              {s.serialCode} · {s.product?.name ?? s.productName}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-sm text-gray-400">Reason *</label>
        <select
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          className="mb-4 w-full rounded-lg border border-brand/30 bg-night-700 px-3 py-2 text-sm text-white"
        >
          <option value="not_working">🔴 Device not working</option>
          <option value="relay_fault">⚡ Relay/switch fault</option>
          <option value="wifi_issue">📶 WiFi/connectivity issue</option>
          <option value="ota_bricked">🔄 OTA update ke baad problem</option>
          <option value="power_damage">🔌 Power damage (over-voltage etc.)</option>
          <option value="other">Other</option>
        </select>

        <label className="mb-1 block text-sm text-gray-400">Description (optional)</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={3}
          placeholder="Kya problem hai — kab se, kya kiya try…"
          className="mb-4 w-full rounded-lg border border-brand/30 bg-night-700 px-3 py-2 text-sm text-white"
        />

        <button
          type="submit"
          disabled={busy || !form.serialCode}
          className="rounded-lg bg-gradient-to-r from-brand to-brand-light px-6 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Filing…" : "📨 File Warranty Claim"}
        </button>
      </form>

      {/* My claims */}
      <h2 className="mb-3 text-xl font-bold">Meri Claims ({claims.length})</h2>
      {claims.length === 0 ? (
        <div className="rounded-xl border border-brand/20 bg-night-800 p-8 text-center text-sm text-gray-400">
          Koi claim nahi abhi.
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => {
            const badge = CLAIM_BADGE[c.status] ?? CLAIM_BADGE.submitted;
            return (
              <div key={c.id} className="rounded-xl border border-brand/20 bg-night-800 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm text-brand-light">{c.serialCode}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="text-sm text-gray-300">
                  <span className="text-gray-500">Reason:</span> {c.reason}
                </div>
                {c.description && <div className="mt-1 text-sm text-gray-400">{c.description}</div>}
                <div className="mt-2 text-xs text-gray-500">{new Date(c.createdAt).toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
