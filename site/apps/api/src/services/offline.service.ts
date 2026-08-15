import { prisma } from "../lib/prisma";
import { emitToHome } from "../lib/socket";
import { createNotification } from "./notification.service";
import { fileLog } from "../lib/logger";

let timer: NodeJS.Timeout | null = null;
const OFFLINE_THRESHOLD_MS = 120_000; // 2 min without sync = offline
const CHECK_INTERVAL_MS = 60_000; // check every 1 min

/** Start the offline detection worker. Idempotent. */
export function startOfflineWatcher(): void {
  if (timer) return;
  timer = setInterval(checkOfflineDevices, CHECK_INTERVAL_MS);
  void checkOfflineDevices();
  console.log("[offline] watcher started (every 60s)");
  fileLog("[offline] watcher started (every 60s)");
}

export function stopOfflineWatcher(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function checkOfflineDevices(): Promise<void> {
  fileLog(`[offline] tick ${new Date().toISOString()} start`);
  try {
    await checkOfflineDevicesInner();
  } catch (err) {
    console.error("[offline] tick error:", err instanceof Error ? err.message : err);
    fileLog(`[offline] tick ERROR: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    fileLog(`[offline] tick ${new Date().toISOString()} done`);
  }
}

async function checkOfflineDevicesInner(): Promise<void> {
  const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MS);
  const stale = await prisma.device.findMany({
    where: { lastSeen: { lt: cutoff } },
    include: { home: { include: { members: { where: { role: { in: ["owner", "admin"] } } } } } },
    take: 50,
  });

  for (const device of stale) {
    const wasOnline = device.lastSeen !== null && !device.offline;
    if (!wasOnline) continue; // already flagged

    await prisma.device.update({ where: { id: device.id }, data: { offline: true } });
    emitToHome(device.homeId, "device:updated", { id: device.id, offline: true });

    const targetIds = device.home.members.map((m) => m.userId);
    for (const userId of targetIds) {
      await createNotification(userId, {
        category: "device",
        type: "warning",
        title: `📡 ${device.name} offline`,
        body: `${device.name} ne 2+ min se sync nahi kiya. WiFi/device check karo.`,
      });
    }
    console.log(`[offline] ${device.name} (${device.id}) marked offline`);
  }

  // Devices that came back online
  const backOnline = await prisma.device.findMany({
    where: { offline: true, lastSeen: { gte: cutoff } },
    include: { home: { include: { members: { where: { role: { in: ["owner", "admin"] } } } } } },
    take: 50,
  });

  for (const device of backOnline) {
    await prisma.device.update({ where: { id: device.id }, data: { offline: false } });
    emitToHome(device.homeId, "device:updated", { id: device.id, offline: false });
    for (const userId of device.home.members.map((m) => m.userId)) {
      await createNotification(userId, {
        category: "device",
        type: "info",
        title: `✅ ${device.name} online`,
        body: `${device.name} wapas connected ho gaya.`,
      });
    }
    console.log(`[offline] ${device.name} (${device.id}) back online`);
  }
}
