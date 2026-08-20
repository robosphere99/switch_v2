import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * MySQL pool size changed to 10 (from 2) to handle ESP heartbeats,
 * polling, and scheduled tasks without exhausting the connection limit.
 * connection_limit=10 provides a healthy buffer while preventing runaway cascades.
 */
export function withConnLimit(url: string, limit = 10): string {
  try {
    const u = new URL(url);
    u.searchParams.set("connection_limit", String(limit));
    return u.toString();
  } catch {
    return url; // parse fail ho to as-is (rare)
  }
}

export let prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: withConnLimit(process.env.DATABASE_URL ?? "") } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Installation ke baad naye DATABASE_URL pe dobara connect karne ke liye.
 * Install route tables create karne ke baad isse call karta hai — purana
 * client disconnect, naya URL set, naya client connect.
 */
export async function resetPrismaClient(databaseUrl: string): Promise<PrismaClient> {
  try {
    await prisma.$disconnect();
  } catch {
    // already disconnected — ignore
  }
  process.env.DATABASE_URL = withConnLimit(databaseUrl);
  const next = new PrismaClient();
  await next.$connect();
  prisma = next;
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = next;
  return next;
}
