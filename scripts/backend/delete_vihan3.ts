import { prisma } from './src/lib/prisma.js';

async function run() {
  const user = await prisma.user.findUnique({ where: { username: 'vihan' }, include: { ownedHomes: true } });
  if (!user) {
    console.log('User vihan not found');
    process.exit(0);
  }
  
  console.log('Deleting homes and devices for user', user.id);
  
  for (const home of user.ownedHomes) {
    // Delete devices
    await prisma.deviceLog.deleteMany({ where: { device: { homeId: home.id } } });
    await prisma.deviceCommand.deleteMany({ where: { device: { homeId: home.id } } });
    await prisma.deviceAccess.deleteMany({ where: { device: { homeId: home.id } } });
    await prisma.deviceUsage.deleteMany({ where: { device: { homeId: home.id } } });
    await prisma.device.deleteMany({ where: { homeId: home.id } });
    
    // Delete rooms
    await prisma.room.deleteMany({ where: { homeId: home.id } });
    
    // Delete home members
    await prisma.homeMember.deleteMany({ where: { homeId: home.id } });
    
    // Delete home audit logs
    await prisma.auditLog.deleteMany({ where: { homeId: home.id } });
    
    // Delete home
    await prisma.home.delete({ where: { id: home.id } });
  }
  
  // Delete user related
  await prisma.homeMember.deleteMany({ where: { userId: user.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
  await prisma.apiKey.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.pushSubscription.deleteMany({ where: { userId: user.id } });
  
  await prisma.user.delete({ where: { id: user.id } });
  console.log('User vihan deleted successfully.');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
