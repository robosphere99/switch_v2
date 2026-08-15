import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listHomes } from "../api/homes";
import { listApiKeys, createApiKey, revokeApiKey } from "../api/keys";

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
  });

  const revoke = useMutation({
    mutationFn: (id: number) => revokeApiKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  function copyKey() {
    if (!created) return;
    navigator.clipboard?.writeText(created.rawKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">🔑 Device Keys</h1>
      <p className="mb-8 text-sm text-gray-500">
        These keys let your ESP32 hardware talk to the API. Keys are scoped to one home and are
        shown <span className="text-amber-600">only once</span> at creation — save them safely.
      </p>

      {error && (
        <p className="mb-4 rounded bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {/* Create */}
      <div className="mb-8 rounded-xl border border-brand/20 bg-night-800 p-5">
        <h2 className="mb-4 font-semibold">➕ Create a device key</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. ESP32 Living Room)"
            className="rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand sm:col-span-2"
          />
          <select
            value={homeId}
            onChange={(e) => setHomeId(e.target.value)}
            className="rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
          >
            <option value="">— select home —</option>
            {homes.data?.success &&
              homes.data.data.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
          </select>
          <select
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            className="rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
          >
            <option value="30">30 days</option>
            <option value="365">1 year</option>
            <option value="3650">10 years</option>
          </select>
          <button
            onClick={() => create.mutate()}
            disabled={!homeId || create.isPending}
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Generate Key
          </button>
        </div>

        {created && (
          <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
            <p className="text-sm font-semibold text-emerald-400">
              ⚠️ Copy this key now — it will never be shown again!
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 select-all overflow-x-auto rounded bg-night-900 px-3 py-2 text-sm text-emerald-300">
                {created.rawKey}
              </code>
              <button
                onClick={copyKey}
                className="rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="rounded-xl border border-gray-200 bg-night-800 p-5">
        <h2 className="mb-4 font-semibold">
          Your keys <span className="text-sm font-normal text-gray-500">({keys.data?.success ? keys.data.data.length : "…"})</span>
        </h2>
        {keys.data?.success && keys.data.data.length === 0 && (
          <p className="text-sm text-gray-500">No keys yet. Create one above.</p>
        )}
        <div className="space-y-2">
          {keys.data?.success &&
            keys.data.data.map((k) => (
              <div
                key={k.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-night-900 px-4 py-2.5 text-sm"
              >
                <div>
                  <span className="font-mono text-xs text-brand">{k.keyPrefix}…</span>
                  {k.label && <span className="ml-2 text-gray-600">{k.label}</span>}
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    created {new Date(k.createdAt).toLocaleDateString()}
                    {k.expiresAt && ` · expires ${new Date(k.expiresAt).toLocaleDateString()}`}
                    {k.lastUsedAt && ` · last used ${new Date(k.lastUsedAt).toLocaleString()}`}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Revoke this key? Devices using it will lose access.")) {
                      revoke.mutate(k.id);
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Revoke
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
