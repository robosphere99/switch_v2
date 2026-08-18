import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Wifi, Home as HomeIcon } from "lucide-react";
import { useState } from "react";
import type { Device, DeviceType, UsageAnalytics } from "@robosphere/shared";
import { listDevices, bulkSetDeviceStatus, createDevice, updateDevice, deleteDevice, getDeviceLogs, getUsageAnalytics, renameEsp, getCurrentFirmware, requestOta } from "../api/devices";
import { createToggleOptions } from "../lib/deviceOptimistic";
import { listHomes, getHomeDetail } from "../api/homes";
import { createRoom, deleteRoom } from "../api/rooms";
import { DeviceCard, isOnline } from "../components/DeviceCard";
import { Modal } from "../components/Modal";
import { ScheduleSection } from "../components/ScheduleSection";
import { AutomationSuggestions } from "../components/AutomationSuggestions";
import { useAuthStore } from "../stores/auth";

const DEVICE_TYPES: DeviceType[] = ["bulb", "fan", "ac", "tv", "plug", "custom"];


function apiErrMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
    "Kuch galat ho gaya"
  );
}

/** ms → "2h 15m" / "45m" / "30s" */
function fmtDur(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Simple div-based bar chart — koi chart library nahi (project convention). */
function ToggleBars({ data }: { data: UsageAnalytics["togglesPerDay"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-28 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.date} className="group flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
          <span className="text-[10px] font-semibold text-gray-500">{d.count > 0 ? d.count : ""}</span>
          <div
            className={`w-full rounded-t ${d.count > 0 ? "bg-brand" : "bg-night-700"}`}
            style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
          />
          <span className="truncate text-[9px] text-gray-400">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsBody({ data }: { data: UsageAnalytics }) {
  const maxToggles = Math.max(1, ...data.perDevice.map((d) => d.toggles));
  return (
    <div className="space-y-6">
      {/* Summary chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-night-900 p-3 dark:border-night-600">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Toggles</p>
          <p className="mt-0.5 text-xl font-extrabold text-night-950">{data.totals.toggles}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-night-900 p-3 dark:border-night-600">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">On-time (est.)</p>
          <p className="mt-0.5 text-xl font-extrabold text-night-950">{fmtDur(data.totals.onMs)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-night-900 p-3 dark:border-night-600">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Active members</p>
          <p className="mt-0.5 text-xl font-extrabold text-night-950">{data.perMember.length}</p>
        </div>
      </div>

      {/* Toggles per day bar chart */}
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Toggles per day</h4>
        <ToggleBars data={data.togglesPerDay} />
      </div>

      {/* Per device */}
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Top devices</h4>
        <div className="space-y-2">
          {data.perDevice.length === 0 && <p className="text-sm text-gray-500">No activity in this period.</p>}
          {data.perDevice.map((d) => (
            <div key={d.deviceId} className="rounded-lg border border-gray-200 bg-night-900 px-3 py-2 dark:border-night-600">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-night-950">{d.name}</span>
                <span className="shrink-0 text-xs text-gray-500">
                  {d.toggles}× · {fmtDur(d.onMs)} on
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-night-700">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (d.toggles / maxToggles) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per member */}
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Member activity</h4>
        <div className="flex flex-wrap gap-2">
          {data.perMember.map((m) => (
            <span
              key={m.userId ?? "auto"}
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-night-900 px-3 py-1.5 text-xs dark:border-night-600"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/15 font-bold text-brand">
                {(m.username ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="font-semibold text-night-950">{m.username}</span>
              <span className="text-gray-500">{m.toggles}×</span>
            </span>
          ))}
          {data.perMember.length === 0 && <p className="text-sm text-gray-500">No member activity.</p>}
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [activeHomeId, setActiveHomeId] = useState<number | null>(null);

  const [addForm, setAddForm] = useState({ name: "", type: "bulb" as DeviceType, roomId: "" });
  const [roomName, setRoomName] = useState("");
  const [editing, setEditing] = useState<Device | null>(null);
  const [editName, setEditName] = useState("");
  const [editRoom, setEditRoom] = useState("");
  const [logsFor, setLogsFor] = useState<Device | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [error, setError] = useState("");
  // Per-device pending — optimistic toggle ke waqt switch pulse dikhata hai
  const [pending, setPending] = useState<Record<number, "on" | "off">>({});

  const homes = useQuery({ queryKey: ["homes"], queryFn: listHomes, refetchInterval: 30_000 });

  const homeId = activeHomeId ?? (homes.data?.success ? (homes.data.data[0]?.id ?? null) : null);

  const homeDetail = useQuery({
    queryKey: ["home", homeId],
    queryFn: () => getHomeDetail(homeId!),
    enabled: homeId !== null,
    // Socket live hai to 20s hi kaafi (device:updated event pe invalidate hota hai).
    refetchInterval: 20_000,
  });

  const home = homeDetail.data?.success ? homeDetail.data.data : null;
  const myRole =
    home?.members.find((m) => m.userId === user?.id)?.role ?? "viewer";
  const canManage = myRole === "owner" || myRole === "admin" || myRole === "member";
  const canAdminDevices = myRole === "owner" || myRole === "admin";

  const [otaMsg, setOtaMsg] = useState("");
  const [deviceQ, setDeviceQ] = useState("");
  const devices = useQuery({
    queryKey: ["devices", homeId],
    queryFn: () => listDevices(homeId!),
    enabled: homeId !== null,
    // Socket live pe events invalidate karte hain — polling ab fallback (15s).
    refetchInterval: 15_000,
  });

  const firmware = useQuery({
    queryKey: ["current-firmware"],
    queryFn: getCurrentFirmware,
    refetchInterval: 60_000,
  });
  const latestForModel = (modelCode?: string | null): string | undefined => {
    if (!modelCode || !firmware.data?.success) return undefined;
    const fw = firmware.data.data.find((f) => f.modelCode.toUpperCase() === modelCode.toUpperCase());
    return fw?.version;
  };

  const pushOta = useMutation({
    mutationFn: (d: Device) => requestOta(homeId!, d.id),
    onSuccess: (r) => {
      if (r.success) {
        setOtaMsg(`${r.data.message} (v${r.data.version})`);
        invalidate();
      }
    },
    onError: (e) => setError(apiErrMsg(e)),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["home", homeId] });
    queryClient.invalidateQueries({ queryKey: ["devices", homeId] });
  };

  // Optimistic: API ka intezaar kiye bina UI turant update + pending state.
  // Error pe rollback (server truth restore). ESP confirm command:updated
  // se aata hai — realtime hook devices refetch karta hai.
  // (Logic lib/deviceOptimistic me hai — unit-tested rollback path.)
  const toggle = useMutation(
    createToggleOptions({
      queryClient,
      homeId: homeId!,
      setPending,
      setError,
      invalidate,
    }),
  );

  const bulkToggle = useMutation({
    mutationFn: ({ deviceIds, status }: { deviceIds: number[]; status: "on" | "off" }) =>
      bulkSetDeviceStatus(homeId!, deviceIds, status),
    onSuccess: invalidate,
    onError: (e) => setError(apiErrMsg(e)),
  });

  const addDevice = useMutation({
    mutationFn: () =>
      createDevice(homeId!, {
        name: addForm.name,
        type: addForm.type,
        roomId: addForm.roomId ? Number(addForm.roomId) : undefined,
      }),
    onSuccess: () => {
      setAddForm({ name: "", type: "bulb", roomId: "" });
      invalidate();
    },
    onError: (e) => setError(apiErrMsg(e)),
  });

  const addRoom = useMutation({
    mutationFn: () => createRoom(homeId!, roomName),
    onSuccess: () => {
      setRoomName("");
      invalidate();
    },
  });

  const removeRoom = useMutation({
    mutationFn: (roomId: number) => deleteRoom(homeId!, roomId),
    onSuccess: invalidate,
  });

  const saveEdit = useMutation({
    mutationFn: () =>
      updateDevice(homeId!, editing!.id, {
        name: editName,
        roomId: editRoom ? Number(editRoom) : null,
      }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  const removeDevice = useMutation({
    mutationFn: (deviceId: number) => deleteDevice(homeId!, deviceId),
    onSuccess: invalidate,
  });

  const renameBoard = useMutation({
    mutationFn: ({ espId, name }: { espId: number; name: string }) => renameEsp(homeId!, espId, name),
    onSuccess: invalidate,
    onError: (err) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Naam change nahi ho paya";
      alert(msg);
    },
  });

  const logsQuery = useQuery({
    queryKey: ["logs", homeId, logsFor?.id],
    queryFn: () => getDeviceLogs(homeId!, logsFor!.id),
    enabled: logsFor !== null,
  });

  const analyticsQuery = useQuery({
    queryKey: ["analytics", homeId, analyticsDays],
    queryFn: () => getUsageAnalytics(homeId!, analyticsDays),
    enabled: analyticsOpen && homeId !== null,
  });

  const roomNameFor = (device: Device) =>
    home?.rooms.find((r) => r.id === device.roomId)?.name ?? null;

  if (homes.isLoading) return <p className="p-10 text-center text-gray-500">Loading…</p>;

  if (homes.data?.success && homes.data.data.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">No homes yet</h1>
        <p className="text-gray-500">
          Create your home on the <span className="text-brand">Homes</span> page, or join
          your family with an invite code.
        </p>
      </div>
    );
  }

  if (!homes.data?.success) {
    return <p className="p-10 text-center text-red-400">{homes.data?.error.message}</p>;
  }

  const myHomes = homes.data.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Home switcher — compact pills */}
      {myHomes.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {myHomes.map((h) => (
            <button
              key={h.id}
              onClick={() => setActiveHomeId(h.id)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                h.id === homeId
                  ? "border-brand bg-brand/20 text-brand"
                  : "border-gray-200 bg-night-800 text-gray-600 hover:border-gray-500 dark:border-night-600"
              }`}
            >
              🏠 {h.name}
              <span className="ml-1.5 text-gray-500">
                {h._count.devices}d · {h._count.members}m
              </span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mb-4 rounded bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}
      {otaMsg && (
        <p className="mb-4 rounded bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">📲 {otaMsg}</p>
      )}

      {home && (
        <div className="space-y-8">
          {/* ===== Greeting banner ===== */}
          <div className="flex flex-col gap-6 rounded-2xl border border-brand/20 bg-brand/10 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30 sm:flex">
                <HomeIcon className="h-8 w-8" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand">Dashboard</p>
                <h1 className="mt-1 text-2xl font-extrabold text-night-950 sm:text-3xl">
                  Hello, {user?.username ?? "there"}! 👋
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {devices.data?.success && devices.data.data.some((d) => isOnline(d))
                    ? `${devices.data.data.filter((d) => isOnline(d)).length} device online — sab kuch control me hai.`
                    : "Welcome home! Apne devices ko yahan se control karo."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-night-800 px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm dark:border dark:border-night-600">
                <Wifi className="h-3.5 w-3.5 text-brand" />
                {devices.data?.success
                  ? `${devices.data.data.filter((d) => isOnline(d)).length}/${devices.data.data.length} online`
                  : "—"}
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-night-800 px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm dark:border dark:border-night-600">
                <Users className="h-3.5 w-3.5 text-brand" />
                {home.members.length} members
              </span>
              <span className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand">
                Role: {myRole}
              </span>
            </div>
          </div>

          {/* ===== Suggested automations (usage patterns ya demo) ===== */}
          {homeId !== null && <AutomationSuggestions homeId={homeId} compact />}

          {/* ===== Quick actions ===== */}
          {devices.data?.success && devices.data.data.some((d) => d.type === "bulb") && (
            <div className="flex flex-wrap items-center gap-3">
              {(() => {
                const bulbIds = devices.data!.data
                  .filter((d) => d.type === "bulb" && isOnline(d))
                  .map((d) => d.id);
                return (
                  <button
                    onClick={() => bulkToggle.mutate({ deviceIds: bulbIds, status: "off" })}
                    disabled={!bulbIds.length || bulkToggle.isPending}
                    className="flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-4 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    💡 All lights off
                  </button>
                );
              })()}
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
            {/* Left: devices + schedules */}
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-night-950">
                  Devices{" "}
                  <span className="text-sm font-normal text-gray-500">
                    ({devices.data?.success ? devices.data.data.length : "…"})
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setAnalyticsOpen(true)}
                    className="rounded-full border border-brand/40 bg-brand/10 px-4 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/20"
                  >
                    📊 Usage
                  </button>
                  <input
                    value={deviceQ}
                    onChange={(e) => setDeviceQ(e.target.value)}
                    placeholder="🔍 Search device / serial / board…"
                    className="w-full max-w-xs rounded-lg border border-gray-200 bg-night-800 px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-brand dark:border-night-600"
                  />
                </div>
              </div>
              {devices.isLoading && (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-44 animate-pulse rounded-xl border border-gray-200 bg-night-800 dark:border-night-600"
                    />
                  ))}
                </div>
              )}
              {devices.data?.success && devices.data.data.length === 0 && (
                <p className="text-gray-500">
                  No devices yet{canAdminDevices ? " — add your first device!" : ""}
                </p>
              )}
              {(() => {
                const q = deviceQ.trim().toLowerCase();
                const all = devices.data?.success ? devices.data.data : [];
                const visible = q
                  ? all.filter((d) => {
                      const room = roomNameFor(d)?.toLowerCase() ?? "";
                      const board = d.esp?.name?.toLowerCase() ?? "";
                      const boardSerial = d.esp?.serialCode?.toLowerCase() ?? "";
                      return (
                        d.name.toLowerCase().includes(q) ||
                        (d.serialNumber?.toLowerCase() ?? "").includes(q) ||
                        room.includes(q) ||
                        board.includes(q) ||
                        boardSerial.includes(q)
                      );
                    })
                  : all;
                if (q && visible.length === 0) {
                  return <p className="text-gray-500">No devices match "{deviceQ}".</p>;
                }
                // Room-first grouping — har room ka apna section + All off/on
                const grouped = new Map<number | null, Device[]>();
                for (const d of visible) {
                  const key = d.roomId ?? null;
                  if (!grouped.has(key)) grouped.set(key, []);
                  grouped.get(key)!.push(d);
                }
                const sections = [
                  ...home.rooms.map((r) => ({
                    title: r.name,
                    roomId: r.id as number | null,
                    list: grouped.get(r.id) ?? [],
                  })),
                  { title: "Other devices", roomId: null as number | null, list: grouped.get(null) ?? [] },
                ].filter((s) => s.list.length > 0);
                return (
                  <div className="space-y-8">
                    {sections.map((s) => (
                      <div key={s.roomId ?? "none"}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <h3 className="flex items-center gap-2 font-semibold text-night-950">
                            {s.roomId !== null ? `📍 ${s.title}` : "📦 Other devices"}
                            <span className="text-xs font-normal text-gray-500">({s.list.length})</span>
                          </h3>
                          {canManage && (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  bulkToggle.mutate({
                                    deviceIds: s.list.map((d) => d.id),
                                    status: "off",
                                  })
                                }
                                disabled={bulkToggle.isPending}
                                className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-night-700 dark:border-night-600"
                              >
                                All off
                              </button>
                              <button
                                onClick={() =>
                                  bulkToggle.mutate({
                                    deviceIds: s.list.map((d) => d.id),
                                    status: "on",
                                  })
                                }
                                disabled={bulkToggle.isPending}
                                className="rounded-full border border-brand/40 bg-brand/10 px-4 py-2 text-xs font-semibold text-brand transition hover:bg-brand/20"
                              >
                                All on
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                          {s.list.map((device) => (
                            <DeviceCard
                              key={device.id}
                              device={device}
                              roomName={s.roomId !== null ? s.title : null}
                              canManage={canManage}
                              pending={pending[device.id] !== undefined}
                              disabled={toggle.isPending && pending[device.id] === undefined}
                              onToggle={(d) =>
                                toggle.mutate({
                                  device: d,
                                  status: d.status === "on" ? "off" : "on",
                                })
                              }
                              onEdit={(d) => {
                                setEditing(d);
                                setEditName(d.name);
                                setEditRoom(d.roomId ? String(d.roomId) : "");
                              }}
                              onLogs={(d) => setLogsFor(d)}
                              latestVersion={latestForModel(device.esp?.modelCode)}
                              onOta={(d) => {
                                const cur = d.esp?.firmwareVersion ?? "—";
                                const next = latestForModel(d.esp?.modelCode);
                                if (next && confirm(`Board "${d.esp?.name}" ka firmware update karein?\nAbhi: v${cur} → Latest: v${next}`)) {
                                  pushOta.mutate(d);
                                }
                              }}
                              onRenameBoard={(esp) => {
                                const name = window.prompt("ESP board ka naam (unique hona chahiye):", esp.name ?? "");
                                if (name && name.trim()) renameBoard.mutate({ espId: esp.id, name: name.trim() });
                              }}
                              onDelete={(d) => {
                                if (confirm(`Delete "${d.name}"? This cannot be undone.`)) {
                                  removeDevice.mutate(d.id);
                                }
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className="mt-8">
              <ScheduleSection
                homeId={homeId!}
                devices={devices.data?.success ? devices.data.data : []}
                canManage={canManage}
              />
            </div>
            </div>

            {/* Right sidebar: Add device, rooms, boards, members */}
            <aside className="space-y-6">
              {canAdminDevices && (
                <div className="rounded-2xl border border-brand/20 bg-night-800 p-5">
                  <h2 className="mb-4 flex items-center gap-1.5 font-semibold text-night-950">
                    <Plus className="h-4 w-4 text-brand" /> Add Device
                  </h2>
                  <input
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="Device name"
                    className="mb-3 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
                  />
                  <select
                    value={addForm.type}
                    onChange={(e) => setAddForm({ ...addForm, type: e.target.value as DeviceType })}
                    className="mb-3 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
                  >
                    {DEVICE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={addForm.roomId}
                    onChange={(e) => setAddForm({ ...addForm, roomId: e.target.value })}
                    className="mb-4 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
                  >
                    <option value="">No room</option>
                    {home.rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => addDevice.mutate()}
                    disabled={!addForm.name || addDevice.isPending}
                    className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Add Device
                  </button>
                </div>
              )}

              {canAdminDevices && (
                <div className="rounded-2xl border border-gray-200 bg-night-800 p-5 dark:border-night-600">
                  <h2 className="mb-4 font-semibold text-night-950">📍 Rooms</h2>
                  <div className="mb-3 flex gap-2">
                    <input
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="New room name"
                      className="flex-1 rounded-lg border border-brand/20 bg-night-900 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                    <button
                      onClick={() => addRoom.mutate()}
                      disabled={!roomName}
                      className="rounded-lg bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {home.rooms.map((r) => (
                      <span
                        key={r.id}
                        className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-night-900 px-3 py-1 text-xs dark:border-night-600"
                      >
                        {r.name}
                        <button
                          onClick={() => removeRoom.mutate(r.id)}
                          className="text-gray-500 hover:text-red-400"
                          title="Delete room"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {home.rooms.length === 0 && (
                      <p className="text-xs text-gray-500">No rooms yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Boards summary */}
              <div className="rounded-2xl border border-gray-200 bg-night-800 p-5 dark:border-night-600">
                <h2 className="mb-4 flex items-center gap-1.5 font-semibold text-night-950">
                  <Wifi className="h-4 w-4 text-brand" /> Boards
                </h2>
                {(() => {
                  const boards = new Map<
                    number,
                    NonNullable<Device["esp"]>
                  >();
                  (devices.data?.success ? devices.data.data : []).forEach((d) => {
                    if (d.esp) boards.set(d.esp.id, d.esp);
                  });
                  if (boards.size === 0) {
                    return <p className="text-xs text-gray-500">Koi ESP board linked nahi.</p>;
                  }
                  return (
                    <div className="space-y-2">
                      {[...boards.values()].map((b) => {
                        const online =
                          !b.offline &&
                          b.lastSeen &&
                          Date.now() - new Date(b.lastSeen).getTime() < 120_000;
                        return (
                          <div
                            key={b.id}
                            className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-night-900/60 px-3 py-2 dark:border-night-600"
                          >
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                online ? "bg-emerald-400" : "bg-red-400"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-night-950">
                                {b.name ?? "ESP Board"}
                              </p>
                              <p className="truncate text-[10px] text-gray-500">
                                {b.modelCode ?? "—"} · FW v{b.firmwareVersion ?? "—"}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] font-bold uppercase ${
                                online ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              {online ? "online" : "offline"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Members */}
              <div className="rounded-2xl border border-gray-200 bg-night-800 p-5 dark:border-night-600">
                <h2 className="mb-4 flex items-center gap-1.5 font-semibold text-night-950">
                  <Users className="h-4 w-4 text-brand" /> Members
                </h2>
                <div className="space-y-2">
                  {home.members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2.5 rounded-lg px-1 py-1"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">
                        {(m.user?.username ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-night-950">
                          {m.user?.username ?? "Member"}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">
                          {m.role}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title={`Edit: ${editing.name}`} onClose={() => setEditing(null)}>
          <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Name</label>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="mb-4 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
          <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Room</label>
          <select
            value={editRoom}
            onChange={(e) => setEditRoom(e.target.value)}
            className="mb-6 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
          >
            <option value="">No room</option>
            {home?.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => saveEdit.mutate()}
            disabled={!editName || saveEdit.isPending}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save Changes
          </button>
        </Modal>
      )}

      {/* Analytics modal */}
      {analyticsOpen && (
        <Modal title={`📊 Usage — last ${analyticsDays} days`} onClose={() => setAnalyticsOpen(false)}>
          <div className="mb-4 flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setAnalyticsDays(d)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  analyticsDays === d
                    ? "bg-brand text-white"
                    : "border border-gray-300 text-gray-600 hover:bg-night-700 dark:border-night-600"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          {analyticsQuery.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {analyticsQuery.data?.success && (
            <AnalyticsBody data={analyticsQuery.data.data} />
          )}
          {analyticsQuery.data?.success === false && (
            <p className="text-sm text-red-400">{analyticsQuery.data.error.message}</p>
          )}
        </Modal>
      )}

      {/* Logs modal */}
      {logsFor && (
        <Modal title={`📜 ${logsFor.name} — Activity`} onClose={() => setLogsFor(null)}>
          {logsQuery.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          <div className="space-y-2">
            {(logsQuery.data?.success ? logsQuery.data.data : []).map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-gray-200 bg-night-900 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">{log.logMessage}</span>
                  <span className="text-[10px] text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-gray-500">
                  {log.actor ? `by ${log.actor.username}` : "by device"} · {log.logType}
                </div>
              </div>
            ))}
            {logsQuery.data?.success && logsQuery.data.data.length === 0 && (
              <p className="text-sm text-gray-500">No activity yet.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
