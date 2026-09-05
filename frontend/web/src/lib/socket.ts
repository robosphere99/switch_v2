import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../stores/auth";

let socket: Socket | null = null;
let socketToken: string | null = null;

/**
 * Get the shared socket, connecting lazily with the current JWT.
 * Token change hone pe purana socket disconnect + naye token se connect
 * (auth expiry/refresh pe bina crash ke reconnect). Polling-first transport
 * proxy/StrictMode ke under zyada robust hai (ws upgrade phir hota hai).
 */
export function getSocket(): Socket {
  const token = useAuthStore.getState().accessToken;
  if (socket && socketToken === token) return socket;
  if (socket) {
    // Token badal gaya — purana socket naye token se auth nahi ho sakta.
    socket.disconnect();
    socket = null;
  }
  socketToken = token;
  socket = io({
    auth: { token },
    transports: ["polling", "websocket"],
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
