const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.firmwareVersion.updateMany({
    where: { modelCode: '4CH' },
    data: { isCurrent: false }
}).then(() => p.firmwareVersion.update({
    where: { id: 6 },
    data: { isCurrent: true }
})).then(x => {
    console.log(x);
    p.$disconnect();
});
