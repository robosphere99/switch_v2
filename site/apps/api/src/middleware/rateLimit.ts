import type { Request, RequestHandler, Response } from "express";

/**
 * Zero-dependency in-memory rate limiter (fixed window per IP + scope).
 *
 * Naya npm package (express-rate-limit) add nahi kiya — Plesk pe deploy
 * fast-path npm install skip karta hai, isliye project ka rule: jo bhi
 * naya ho wo node: ke built-in modules se banao (email service bhi aise hi hai).
 *
 * - Key = `scope:ip` — alag scopes apne alag buckets (login ka bucket
 *   support ke bucket me ghus ke 429 nahi dega).
 * - Behind reverse proxy (Plesk nginx) X-Forwarded-For se asli client IP.
 * - 429 response standard envelope me ({ success:false, error }).
 * - Har 60s purane buckets sweep (memory leak nahi).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Bucket scope — alag scopes alag counters (e.g. "auth:login"). */
  name: string;
  windowMs: number;
  max: number;
  message?: string;
  /** Custom key (default: client IP). */
  keyGenerator?: (req: Request) => string;
  /** Skip condition (tests / health checks). */
  skip?: (req: Request) => boolean;
}

const store = new Map<string, Bucket>();
let sweepTimer: NodeJS.Timeout | null = null;

function sweepExpired(): void {
  const now = Date.now();
  for (const [key, b] of store) {
    if (b.resetAt <= now) store.delete(key);
  }
}

function ensureSweep(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(sweepExpired, 60_000);
  sweepTimer.unref?.(); // process exit pe rukawat na ho
}

/** Client IP — reverse proxy ke peeche X-Forwarded-For se (Plesk nginx). */
export function clientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim().length > 0) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function rateLimit(opts: RateLimitOptions): RequestHandler {
  ensureSweep();
  return (req, res, next) => {
    if (opts.skip?.(req)) return next();

    const key = `${opts.name}:${opts.keyGenerator ? opts.keyGenerator(req) : clientIp(req)}`;
    const now = Date.now();

    let bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      store.set(key, bucket);
    }
    bucket.count += 1;

    res.setHeader("X-RateLimit-Limit", String(opts.max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, opts.max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > opts.max) {
      sendTooMany(res, opts.message, bucket.resetAt - now);
      return;
    }
    next();
  };
}

function sendTooMany(res: Response, message: string | undefined, retryAfterMs: number): void {
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  res.setHeader("Retry-After", String(retryAfterSec));
  res.status(429).json({
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: message ?? "Bahut zyada requests — thodi der baad try karo",
      details: { retryAfterSec },
    },
  });
}

/** Test helper — sab buckets clear (windows reset). */
export function resetRateLimitStore(): void {
  store.clear();
}
