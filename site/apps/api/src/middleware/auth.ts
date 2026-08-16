import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { HomeMember } from "@prisma/client";
import type { AccessTokenPayload } from "@robosphere/shared";
import { env } from "../config/env";
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
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("UNAUTHORIZED", "Missing bearer token", 401));
  }

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as unknown as AccessTokenPayload;
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
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as unknown as AccessTokenPayload;
      req.user = payload;
    } catch {
      /* invalid/expired token — anonymous hi samjho */
    }
  }
  next();
};
