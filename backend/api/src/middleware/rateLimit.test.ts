import { describe, expect, it, beforeEach, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { rateLimit, resetRateLimitStore, clientIp } from "./rateLimit";

function mockReq(ip = "1.2.3.4", xff?: string): Request {
  const headers: Record<string, string | undefined> = {};
  if (xff) headers["x-forwarded-for"] = xff;
  return { ip, socket: { remoteAddress: ip }, headers } as unknown as Request;
}

function mockRes() {
  const headers = new Map<string, string>();
  const res = {
    setHeader: (k: string, v: string) => headers.set(k.toLowerCase(), v),
    getHeader: (k: string) => headers.get(k.toLowerCase()),
    statusCode: 200,
    status: vi.fn(function (this: { statusCode: number }, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(),
  } as unknown as Response & { statusCode: number };
  return res;
}

const next: NextFunction = () => undefined;

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimitStore();
    vi.restoreAllMocks();
  });

  it("allows requests under the limit, then 429s after max", () => {
    const limiter = rateLimit({ name: "test", windowMs: 60_000, max: 3 });
    const req = mockReq();

    const res1 = mockRes();
    limiter(req, res1, next);
    expect(res1.statusCode).toBe(200);
    expect(res1.getHeader("x-ratelimit-remaining")).toBe("2");

    const res2 = mockRes();
    limiter(req, res2, next);
    expect(res2.statusCode).toBe(200);

    const res3 = mockRes();
    limiter(req, res3, next);
    expect(res3.statusCode).toBe(200);
    expect(res3.getHeader("x-ratelimit-remaining")).toBe("0");

    const res4 = mockRes();
    limiter(req, res4, next);
    expect(res4.statusCode).toBe(429);
    expect(res4.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "RATE_LIMITED" }),
      }),
    );
    expect(res4.getHeader("retry-after")).toBeTruthy();
  });

  it("different IPs have independent buckets", () => {
    const limiter = rateLimit({ name: "test", windowMs: 60_000, max: 2 });
    const resA1 = mockRes();
    limiter(mockReq("10.0.0.1"), resA1, next);
    limiter(mockReq("10.0.0.1"), mockRes(), next);
    const resA3 = mockRes();
    limiter(mockReq("10.0.0.1"), resA3, next);
    expect(resA3.statusCode).toBe(429);

    // Doosra IP — fresh bucket
    const resB1 = mockRes();
    limiter(mockReq("10.0.0.2"), resB1, next);
    expect(resB1.statusCode).toBe(200);
  });

  it("different scopes have independent buckets (login vs support)", () => {
    const login = rateLimit({ name: "auth:login", windowMs: 60_000, max: 1 });
    const support = rateLimit({ name: "support:send", windowMs: 60_000, max: 1 });
    const req = mockReq();

    login(req, mockRes(), next);
    expect(support(req, mockRes(), next)).toBeUndefined(); // support still fresh
    const resLogin2 = mockRes();
    login(req, resLogin2, next);
    expect(resLogin2.statusCode).toBe(429);
    const resSupport2 = mockRes();
    support(req, resSupport2, next);
    expect(resSupport2.statusCode).toBe(429);
  });

  it("window expiry resets the counter", () => {
    vi.useFakeTimers();
    try {
      const limiter = rateLimit({ name: "test", windowMs: 1_000, max: 1 });
      limiter(mockReq(), mockRes(), next);
      const res2 = mockRes();
      limiter(mockReq(), res2, next);
      expect(res2.statusCode).toBe(429);

      vi.advanceTimersByTime(1_100);
      const res3 = mockRes();
      limiter(mockReq(), res3, next);
      expect(res3.statusCode).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keyGenerator allows custom keys (e.g. per-user instead of per-IP)", () => {
    const limiter = rateLimit({
      name: "test",
      windowMs: 60_000,
      max: 1,
      keyGenerator: (req) => String((req as unknown as { userId?: number }).userId ?? "anon"),
    });
    const reqA = { ...mockReq(), userId: 7 } as unknown as Request;
    const reqB = { ...mockReq(), userId: 8 } as unknown as Request;
    limiter(reqA, mockRes(), next);
    const resA2 = mockRes();
    limiter(reqA, resA2, next);
    expect(resA2.statusCode).toBe(429);
    // Dusra user — fresh
    const resB1 = mockRes();
    limiter(reqB, resB1, next);
    expect(resB1.statusCode).toBe(200);
  });

  it("skip() bypasses limiting", () => {
    const limiter = rateLimit({ name: "test", windowMs: 60_000, max: 1, skip: () => true });
    limiter(mockReq(), mockRes(), next);
    const res2 = mockRes();
    limiter(mockReq(), res2, next);
    expect(res2.statusCode).toBe(200);
  });
});

describe("clientIp", () => {
  it("uses X-Forwarded-For first value behind proxy", () => {
    expect(clientIp(mockReq("127.0.0.1", "203.0.113.5, 70.41.3.18"))).toBe("203.0.113.5");
  });
  it("falls back to req.ip", () => {
    expect(clientIp(mockReq("127.0.0.1"))).toBe("127.0.0.1");
  });
});
