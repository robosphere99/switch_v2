import type { BoardHistoryEvent } from "../api/devices";

/** Activity timeline labels — audit action se user-friendly Hindi label + icon. */
export function historyEvent(ev: BoardHistoryEvent): { icon: string; label: string; detail?: string } {
  const meta = ev.meta;
  switch (ev.action) {
    case "user.esp.rename":
      return {
        icon: "✏️",
        label: "Naam badla",
        detail: meta?.from && meta?.to ? `${meta.from} → ${meta.to}` : undefined,
      };
    case "admin.esp.rename":
      return {
        icon: "🛠️",
        label: "Support ne naam badla",
        detail: meta?.from && meta?.to ? `${meta.from} → ${meta.to}` : undefined,
      };
    case "admin.esp.key.issue":
      return { icon: "🔑", label: "Naya API key issue hua" };
    case "user.ota.push":
      return { icon: "📤", label: "OTA update request", detail: meta?.version ? `FW v${meta.version}` : undefined };
    case "admin.ota.push":
      return { icon: "📤", label: "Firmware push (admin)", detail: meta?.version ? `FW v${meta.version}` : undefined };
    case "admin.ota.push_all":
      return { icon: "📤", label: "Firmware push (sabko)", detail: meta?.version ? `FW v${meta.version}` : undefined };
    case "shop.device.claim":
      return { icon: "📦", label: "Device claim hua", detail: meta?.serialCode ? `Serial ${meta.serialCode}` : undefined };
    default:
      return { icon: "📌", label: ev.action.replace(/\./g, " ") };
  }
}
