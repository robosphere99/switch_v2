const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const res = await prisma.firmwareVersion.create({
      data: {
        version: 'v1.1.1',
        url: '/firmware/sn-4ch/v1.1.1.bin', // appended to baseUrl
        modelCode: 'sn-4ch',
        isCurrent: true,
        releaseNotes: 'Fixed LED blinking during heartbeat by adding MQTT command support.'
      }
    });
    console.log('Inserted FirmwareVersion:', res);
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
