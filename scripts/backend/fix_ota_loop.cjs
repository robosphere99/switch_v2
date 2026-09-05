const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    // 1. Update FirmwareVersion to "1.1.1"
    await prisma.firmwareVersion.updateMany({
      where: { version: 'v1.1.1' },
      data: { version: '1.1.1' }
    });
    // 2. Update espDevice otaPendingVersion to "1.1.1"
    await prisma.espDevice.updateMany({
      where: { otaPendingVersion: 'v1.1.1' },
      data: { otaPendingVersion: '1.1.1' }
    });
    console.log("Fixed OTA loop mismatch!");
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
