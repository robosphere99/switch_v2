import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const version = '1.1.5';
    const modelCode = '4CH';
    const releaseNotes = 'Fixed LED logic in SERVER_ERROR mode. LED state is now correctly respected even during WiFi/API failures.';
    const sourceBin = path.resolve('../../../hardware/Robosphere-Dev/.pio/build/model-4ch/firmware.bin');
    const destDir = path.resolve('../../../hardware/firmware');
    const destBin = path.join(destDir, 'firmware-4CH.bin');

    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(sourceBin, destBin);

    await prisma.firmwareVersion.updateMany({
        where: { modelCode, isCurrent: true },
        data: { isCurrent: false }
    });

    await prisma.firmwareVersion.upsert({
        where: { version_modelCode: { version, modelCode } },
        create: { version, modelCode, url: '/firmware/firmware-4CH.bin', releaseNotes, isCurrent: true },
        update: { releaseNotes, isCurrent: true, url: '/firmware/firmware-4CH.bin' }
    });
    console.log('OTA firmware updated in DB and disk!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
