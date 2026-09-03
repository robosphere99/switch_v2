import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('EMAIL_PASS length:', process.env.EMAIL_PASS?.length);
