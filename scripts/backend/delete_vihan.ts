import { prisma } from './src/lib/prisma.js';

async function run() {
  const user = await prisma.user.findUnique({ where: { username: 'vihan' }, include: { ownedHomes: true } });
  if (!user) {
    console.log('User vihan not found');
    process.exit(1);
  }
  
  await prisma.$transaction(async (tx) => {
    // Delete homes and related
    for (const home of user.ownedHomes) {
      await tx.device.deleteMany({ where: { homeId: home.id } });
      await tx.room.deleteMany({ where: { homeId: home.id } });
      await tx.homeMember.deleteMany({ where: { homeId: home.id } });
      await tx.home.delete({ where: { id: home.id } });
    }
    
    // Delete other user related
    await tx.homeMember.deleteMany({ where: { userId: user.id } });
    await tx.refreshToken.deleteMany({ where: { userId: user.id } });
    await tx.auditLog.deleteMany({ where: { userId: user.id } });
    await tx.user.delete({ where: { id: user.id } });
  });
  
  console.log('User vihan deleted successfully.');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
