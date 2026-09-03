const { PrismaClient } = require('@prisma/client'); 
const p = new PrismaClient(); 
p.supportMessage.findMany({ orderBy: { id: 'desc' }, take: 2 }).then(console.log).finally(() => p.$disconnect());
