import type { Request, RequestHandler } from "express";
import crypto from "node:crypto";
import type { ApiKey } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";

declare global {
  namespace Express {
    interface Request {
      /** Authenticated device API key (set by requireApiKey). */
      apiKey?: ApiKey;
    }
  }
}

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Extract the raw API key from, in order of preference:
 *  - Authorization: Bearer rs_...
 *  - ?api_key= query param (used by ESP32 / simple clients)
 *  - api_key form/JSON body field
 */
function extractKey(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer rs_")) {
    return header.slice(7);
  }

  const query = req.query["api_key"];
  if (typeof query === "string" && query.length > 0) return query;

  const body = (req.body as Record<string, unknown>)["api_key"];
  if (typeof body === "string" && body.length > 0) return body;

  return null;
}

/**
 * Requires a valid, unexpired API key scoped to a home.
 * Sets req.apiKey. Device endpoints (ESP32 etc.) use this instead of JWT.
 */
export const requireApiKey: RequestHandler = async (req, _res, next) => {
  try {
    const raw = extractKey(req);
    if (!raw) {
      return next(new AppError("UNAUTHORIZED", "Missing api_key", 401));
    }

    const key = await prisma.apiKey.findUnique({ where: { keyHash: hashKey(raw) } });

    if (!key) {
      return next(new AppError("UNAUTHORIZED", "Invalid api_key", 401));
    }
    if (key.revokedAt) {
      return next(new AppError("UNAUTHORIZED", "API key has been revoked", 401));
    }
    if (key.expiresAt && key.expiresAt < new Date()) {
      return next(new AppError("UNAUTHORIZED", "API key has expired", 401));
    }
    if (!key.homeId) {
      return next(
        new AppError(
          "KEY_NOT_SCOPED",
          "This API key is not scoped to a home — create a device key for a home first",
          400,
        ),
      );
    }

    // Track usage (best-effort; never fail the request on a tracking error).
    await prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    req.apiKey = key;
    next();
  } catch (err) {
    next(err);
  }
};
