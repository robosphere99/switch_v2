import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../stores/auth";

let socket: Socket | null = null;

/** Get the shared socket, connecting lazily with the current JWT. */
export function getSocket(): Socket {
  if (socket) return socket;
  const token = useAuthStore.getState().accessToken;
  socket = io({
    auth: { token },
    transports: ["websocket", "polling"],
  });
  socket.on("disconnect", () => {
    // stale reference; next getSocket() call reconnects
    socket = null;
  });
  return socket;
}

/** Disconnect (call on logout). */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Reconnect with a fresh token (call after login/refresh). */
export function reconnectSocket(): void {
  disconnectSocket();
  getSocket();
}
