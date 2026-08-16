import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth";
import { getSocket, disconnectSocket, reconnectSocket } from "../lib/socket";
import { applyInvalidations, REALTIME_INVALIDATIONS } from "../lib/realtimeMap";

/**
 * Global realtime wiring:
 * - connects the Socket.IO client when logged in
 * - socket events → react-query invalidations (mapping lib/realtimeMap me)
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
    reconnectSocket();
    const socket = getSocket();

    const handlers: Record<string, () => void> = {};
    for (const event of Object.keys(REALTIME_INVALIDATIONS)) {
      handlers[event] = () => applyInvalidations(queryClient, event);
    }

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event, handler);
      }
    };
  }, [accessToken, queryClient]);
}
