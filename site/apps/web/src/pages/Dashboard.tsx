import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Device, DeviceType } from "@robosphere/shared";
import { listDevices, setDeviceStatus, createDevice, updateDevice, deleteDevice, getDeviceLogs, renameEsp } from "../api/devices";
import { listHomes, getHomeDetail } from "../api/homes";
import { createRoom, deleteRoom } from "../api/rooms";
import { DeviceCard } from "../components/DeviceCard";
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

  const [deviceQ, setDeviceQ] = useState("");
  const devices = useQuery({
    queryKey: ["devices", homeId],
    queryFn: () => listDevices(homeId!),
    enabled: homeId !== null,
    refetchInterval: 5_000,
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

  if (homes.isLoading) return <p className="p-10 text-center text-gray-400">Loading…</p>;

  if (homes.data?.success && homes.data.data.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">No homes yet</h1>
        <p className="text-gray-400">
          Create your home on the <span className="text-brand-light">Homes</span> page, or join
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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">⚙️ Dashboard</h1>
        <span className="rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-light">
          Your role: {myRole}
        </span>
      </div>

      {/* Home switcher */}
      <div className="mb-8 flex flex-wrap gap-3">
        {myHomes.map((h) => (
          <button
            key={h.id}
            onClick={() => setActiveHomeId(h.id)}
            className={`rounded-lg border px-5 py-2.5 text-sm font-semibold transition ${
              h.id === homeId
                ? "border-brand bg-brand/20 text-brand-light"
                : "border-gray-700 bg-night-800 text-gray-300 hover:border-gray-500"
            }`}
          >
            🏠 {h.name}
            <span className="ml-2 text-xs text-gray-500">
              {h._count.devices} devices · {h._count.members} members
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {home && (
        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          {/* Left column: add device + rooms */}
          <div className="space-y-6">
            {canAdminDevices && (
              <div className="rounded-xl border border-brand/20 bg-night-800 p-5">
                <h2 className="mb-4 font-semibold">➕ Add Device</h2>
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
                  className="w-full rounded-lg bg-gradient-to-r from-brand to-brand-light py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Add Device
                </button>
              </div>
            )}

            {canAdminDevices && (
              <div className="rounded-xl border border-gray-700 bg-night-800 p-5">
                <h2 className="mb-4 font-semibold">📍 Rooms</h2>
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
                      className="flex items-center gap-1.5 rounded-full border border-gray-600 bg-night-900 px-3 py-1 text-xs"
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
          </div>

          {/* Right: devices */}
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                Devices{" "}
                <span className="text-sm font-normal text-gray-500">
                  ({devices.data?.success ? devices.data.data.length : "…"})
                </span>
              </h2>
              <input
                value={deviceQ}
                onChange={(e) => setDeviceQ(e.target.value)}
                placeholder="🔍 Search device / serial / board…"
                className="w-full max-w-xs rounded-lg border border-gray-700 bg-night-800 px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-brand"
              />
            </div>
            {devices.isLoading && <p className="text-gray-400">Loading devices…</p>}
            {devices.data?.success && devices.data.data.length === 0 && (
              <p className="text-gray-400">
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
                return <p className="text-gray-400">No devices match "{deviceQ}".</p>;
              }
              return (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title={`Edit: ${editing.name}`} onClose={() => setEditing(null)}>
          <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">Name</label>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="mb-4 w-full rounded-lg border border-brand/20 bg-night-900 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
          <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">Room</label>
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
            className="w-full rounded-lg bg-gradient-to-r from-brand to-brand-light py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save Changes
          </button>
        </Modal>
      )}

      {/* Logs modal */}
      {logsFor && (
        <Modal title={`📜 ${logsFor.name} — Activity`} onClose={() => setLogsFor(null)}>
          {logsQuery.isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          <div className="space-y-2">
            {(logsQuery.data?.success ? logsQuery.data.data : []).map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-gray-700 bg-night-900 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-200">{log.logMessage}</span>
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
