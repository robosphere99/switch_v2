import type { Device, DeviceType } from "@robosphere/shared";
import { isNewerVersion } from "../api/devices";

const ICONS: Record<DeviceType, string> = {
  bulb: "💡",
  fan: "🌀",
  ac: "❄️",
  tv: "📺",
  plug: "🔌",
  custom: "⚙️",
};

/**
 * Online = server marked it online (offline watcher) AND it reported within
 * the last 90 seconds. The backend flips `offline` on stale lastSeen.
 */
export function isOnline(device: Device): boolean {
  if (device.offline) return false;
  if (!device.lastSeen) return false;
  return Date.now() - new Date(device.lastSeen).getTime() < 90_000;
}

export function DeviceCard({
  device,
  roomName,
  canManage,
  onToggle,
  onEdit,
  onDelete,
  onLogs,
  onRenameBoard,
  onOta,
  latestVersion,
  disabled,
}: {
  device: Device;
  roomName?: string | null;
  canManage: boolean;
  onToggle: (device: Device) => void;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onLogs: (device: Device) => void;
  onRenameBoard?: (esp: NonNullable<Device["esp"]>) => void;
  /** Is device ke board ke model ka latest published firmware (update badge ke liye). */
  latestVersion?: string | null;
  onOta?: (device: Device) => void;
  disabled?: boolean;
}) {
  const on = device.status === "on";
  const online = isOnline(device);

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-5 transition ${
        on
          ? "border-brand bg-brand/10 shadow-lg shadow-brand/20"
          : "border-gray-200 bg-night-800"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-3xl">{ICONS[device.type]}</span>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              online
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                online ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
            {online ? "online" : "offline"}
          </span>
          {roomName && <span className="text-[10px] text-gray-500">📍 {roomName}</span>}
        </div>
      </div>

      <div>
        <h3 className="font-semibold">{device.name}</h3>
        <p className="text-[11px] text-gray-500">
          {device.type} · ID {device.id}
          {device.serialNumber ? ` · ${device.serialNumber}` : ""}
          {device.ipAddress ? ` · ${device.ipAddress}` : ""}
        </p>
        {device.esp && (
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
            <span>
              🛰️ {device.esp.name ?? "ESP Board"}
              {device.esp.serialCode ? ` · ${device.esp.serialCode}` : ""}
              {device.esp.modelCode ? ` · ${device.esp.modelCode}` : ""}
              {device.esp.firmwareVersion ? ` · FW v${device.esp.firmwareVersion}` : ""}
            </span>
            {isNewerVersion(latestVersion, device.esp.firmwareVersion) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-bold text-amber-600">
                ⬆ v{latestVersion}
                {canManage && onOta && (
                  <button
                    onClick={() => onOta(device)}
                    className="ml-0.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 hover:bg-amber-500/30"
                    title="Board ka firmware update karo (OTA)"
                  >
                    Update
                  </button>
                )}
              </span>
            )}
            {canManage && onRenameBoard && (
              <button
                onClick={() => onRenameBoard(device.esp!)}
                className="rounded px-1 text-gray-500 transition hover:bg-night-700 hover:text-brand"
                title="Board ka naam badlo"
              >
                ✏️
              </button>
            )}
          </p>
        )}
      </div>

      <button
        onClick={() => onToggle(device)}
        disabled={disabled}
        className={`w-full rounded-lg py-2 text-sm font-bold uppercase tracking-wide transition ${
          on
            ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
            : "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
        } ${disabled ? "cursor-wait opacity-60" : ""}`}
      >
        {on ? "Turn Off" : "Turn On"}
      </button>

      {canManage && (
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => onEdit(device)}
            className="flex-1 rounded bg-gray-100/60 py-1.5 text-gray-600 hover:bg-gray-200"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => onLogs(device)}
            className="flex-1 rounded bg-gray-100/60 py-1.5 text-gray-600 hover:bg-gray-200"
          >
            📜 Logs
          </button>
          <button
            onClick={() => onDelete(device)}
            className="flex-1 rounded bg-red-900/40 py-1.5 text-red-400 hover:bg-red-900/60"
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
}
