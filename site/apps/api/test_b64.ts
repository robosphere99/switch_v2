import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
const p = new PrismaClient();

const attachmentDir = path.resolve(process.cwd(), "../../../hardware/attachments");

function readAttachmentFile(filename) {
    const safe = path.basename(filename);
    try {
        return fs.readFileSync(path.join(attachmentDir, safe));
    } catch {
        return null;
    }
}

async function main() {
    const msgs = await p.supportMessage.findMany({
        where: { id: { in: [105, 109, 110] } }
    });
    
    for (const m of msgs) {
        let b64 = null;
        if (m.attachmentPath && (m.attachmentType || '').startsWith('image/')) {
            const buf = readAttachmentFile(m.attachmentPath);
            if (buf) {
                b64 = buf.toString('base64');
            }
        }
        console.log(\`ID: \${m.id}\`);
        console.log(\`Path: \${m.attachmentPath}\`);
        console.log(\`Type: \${m.attachmentType}\`);
        console.log(\`B64 length: \${b64 ? b64.length : 'NULL'}\`);
        console.log('---');
    }
}
main().finally(() => p.$disconnect());
