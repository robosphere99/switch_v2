const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const esps = await prisma.espDevice.findMany({ select: { id: true, modelCode: true, otaPendingVersion: true, otaStatus: true, otaProgress: true } });
    console.log(esps);
    const fw = await prisma.firmwareVersion.findMany();
    console.log("Firmware:", fw);
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
