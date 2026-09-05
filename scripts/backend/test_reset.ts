import { requestPasswordReset, resetPassword } from './src/services/auth.service.js';
import { prisma } from './src/lib/prisma.js';

async function run() {
  console.log('Requesting reset for: admin@robosphere.local');
  await requestPasswordReset('admin@robosphere.local');
  
  const tokenRecord = await prisma.passwordResetToken.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  
  if (!tokenRecord) {
    console.log('No token found in DB!');
    process.exit(1);
  }
  
  console.log('Latest Token Hash in DB:', tokenRecord.tokenHash);
  // We can't easily get the raw token here because it's only generated in the function and hashed.
  // But this confirms the DB record is created.
  process.exit(0);
}
run();
