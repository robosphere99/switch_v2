import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { HomeMember } from "@prisma/client";
import type { AccessTokenPayload } from "@robosphere/shared";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";

declare global {
  namespace Express {
    interface Request {
      /** Authenticated user (set by requireAuth). */
      user?: AccessTokenPayload;
      /** Home membership of the authenticated user (set by requireHomeMember). */
      homeMembership?: HomeMember;
    }
  }
}

// In-memory throttle to avoid hitting DB on rapid API calls (1 touch per 30s per device)
const lastTouchCache = new Map<string, number>();

async function recordSessionActivity(userId: number, sid: number | undefined, rawUA: string, ip: string) {
  const cacheKey = `${userId}:${sid || rawUA}`;
  const now = Date.now();
  const lastTouch = lastTouchCache.get(cacheKey) || 0;
  if (now - lastTouch < 30_000) return;
  lastTouchCache.set(cacheKey, now);

  try {
    if (sid) {
      const updated = await prisma.refreshToken.updateMany({
        where: { id: sid, userId, revokedAt: null },
        data: { lastActive: new Date(), ipAddress: ip },
      });
      if (updated.count > 0) return;
    }

    // If no sid or sid was removed: find active session by user + device
    const existing = await prisma.refreshToken.findFirst({
      where: { userId, deviceInfo: rawUA, revokedAt: null },
      orderBy: { lastActive: "desc" },
    });

    if (existing) {
      await prisma.refreshToken.update({
        where: { id: existing.id },
        data: { lastActive: new Date(), ipAddress: ip },
      });
    } else {
      const crypto = await import("node:crypto");
      const syntheticHash = crypto
        .createHash("sha256")
        .update(`sess_${userId}_${rawUA}_${Date.now()}_${Math.random()}`)
        .digest("hex");
      await prisma.refreshToken.create({
        data: {
          userId,
          tokenHash: syntheticHash,
          deviceInfo: rawUA,
          ipAddress: ip,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          lastActive: new Date(),
        },
      });
      try {
        const { emitToUser } = await import("../lib/socket");
        emitToUser(userId, "auth:sessions_changed", {});
      } catch {}
    }
  } catch {
    // Non-blocking
  }
}

/** Requires a valid JWT access token. Sets req.user. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("UNAUTHORIZED", "Missing bearer token", 401));
  }

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as unknown as AccessTokenPayload;
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { tokenVersion: true, status: true },
      });
      if (user) {
        if (payload.ver !== undefined && payload.ver !== user.tokenVersion) {
          return next(new AppError("UNAUTHORIZED", "Session invalidated — dobara login karo", 401));
        }
        if (user.status !== "active") {
          return next(new AppError("ACCOUNT_SUSPENDED", "Account is suspended", 403));
        }
      }
    } catch (_dbErr) {
      // Non-fatal DB check error — valid signed JWT payload passes
    }
    req.user = payload;

    const rawUA = (req.headers["user-agent"] as string)?.substring(0, 255) || "Web Browser";
    const rawIp = (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      "127.0.0.1"
    ).substring(0, 45).replace(/^::ffff:/, "");
    recordSessionActivity(payload.sub, payload.sid, rawUA, rawIp).catch(() => {});

    next();
  } catch {
    next(new AppError("UNAUTHORIZED", "Invalid or expired token", 401));
  }
};

/**
 * Optional auth — token diya ho aur valid ho to req.user set karo,
 * warna bina error ke aage badho (anonymous request). Public endpoints
 * me use hota hai jahan role ke hisaab se alag jawab dena ho.
 */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as unknown as AccessTokenPayload;
      // Stale token (password change/suspend) → anonymous hi samjho.
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { tokenVersion: true, status: true },
      });
      if (user && payload.ver === user.tokenVersion && user.status === "active") {
        req.user = payload;
      }
    } catch {
      /* invalid/expired token — anonymous hi samjho */
    }
  }
  next();
};
