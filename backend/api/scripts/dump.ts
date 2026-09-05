import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const keys = await prisma.apiKey.findMany();
  console.log("Keys:", JSON.stringify(keys, null, 2));
  
  const esps = await prisma.espDevice.findMany({ select: { id: true, name: true, lastApiKeyId: true, offline: true } });
  console.log("ESPs:", JSON.stringify(esps, null, 2));
}

main().then(() => prisma.$disconnect());
