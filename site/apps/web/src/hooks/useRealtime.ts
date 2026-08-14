import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth";
import { getSocket, disconnectSocket, reconnectSocket } from "../lib/socket";

/**
 * Global realtime wiring:
 * - connects the Socket.IO client when logged in
 * - device:updated / command:updated → refresh devices + home detail
 * - notification:new → refresh the bell
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

    const onDeviceUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["home"] });
    };
    const onCommandUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    };
    const onNotification = () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    socket.on("device:updated", onDeviceUpdated);
    socket.on("command:updated", onCommandUpdated);
    socket.on("notification:new", onNotification);

    return () => {
      socket.off("device:updated", onDeviceUpdated);
      socket.off("command:updated", onCommandUpdated);
      socket.off("notification:new", onNotification);
    };
  }, [accessToken, queryClient]);
}
