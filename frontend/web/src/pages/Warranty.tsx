import { useEffect, useState } from "react";
import {
  fileWarrantyClaim,
  getMyWarranty,
  type WarrantyClaimRow,
  type WarrantyDevice,
} from "../api/shop";
import { Select } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { ShieldCheck, ShieldAlert, CheckCircle2 } from "lucide-react";

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
      setMsg({ ok: true, text: `Warranty claim #${c.id} submitted successfully! Our support engineering team will review it.` });
      setForm({ serialCode: "", reason: "not_working", description: "" });
      await refresh();
    } catch (err) {
      setMsg({ ok: false, text: String((err as Error).message ?? err) });
    } finally {
      setBusy(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "approved":
      case "resolved":
        return "success";
      case "rejected":
        return "danger";
      case "submitted":
      default:
        return "warning";
    }
  };

  if (loading) {
    return (
      <div className="page-enter mx-auto max-w-4xl px-4 py-10 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Hardware Warranty & Claims
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Every activated SwitchNest board includes a 1-year factory warranty covering relay, component, or connectivity failures.
        </p>
      </div>

      {msg && (
        <div className="mb-6">
          <Alert variant={msg.ok ? "success" : "danger"} onClose={() => setMsg(null)}>
            {msg.text}
          </Alert>
        </div>
      )}

      {/* Claim Form Card */}
      <div className="mb-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 dark:bg-brand/15 text-brand">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              File a Warranty Service Claim
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select your registered device and describe the hardware issue.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Select
            label="Select Registered Device *"
            value={form.serialCode}
            onChange={(e) => setForm((f) => ({ ...f, serialCode: e.target.value }))}
            required
          >
            <option value="">— Select device by serial —</option>
            {serials.map((s) => (
              <option key={s.serialCode} value={s.serialCode}>
                {s.serialCode} · {s.product?.name ?? s.productName}
              </option>
            ))}
          </Select>

          <Select
            label="Issue Category *"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          >
            <option value="not_working">Appliance does not power on</option>
            <option value="relay_fault">Relay / physical switch fault</option>
            <option value="wifi_issue">WiFi / network drops</option>
            <option value="ota_bricked">Issue after OTA firmware update</option>
            <option value="power_damage">Electrical surge / voltage damage</option>
            <option value="other">Other issue</option>
          </Select>

          <Textarea
            label="Detailed Description (Optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            placeholder="When did the issue start? Have you tried power cycling the unit?"
          />

          <Button
            type="submit"
            variant="primary"
            disabled={busy || !form.serialCode}
            loading={busy}
            className="w-full"
            leftIcon={<ShieldCheck className="h-4 w-4" />}
          >
            Submit Warranty Claim
          </Button>
        </form>
      </div>

      {/* Claims List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Your Warranty Claims ({claims.length})
          </h2>
        </div>

        {claims.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
            title="No Active Claims"
            description="You don't have any pending warranty claims. All registered hardware is operating normally."
          />
        ) : (
          <div className="space-y-3">
            {claims.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold text-brand bg-brand/10 px-2 py-1 rounded-lg">
                    {c.serialCode}
                  </span>
                  <Badge variant={getStatusBadgeVariant(c.status)} dot>
                    {c.status.toUpperCase()}
                  </Badge>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-400">Category:</span> {c.reason}
                </div>

                {c.description && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {c.description}
                  </p>
                )}

                <div className="mt-2 text-[10px] text-slate-400">
                  Submitted on {new Date(c.createdAt).toLocaleDateString("en-IN")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
