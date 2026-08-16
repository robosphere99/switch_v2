import type { QueryClient } from "@tanstack/react-query";

/**
 * Socket.IO event → react-query query keys jo invalidate hote hain.
 * useRealtime hook isi map se listeners banata hai — mapping ka single
 * source of truth (testable, aur naye events yahan ek line me add hote hain).
 */
export const REALTIME_INVALIDATIONS: Record<string, Array<Array<string | number>>> = {
  "device:updated": [["devices"], ["home"]],
  "esp:updated": [["devices"], ["home"]],
  "command:updated": [["devices"]],
  "notification:new": [["notifications"]],
};

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
