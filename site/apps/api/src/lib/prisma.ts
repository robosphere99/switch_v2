import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * MySQL pool chhota rakhna zaroori hai — Plesk per-user
 * max_user_connections. Har process ka default pool (num_cpus*2+1)
 * multiple processes me exhaust -> ERROR 1203 -> fail -> naya process
 * -> aur zyada connections -> cascade. connection_limit=2 breaks cycle.
 */
export function withConnLimit(url: string, limit = 2): string {
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
