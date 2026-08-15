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

  // ===================== ESP BOARDS (root cause) =====================
  // Board offline = uske NICHE saare devices bhi dead. Board ek hi notification
  // bhejta hai (har device ki alag nahi) — user ko seedha board ka pata chalta hai.
  const staleBoards = await prisma.espDevice.findMany({
    where: { lastSeen: { lt: cutoff }, offline: false },
    include: { home: { include: { members: { where: { role: { in: ["owner", "admin"] } } } } } },
    take: 50,
  });
  const anyStaleBoardIds = new Set(
    (await prisma.espDevice.findMany({ where: { lastSeen: { lt: cutoff } }, select: { id: true } })).map((b) => b.id),
  );

  for (const board of staleBoards) {
    await prisma.espDevice.update({ where: { id: board.id }, data: { offline: true } });
    emitToHome(board.homeId, "esp:updated", { id: board.id, offline: true });
    const boardName = board.name ?? board.serialCode ?? `ESP-${board.macAddress.slice(-6).toUpperCase()}`;
    for (const m of board.home.members) {
      await createNotification(m.userId, {
        category: "device",
        type: "warning",
        title: `📡 Board offline: ${boardName}`,
        body: `${boardName} ne 2+ min se sync nahi kiya — WiFi/power check karo.`,
      });
    }
    console.log(`[offline] board ${boardName} (${board.id}) marked offline`);
  }

  // Boards that came back online
  const backBoards = await prisma.espDevice.findMany({
    where: { offline: true, lastSeen: { gte: cutoff } },
    include: { home: { include: { members: { where: { role: { in: ["owner", "admin"] } } } } } },
    take: 50,
  });
  for (const board of backBoards) {
    await prisma.espDevice.update({ where: { id: board.id }, data: { offline: false } });
    emitToHome(board.homeId, "esp:updated", { id: board.id, offline: false });
    const boardName = board.name ?? board.serialCode ?? `ESP-${board.macAddress.slice(-6).toUpperCase()}`;
    for (const m of board.home.members) {
      await createNotification(m.userId, {
        category: "device",
        type: "info",
        title: `✅ Board online: ${boardName}`,
        body: `${boardName} wapas connected ho gaya.`,
      });
    }
    console.log(`[offline] board ${boardName} (${board.id}) back online`);
  }

  // ===================== DEVICES =====================
  // Sirf un devices ko flag karo jo kisi offline/stale board ke under NAHI hain
  // (board wale ka root cause board hai — board notification kaafi hai).
  const stale = await prisma.device.findMany({
    where: {
      lastSeen: { lt: cutoff },
      ...(anyStaleBoardIds.size
        ? { OR: [{ espId: null }, { espId: { notIn: [...anyStaleBoardIds] } }] }
        : {}),
    },
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
