import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import 'dotenv/config';

const p = new PrismaClient();

async function main() {
    const msg = await p.supportMessage.findUnique({ where: { id: 106 } });
    if (!msg) return console.log("Msg not found");
    
    console.log("Msg userId:", msg.userId);
    
    // Generate token
    const token = jwt.sign({ sub: msg.userId, role: 'user' }, process.env.JWT_ACCESS_SECRET || 'secret', { expiresIn: '1h' });
    
    console.log("Token:", token);
    
    const url = `http://127.0.0.1:4000/api/support/attachment/106?token=${token}`;
    console.log("URL:", url);
    
    const fetch = require('node-fetch'); // or dynamic import
    const res = await fetch(url);
    console.log("Status:", res.status);
    console.log("Headers:", res.headers.raw());
}
main().finally(() => p.$disconnect());
