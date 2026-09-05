import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
    const msgs = await p.supportMessage.findMany({
        orderBy: { id: 'desc' },
        take: 10
    });
    console.log("Recent messages:");
    for (const msg of msgs) {
        if (msg.attachmentPath || msg.attachmentData) {
            console.log(`[${msg.senderRole}] ID: ${msg.id}, Path: ${msg.attachmentPath}, Type: ${msg.attachmentType}`);
        }
    }
}
main().finally(() => p.$disconnect());
