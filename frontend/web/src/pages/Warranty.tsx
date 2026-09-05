import { useEffect, useState } from "react";
import {
  fileWarrantyClaim,
  getMyWarranty,
  type WarrantyClaimRow,
  type WarrantyDevice,
} from "../api/shop";

const CLAIM_BADGE: Record<string, { label: string; cls: string }> = {
  submitted: { label: "🕐 Submitted", cls: "bg-amber-500/20 text-amber-600" },
  approved: { label: "✅ Approved", cls: "bg-green-500/20 text-green-700" },
  rejected: { label: "❌ Rejected", cls: "bg-red-500/20 text-red-600" },
  resolved: { label: "🔧 Resolved", cls: "bg-blue-500/20 text-blue-700" },
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

  if (loading) return <div className="p-10 text-center text-gray-500">Loading…</div>;

  return (
    <div className="page-enter mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-brand">🛡️ Warranty</span>
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        Serial claim ke din se <span className="text-brand">1 saal</span> ki warranty. Koi device kharab ho to
        claim file karo — support team approve karke resolution dega.
      </p>

      {msg && (
        <div className={`mb-6 rounded-lg border p-4 text-sm ${msg.ok ? "border-green-500/40 bg-green-900/30 text-green-700" : "border-red-500/40 bg-red-900/30 text-red-600"}`}>
          {msg.text}
        </div>
      )}


      {/* Claim form */}
      <h2 className="mb-3 text-xl font-bold">File a Warranty Claim</h2>
      <form onSubmit={submit} className="mb-8 rounded-xl border border-brand/20 bg-night-800 p-6">
        <label className="mb-1 block text-sm text-gray-500">Serial Code *</label>
        <select
          value={form.serialCode}
          onChange={(e) => setForm((f) => ({ ...f, serialCode: e.target.value }))}
          required
          className="mb-4 w-full rounded-lg border border-brand/30 bg-night-700 px-3 py-2 text-sm text-night-950"
        >
          <option value="">— choose device —</option>
          {serials.map((s) => (
            <option key={s.serialCode} value={s.serialCode}>
              {s.serialCode} · {s.product?.name ?? s.productName}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-sm text-gray-500">Reason *</label>
        <select
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          className="mb-4 w-full rounded-lg border border-brand/30 bg-night-700 px-3 py-2 text-sm text-night-950"
        >
          <option value="not_working">🔴 Device not working</option>
          <option value="relay_fault">⚡ Relay/switch fault</option>
          <option value="wifi_issue">📶 WiFi/connectivity issue</option>
          <option value="ota_bricked">🔄 OTA update ke baad problem</option>
          <option value="power_damage">🔌 Power damage (over-voltage etc.)</option>
          <option value="other">Other</option>
        </select>

        <label className="mb-1 block text-sm text-gray-500">Description (optional)</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={3}
          placeholder="Kya problem hai — kab se, kya kiya try…"
          className="mb-4 w-full rounded-lg border border-brand/30 bg-night-700 px-3 py-2 text-sm text-night-950"
        />

        <button
          type="submit"
          disabled={busy || !form.serialCode}
          className="rounded-lg bg-brand px-6 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Filing…" : "📨 File Warranty Claim"}
        </button>
      </form>

      {/* My claims */}
      <h2 className="mb-3 text-xl font-bold">My Claims ({claims.length})</h2>
      {claims.length === 0 ? (
        <div className="rounded-xl border border-brand/20 bg-night-800 p-8 text-center text-sm text-gray-500">
          Koi claim nahi abhi.
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => {
            const badge = CLAIM_BADGE[c.status] ?? CLAIM_BADGE.submitted;
            return (
              <div key={c.id} className="rounded-xl border border-brand/20 bg-night-800 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm text-brand">{c.serialCode}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="text-gray-500">Reason:</span> {c.reason}
                </div>
                {c.description && <div className="mt-1 text-sm text-gray-500">{c.description}</div>}
                <div className="mt-2 text-xs text-gray-500">{new Date(c.createdAt).toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
