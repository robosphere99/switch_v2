const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const esps = await prisma.espDevice.findMany();
    console.log(JSON.stringify(esps, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
