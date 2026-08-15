import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { claimDevice, getClaimHomes } from "../api/shop";

export function Activate() {
  const [params] = useSearchParams();
  const [serialCode, setSerialCode] = useState(params.get("serial") ?? "");
  const [homes, setHomes] = useState<Array<{ id: number; name: string }>>([]);
  const [homeId, setHomeId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ device: { id: number; name: string }; serialCode: string } | null>(null);

  useEffect(() => {
    getClaimHomes()
      .then((hs) => {
        setHomes(hs);
        if (hs.length === 1) setHomeId(hs[0].id);
      })
      .catch(() => setError("Homes load nahi hue — login check karo."));
  }, []);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!serialCode.trim() || !homeId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await claimDevice(serialCode.trim().toUpperCase(), Number(homeId));
      setResult(res);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg ?? "Claim fail ho gaya — serial code check karo.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mb-4 text-6xl">🎉</div>
        <h1 className="mb-2 text-3xl font-bold">Device Activated!</h1>
        <p className="mb-4 text-gray-500">
          <span className="font-semibold text-night-950">{result.device.name}</span> aapke home me add ho gaya.
        </p>
        <code className="rounded bg-night-700 px-3 py-1 text-sm text-brand">{result.serialCode}</code>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/dashboard" className="rounded-lg bg-gradient-to-r from-brand to-brand-light px-6 py-3 font-semibold text-white">
            Dashboard kholo
          </Link>
          <Link to="/orders" className="rounded-lg border-2 border-brand-light px-6 py-3 font-semibold text-brand hover:bg-brand-light hover:text-white">
            Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">🔑 Activate Device</span>
      </h1>
      <p className="mb-8 text-sm text-gray-500">
        Box pe laga sticker se serial code daalo — device aapke home me add ho jayega aur aapke account se permanently linked.
      </p>

      <form onSubmit={handleClaim} className="space-y-5 rounded-xl border border-brand/20 bg-night-800 p-6">
        <div>
          <label className="mb-1 block text-sm text-gray-500">Serial code (box pe sticker)</label>
          <input
            value={serialCode}
            onChange={(e) => setSerialCode(e.target.value.toUpperCase())}
            placeholder="RS-4CH-XXXXXX"
            required
            className="w-full rounded-lg border border-night-600 bg-night-900 px-3 py-3 font-mono text-lg tracking-widest"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-500">Home (device kahan add hoga)</label>
          {homes.length === 0 ? (
            <p className="text-sm text-gray-500">
              Koi home nahi mila — <Link to="/homes" className="text-brand underline">home banao</Link> pehle.
            </p>
          ) : (
            <select
              value={homeId}
              onChange={(e) => setHomeId(Number(e.target.value))}
              required
              className="w-full rounded-lg border border-night-600 bg-night-900 px-3 py-3 text-sm"
            >
              <option value="" disabled>Home choose karo</option>
              {homes.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          )}
        </div>

        {error && <div className="rounded bg-red-900/40 p-3 text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={busy || !homeId}
          className="w-full rounded-lg bg-gradient-to-r from-brand to-brand-light px-4 py-3 font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
        >
          {busy ? "Activating…" : "Activate Device"}
        </button>
      </form>
    </div>
  );
}
