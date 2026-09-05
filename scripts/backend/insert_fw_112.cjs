const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    // Set old current to false
    await prisma.firmwareVersion.updateMany({
      where: { modelCode: '4CH' },
      data: { isCurrent: false }
    });
    // Insert new firmware
    await prisma.firmwareVersion.create({
      data: {
        version: '1.1.2',
        modelCode: '4CH',
        url: '/firmware/4ch/v1.1.2.bin',
        releaseNotes: 'Added Remote Serial Monitor support',
        isCurrent: true
      }
    });
    console.log("Inserted firmware v1.1.2");
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
