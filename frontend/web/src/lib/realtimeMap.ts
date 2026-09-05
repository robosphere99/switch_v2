import type { QueryClient } from "@tanstack/react-query";

/**
 * Socket.IO event → react-query query keys jo invalidate hote hain.
 * useRealtime hook isi map se listeners banata hai — mapping ka single
 * source of truth (testable, aur naye events yahan ek line me add hote hain).
 */
export const REALTIME_INVALIDATIONS: Record<string, Array<Array<string | number>>> = {
  "device:updated": [["devices"], ["home"], ["my-boards"]],
  "esp:updated": [["devices"], ["home"], ["my-boards"]],
  "command:updated": [["devices"]],
  "notification:new": [["notifications"]],
  "notification:deleted": [["notifications"]],
  "notification:updated": [["notifications"]],
  "support:new": [["support"]],
  "home:access-revoked": [["homes"]],
};

/**
 * Access-revoked (membership remove) pe yeh queries REMOVE hote hain —
 * stale data UI me na dikhe (removed member ko devices nahi dikhte).
 */
export const REALTIME_REMOVALS: Record<string, Array<Array<string | number>>> = {
  "home:access-revoked": [["devices"], ["home"]],
};

/**
 * Socket reconnect pe (events ka gap tha) — yeh saari keys refresh hoti hain
 * taaki chhute hue events recover ho jayein.
 */
export const REALTIME_RECONNECT_KEYS: Array<Array<string | number>> = [
  ["devices"],
  ["home"],
  ["homes"],
  ["notifications"],
  ["my-boards"],
];

/** Event ke liye invalidate keys — unknown event → empty (koi listener nahi). */
export function invalidationsForEvent(event: string): Array<Array<string | number>> {
  return REALTIME_INVALIDATIONS[event] ?? [];
}

/** QueryClient pe event ke saare registered keys invalidate karo. */
export function applyInvalidations(queryClient: QueryClient, event: string): void {
  for (const key of invalidationsForEvent(event)) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

/** Event ke liye remove-keys — unknown event → empty. */
export function removalsForEvent(event: string): Array<Array<string | number>> {
  return REALTIME_REMOVALS[event] ?? [];
}

/** QueryClient pe event ke saare registered keys REMOVE karo (stale data hatana). */
export function applyRemovals(queryClient: QueryClient, event: string): void {
  for (const key of removalsForEvent(event)) {
    queryClient.removeQueries({ queryKey: key });
  }
}
