import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getStats,
  listUsers,
  setUserStatus,
  setUserRole,
  deleteUser,
  listAllHomes,
  getHomeDetail,
  setHomeStatus,
  deleteHome,
  listAllDevices,
  listAllApiKeys,
  deleteApiKey,
  listAuditLogs,
  getEspDevices,
  getFirmwareList,
  uploadFirmware,
  activateFirmware,
  pushOta,
  pushOtaAll,
  probeEsp,
  type AdminHomeDetail,
  type EspBoard,
} from "../api/admin";
import { Modal } from "../components/Modal";
import { AdminShop } from "../components/AdminShop";
import { getSocket } from "../lib/socket";

type Tab = "overview" | "users" | "homes" | "devices" | "keys" | "audit" | "ota" | "shop";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "📊 Overview" },
  { id: "users", label: "👤 Users" },
  { id: "homes", label: "🏠 Homes" },
  { id: "devices", label: "💡 Devices" },
  { id: "ota", label: "🛰️ OTA / ESP" },
  { id: "shop", label: "🛒 Shop / Orders" },
  { id: "keys", label: "🔑 API Keys" },
  { id: "audit", label: "📜 Audit Log" },
];

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${color}`}>
      {children}
    </span>
  );
}

export function Admin() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [q, setQ] = useState("");
  const [viewHome, setViewHome] = useState<AdminHomeDetail | null>(null);
  const [fwFile, setFwFile] = useState<File | null>(null);
  const [fwVersion, setFwVersion] = useState("");
  const [fwModel, setFwModel] = useState("");
  const [fwNotes, setFwNotes] = useState("");
  const [otaMsg, setOtaMsg] = useState<string | null>(null);

  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: getStats, refetchInterval: 15_000 });
  const users = useQuery({ queryKey: ["admin-users", q], queryFn: () => listUsers(q || undefined), refetchInterval: 15_000 });
  const homes = useQuery({ queryKey: ["admin-homes", q], queryFn: () => listAllHomes(q || undefined), refetchInterval: 15_000 });
  const devices = useQuery({ queryKey: ["admin-devices", q], queryFn: () => listAllDevices(q || undefined), refetchInterval: 10_000 });
  const keys = useQuery({ queryKey: ["admin-keys"], queryFn: listAllApiKeys, refetchInterval: 30_000 });
  const audit = useQuery({ queryKey: ["admin-audit"], queryFn: () => listAuditLogs(), refetchInterval: 15_000 });
  const esp = useQuery({ queryKey: ["admin-esp"], queryFn: getEspDevices, refetchInterval: 10_000 });
  const fw = useQuery({ queryKey: ["admin-firmware"], queryFn: getFirmwareList, refetchInterval: 30_000 });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-"] });
  };

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "active" | "suspended" }) => setUserStatus(id, status),
    onSuccess: invalidate,
  });
  const role = useMutation({
    mutationFn: ({ id, r }: { id: number; r: "user" | "system_admin" }) => setUserRole(id, r),
    onSuccess: invalidate,
  });
  const delUser = useMutation({
    mutationFn: deleteUser,
    onSuccess: invalidate,
  });
  const setHomeStatusM = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "active" | "suspended" }) => setHomeStatus(id, status),
    onSuccess: invalidate,
  });
  const delHome = useMutation({
    mutationFn: deleteHome,
    onSuccess: invalidate,
  });
  const delKey = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: invalidate,
  });
  const publishFw = useMutation({
    mutationFn: uploadFirmware,
    onSuccess: invalidate,
  });
  const activateFw = useMutation({
    mutationFn: activateFirmware,
    onSuccess: invalidate,
  });
  const pushOtaM = useMutation({
    mutationFn: pushOta,
    onSuccess: invalidate,
  });
  const pushAllM = useMutation({
    mutationFn: pushOtaAll,
    onSuccess: invalidate,
  });

  // ESP reachability probe — IP click se pehle quick HTTP check.
  const PROBE_TTL_MS = 60_000;
  const [probes, setProbes] = useState<Record<number, { state: "probing" | "ok" | "fail"; at: number; latencyMs?: number }>>({});

  // Live OTA progress — ESP report karta hai (Update.onProgress -> server), socket se UI me.
  const [liveOta, setLiveOta] = useState<Record<number, { progress: number; status: string }>>({});

  useEffect(() => {
    const socket = getSocket();
    const handler = (d: { id: number; otaProgress?: number | null; otaStatus?: string | null }) => {
      if (d && typeof d.id === "number" && d.otaStatus) {
        const status: string = d.otaStatus;
        setLiveOta((prev) => ({ ...prev, [d.id]: { progress: d.otaProgress ?? 0, status } }));
      } else if (d && typeof d.id === "number") {
        setLiveOta((prev) => {
          const next = { ...prev };
          delete next[d.id];
          return next;
        });
      }
    };
    socket.on("esp:updated", handler);
    return () => {
      socket.off("device:updated", handler);
    };
  }, []);

  const handleIpClick = async (e: React.MouseEvent<HTMLAnchorElement>, d: EspBoard) => {
    const ip = d.ipAddress;
    if (!ip) return;
    e.preventDefault();
    const existing = probes[d.id];
    if (existing?.state === "probing") return;
    if (existing && Date.now() - existing.at < PROBE_TTL_MS) {
      if (existing.state === "ok") window.open(`http://${ip}`, "_blank", "noopener,noreferrer");
      return;
    }
    setProbes((p) => ({ ...p, [d.id]: { state: "probing", at: Date.now() } }));
    const started = Date.now();
    const r = await probeEsp(d.id);
    const ok = r.success && r.data.reachable;
    setProbes((p) => ({
      ...p,
      [d.id]: {
        state: ok ? "ok" : "fail",
        at: Date.now(),
        latencyMs: r.success ? r.data.latencyMs : Date.now() - started,
      },
    }));
    if (ok) window.open(`http://${ip}`, "_blank", "noopener,noreferrer");
  };

  const s = stats.data?.success ? stats.data.data : null;
  const statCards = s
    ? [
        { label: "Total Users", value: s.users, icon: "👤", sub: `${s.activeToday} active today` },
        { label: "Homes", value: s.homes, icon: "🏠", sub: "platform-wide" },
        { label: "Devices", value: s.devices, icon: "💡", sub: `${s.onlineDevices} online now` },
        { label: "Pending Commands", value: s.pendingCommands, icon: "⚡", sub: "awaiting ESP32" },
        { label: "API Keys", value: s.apiKeys, icon: "🔑", sub: "device access" },
        { label: "Audit Events", value: s.auditCount, icon: "📜", sub: "tracked actions" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-3xl font-bold">🛡️ Admin Panel</h1>
          <p className="text-sm text-gray-400">Platform-wide management (system admin only).</p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Search users / homes / devices…"
          className="w-64 rounded-lg border border-brand/20 bg-night-800 px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>

      {/* Tabs */}
      <div className="mb-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "border-brand bg-brand/20 text-brand-light"
                : "border-gray-700 bg-night-800 text-gray-300 hover:border-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {statCards.map((c) => (
              <div key={c.label} className="rounded-xl border border-gray-700 bg-night-800 p-6">
                <div className="text-3xl">{c.icon}</div>
                <div className="mt-3 text-3xl font-bold">{c.value}</div>
                <div className="text-sm font-medium text-gray-200">{c.label}</div>
                <div className="text-xs text-gray-500">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Recent audit activity */}
          <div className="rounded-xl border border-gray-700 bg-night-800 p-5">
            <h2 className="mb-4 font-semibold">🕒 Recent activity</h2>
            <div className="space-y-2">
              {(audit.data?.success ? audit.data.data.slice(0, 8) : []).map((log) => (
                <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-700 bg-night-900 px-4 py-2 text-sm">
                  <div>
                    <Badge color="border-brand/40 text-brand-light">{log.action}</Badge>
                    {log.entity && (
                      <span className="ml-2 text-xs text-gray-400">
                        {log.entity}{log.entityId ? ` #${log.entityId}` : ""}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-500">
                    {log.actor ? log.actor.username : "system"} · {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
              {audit.data?.success && audit.data.data.length === 0 && (
                <p className="text-sm text-gray-500">No audit events yet — actions will be tracked here.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="rounded-xl border border-gray-700 bg-night-800 p-5">
          <h2 className="mb-4 font-semibold">
            Users <span className="text-sm font-normal text-gray-500">({users.data?.success ? users.data.data.length : "…"})</span>
          </h2>
          <div className="space-y-2">
            {users.data?.success &&
              users.data.data.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-700 bg-night-900 px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-semibold">{u.username}</span>
                    <span className="ml-2 text-xs text-gray-500">{u.email}</span>
                    <span className="ml-2 text-xs text-gray-600">
                      {u._count.ownedHomes} homes · {u._count.memberships} memberships
                    </span>
                    <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                      u.role === "system_admin" ? "border-purple-500/40 text-purple-400" : "border-gray-600 text-gray-400"
                    }`}>
                      {u.role}
                    </span>
                    <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                      u.status === "active" ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"
                    }`}>
                      {u.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-500">
                      joined {new Date(u.createdAt).toLocaleDateString()}
                      {u.lastLoginAt ? ` · last ${new Date(u.lastLoginAt).toLocaleDateString()}` : ""}
                    </span>
                    <button
                      onClick={() => role.mutate({ id: u.id, r: u.role === "system_admin" ? "user" : "system_admin" })}
                      className="text-xs font-semibold text-purple-400 hover:text-purple-300"
                      title="Toggle admin role"
                    >
                      {u.role === "system_admin" ? "Demote" : "Make admin"}
                    </button>
                    <button
                      onClick={() => setStatus.mutate({ id: u.id, status: u.status === "active" ? "suspended" : "active" })}
                      className={`text-xs font-semibold ${
                        u.status === "active" ? "text-amber-400 hover:text-amber-300" : "text-emerald-400 hover:text-emerald-300"
                      }`}
                    >
                      {u.status === "active" ? "Suspend" : "Activate"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete user "${u.username}"? All their data will be removed.`)) delUser.mutate(u.id);
                      }}
                      className="text-xs font-semibold text-red-400 hover:text-red-300"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            {users.data?.success && users.data.data.length === 0 && (
              <p className="text-sm text-gray-500">No users match the search.</p>
            )}
          </div>
        </div>
      )}

      {tab === "homes" && (
        <div className="rounded-xl border border-gray-700 bg-night-800 p-5">
          <h2 className="mb-4 font-semibold">
            Homes <span className="text-sm font-normal text-gray-500">({homes.data?.success ? homes.data.data.length : "…"})</span>
          </h2>
          <div className="space-y-2">
            {homes.data?.success &&
              homes.data.data.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-700 bg-night-900 px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-semibold">🏠 {h.name}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      owner: {h.owner.username} · {h._count.devices} devices · {h._count.members} members · {h._count.rooms} rooms
                    </span>
                    <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                      h.status === "active" ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"
                    }`}>
                      {h.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-500">created {new Date(h.createdAt).toLocaleDateString()}</span>
                    <button
                      onClick={() => getHomeDetail(h.id).then((r) => r.success && setViewHome(r.data))}
                      className="text-xs font-semibold text-brand-light hover:text-brand"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setHomeStatusM.mutate({ id: h.id, status: h.status === "active" ? "suspended" : "active" })}
                      className={`text-xs font-semibold ${
                        h.status === "active" ? "text-amber-400 hover:text-amber-300" : "text-emerald-400 hover:text-emerald-300"
                      }`}
                    >
                      {h.status === "active" ? "Suspend" : "Activate"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete home "${h.name}"? All devices, members and data will be removed.`)) delHome.mutate(h.id);
                      }}
                      className="text-xs font-semibold text-red-400 hover:text-red-300"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            {homes.data?.success && homes.data.data.length === 0 && (
              <p className="text-sm text-gray-500">No homes match the search.</p>
            )}
          </div>
        </div>
      )}

      {tab === "devices" && (
        <div className="rounded-xl border border-gray-700 bg-night-800 p-5">
          <h2 className="mb-4 font-semibold">
            Devices <span className="text-sm font-normal text-gray-500">({devices.data?.success ? devices.data.data.length : "…"})</span>
          </h2>
          <div className="space-y-2">
            {devices.data?.success &&
              devices.data.data.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-700 bg-night-900 px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-semibold">{d.name}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      #{d.id} · {d.type}
                      {d.room ? ` · ${d.room.name}` : ""} · home: {d.home.name} ({d.home.owner.username})
                    </span>
                    <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                      d.status === "on" ? "border-emerald-500/40 text-emerald-400" : "border-gray-600 text-gray-400"
                    }`}>
                      {d.status}
                    </span>
                    {d.serialNumber && <span className="ml-2 text-[10px] text-gray-600">S/N {d.serialNumber}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge color={d.online ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}>
                      {d.online ? "ONLINE" : "OFFLINE"}
                    </Badge>
                    <span className="text-[11px] text-gray-500">
                      {d._count.commands} cmds · {d._count.logs} logs
                      {d.lastSeen ? ` · ${new Date(d.lastSeen).toLocaleString()}` : ""}
                    </span>
                  </div>
                </div>
              ))}
            {devices.data?.success && devices.data.data.length === 0 && (
              <p className="text-sm text-gray-500">No devices match the search.</p>
            )}
          </div>
        </div>
      )}

      {tab === "keys" && (
        <div className="rounded-xl border border-gray-700 bg-night-800 p-5">
          <h2 className="mb-4 font-semibold">
            API Keys <span className="text-sm font-normal text-gray-500">({keys.data?.success ? keys.data.data.length : "…"})</span>
          </h2>
          <div className="space-y-2">
            {keys.data?.success &&
              keys.data.data.map((k) => (
                <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-700 bg-night-900 px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-mono text-xs font-semibold text-brand-light">{k.keyPrefix}…</span>
                    {k.label && <span className="ml-2 text-xs text-gray-400">{k.label}</span>}
                    <span className="ml-2 text-xs text-gray-500">
                      by {k.user.username} · {k.home ? `home: ${k.home.name}` : "global"}
                    </span>
                    {k.expiresAt && new Date(k.expiresAt).getTime() < Date.now() && (
                      <Badge color="border-red-500/40 text-red-400">expired</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-500">
                      created {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt ? ` · used ${new Date(k.lastUsedAt).toLocaleString()}` : ""}
                    </span>
                    <button
                      onClick={() => {
                        if (confirm("Revoke this API key? Devices using it will lose access.")) delKey.mutate(k.id);
                      }}
                      className="text-xs font-semibold text-red-400 hover:text-red-300"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            {keys.data?.success && keys.data.data.length === 0 && (
              <p className="text-sm text-gray-500">No API keys yet.</p>
            )}
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="rounded-xl border border-gray-700 bg-night-800 p-5">
          <h2 className="mb-4 font-semibold">
            Audit Log <span className="text-sm font-normal text-gray-500">({audit.data?.success ? audit.data.data.length : "…"})</span>
          </h2>
          <div className="space-y-2">
            {audit.data?.success &&
              audit.data.data.map((log) => (
                <div key={log.id} className="rounded-lg border border-gray-700 bg-night-900 px-4 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge color="border-brand/40 text-brand-light">{log.action}</Badge>
                    {log.entity && (
                      <span className="text-xs text-gray-400">
                        {log.entity}{log.entityId ? ` #${log.entityId}` : ""}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500">
                      {log.actor ? log.actor.username : "system"} · {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {!!log.meta && typeof log.meta === "object" && (
                    <pre className="mt-1 overflow-x-auto text-[10px] text-gray-500">
                      {String(JSON.stringify(log.meta, null, 1) ?? "")}
                    </pre>
                  )}
                </div>
              ))}
            {audit.data?.success && audit.data.data.length === 0 && (
              <p className="text-sm text-gray-500">No audit events yet.</p>
            )}
          </div>
        </div>
      )}

      {tab === "ota" && (
        <div className="space-y-6">
          {otaMsg && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              ✅ {otaMsg}
            </div>
          )}

          {/* Firmware manager */}
          <div className="rounded-xl border border-gray-700 bg-night-800 p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="font-semibold">📦 Firmware</h2>
              {fw.data?.success && fw.data.data.current ? (
                <Badge color="border-brand/40 text-brand-light">current: {fw.data.data.current.version}</Badge>
              ) : (
                <Badge color="border-amber-500/40 text-amber-400">no firmware published</Badge>
              )}
            </div>

            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!fwFile || !fwVersion.trim()) {
                  alert("Select a .bin file and enter a version (e.g. 1.0.1).");
                  return;
                }
                if (!fwFile.name.toLowerCase().endsWith(".bin")) {
                  alert("Only .bin files are accepted.");
                  return;
                }
                const form = new FormData();
                form.append("firmware", fwFile);
                form.append("version", fwVersion.trim());
                form.append("model", fwModel);
                form.append("release_notes", fwNotes);
                publishFw.mutate(form, {
                  onSuccess: (r) => {
                    if (r.success) {
                      setOtaMsg(`Firmware ${r.data.version} published — push it to your ESPs below.`);
                      setFwFile(null);
                      setFwVersion("");
                      setFwModel("");
                      setFwNotes("");
                      (e.target as HTMLFormElement).reset();
                    } else {
                      alert(r.error.message);
                    }
                  },
                });
              }}
            >
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-gray-400">Firmware .bin</span>
                <input
                  type="file"
                  accept=".bin"
                  onChange={(ev) => setFwFile(ev.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border border-gray-700 bg-night-900 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-gray-400">Version</span>
                <input
                  value={fwVersion}
                  onChange={(ev) => setFwVersion(ev.target.value)}
                  placeholder="e.g. 1.0.1"
                  className="w-full rounded-lg border border-gray-700 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase text-gray-400">Board model</span>
                <select
                  value={fwModel}
                  onChange={(ev) => setFwModel(ev.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
                >
                  <option value="">🌐 Universal (sab models)</option>
                  <option value="2CH">2CH</option>
                  <option value="4CH">4CH</option>
                  <option value="5CH">5CH</option>
                  <option value="6CH">6CH</option>
                  <option value="8CH">8CH</option>
                  <option value="4CH-IR">4CH-IR</option>
                  <option value="FAN-DIM">FAN-DIM</option>
                  <option value="DIM-3S">DIM-3S (3-step dimmer)</option>
                  <option value="DIM-4S">DIM-4S (4-step dimmer)</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase text-gray-400">Release notes (optional)</span>
                <input
                  value={fwNotes}
                  onChange={(ev) => setFwNotes(ev.target.value)}
                  placeholder="What changed in this update?"
                  className="w-full rounded-lg border border-gray-700 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={publishFw.isPending}
                  className="rounded-lg bg-gradient-to-r from-brand to-brand-light px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {publishFw.isPending ? "Uploading…" : "📤 Publish Firmware"}
                </button>
              </div>
            </form>

            {fw.data?.success && fw.data.data.versions.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Version history</p>
                <div className="space-y-2">
                  {fw.data.data.versions.map((v) => (
                    <div
                      key={v.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-700 bg-night-900 px-4 py-2 text-sm"
                    >
                      <div>
                        <span className="font-mono font-semibold">{v.version}</span>
                        <span
                          className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                            v.isCurrent ? "border-emerald-500/40 text-emerald-400" : "border-gray-600 text-gray-400"
                          }`}
                        >
                          {v.isCurrent ? "current" : "old"}
                        </span>
                        {v.modelCode && (
                          <span className="ml-2 rounded bg-brand/20 px-2 py-0.5 text-[10px] font-bold text-brand-light">
                            {v.modelCode}
                          </span>
                        )}
                        {v.releaseNotes && <span className="ml-2 text-xs text-gray-400">{v.releaseNotes}</span>}
                      </div>
                      {!v.isCurrent && (
                        <button
                          onClick={() => activateFw.mutate(v.id)}
                          className="text-xs font-semibold text-brand-light hover:text-brand"
                        >
                          Set current
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ESP boards — ek row per physical board */}
          <div className="rounded-xl border border-gray-700 bg-night-800 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">
                🛰️ ESP Boards{" "}
                <span className="text-sm font-normal text-gray-500">
                  ({esp.data?.success ? esp.data.data.esps.length : "…"})
                </span>
              </h2>
              <button
                onClick={() => {
                  const cur = fw.data?.success ? fw.data.data.current?.version : null;
                  if (!cur) {
                    alert("No firmware published yet — upload a .bin first.");
                    return;
                  }
                  if (confirm(`Push firmware ${cur} to ALL boards?`)) {
                    pushAllM.mutate(undefined, {
                      onSuccess: (r) => r.success && setOtaMsg(`Pushed ${r.data.version} to ${r.data.count} device(s).`),
                    });
                  }
                }}
                className="rounded-lg border border-brand/40 px-3 py-1.5 text-xs font-semibold text-brand-light hover:bg-brand/10"
              >
                📤 Push to All
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-xs uppercase text-gray-400">
                    <th className="py-2 pr-3">ESP Board</th>
                    <th className="py-2 pr-3">Home</th>
                    <th className="py-2 pr-3">Devices</th>
                    <th className="py-2 pr-3">IP</th>
                    <th className="py-2 pr-3">Firmware</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Last seen</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {esp.data?.success &&
                    esp.data.data.esps.map((espRow) => (
                      <tr key={espRow.id} className="border-b border-gray-800 align-top">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{espRow.name ?? "ESP"}</div>
                          <div className="font-mono text-[10px] text-gray-500">{espRow.macAddress}</div>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-400">
                            <span>📶</span>
                            <span>{espRow.ssid ?? "—"}</span>
                          </div>
                          {espRow.serialCode && (
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span className="rounded bg-brand/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-light">
                                {espRow.serialCode}
                              </span>
                              {espRow.modelCode && (
                                <span className="rounded bg-night-700 px-1.5 py-0.5 text-[10px] text-gray-400">
                                  {espRow.modelCode}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-gray-400">{espRow.home.name}</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {espRow.devices.length === 0 && (
                              <span className="text-xs text-gray-600">—</span>
                            )}
                            {espRow.devices.map((dev) => (
                              <span
                                key={dev.id}
                                title={`${dev.room?.name ?? ""} · ${dev.status.toUpperCase()}`}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                                  dev.status === "on"
                                    ? "border-emerald-500/40 text-emerald-400"
                                    : "border-gray-600 text-gray-400"
                                }`}
                              >
                                <span
                                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                                    dev.status === "on" ? "bg-emerald-400" : "bg-gray-600"
                                  }`}
                                />
                                {dev.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          {espRow.ipAddress ? (
                            <span className="inline-flex items-center gap-1.5">
                              <a
                                href={`http://${espRow.ipAddress}`}
                                onClick={(e) => handleIpClick(e, espRow)}
                                title={`Open ${espRow.ipAddress} (ESP web panel)`}
                                className="font-mono text-xs text-brand-light underline decoration-dotted underline-offset-2 hover:text-brand"
                              >
                                {espRow.ipAddress}
                              </a>
                              {probes[espRow.id]?.state === "probing" && (
                                <span
                                  title="Checking reachability…"
                                  className="inline-block h-3 w-3 animate-spin rounded-full border border-brand/40 border-t-brand"
                                />
                              )}
                              {probes[espRow.id]?.state === "ok" && (
                                <span
                                  title={`Reachable (${probes[espRow.id].latencyMs}ms)`}
                                  className="text-[10px] text-emerald-400"
                                >
                                  ●
                                </span>
                              )}
                              {probes[espRow.id]?.state === "fail" && (
                                <Badge color="border-red-500/40 text-red-400">ESP offline</Badge>
                              )}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-brand-light">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {espRow.firmwareVersion ?? "—"}
                          {espRow.otaPendingVersion && (
                            <Badge color="border-amber-500/40 text-amber-400">⏳ v{espRow.otaPendingVersion}</Badge>
                          )}
                          {(() => {
                            const ota =
                              liveOta[espRow.id] ??
                              (espRow.otaStatus ? { progress: espRow.otaProgress ?? 0, status: espRow.otaStatus } : null);
                            if (!ota || ota.status === "complete") {
                              return ota?.status === "complete" ? (
                                <div className="mt-1 text-[10px] text-amber-400">✓ Flashed — rebooting…</div>
                              ) : null;
                            }
                            if (ota.status === "failed") {
                              return <Badge color="border-red-500/40 text-red-400">OTA failed</Badge>;
                            }
                            return (
                              <div className="mt-1">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-700">
                                    <div
                                      className="h-full rounded-full bg-brand transition-all"
                                      style={{ width: `${ota.progress}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-brand-light">{ota.progress}%</span>
                                </div>
                                <span className="text-[10px] text-gray-400">
                                  {ota.status === "downloading" ? "Downloading…" : "Flashing…"}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge
                            color={!espRow.offline ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}
                          >
                            {!espRow.offline ? "ONLINE" : "OFFLINE"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-xs text-gray-500">
                          {espRow.lastSeen ? new Date(espRow.lastSeen).toLocaleString() : "—"}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => {
                              const cur = fw.data?.success ? fw.data.data.current?.version : null;
                              if (!cur) {
                                alert("No firmware published yet — upload a .bin first.");
                                return;
                              }
                              if (espRow.devices.length === 0) {
                                alert("This board has no linked devices yet — waiting for its first heartbeat.");
                                return;
                              }
                              if (confirm(`Push firmware ${cur} to "${espRow.name ?? espRow.macAddress}"?`)) {
                                pushOtaM.mutate(espRow.devices[0].id, {
                                  onSuccess: (r) => r.success && setOtaMsg(r.data.message),
                                });
                              }
                            }}
                            disabled={pushOtaM.isPending}
                            className="rounded border border-brand/40 px-2.5 py-1 text-xs font-semibold text-brand-light hover:bg-brand/10 disabled:opacity-50"
                          >
                            📤 Push
                          </button>
                        </td>
                      </tr>
                    ))}
                  {esp.data?.success && esp.data.data.esps.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-sm text-gray-500">
                        No ESP boards yet — boards appear here when an ESP reports its heartbeat (MAC + WiFi + IP).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {esp.data?.success && esp.data.data.unlinked.length > 0 && (
              <div className="mt-4 rounded-lg border border-dashed border-gray-700 bg-night-900/50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase text-gray-400">
                  Devices without an ESP ({esp.data.data.unlinked.length}) — koi board report nahi kar raha
                </p>
                <div className="flex flex-wrap gap-2">
                  {esp.data.data.unlinked.map((d) => (
                    <span key={d.id} className="rounded-full border border-gray-700 px-2.5 py-0.5 text-[10px] text-gray-400">
                      {d.name} · {d.home.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Home detail modal */}
      {viewHome && (
        <Modal title={`🏠 ${viewHome.name} — Details`} onClose={() => setViewHome(null)}>
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-gray-700 bg-night-900 p-3">
              <div className="text-xl font-bold">{viewHome._count.devices}</div>
              <div className="text-xs text-gray-500">Devices</div>
            </div>
            <div className="rounded-lg border border-gray-700 bg-night-900 p-3">
              <div className="text-xl font-bold">{viewHome._count.members}</div>
              <div className="text-xs text-gray-500">Members</div>
            </div>
            <div className="rounded-lg border border-gray-700 bg-night-900 p-3">
              <div className="text-xl font-bold">{viewHome._count.rooms}</div>
              <div className="text-xs text-gray-500">Rooms</div>
            </div>
          </div>
          <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Owner</p>
          <p className="mb-4 text-sm">{viewHome.owner.username} · {viewHome.owner.email}</p>
          <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Members</p>
          <div className="mb-4 space-y-1">
            {viewHome.members.map((m) => (
              <div key={m.id} className="flex justify-between rounded border border-gray-700 bg-night-900 px-3 py-1.5 text-sm">
                <span>{m.user.username}</span>
                <span className="text-xs text-gray-400">{m.role}</span>
              </div>
            ))}
          </div>
          <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Devices</p>
          <div className="space-y-1">
            {viewHome.devices.map((d) => (
              <div key={d.id} className="flex justify-between rounded border border-gray-700 bg-night-900 px-3 py-1.5 text-sm">
                <span>{d.name} <span className="text-xs text-gray-500">#{d.id} · {d.type}</span></span>
                <span className={`text-xs font-bold uppercase ${d.status === "on" ? "text-emerald-400" : "text-gray-500"}`}>
                  {d.status}
                </span>
              </div>
            ))}
            {viewHome.devices.length === 0 && <p className="text-sm text-gray-500">No devices.</p>}
          </div>
        </Modal>
      )}

      {tab === "shop" && <AdminShop />}
    </div>
  );
}
