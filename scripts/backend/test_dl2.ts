import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import 'dotenv/config';

const p = new PrismaClient();

async function main() {
    const msg = await p.supportMessage.findUnique({ where: { id: 106 } });
    if (!msg) return console.log("Msg not found");
    
    const token = jwt.sign({ sub: msg.userId, role: 'system_admin' }, process.env.JWT_ACCESS_SECRET || 'secret', { expiresIn: '1h' });
    
    const url = `http://127.0.0.1:4000/api/support/attachment/106?token=${token}`;
    
    // using global fetch in node 18+
    const res = await fetch(url);
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get('content-type'));
    
    const buf = await res.arrayBuffer();
    console.log("Buffer length:", buf.byteLength);
    
    if (buf.byteLength > 0) {
        fs.writeFileSync('test_image_dl.jpg', Buffer.from(buf));
        console.log("Saved test_image_dl.jpg");
    }
}
main().finally(() => p.$disconnect());
