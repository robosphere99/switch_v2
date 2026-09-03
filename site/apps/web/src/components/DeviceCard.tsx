import { Edit2, Trash2, ScrollText } from "lucide-react";
import type { Device, DeviceType } from "@robosphere/shared";

const ICONS: Record<DeviceType, string> = {
  bulb: "💡",
  fan: "🌀",
  ac: "❄️",
  tv: "📺",
  plug: "🔌",
  custom: "⚙️",
};

const GLOW_COLORS: Record<string, string> = {
  bulb: "rgba(253, 224, 71, 0.80)",  // Yellow
  tv: "rgba(244, 114, 182, 0.80)",   // Pink
  fan: "rgba(56, 189, 248, 0.80)",   // Sky
  ac: "rgba(167, 139, 250, 0.80)",   // Violet
  plug: "rgba(52, 211, 153, 0.80)",  // Emerald
  custom: "rgba(251, 146, 60, 0.80)", // Orange
};

const ON_BG: Record<string, string> = {
  bulb: "bg-yellow-500/15",
  tv: "bg-pink-500/15",
  fan: "bg-sky-500/15",
  ac: "bg-violet-500/15",
  plug: "bg-emerald-500/15",
  custom: "bg-orange-500/15",
};

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
  pending,
  disabled,
  isBlocked,
}: {
  device: Device;
  roomName?: string | null;
  canManage: boolean;
  onToggle: (device: Device) => void;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onLogs: (device: Device) => void;
  onRenameBoard?: (esp: NonNullable<Device["esp"]>) => void;
  latestVersion?: string | null;
  onOta?: (device: Device) => void;
  pending?: boolean;
  disabled?: boolean;
  isBlocked?: boolean;
}) {
  const on = device.status === "on";
  const online = isOnline(device);
  const typeKey = device.type || "custom";

  return (
    <div
      className={`relative flex h-[280px] flex-col items-center justify-between overflow-hidden rounded-3xl border-2 p-5 transition-all duration-500
        ${on
          ? `border-slate-600/80 bg-gradient-to-b from-slate-800 to-slate-900 ${ON_BG[typeKey]}`
          : "border-slate-800 bg-slate-900"
        }
        ${isBlocked ? "pointer-events-none opacity-50 grayscale" : ""}
      `}
    >
      {/* Online indicator dot */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${
            online
              ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]"
              : "bg-gray-600"
          }`}
        />
        {!online && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
            Offline
          </span>
        )}
      </div>

      {/* Admin Actions (Top Right) */}
      {canManage && (
        <div className="absolute right-4 top-4 z-10 flex gap-1.5">
          {onLogs && (
            <button
              onClick={(e) => { e.stopPropagation(); onLogs(device); }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700/80 shadow-md transition-all hover:bg-slate-600"
              title="Activity Logs"
            >
              <ScrollText className="h-3.5 w-3.5 text-gray-300" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(device); }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/80 shadow-md transition-all hover:bg-blue-500 hover:scale-105"
            title="Edit Device"
          >
            <Edit2 className="h-3.5 w-3.5 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(device); }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/80 shadow-md transition-all hover:bg-red-500 hover:scale-105"
            title="Delete Device"
          >
            <Trash2 className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      )}

      {/* Center Glowing Emoji */}
      <div
        className="mt-4 flex flex-1 cursor-pointer items-center justify-center transition-transform duration-300 hover:scale-105"
        onClick={() => { if (!disabled && !isBlocked) onToggle(device); }}
      >
        <span
          className="text-[72px] transition-all duration-500 ease-out select-none"
          style={{
            textShadow: on
              ? `0 0 30px ${GLOW_COLORS[typeKey]}, 0 0 60px ${GLOW_COLORS[typeKey]}`
              : "none",
            opacity: on ? 1 : 0.22,
            transform: on ? "scale(1.12)" : "scale(1)",
          }}
        >
          {ICONS[typeKey]}
        </span>
      </div>

      {/* Device Name */}
      <div
        className="w-full px-2 text-center"
        onClick={() => { if (!disabled && !isBlocked) onToggle(device); }}
      >
        <h3 className="truncate text-lg font-bold tracking-wide text-white drop-shadow-sm">
          {device.name}
        </h3>
      </div>

      {/* Status toggle pill */}
      <div className="mt-3 flex w-full flex-col items-center gap-1.5 pb-1">
        <button
          onClick={() => onToggle(device)}
          disabled={disabled || isBlocked}
          className={`rounded-full px-6 py-1.5 text-xs font-bold tracking-widest text-white transition-all duration-300
            ${pending ? "animate-pulse" : ""}
            ${on
              ? "bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.45)]"
              : "bg-slate-700 hover:bg-slate-600"
            }
            ${disabled || isBlocked ? "cursor-not-allowed opacity-50" : "hover:scale-105 active:scale-95"}
          `}
        >
          {pending ? "..." : on ? "ON" : "OFF"}
        </button>

        <span className="text-[11px] font-semibold tracking-wider uppercase text-gray-600">
          {roomName || "Home"}
        </span>
      </div>

      {/* Blocked overlay */}
      {isBlocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[22px] bg-black/40">
          <span className="text-3xl">🔒</span>
        </div>
      )}
    </div>
  );
}
