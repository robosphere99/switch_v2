/**
 * Realtime (Socket.IO) event names + payload types.
 * API emit karta hai aur web sunta hai — dono yahi constants/types use karte
 * hain, taaki event name typo/partial-payload mismatch na ho.
 */

export const REALTIME_EVENTS = {
  /** Device row change — hamesha uniform DTO (id + status + online + updatedAt). */
  deviceUpdated: "device:updated",
  /** ESP board update (admin/devices page). */
  espUpdated: "esp:updated",
  /** Command executed/failed — pending badge confirm ke liye. */
  commandUpdated: "command:updated",
  /** Naya notification (bell + badge). */
  notificationNew: "notification:new",
  /** Support chat message. */
  supportNew: "support:new",
  /** Socket connect hone pe ack — UI "live" indicator ke liye. */
  socketReady: "socket:ready",
  /** Home membership revoke/role-change — socket ko room se nikaala gaya. */
  homeAccessRevoked: "home:access-revoked",
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

/** `device:updated` ka uniform payload — partial `{id}` events ki jagah. */
export interface RealtimeDeviceEvent {
  id: number;
  /** Web side isi home ki device queries invalidate karta hai. */
  homeId: number;
  name?: string;
  status?: "on" | "off";
  online?: boolean;
  offline?: boolean;
  lastSeen?: string | null;
  updatedAt: string;
}

/** `command:updated` payload — pending → executed/failed confirm. */
export interface RealtimeCommandEvent {
  id: number;
  status: "pending" | "executed" | "failed" | "cancelled";
  executedAt?: string | null;
}
