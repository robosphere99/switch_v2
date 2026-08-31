import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import type { RealtimeDeviceEvent } from "@robosphere/shared";
import { REALTIME_EVENTS } from "@robosphere/shared";
import { env, corsOrigins } from "../config/env";
import { prisma } from "./prisma";

let io: Server | null = null;

// Track pending WebRTC calls for users who are currently offline or backgrounded
const activeCalls = new Map<number, { adminId: number, callType: string, timestamp: number }>();

/** Attach Socket.IO to the HTTP server. Call once at startup. */
export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: corsOrigins, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error("missing token");
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as unknown as { sub: number, sid?: number };
      socket.data.userId = payload.sub;
      if (payload.sid) {
        socket.data.sessionId = payload.sid;
      }
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId as number;
    const sessionId = socket.data.sessionId as number | undefined;

    socket.join(`user:${userId}`);
    if (sessionId) {
      socket.join(`session:${sessionId}`);
    }

    let joined = 0;
    let isAdmin = false;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      isAdmin = user?.role === "system_admin";
      const homes = isAdmin
        ? await prisma.home.findMany({ select: { id: true } })
        : await prisma.homeMember.findMany({ where: { userId }, select: { homeId: true } });
      for (const h of homes) {
        socket.join(`home:${"homeId" in h ? h.homeId : h.id}`);
        joined++;
      }
    } catch {
      // memberships lookup failure shouldn't kill the socket
    }
    // Connection ack — web ko "live" indicator ke liye (rooms count ke saath).
    socket.emit(REALTIME_EVENTS.socketReady, { homes: joined });
    console.log(`[socket] user ${userId} connected (${joined} homes)`);

    // Sync any pending WebRTC calls if the user was offline/backgrounded
    const pendingCall = activeCalls.get(userId);
    if (pendingCall && (Date.now() - pendingCall.timestamp < 60000)) {
      socket.emit('webrtc:signal', {
        senderId: pendingCall.adminId,
        type: 'call-request',
        payload: { callType: pendingCall.callType }
      });
    }

    // WebRTC Generic Signaling
    socket.on('webrtc:signal', (data) => {
      const { targetId, type, payload } = data || {};
      if (targetId) {
        const roomName = `user:${targetId}`;
        const room = io?.sockets.adapter.rooms.get(roomName);

        if (type === 'call-request') {
          activeCalls.set(targetId, { adminId: userId, callType: payload?.callType || 'video', timestamp: Date.now() });
          setTimeout(() => activeCalls.delete(targetId), 60000);

          if (!room || room.size === 0) {
            // User is offline or backgrounded -> Wake them up with a Push Notification!
            import("../services/push.service").then(({ sendPushToUser }) => {
              sendPushToUser(
                targetId,
                "Incoming Support Call",
                "Admin is calling you for support. Tap to answer.",
                { type: 'webrtc-call', callType: payload?.callType || 'video', adminId: userId },
                "support"
              ).catch(console.error);
            });
            
            // Inform the admin UI that we are waking the user up
            socket.emit('webrtc:signal', {
              senderId: targetId,
              type: 'call-offline-push-sent'
            });
          }
        } else if (type === 'call-end' || type === 'call-reject' || type === 'call-accept') {
          activeCalls.delete(targetId);
          activeCalls.delete(userId);
        }

        socket.to(roomName).emit('webrtc:signal', {
          senderId: userId,
          type,
          payload
        });
      }
    });

    // Terminal Logging & Commands for Admins
    socket.on('admin:subscribe-logs', (data) => {
      if (!isAdmin) return;
      const { espId } = data || {};
      if (espId) {
        socket.join(`board-logs-${espId}`);
        socket.emit('admin:board-log', `[Server] Subscribed to terminal logs for board #${espId}`);
      }
    });
    
    socket.on('admin:unsubscribe-logs', (data) => {
      const { espId } = data || {};
      if (espId) socket.leave(`board-logs-${espId}`);
    });

    socket.on('admin:send-cmd', async (data) => {
      if (!isAdmin) return;
      const { espId, cmd } = data || {};
      if (espId && cmd) {
        try {
          const esp = await prisma.espDevice.findUnique({ where: { id: espId }, select: { macAddress: true }});
          if (esp) {
            import("../services/mqtt.service").then(({ publishTermCommand }) => {
              publishTermCommand(esp.macAddress, cmd);
            });
          }
        } catch (e) {
          console.error("[socket] Failed to send terminal command", e);
        }
      }
    });
  });

  return io;
}

/** Emit an event to a single user's room (notifications, assistant replies). */
export function emitToUser(userId: number, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

/** Emit an event to a single authenticated session (force logout specific device). */
export function emitToSession(sessionId: number, event: string, payload: unknown): void {
  io?.to(`session:${sessionId}`).emit(event, payload);
}

/** Emit an event to everyone who is a member of a home (device updates). */
export function emitToHome(homeId: number, event: string, payload: unknown): void {
  io?.to(`home:${homeId}`).emit(event, payload);
}

/**
 * Uniform `device:updated` emitter — mutation ke baad device re-fetch karke
 * consistent DTO bhejta hai (partial `{id}` events ki jagah). Web side
 * stale-event guard ke liye payload me `updatedAt` hamesha hota hai.
 */
export async function emitDeviceUpdated(homeId: number, deviceId: number): Promise<void> {
  if (!io) return;
  try {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        name: true,
        status: true,
        offline: true,
        lastSeen: true,
        lastUpdated: true,
      },
    });
    if (!device) return;
    const payload: RealtimeDeviceEvent = {
      id: device.id,
      homeId,
      name: device.name,
      status: device.status,
      online: !device.offline,
      offline: device.offline,
      lastSeen: device.lastSeen ? device.lastSeen.toISOString() : null,
      updatedAt: device.lastUpdated.toISOString(),
    };
    io.to(`home:${homeId}`).emit(REALTIME_EVENTS.deviceUpdated, payload);
  } catch (err) {
    console.error("[socket] emitDeviceUpdated failed", err);
  }
}

/**
 * Home membership change (remove/role-change) pe user ke saare sockets ko us
 * home room se nikaalo + `home:access-revoked` bhejo — warna removed member
 * ko devices dikhte rehte hain.
 */
export async function leaveHomeRoom(userId: number, homeId: number): Promise<void> {
  if (!io) return;
  try {
    const sockets = await io.in(`home:${homeId}`).fetchSockets();
    for (const s of sockets) {
      if (s.data.userId === userId) s.leave(`home:${homeId}`);
    }
  } catch {
    // lookup failure shouldn't break membership ops
  }
  emitToUser(userId, REALTIME_EVENTS.homeAccessRevoked, { homeId });
}

export function emitToBoardLogs(espId: number, logMsg: string): void {
  io?.to(`board-logs-${espId}`).emit("admin:board-log", logMsg);
}
