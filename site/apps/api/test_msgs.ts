import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const p = new PrismaClient();

async function main() {
    const token = jwt.sign({ sub: 6, role: 'user' }, process.env.JWT_ACCESS_SECRET || 'dev-access-secret', { expiresIn: '1h' });
    
    const url = \`http://127.0.0.1:4000/api/support/messages\`;
    const res = await fetch(url, { headers: { Authorization: \`Bearer \${token}\` } });
    const data = await res.json();
    console.log(JSON.stringify(data.data.messages.slice(-3), null, 2));
}
main().finally(() => p.$disconnect());
