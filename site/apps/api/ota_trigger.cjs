const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const res = await prisma.espDevice.updateMany({
      data: { otaPendingVersion: 'v1.1.1', otaRequestedAt: new Date() }
    });
    console.log('Updated:', res);
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
