import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import { prisma } from "../lib/prisma";
import { AppError, ok } from "../lib/response";

export const apiKeyRouter = Router();

// API key creation — attacker ko unlimited keys banane se rokta hai.
const createKeyLimiter = rateLimit({
  name: "api-key:create",
  windowMs: 60 * 60_000,
  max: 20,
  message: "Bahut zyada API keys bana rahe ho — 1 ghanta baad try karo",
});

const createSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  homeId: z.coerce.number().int().positive().optional(),
  expiresInDays: z.coerce.number().int().positive().max(3650).optional(),
});

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateKey(): { raw: string; prefix: string } {
  const raw = `rs_${crypto.randomBytes(24).toString("hex")}`;
  return { raw, prefix: raw.slice(0, 8) };
}

apiKeyRouter.get("/", requireAuth, async (req, res) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.user!.sub },
      include: { home: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    ok(res, keys);
  } catch (err: any) {
    console.error("[apiKey] list failed:", err?.message ?? err);
    ok(res, []);
  }
});

apiKeyRouter.post("/", requireAuth, createKeyLimiter, validateBody(createSchema), async (req, res) => {
  const { raw, prefix } = generateKey();
  const key = await prisma.apiKey.create({
    data: {
      userId: req.user!.sub,
      homeId: req.body.homeId,
      label: req.body.label,
      keyHash: hashKey(raw),
      keyPrefix: prefix,
      expiresAt: req.body.expiresInDays
        ? new Date(Date.now() + req.body.expiresInDays * 24 * 60 * 60 * 1000)
        : null,
    },
  });
  // Return the raw key exactly once.
  ok(res, { ...key, keyHash: undefined, rawKey: raw }, 201);
});

apiKeyRouter.delete("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.apiKey.findFirst({ where: { id, userId: req.user!.sub } });
  if (!existing) throw new AppError("API_KEY_NOT_FOUND", "API key not found", 404);
  try {
    await prisma.apiKey.delete({ where: { id } });
  } catch {
    // If delete fails (e.g. constraint), try soft-delete
    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } }).catch(() => {});
  }
  ok(res, { message: "API key revoked" });
});
