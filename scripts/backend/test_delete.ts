import { prisma } from './src/lib/prisma.js';

async function run() {
  const user = await prisma.user.findUnique({ where: { username: 'vihan' } });
  if (!user) {
    console.log('User vihan not found!');
    process.exit(1);
  }
  console.log('User vihan ID:', user.id);
  
  try {
    await prisma.user.delete({ where: { id: user.id } });
    console.log('Successfully deleted user vihan');
  } catch (err: any) {
    console.error('Delete failed with error:', err.message);
  }
  process.exit(0);
}
run();
