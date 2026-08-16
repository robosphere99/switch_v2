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

/** Requires a valid JWT access token. Sets req.user. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("UNAUTHORIZED", "Missing bearer token", 401));
  }

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as unknown as AccessTokenPayload;
    // Password change / suspend ke baad purane tokens bhi turant invalid —
    // user ki current tokenVersion se compare karte hain (har request pe).
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true, status: true },
    });
    if (!user || payload.ver !== user.tokenVersion) {
      return next(new AppError("UNAUTHORIZED", "Session invalidated — dobara login karo", 401));
    }
    if (user.status !== "active") {
      return next(new AppError("ACCOUNT_SUSPENDED", "Account is suspended", 403));
    }
    req.user = payload;
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
