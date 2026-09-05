const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    // 1. Update the FirmwareVersion I just created
    await prisma.firmwareVersion.update({
      where: { id: 3 },
      data: { modelCode: '4CH' }
    });
    // 2. Also un-current the old 1.5.1 one so it doesn't conflict
    await prisma.firmwareVersion.update({
      where: { id: 2 },
      data: { isCurrent: false }
    });
    console.log("Updated firmware versions.");
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
