import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { listHomes } from "../api/homes";
import { listApiKeys, createApiKey, revokeApiKey } from "../api/keys";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Key, Plus, Copy, Check, Trash2, Cpu, Calendar, ShieldAlert } from "lucide-react";

export function DeviceKeys() {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [homeId, setHomeId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("365");
  const [created, setCreated] = useState<{ rawKey: string; keyPrefix: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const homes = useQuery({ queryKey: ["homes"], queryFn: listHomes, refetchInterval: 30_000 });
  const keys = useQuery({ queryKey: ["api-keys"], queryFn: listApiKeys, refetchInterval: 30_000 });

  const create = useMutation({
    mutationFn: () =>
      createApiKey({
        label: label || undefined,
        homeId: homeId ? Number(homeId) : undefined,
        expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
      }),
    onSuccess: (res) => {
      if (res.success) {
        setCreated({ rawKey: res.data.rawKey!, keyPrefix: res.data.keyPrefix });
        setLabel("");
        queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      } else {
        setError(res.error.message);
      }
    },
    onError: () => setError("Failed to generate API key"),
  });

  const revoke = useMutation({
    mutationFn: (id: number) => revokeApiKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
    onError: () => setError("Failed to revoke key"),
  });

  function copyKey() {
    if (!created) return;
    navigator.clipboard?.writeText(created.rawKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="page-enter mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Hardware API Keys
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Hardware keys authenticate ESP32 relay controllers with the SwitchNest cloud. Keys are scoped per home.
        </p>
      </div>

      {error && (
        <div className="mb-6">
          <Alert variant="danger" onClose={() => setError("")}>
            {error}
          </Alert>
        </div>
      )}

      {/* Create Card */}
      <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 dark:bg-brand/15 text-brand">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Generate New Hardware Key
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provide a label and associate with one of your family homes.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Input
              label="Key Label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Living Room 4CH Board or Kitchen Controller"
            />
          </div>

          <div>
            <Select
              label="Associated Home *"
              value={homeId}
              onChange={(e) => setHomeId(e.target.value)}
            >
              <option value="">— Select Home —</option>
              {homes.data?.success &&
                homes.data.data.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
            </Select>
          </div>

          <div>
            <Select
              label="Validity Duration"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
            >
              <option value="30">30 Days</option>
              <option value="90">90 Days</option>
              <option value="365">1 Year (Recommended)</option>
              <option value="3650">10 Years (Permanent)</option>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={() => create.mutate()}
              disabled={!homeId || create.isPending}
              loading={create.isPending}
              variant="primary"
              className="w-full"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Generate Key
            </Button>
          </div>
        </div>

        {/* Revealed Key Banner */}
        {created && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
            <div className="flex items-start gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Copy and store this secret key now. For your security, it will never be displayed again!</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 select-all overflow-x-auto rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-slate-900 dark:text-emerald-300">
                {created.rawKey}
              </code>
              <Button
                size="sm"
                variant="primary"
                onClick={copyKey}
                leftIcon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Keys List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Active Hardware Keys
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {keys.data?.success ? `${keys.data.data.length} keys` : ""}
          </span>
        </div>

        {keys.isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <Skeleton className="h-5 w-1/3 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!keys.isLoading && keys.data?.success && keys.data.data.length === 0 && (
          <EmptyState
            icon={<Key className="h-8 w-8 text-slate-400" />}
            title="No API Keys Generated"
            description="You haven't generated any hardware API keys yet. Create one above to link an ESP32 board."
          />
        )}

        {keys.data?.success &&
          keys.data.data.map((k) => (
            <div
              key={k.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-bold text-brand bg-brand/10 dark:bg-brand/15 px-2.5 py-1 rounded-lg">
                    {k.keyPrefix}…
                  </span>
                  {k.label && (
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">
                      {k.label}
                    </span>
                  )}
                  {k.home && (
                    <Badge variant="neutral" size="sm">
                      {k.home.name}
                    </Badge>
                  )}
                </div>

                {k.espDevices && k.espDevices.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Cpu className="h-3.5 w-3.5 text-slate-400" />
                    <span>Linked to:</span>
                    {k.espDevices.map((esp, i) => (
                      <span key={esp.id}>
                        <Link
                          to={`/boards#board-${esp.id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {esp.name || esp.serialCode || `Board #${esp.id}`}
                        </Link>
                        {i < k.espDevices!.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created {new Date(k.createdAt).toLocaleDateString("en-IN")}
                  </span>
                  {k.expiresAt && (
                    <span>· Expires {new Date(k.expiresAt).toLocaleDateString("en-IN")}</span>
                  )}
                  {k.lastUsedAt && (
                    <span>· Last used {new Date(k.lastUsedAt).toLocaleString("en-IN")}</span>
                  )}
                </div>
              </div>

              <div className="self-end sm:self-center">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (confirm("Revoke this key? Hardware controllers using it will immediately lose cloud connectivity.")) {
                      revoke.mutate(k.id);
                    }
                  }}
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Revoke
                </Button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
