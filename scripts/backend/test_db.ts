import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const p = new PrismaClient();

async function main() {
    const msgs = await p.supportMessage.findMany({
        orderBy: { id: 'desc' },
        take: 5
    });
    console.log("Recent messages:");
    for (const msg of msgs) {
        console.log(`ID: ${msg.id}, Path: ${msg.attachmentPath}`);
        if (msg.attachmentPath) {
            // Find attachment dir
            const repoRoot = path.resolve(__dirname, '../../../../');
            const attDir = path.join(repoRoot, 'hardware', 'attachments');
            const fullPath = path.join(attDir, msg.attachmentPath);
            const exists = fs.existsSync(fullPath);
            console.log(`   -> File exists on disk? ${exists} (${fullPath})`);
        }
    }
}
main().finally(() => p.$disconnect());
