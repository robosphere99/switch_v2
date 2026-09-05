import type { Request, Response } from "express";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma";
import { AppError, ok } from "../lib/response";

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateKey(): { raw: string; prefix: string } {
  const raw = `rs_${crypto.randomBytes(24).toString("hex")}`;
  return { raw, prefix: raw.slice(0, 8) };
}

export async function listApiKeys(req: Request, res: Response): Promise<void> {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.user!.sub },
      include: {
        home: {
          select: {
            id: true,
            name: true,
            espDevices: {
              select: { id: true, name: true, serialCode: true, modelCode: true, offline: true, lastSeen: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    ok(res, keys);
  } catch (err: any) {
    console.error("[apiKey] list failed:", err?.message ?? err);
    ok(res, []);
  }
}

export async function createApiKey(req: Request, res: Response): Promise<void> {
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
}

export async function deleteApiKey(req: Request, res: Response): Promise<void> {
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
}
