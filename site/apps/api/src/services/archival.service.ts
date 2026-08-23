import { prisma } from "../lib/prisma";
import { getSiteSettings } from "./siteSettings.service";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const COLD_STORAGE_TELEMETRY = path.join(UPLOADS_DIR, "cold_storage", "telemetry");
const COLD_STORAGE_SUPPORT = path.join(UPLOADS_DIR, "cold_storage", "support");

let archivalTimer: NodeJS.Timeout | null = null;
let isRunning = false;

export function startArchivalService() {
    if (archivalTimer) return;
    // Run once immediately, then every 24 hours
    setTimeout(runArchival, 5000);
    archivalTimer = setInterval(runArchival, 24 * 60 * 60 * 1000);
    logger.info("[ArchivalService] started (runs daily)");
}

export function stopArchivalService() {
    if (archivalTimer) {
        clearInterval(archivalTimer);
        archivalTimer = null;
    }
}

async function runArchival() {
    if (isRunning) return;
    isRunning = true;
    try {
        const settings = await getSiteSettings();

        // Ensure directories exist
        fs.mkdirSync(COLD_STORAGE_TELEMETRY, { recursive: true });
        fs.mkdirSync(COLD_STORAGE_SUPPORT, { recursive: true });

        const now = new Date();

        // 1. Archive Device Telemetry
        const telemetryThreshold = new Date();
        telemetryThreshold.setDate(telemetryThreshold.getDate() - (settings.deviceTelemetryRetentionDays || 180));

        // Process in batches of 1000 to prevent memory spikes
        let archivedTelemetryCount = 0;
        while (true) {
            const oldLogs = await prisma.deviceLog.findMany({
                where: { createdAt: { lt: telemetryThreshold } },
                take: 1000,
                orderBy: { createdAt: 'asc' }
            });
            if (oldLogs.length === 0) break;

            const filePath = path.join(COLD_STORAGE_TELEMETRY, `telemetry_${now.toISOString().split('T')[0]}.jsonl`);
            const lines = oldLogs.map(l => JSON.stringify(l)).join("\n") + "\n";
            fs.appendFileSync(filePath, lines);

            const ids = oldLogs.map(l => l.id);
            await prisma.deviceLog.deleteMany({ where: { id: { in: ids } } });
            archivedTelemetryCount += oldLogs.length;
        }
        if (archivedTelemetryCount > 0) {
            logger.info(`[ArchivalService] Archived and deleted ${archivedTelemetryCount} old device telemetry logs.`);
        }

        // 2. Archive Support Chat History
        const chatThreshold = new Date();
        chatThreshold.setDate(chatThreshold.getDate() - (settings.chatHistoryRetentionDays || 90));

        let archivedChatCount = 0;
        while (true) {
            const oldMessages = await prisma.supportMessage.findMany({
                where: { createdAt: { lt: chatThreshold } },
                take: 500,
                orderBy: { createdAt: 'asc' }
            });
            if (oldMessages.length === 0) break;

            const filePath = path.join(COLD_STORAGE_SUPPORT, `chat_${now.toISOString().split('T')[0]}.jsonl`);
            const lines = oldMessages.map(m => JSON.stringify(m)).join("\n") + "\n";
            fs.appendFileSync(filePath, lines);

            // Note: In real-world, we might also want to move the `m.attachmentPath` to a cold storage bucket.
            // For now, we archive the DB record.
            const ids = oldMessages.map(m => m.id);
            await prisma.supportMessage.deleteMany({ where: { id: { in: ids } } });
            archivedChatCount += oldMessages.length;
        }
        if (archivedChatCount > 0) {
            logger.info(`[ArchivalService] Archived and deleted ${archivedChatCount} old support chat messages.`);
        }

    } catch (err) {
        logger.error("[ArchivalService] error during archival run", err instanceof Error ? err.stack : err);
    } finally {
        isRunning = false;
    }
}
