import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { claimDevice, getClaimHomes } from "../api/shop";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Key, CheckCircle2, ArrowRight, Home as HomeIcon } from "lucide-react";

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
      .catch(() => setError("Failed to load family homes. Please verify your login session."));
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
      setError(msg ?? "Activation failed. Please check the serial code.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="page-enter mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl mb-2">
          Device Activated!
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          <span className="font-semibold text-slate-900 dark:text-white">{result.device.name}</span> has been securely bound to your home.
        </p>
        <code className="inline-block rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1 font-mono text-sm font-semibold text-brand mb-8">
          {result.serialCode}
        </code>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/dashboard">
            <Button variant="primary" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Open Dashboard
            </Button>
          </Link>
          <Link to="/orders">
            <Button variant="outline">View Orders</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-brand font-bold text-xs uppercase tracking-wider mb-1">
          <Key className="h-4 w-4" />
          <span>Hardware Registration</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Activate Your Device
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Enter the cryptographic serial code from the sticker on your hardware box.
        </p>
      </div>

      {error && (
        <div className="mb-6">
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      <form
        onSubmit={handleClaim}
        className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4"
      >
        <Input
          label="Serial Code *"
          value={serialCode}
          onChange={(e) => setSerialCode(e.target.value.toUpperCase())}
          placeholder="e.g. SN-4CH-XXXXXX"
          required
          className="font-mono text-base tracking-wider uppercase"
        />

        {homes.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            No family home found. Please{" "}
            <Link to="/homes" className="font-semibold underline">
              create a home
            </Link>{" "}
            first before activating hardware.
          </div>
        ) : (
          <Select
            label="Select Home *"
            value={homeId}
            onChange={(e) => setHomeId(Number(e.target.value))}
            required
          >
            <option value="" disabled>
              — Select Destination Home —
            </option>
            {homes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={busy || !homeId || !serialCode.trim()}
          loading={busy}
          className="w-full"
          leftIcon={<HomeIcon className="h-4 w-4" />}
        >
          Activate & Link to Home
        </Button>
      </form>
    </div>
  );
}
