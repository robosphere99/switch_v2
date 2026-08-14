import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env, corsOrigins } from "../config/env";
import { prisma } from "./prisma";

let io: Server | null = null;

/** Attach Socket.IO to the HTTP server. Call once at startup. */
export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: corsOrigins, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error("missing token");
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as unknown as { sub: number };
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId as number;
    socket.join(`user:${userId}`);
    let joined = 0;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      const isAdmin = user?.role === "system_admin";
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
    console.log(`[socket] user ${userId} connected (${joined} homes)`);
  });

  return io;
}

/** Emit an event to a single user's room (notifications, assistant replies). */
export function emitToUser(userId: number, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

/** Emit an event to everyone who is a member of a home (device updates). */
export function emitToHome(homeId: number, event: string, payload: unknown): void {
  io?.to(`home:${homeId}`).emit(event, payload);
}
