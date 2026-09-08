import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up dummy boards starting with RS-SIM-...");

  // Find dummy ESP devices
  const dummyEsps = await prisma.espDevice.findMany({
    where: {
      serialCode: {
        startsWith: 'RS-SIM-'
      }
    }
  });

  const espIds = dummyEsps.map(e => e.id);

  if (espIds.length > 0) {
      // Delete associated physical devices first
      const deletedDevices = await prisma.device.deleteMany({
          where: {
              espId: { in: espIds }
          }
      });
      console.log(`Deleted ${deletedDevices.count} mapped dummy devices.`);

      // Delete the ESP boards
      const deletedEsps = await prisma.espDevice.deleteMany({
          where: {
              id: { in: espIds }
          }
      });
      console.log(`Deleted ${deletedEsps.count} dummy ESP boards.`);
  } else {
      console.log("No dummy boards found.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
