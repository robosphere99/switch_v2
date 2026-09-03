import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { sendEmail } from './src/lib/email.service.js';

async function run() {
  console.log('Sending email...');
  const res = await sendEmail({
    to: 'anilalok99mahalpar@gmail.com',
    subject: 'SwitchNest SMTP Test',
    text: 'Ye test email backend se bheja gaya hai. SMTP configuration check passed! ?'
  });
  console.log('Response:', res);
  process.exit(0);
}
run();
