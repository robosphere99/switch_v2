import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Wifi, BarChart2, Search, LayoutGrid } from "lucide-react";
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
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Alert } from "../components/ui/Alert";
import { extractApiError } from "../api/client";

const DEVICE_TYPES: DeviceType[] = ["bulb", "fan", "ac", "tv", "plug", "custom"];

function fmtDur(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function ToggleBars({ data }: { data: UsageAnalytics["togglesPerDay"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-24 items-end gap-1">
      {data.map((d) => (
        <div key={d.date} className="group flex flex-1 flex-col items-center gap-0.5" title={`${d.date}: ${d.count}`}>
          <span className="text-[9px] font-semibold text-night-500">{d.count > 0 ? d.count : ""}</span>
          <div
            className={`w-full rounded-t-sm ${d.count > 0 ? "bg-brand" : "bg-night-700"}`}
            style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }}
          />
          <span className="truncate text-[8px] text-night-500">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsBody({ data }: { data: UsageAnalytics }) {
  const maxToggles = Math.max(1, ...data.perDevice.map((d) => d.toggles));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Toggles", value: data.totals.toggles },
          { label: "On-time", value: fmtDur(data.totals.onMs) },
          { label: "Members", value: data.perMember.length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-night-600 bg-night-900 p-3 dark:bg-night-700/50">
            <p className="text-[10px] font-bold uppercase tracking-wide text-night-500">{s.label}</p>
            <p className="mt-0.5 text-lg font-bold text-night-950 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-night-500">Toggles per day</h4>
        <ToggleBars data={data.togglesPerDay} />
      </div>
      {data.perDevice.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-night-500">Top devices</h4>
          <div className="space-y-2">
            {data.perDevice.map((d) => (
              <div key={d.deviceId} className="rounded-xl border border-night-600/70 bg-night-900 px-3 py-2 dark:bg-night-700/40">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="truncate text-xs font-semibold text-night-950 dark:text-white">{d.name}</span>
                  <span className="shrink-0 text-[10px] text-night-500">{d.toggles}× · {fmtDur(d.onMs)}</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-night-700">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (d.toggles / maxToggles) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
  const [otaMsg, setOtaMsg] = useState("");
  const [pending, setPending] = useState<Record<number, "on" | "off">>({});
  const [blockedDevices, setBlockedDevices] = useState<Record<number, boolean>>({});
  const [deviceQ, setDeviceQ] = useState("");

  const homes = useQuery({ queryKey: ["homes"], queryFn: listHomes, refetchInterval: 30_000 });
  const homeId = activeHomeId ?? (homes.data?.success ? (homes.data.data[0]?.id ?? null) : null);
  const homeDetail = useQuery({
    queryKey: ["home", homeId],
    queryFn: () => getHomeDetail(homeId!),
    enabled: homeId !== null,
    refetchInterval: 20_000,
  });
  const home = homeDetail.data?.success ? homeDetail.data.data : null;
  const myRole = home?.members.find((m) => m.userId === user?.id)?.role ?? "viewer";
  const canManage = myRole === "owner" || myRole === "admin" || myRole === "member";
  const canAdminDevices = myRole === "owner" || myRole === "admin";

  const devices = useQuery({
    queryKey: ["devices", homeId],
    queryFn: () => listDevices(homeId!),
    enabled: homeId !== null,
    refetchInterval: 15_000,
  });

  const firmware = useQuery({ queryKey: ["current-firmware"], queryFn: getCurrentFirmware, refetchInterval: 60_000 });
  const latestForModel = (modelCode?: string | null) => {
    if (!modelCode || !firmware.data?.success) return undefined;
    const fw = firmware.data.data.find((f) => f.modelCode.toUpperCase() === modelCode.toUpperCase());
    return fw?.version;
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["home", homeId] });
    queryClient.invalidateQueries({ queryKey: ["devices", homeId] });
  };

  const pushOta = useMutation({
    mutationFn: (d: Device) => requestOta(homeId!, d.id),
    onSuccess: (r) => { if (r.success) { setOtaMsg(`${r.data.message} (v${r.data.version})`); invalidate(); } },
    onError: (e) => setError(extractApiError(e).message),
  });

  const toggle = useMutation(
    createToggleOptions({
      queryClient, homeId: homeId!, setPending, setError, invalidate,
      onSecurityLock: (deviceId) => {
        setBlockedDevices((p) => ({ ...p, [deviceId]: true }));
        setTimeout(() => setBlockedDevices((p) => { const n = { ...p }; delete n[deviceId]; return n; }), 60000);
      },
    })
  );

  const bulkToggle = useMutation({
    mutationFn: ({ deviceIds, status }: { deviceIds: number[]; status: "on" | "off" }) =>
      bulkSetDeviceStatus(homeId!, deviceIds, status),
    onSuccess: invalidate,
    onError: (e) => setError(extractApiError(e).message),
  });

  const addDevice = useMutation({
    mutationFn: () => createDevice(homeId!, { name: addForm.name, type: addForm.type, roomId: addForm.roomId ? Number(addForm.roomId) : undefined }),
    onSuccess: () => { setAddForm({ name: "", type: "bulb", roomId: "" }); invalidate(); },
    onError: (e) => setError(extractApiError(e).message),
  });

  const addRoom = useMutation({
    mutationFn: () => createRoom(homeId!, roomName),
    onSuccess: () => { setRoomName(""); invalidate(); },
  });

  const removeRoom = useMutation({ mutationFn: (roomId: number) => deleteRoom(homeId!, roomId), onSuccess: invalidate });

  const saveEdit = useMutation({
    mutationFn: () => updateDevice(homeId!, editing!.id, { name: editName, roomId: editRoom ? Number(editRoom) : null }),
    onSuccess: () => { setEditing(null); invalidate(); },
  });

  const removeDevice = useMutation({ mutationFn: (deviceId: number) => deleteDevice(homeId!, deviceId), onSuccess: invalidate });

  const renameBoard = useMutation({
    mutationFn: ({ espId, name }: { espId: number; name: string }) => renameEsp(homeId!, espId, name),
    onSuccess: invalidate,
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Rename failed";
      alert(msg);
    },
  });

  const logsQuery = useQuery({ queryKey: ["logs", homeId, logsFor?.id], queryFn: () => getDeviceLogs(homeId!, logsFor!.id), enabled: logsFor !== null });
  const analyticsQuery = useQuery({ queryKey: ["analytics", homeId, analyticsDays], queryFn: () => getUsageAnalytics(homeId!, analyticsDays), enabled: analyticsOpen && homeId !== null });
  const roomNameFor = (device: Device) => home?.rooms.find((r) => r.id === device.roomId)?.name ?? null;

  if (homes.isLoading) {
    return (
      <div className="page-enter mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[260px] rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (homes.data?.success && homes.data.data.length === 0) {
    return (
      <div className="page-enter mx-auto max-w-xl px-4 py-20 sm:px-6">
        <EmptyState
          icon={<LayoutGrid className="h-6 w-6" />}
          title="No homes yet"
          description="Create your first home on the Homes page, or join your family's home using an invite code."
          action={
            <a href="/homes" className="btn-primary px-6 py-2.5 text-sm inline-flex items-center gap-2">
              Go to Homes
            </a>
          }
        />
      </div>
    );
  }

  if (!homes.data?.success) {
    return <p className="p-10 text-center text-rose-500">{homes.data?.error.message}</p>;
  }

  const myHomes = homes.data.data;

  return (
    <div className="page-enter mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Home Switcher */}
      {myHomes.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {myHomes.map((h) => (
            <button
              key={h.id}
              onClick={() => setActiveHomeId(h.id)}
              className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-all duration-150 ${
                h.id === homeId
                  ? "border-brand bg-brand/10 text-brand dark:bg-brand/15"
                  : "border-night-600 bg-white text-night-500 hover:border-brand/40 hover:text-brand dark:border-night-600 dark:bg-night-800 dark:text-gray-400"
              }`}
            >
              🏠 {h.name}
              <span className="ml-1.5 text-night-500/70">{h._count.devices}d · {h._count.members}m</span>
            </button>
          ))}
        </div>
      )}

      {error && <div className="mb-4"><Alert variant="danger" onClose={() => setError("")}>{error}</Alert></div>}
      {otaMsg && <div className="mb-4"><Alert variant="success">📲 {otaMsg}</Alert></div>}

      {home && (
        <div className="space-y-8">
          {/* Greeting Banner */}
          <div className="flex flex-col gap-5 rounded-2xl border border-night-600/70 bg-white p-6 sm:flex-row sm:items-center sm:justify-between dark:border-night-600 dark:bg-night-800 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand sm:flex">
                <LayoutGrid className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand">Dashboard</p>
                <h1 className="mt-0.5 text-xl font-bold text-night-950 dark:text-white sm:text-2xl">
                  Hello, {user?.username ?? "there"} 👋
                </h1>
                <p className="mt-0.5 text-xs text-night-500 dark:text-gray-400">
                  {devices.data?.success && devices.data.data.some((d) => isOnline(d))
                    ? `${devices.data.data.filter((d) => isOnline(d)).length} device${devices.data.data.filter((d) => isOnline(d)).length !== 1 ? "s" : ""} online — everything under control.`
                    : "Welcome home! Control your devices from here."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">
                <Wifi className="h-3 w-3" />
                {devices.data?.success
                  ? `${devices.data.data.filter((d) => isOnline(d)).length}/${devices.data.data.length} online`
                  : "—"}
              </Badge>
              <Badge variant="neutral">
                <Users className="h-3 w-3" />
                {home.members.length} member{home.members.length !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="primary">{myRole}</Badge>
            </div>
          </div>

          {/* Automation Suggestions */}
          {homeId !== null && <AutomationSuggestions homeId={homeId} compact />}

          {/* Quick Actions */}
          {devices.data?.success && devices.data.data.some((d) => d.type === "bulb") && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-night-500">Quick:</span>
              {(() => {
                const bulbIds = devices.data!.data.filter((d) => d.type === "bulb" && isOnline(d)).map((d) => d.id);
                return (
                  <button
                    onClick={() => bulkToggle.mutate({ deviceIds: bulbIds, status: "off" })}
                    disabled={!bulbIds.length || bulkToggle.isPending}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800/30 dark:bg-amber-950/20 dark:text-amber-400"
                  >
                    💡 All lights off
                  </button>
                );
              })()}
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
            {/* Devices Section */}
            <div>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-night-950 dark:text-white">
                  Devices
                  <span className="ml-2 text-xs font-normal text-night-500">
                    ({devices.data?.success ? devices.data.data.length : "…"})
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<BarChart2 className="h-3.5 w-3.5" />}
                    onClick={() => setAnalyticsOpen(true)}
                  >
                    Usage
                  </Button>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-night-500 pointer-events-none" />
                    <input
                      value={deviceQ}
                      onChange={(e) => setDeviceQ(e.target.value)}
                      placeholder="Search device, serial, board…"
                      className="w-full max-w-[220px] rounded-xl border border-night-600 bg-white py-2 pl-8 pr-3 text-xs text-night-950 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 dark:border-night-600 dark:bg-night-800 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Device skeletons */}
              {devices.isLoading && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[260px] rounded-2xl" />)}
                </div>
              )}

              {/* Device cards by room */}
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
                      room.includes(q) || board.includes(q) || boardSerial.includes(q)
                    );
                  })
                  : all;

                if (all.length === 0 && !devices.isLoading) {
                  return (
                    <EmptyState
                      icon={<LayoutGrid className="h-5 w-5" />}
                      title="No devices yet"
                      description={canAdminDevices ? "Add your first device using the panel on the right." : "Ask your home admin to add devices."}
                    />
                  );
                }

                if (q && visible.length === 0) {
                  return <p className="text-sm text-night-500">No devices match "{deviceQ}".</p>;
                }

                const grouped = new Map<number | null, Device[]>();
                for (const d of visible) {
                  const key = d.roomId ?? null;
                  if (!grouped.has(key)) grouped.set(key, []);
                  grouped.get(key)!.push(d);
                }
                const sections = [
                  ...home.rooms.map((r) => ({ title: r.name, roomId: r.id as number | null, list: grouped.get(r.id) ?? [] })),
                  { title: "Other devices", roomId: null as number | null, list: grouped.get(null) ?? [] },
                ].filter((s) => s.list.length > 0);

                return (
                  <div className="space-y-8">
                    {sections.map((s) => (
                      <div key={s.roomId ?? "none"}>
                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-night-950 dark:text-white">
                            <span className="text-base">{s.roomId !== null ? "📍" : "📦"}</span>
                            {s.title}
                            <span className="text-xs font-normal text-night-500">({s.list.length})</span>
                          </h3>
                          {canManage && (
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={bulkToggle.isPending}
                                onClick={() => bulkToggle.mutate({ deviceIds: s.list.map((d) => d.id), status: "off" })}
                              >
                                All off
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={bulkToggle.isPending}
                                onClick={() => bulkToggle.mutate({ deviceIds: s.list.map((d) => d.id), status: "on" })}
                              >
                                All on
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {s.list.map((device) => (
                            <DeviceCard
                              key={device.id}
                              device={device}
                              roomName={s.roomId !== null ? s.title : null}
                              canManage={canManage}
                              pending={pending[device.id] !== undefined}
                              disabled={toggle.isPending && pending[device.id] === undefined}
                              isBlocked={!!blockedDevices[device.id]}
                              onToggle={(d) => toggle.mutate({ device: d, status: d.status === "on" ? "off" : "on" })}
                              onEdit={(d) => { setEditing(d); setEditName(d.name); setEditRoom(d.roomId ? String(d.roomId) : ""); }}
                              onLogs={(d) => setLogsFor(d)}
                              latestVersion={latestForModel(device.esp?.modelCode)}
                              onOta={(d) => {
                                const cur = d.esp?.firmwareVersion ?? "—";
                                const next = latestForModel(d.esp?.modelCode);
                                if (next && confirm(`Update board "${d.esp?.name}" firmware?\nCurrent: v${cur} → Latest: v${next}`)) {
                                  pushOta.mutate(d);
                                }
                              }}
                              onRenameBoard={(esp) => {
                                const name = window.prompt("New board name (must be unique):", esp.name ?? "");
                                if (name && name.trim()) renameBoard.mutate({ espId: esp.id, name: name.trim() });
                              }}
                              onDelete={(d) => {
                                if (confirm(`Delete "${d.name}"? This cannot be undone.`)) removeDevice.mutate(d.id);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Schedules */}
              <div className="mt-10">
                <ScheduleSection homeId={homeId!} devices={devices.data?.success ? devices.data.data : []} canManage={canManage} />
              </div>
            </div>

            {/* Right Sidebar */}
            <aside className="space-y-5">
              {/* Add Device */}
              {canAdminDevices && (
                <Card className="p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-night-950 dark:text-white">
                    <Plus className="h-4 w-4 text-brand" />
                    Add Device
                  </h3>
                  <div className="space-y-3">
                    <Input
                      label="Name"
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      placeholder="e.g. Living Room Light"
                    />
                    <Select
                      label="Type"
                      value={addForm.type}
                      onChange={(e) => setAddForm({ ...addForm, type: e.target.value as DeviceType })}
                    >
                      {DEVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                    <Select
                      label="Room"
                      value={addForm.roomId}
                      onChange={(e) => setAddForm({ ...addForm, roomId: e.target.value })}
                    >
                      <option value="">No room</option>
                      {home.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </Select>
                    <Button
                      variant="primary"
                      className="w-full"
                      loading={addDevice.isPending}
                      disabled={!addForm.name}
                      onClick={() => addDevice.mutate()}
                    >
                      <Plus className="h-4 w-4" />
                      Add Device
                    </Button>
                  </div>
                </Card>
              )}

              {/* Rooms */}
              {canAdminDevices && (
                <Card className="p-5">
                  <h3 className="mb-4 text-sm font-semibold text-night-950 dark:text-white">📍 Rooms</h3>
                  <div className="mb-3 flex gap-2">
                    <input
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="New room name"
                      className="flex-1 rounded-xl border border-night-600 bg-night-900/50 px-3 py-2 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 dark:bg-night-700 dark:text-gray-100"
                      onKeyDown={(e) => { if (e.key === "Enter" && roomName) addRoom.mutate(); }}
                    />
                    <Button size="sm" variant="primary" disabled={!roomName} onClick={() => addRoom.mutate()}>
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {home.rooms.map((r) => (
                      <span
                        key={r.id}
                        className="flex items-center gap-1 rounded-full border border-night-600 bg-night-900/50 px-2.5 py-1 text-[11px] font-medium text-night-950 dark:bg-night-700 dark:text-gray-300"
                      >
                        {r.name}
                        <button
                          onClick={() => removeRoom.mutate(r.id)}
                          className="ml-0.5 rounded-full text-night-500 hover:text-rose-500 transition-colors"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {home.rooms.length === 0 && <p className="text-xs text-night-500">No rooms yet.</p>}
                  </div>
                </Card>
              )}

              {/* Boards Summary */}
              <Card className="p-5">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-night-950 dark:text-white">
                  <Wifi className="h-4 w-4 text-brand" />
                  Boards
                </h3>
                {(() => {
                  const boards = new Map<number, NonNullable<Device["esp"]>>();
                  (devices.data?.success ? devices.data.data : []).forEach((d) => { if (d.esp) boards.set(d.esp.id, d.esp); });
                  if (boards.size === 0) return <p className="text-xs text-night-500">No ESP boards linked.</p>;
                  return (
                    <div className="space-y-2">
                      {[...boards.values()].map((b) => {
                        const isOnlineBoard = !b.offline && b.lastSeen && Date.now() - new Date(b.lastSeen).getTime() < 120_000;
                        return (
                          <div key={b.id} className="flex items-center gap-2.5 rounded-xl border border-night-600/70 bg-night-900/50 px-3 py-2 dark:bg-night-700/40">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${isOnlineBoard ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-red-400"}`} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-night-950 dark:text-white">{b.name ?? "ESP Board"}</p>
                              <p className="truncate text-[10px] text-night-500">{b.modelCode ?? "—"} · v{b.firmwareVersion ?? "—"}</p>
                            </div>
                            <span className={`text-[10px] font-bold uppercase ${isOnlineBoard ? "text-emerald-500" : "text-red-400"}`}>
                              {isOnlineBoard ? "online" : "offline"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </Card>

              {/* Members */}
              <Card className="p-5">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-night-950 dark:text-white">
                  <Users className="h-4 w-4 text-brand" />
                  Members
                </h3>
                <div className="space-y-2">
                  {home.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand dark:bg-brand/15 dark:text-brand-light">
                        {(m.user?.username ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-night-950 dark:text-white">{m.user?.username ?? "Member"}</p>
                        <p className="text-[10px] uppercase tracking-wide text-night-500">{m.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </aside>
          </div>
        </div>
      )}

      {/* Edit Device Modal */}
      {editing && (
        <Modal title={`Edit: ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <Input
              label="Device Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
            <Select
              label="Room"
              value={editRoom}
              onChange={(e) => setEditRoom(e.target.value)}
            >
              <option value="">No room</option>
              {home?.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
            <Button
              variant="primary"
              className="w-full"
              loading={saveEdit.isPending}
              disabled={!editName}
              onClick={() => saveEdit.mutate()}
            >
              Save Changes
            </Button>
          </div>
        </Modal>
      )}

      {/* Analytics Modal */}
      {analyticsOpen && (
        <Modal title={`Usage — last ${analyticsDays} days`} onClose={() => setAnalyticsOpen(false)}>
          <div className="mb-4 flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setAnalyticsDays(d)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  analyticsDays === d
                    ? "bg-brand text-white"
                    : "border border-night-600 text-night-500 hover:bg-night-700"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          {analyticsQuery.isLoading && <p className="text-sm text-night-500">Loading…</p>}
          {analyticsQuery.data?.success && <AnalyticsBody data={analyticsQuery.data.data} />}
          {analyticsQuery.data?.success === false && (
            <Alert variant="danger">{analyticsQuery.data.error.message}</Alert>
          )}
        </Modal>
      )}

      {/* Device Logs Modal */}
      {logsFor && (
        <Modal title={`${logsFor.name} — Activity`} onClose={() => setLogsFor(null)}>
          {logsQuery.isLoading && <p className="text-sm text-night-500">Loading…</p>}
          <div className="space-y-2">
            {(logsQuery.data?.success ? logsQuery.data.data : []).map((log) => (
              <div key={log.id} className="rounded-xl border border-night-600/70 bg-night-900/50 px-3 py-2.5 dark:bg-night-700/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-night-950 dark:text-gray-200">{log.logMessage}</span>
                  <span className="shrink-0 text-[10px] text-night-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-night-500">
                  {log.actor ? `by ${log.actor.username}` : "by device"} · {log.logType}
                </p>
              </div>
            ))}
            {logsQuery.data?.success && logsQuery.data.data.length === 0 && (
              <p className="text-sm text-night-500">No activity yet.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
