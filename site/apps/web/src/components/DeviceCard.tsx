import { Edit2, Trash2 } from "lucide-react";
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
  bulb: "rgba(253, 224, 71, 0.85)", // Yellow
  tv: "rgba(244, 114, 182, 0.85)",  // Pink
  fan: "rgba(56, 189, 248, 0.85)",  // Sky
  ac: "rgba(167, 139, 250, 0.85)",  // Violet
  plug: "rgba(52, 211, 153, 0.85)", // Emerald
  custom: "rgba(251, 146, 60, 0.85)", // Orange
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
        ${on ? "border-slate-600 bg-slate-800" : "border-slate-800 bg-slate-900"} 
        ${on ? "" : "opacity-95"}
        ${isBlocked ? "pointer-events-none opacity-50 grayscale" : ""}
      `}
    >
      {/* Admin Actions (Top Right) */}
      {canManage && (
        <div className="absolute right-4 top-4 z-10 flex gap-2">
          {onLogs && (
            <button
              onClick={(e) => { e.stopPropagation(); onLogs(device); }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 shadow-md transition-colors hover:bg-slate-500"
              title="Activity Logs"
            >
              <span className="text-[10px] font-bold text-white">📜</span>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(device); }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ef4444] opacity-80 shadow-md transition-transform hover:scale-110 hover:opacity-100"
            title="Delete Device"
          >
            <Trash2 className="h-3.5 w-3.5 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(device); }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3b82f6] opacity-80 shadow-md transition-transform hover:scale-110 hover:opacity-100"
            title="Edit Device"
          >
            <Edit2 className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      )}

      {/* Center 3D Glowing Emoji */}
      <div
        className="mt-4 flex flex-1 items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-105"
        onClick={() => { if (!disabled && !isBlocked) onToggle(device); }}
      >
        <span
          className="text-[75px] transition-all duration-500 ease-out"
          style={{
            textShadow: on ? `0 0 30px ${GLOW_COLORS[typeKey]}, 0 0 60px ${GLOW_COLORS[typeKey]}, 0 0 90px ${GLOW_COLORS[typeKey]}` : "none",
            opacity: on ? 1 : 0.25,
            transform: on ? "scale(1.15)" : "scale(1)",
          }}
        >
          {ICONS[typeKey]}
        </span>
      </div>

      {/* Device Name */}
      <div className="w-full px-2 text-center" onClick={() => { if (!disabled && !isBlocked) onToggle(device); }}>
        <h3 className="truncate text-xl font-bold tracking-wide text-white drop-shadow-md">
          {device.name}
        </h3>
      </div>

      {/* Status Pill Button */}
      <div className="mt-3 flex w-full flex-col items-center gap-1.5 pb-2">
        <button
          onClick={() => onToggle(device)}
          disabled={disabled || isBlocked}
          className={`rounded-full px-6 py-1 text-sm font-bold tracking-widest text-white transition-all duration-300 ${pending ? "animate-pulse" : ""
            } ${on
              ? "bg-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.5)]"
              : "bg-[#4b5563]"
            } ${disabled || isBlocked ? "cursor-not-allowed opacity-50" : "hover:scale-105 active:scale-95"}`}
        >
          {pending ? "..." : on ? "ON" : "OFF"}
        </button>

        {/* Subtitle - Room Name */}
        <span className={`text-[11px] font-bold tracking-wider uppercase text-gray-500`}>
          {roomName || "Home"} {!online && <span className="text-red-500 normal-case ml-1">- Offline</span>}
        </span>
      </div>

      {/* Dim Overlay when blocked */}
      {isBlocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-[22px]">
          <span className="text-3xl">🔒</span>
        </div>
      )}
    </div>
  );
}
