const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.firmwareVersion.upsert({
    where: { version_modelCode: { version: '1.1.4', modelCode: '4CH' } },
    update: {},
    create: {
        version: '1.1.4',
        modelCode: '4CH',
        url: '/firmware/4ch/v1.1.4.bin',
        releaseNotes: 'Added terminal log streaming over MQTT, boot greetings, and new terminal commands (ping, fw_version, wifi_status)'
    }
}).then(x => {
    console.log(x);
    p.$disconnect();
});
