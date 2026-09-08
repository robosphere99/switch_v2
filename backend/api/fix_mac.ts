import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const realMac = "d0:ef:76:33:56:a0";
  const targetSerial = "RS-4CH-BQME98";
  
  console.log(`Fixing MAC address for ${targetSerial}...`);

  // Find the auto-generated board
  const autoBoard = await prisma.espDevice.findUnique({
      where: { macAddress: realMac }
  });

  if (autoBoard) {
      console.log(`Found auto-generated board ${autoBoard.id}. Deleting it...`);
      await prisma.device.deleteMany({ where: { espId: autoBoard.id } });
      await prisma.espDevice.delete({ where: { id: autoBoard.id } });
  }

  // Update the real board with the real MAC
  const realBoard = await prisma.espDevice.findUnique({
      where: { serialCode: targetSerial }
  });

  if (realBoard) {
      await prisma.espDevice.update({
          where: { id: realBoard.id },
          data: { macAddress: realMac }
      });
      console.log(`Updated ${targetSerial} with real MAC ${realMac}!`);
  } else {
      console.error(`Could not find ${targetSerial} in DB.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
