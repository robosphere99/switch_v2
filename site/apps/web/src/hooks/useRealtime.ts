import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth";
import { getSocket, disconnectSocket } from "../lib/socket";
import {
  applyInvalidations,
  applyRemovals,
  REALTIME_INVALIDATIONS,
  REALTIME_RECONNECT_KEYS,
  REALTIME_REMOVALS,
} from "../lib/realtimeMap";

/**
 * Global realtime wiring:
 * - connects the Socket.IO client when logged in
 * - socket events → react-query invalidations (mapping lib/realtimeMap me)
 * - access-revoked → stale home/device queries REMOVE
 * - reconnect (socket gir ke wapas aaye) → saari core queries refresh (gap recover)
 * - listeners effect cleanup pe off hote hain (re-render pe duplicates nahi)
 */
export function useRealtime() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) {
      disconnectSocket();
      return;
    }
    const socket = getSocket();

    const handlers: Record<string, () => void> = {};
    for (const event of Object.keys(REALTIME_INVALIDATIONS)) {
      handlers[event] = () => applyInvalidations(queryClient, event);
    }
    // Removals (access-revoked) — invalidate ke saath stale data bhi hatana.
    for (const event of Object.keys(REALTIME_REMOVALS)) {
      const prev = handlers[event];
      handlers[event] = prev
        ? () => {
            prev();
            applyRemovals(queryClient, event);
          }
        : () => applyRemovals(queryClient, event);
    }

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }

    // Reconnect pe gap recover — saare chhute hue events ki queries refresh.
    const onReconnect = () => {
      for (const key of REALTIME_RECONNECT_KEYS) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    };
    socket.io.on("reconnect", onReconnect);

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event, handler);
      }
      socket.io.off("reconnect", onReconnect);
    };
  }, [accessToken, queryClient]);
}
