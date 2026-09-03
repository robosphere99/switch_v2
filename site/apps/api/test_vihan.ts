import { prisma } from './src/lib/prisma.js';

async function run() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true },
    where: { username: 'vihan' }
  });
  console.log('Users found:', users);
  process.exit(0);
}
run();
