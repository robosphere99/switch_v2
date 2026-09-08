import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";

// Load .env synchronously before initializing PrismaClient
const candidatePaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), "../../.env"),
];
for (const p of candidatePaths) {
  try {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p, override: true });
    }
  } catch {}
}

export function getEffectiveDbUrl(): string {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl) return envUrl;
  // DATABASE_URL missing — warn clearly rather than silently returning a stale MySQL URL.
  // Set DATABASE_URL in your .env file pointing to your Neon PostgreSQL instance.
  console.error("⚠️  [prisma] DATABASE_URL is not set! Using dummy URL — DB operations will fail.");
  return "postgresql://user:pass@localhost:5432/switchnest";
}


export function withConnLimit(url: string, limit = 10): string {
  const target = url.trim() || getEffectiveDbUrl();
  try {
    const u = new URL(target);
    u.searchParams.set("connection_limit", String(limit));
    return u.toString();
  } catch {
    return target;
  }
}

// Ensure process.env.DATABASE_URL is set before PrismaClient constructor
process.env.DATABASE_URL = withConnLimit(getEffectiveDbUrl());

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export let prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function resetPrismaClient(databaseUrl: string): Promise<PrismaClient> {
  try {
    await prisma.$disconnect();
  } catch {
    // already disconnected — ignore
  }
  process.env.DATABASE_URL = withConnLimit(databaseUrl);
  const next = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });
  await next.$connect().catch(() => undefined);
  prisma = next;
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = next;
  return next;
}
