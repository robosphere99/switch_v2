import { prisma } from './src/lib/prisma.js';

async function run() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true },
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  console.log('Recent Users:', users);
  process.exit(0);
}
run();
