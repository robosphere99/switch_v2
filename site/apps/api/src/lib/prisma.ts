import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export let prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

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
  process.env.DATABASE_URL = databaseUrl;
  const next = new PrismaClient();
  await next.$connect();
  prisma = next;
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = next;
  return next;
}
