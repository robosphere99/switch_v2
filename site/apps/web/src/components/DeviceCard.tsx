import type { Device, DeviceType } from "@robosphere/shared";
import { isNewerVersion } from "../api/devices";
import { Switch } from "./Switch";

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

/** Human-friendly "last seen" — normal users ke liye, raw timestamps nahi. */
export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return "Last seen: kabhi nahi";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 0) return "Last seen: abhi abhi";
  if (sec < 60) return "Last seen: abhi abhi";
  if (sec < 3600) return `Last seen: ${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `Last seen: ${Math.floor(sec / 3600)} hr ago`;
  return `Last seen: ${new Date(iso).toLocaleDateString()}`;
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
  pending,
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
  /** Is device ke board ka model ka latest published firmware (update badge ke liye). */
  latestVersion?: string | null;
  onOta?: (device: Device) => void;
  /** True = command in-flight (optimistic UI). */
  pending?: boolean;
  disabled?: boolean;
}) {
  const on = device.status === "on";
  const online = isOnline(device);

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 sm:p-5 transition ${
        on
          ? "border-brand bg-brand/10 shadow-lg shadow-brand/20"
          : "border-gray-200 bg-night-800"
      } ${!online ? "opacity-80" : ""}`}
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
        {!online ? (
          <p className="mt-0.5 text-[11px] text-red-400/90">{formatLastSeen(device.lastSeen)}</p>
        ) : (
          <p className="mt-0.5 text-[11px] text-emerald-400/80">Connected just now</p>
        )}
        {/* Board update/rename — sirf affordances, raw serial/model/FW info nahi
            (consumer card clean rakho; technical detail Boards page pe hai). */}
        {device.esp && (canManage || isNewerVersion(latestVersion, device.esp.firmwareVersion)) && (
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
            <span>🛰️ {device.esp.name ?? "ESP Board"}</span>
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

      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-night-900/60 px-4 py-3 dark:border-night-600">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full transition-colors ${
              pending
                ? "animate-pulse bg-amber-400"
                : on
                  ? "bg-brand"
                  : "bg-gray-400 dark:bg-night-500"
            }`}
          />
          <span className="text-sm font-bold text-gray-700 dark:text-night-950">
            {pending ? "PENDING" : on ? "ON" : "OFF"}
          </span>
        </div>
        {!online ? (
          <span className="text-[10px] font-semibold text-red-400/80">
            Offline — control band
          </span>
        ) : (
          <Switch
            checked={on}
            onChange={() => onToggle(device)}
            disabled={disabled}
            pending={pending}
            label={`${device.name} ${on ? "band karo" : "chalu karo"}`}
          />
        )}
      </div>

      {canManage && (
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => onEdit(device)}
            className="flex-1 rounded bg-gray-100/60 py-2.5 text-gray-600 hover:bg-gray-200"
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => onLogs(device)}
            className="flex-1 rounded bg-gray-100/60 py-2.5 text-gray-600 hover:bg-gray-200"
          >
            📜 Activity
          </button>
          <button
            onClick={() => onDelete(device)}
            className="flex-1 rounded bg-red-900/40 py-2.5 text-red-400 hover:bg-red-900/60"
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
}
