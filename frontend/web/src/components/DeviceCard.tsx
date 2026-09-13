import { Edit2, Trash2, ScrollText, Lock } from "lucide-react";
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
  bulb: "rgba(253, 224, 71, 0.70)",
  tv: "rgba(244, 114, 182, 0.70)",
  fan: "rgba(56, 189, 248, 0.70)",
  ac: "rgba(167, 139, 250, 0.70)",
  plug: "rgba(52, 211, 153, 0.70)",
  custom: "rgba(251, 146, 60, 0.70)",
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
      className={`relative flex h-[260px] flex-col items-center justify-between overflow-hidden rounded-2xl border p-5 transition-all duration-300 select-none
        ${on
          ? "border-white/25 bg-zinc-900/90 shadow-[0_0_25px_rgba(255,255,255,0.06)]"
          : "border-white/[0.08] bg-zinc-950 hover:border-white/20 hover:bg-zinc-900/50"
        }
        ${isBlocked ? "pointer-events-none opacity-50 grayscale" : ""}
      `}
    >
      {/* Online indicator */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${
            online
              ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
              : "bg-slate-300 dark:bg-slate-600"
          }`}
        />
        {!online && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-night-500 dark:text-gray-500">
            Offline
          </span>
        )}
      </div>

      {/* Admin Actions */}
      {canManage && (
        <div className="absolute right-3 top-3 z-10 flex gap-1">
          {onLogs && (
            <button
              onClick={(e) => { e.stopPropagation(); onLogs(device); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-night-500 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-night-950 dark:bg-night-700/80 dark:text-gray-400 dark:hover:bg-night-700 dark:hover:text-gray-100"
              title="Activity Logs"
            >
              <ScrollText className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(device); }}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand shadow-sm transition hover:bg-brand/20 dark:bg-brand/15 dark:text-brand-light"
            title="Edit Device"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(device); }}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-500 shadow-sm transition hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50"
            title="Delete Device"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Emoji Icon with Glow */}
      <div
        className="mt-4 flex flex-1 cursor-pointer items-center justify-center"
        onClick={() => { if (!disabled && !isBlocked) onToggle(device); }}
      >
        <span
          className="text-[64px] transition-all duration-400 ease-out"
          style={{
            textShadow: on ? `0 0 28px ${GLOW_COLORS[typeKey]}, 0 0 56px ${GLOW_COLORS[typeKey]}` : "none",
            opacity: on ? 1 : 0.3,
            transform: on ? "scale(1.08)" : "scale(1)",
          }}
        >
          {ICONS[typeKey]}
        </span>
      </div>

      {/* Device Name */}
      <div
        className="w-full px-2 text-center cursor-pointer"
        onClick={() => { if (!disabled && !isBlocked) onToggle(device); }}
      >
        <h3 className={`truncate text-sm font-bold tracking-tight ${on ? "text-night-950 dark:text-white" : "text-night-500 dark:text-gray-400"}`}>
          {device.name}
        </h3>
      </div>

      {/* Toggle Button */}
      <div className="mt-3 flex w-full flex-col items-center gap-1.5 pb-1">
        <button
          onClick={() => onToggle(device)}
          disabled={disabled || isBlocked}
          className={`rounded-full px-6 py-1.5 text-[11px] font-mono font-bold tracking-[0.12em] uppercase transition-all duration-200
            ${pending ? "animate-pulse" : ""}
            ${on
              ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.25)] hover:bg-zinc-200"
              : "border border-white/10 bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-white"
            }
            ${disabled || isBlocked ? "cursor-not-allowed opacity-50" : "hover:scale-105 active:scale-95"}
          `}
        >
          {pending ? "···" : on ? "ON" : "OFF"}
        </button>

        <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">
          {roomName || "Home"}
        </span>
      </div>

      {/* Blocked overlay */}
      {isBlocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/50 backdrop-blur-xs dark:bg-night-900/50">
          <Lock className="h-8 w-8 text-night-500" />
        </div>
      )}
    </div>
  );
}
