import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Wifi, Home as HomeIcon } from "lucide-react";
import { useState } from "react";
import type { Device, DeviceType } from "@robosphere/shared";
import { listDevices, setDeviceStatus, createDevice, updateDevice, deleteDevice, getDeviceLogs, renameEsp, getCurrentFirmware, requestOta } from "../api/devices";
import { listHomes, getHomeDetail } from "../api/homes";
import { createRoom, deleteRoom } from "../api/rooms";
import { DeviceCard, isOnline } from "../components/DeviceCard";
import { Switch, TYPE_ICONS } from "../components/Switch";
import { Modal } from "../components/Modal";
import { ScheduleSection } from "../components/ScheduleSection";
import { useAuthStore } from "../stores/auth";

const DEVICE_TYPES: DeviceType[] = ["bulb", "fan", "ac", "tv", "plug", "custom"];


function apiErrMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
    "Kuch galat ho gaya"
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
  const [error, setError] = useState("");

  const homes = useQuery({ queryKey: ["homes"], queryFn: listHomes, refetchInterval: 30_000 });

  const homeId = activeHomeId ?? (homes.data?.success ? (homes.data.data[0]?.id ?? null) : null);

  const homeDetail = useQuery({
    queryKey: ["home", homeId],
    queryFn: () => getHomeDetail(homeId!),
    enabled: homeId !== null,
    refetchInterval: 10_000,
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
    refetchInterval: 5_000,
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

  const toggle = useMutation({
    mutationFn: ({ device, status }: { device: Device; status: "on" | "off" }) =>
      setDeviceStatus(homeId!, device.id, status),
    onSuccess: invalidate,
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
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
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

          {/* ===== Quick control cards ===== */}
          {devices.data?.success && devices.data.data.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-night-950">Quick Controls</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {devices.data.data.map((device) => {
                  const on = device.status === "on";
                  const online = isOnline(device);
                  return (
                    <div
                      key={device.id}
                      className={`flex w-40 shrink-0 flex-col gap-3 rounded-2xl border p-4 transition ${
                        on
                          ? "border-brand bg-brand/10 shadow-md shadow-brand/20"
                          : "border-gray-200 bg-night-800 dark:border-night-600"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide ${
                            on ? "text-brand" : "text-gray-400"
                          }`}
                        >
                          {on ? "ON" : "OFF"}
                        </span>
                        <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-red-400"}`} />
                      </div>
                      <span className="text-3xl">{TYPE_ICONS[device.type]}</span>
                      <div>
                        <p className="truncate text-sm font-semibold text-night-950">{device.name}</p>
                        <p className="truncate text-[11px] text-gray-500">
                          {roomNameFor(device) ?? device.type}
                        </p>
                      </div>
                      <Switch
                        checked={on}
                        onChange={() =>
                          toggle.mutate({ device, status: on ? "off" : "on" })
                        }
                        disabled={toggle.isPending}
                        label={`${device.name} ${on ? "band karo" : "chalu karo"}`}
                      />
                    </div>
                  );
                })}
              </div>
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
                <input
                  value={deviceQ}
                  onChange={(e) => setDeviceQ(e.target.value)}
                  placeholder="🔍 Search device / serial / board…"
                  className="w-full max-w-xs rounded-lg border border-gray-200 bg-night-800 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-brand dark:border-night-600"
                />
              </div>
              {devices.isLoading && <p className="text-gray-500">Loading devices…</p>}
              {devices.data?.success && devices.data.data.length === 0 && (
                <p className="text-gray-500">
                  No devices yet{canAdminDevices ? " — add your first device!" : ""}
                </p>
              )}
              {(() => {
                const q = deviceQ.trim().toLowerCase();
                const visible = devices.data?.success
                  ? devices.data.data.filter((d) => {
                      if (!q) return true;
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
                  : [];
                if (q && visible.length === 0) {
                  return <p className="text-gray-500">No devices match "{deviceQ}".</p>;
                }
                return (
                  <div className="grid gap-5 sm:grid-cols-2">
                    {visible.map((device) => (
                      <DeviceCard
                        key={device.id}
                        device={device}
                        roomName={roomNameFor(device)}
                        canManage={canManage}
                        disabled={toggle.isPending}
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
