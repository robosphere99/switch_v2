import { prisma } from "../lib/prisma";
import { emitDeviceUpdated, emitToHome } from "../lib/socket";
import { createNotificationWithEmail } from "./notification.service";
import { fileLog } from "../lib/logger";

let timer: NodeJS.Timeout | null = null;
const OFFLINE_THRESHOLD_MS = 120_000; // 2 min without sync = offline
const CHECK_INTERVAL_MS = 60_000; // check every 1 min

// ---------------------------------------------------------------------------
// Offline batching (power-cut summary) — pure helpers (unit-tested).
//
// Jab ek hi tick me ek home ke 2+ boards/devices offline ho jayein (typical
// power cut / WiFi down), to har item ki alag notification+email bhejne ki
// jagah EK summary bhejte hain. Single event pe purana individual behavior.
// ---------------------------------------------------------------------------

export interface OfflineEventItem {
  homeId: number;
  name: string;
  kind: "board" | "device";
}

/** Items ko home ke hisaab se group karo (order preserve). */
export function groupOfflineEvents(items: OfflineEventItem[]): OfflineEventItem[][] {
  const byHome = new Map<number, OfflineEventItem[]>();
  for (const it of items) {
    const arr = byHome.get(it.homeId) ?? [];
    arr.push(it);
    byHome.set(it.homeId, arr);
  }
  return [...byHome.values()];
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

function describeGroup(group: OfflineEventItem[]): string {
  const boards = group.filter((i) => i.kind === "board").length;
  const devices = group.filter((i) => i.kind === "device").length;
  const parts: string[] = [];
  if (boards) parts.push(plural(boards, "board"));
  if (devices) parts.push(plural(devices, "device"));
  return parts.join(" + ");
}

/**
 * 2+ items ek saath offline = power cut summary, warna null (individual
 * notification bhejna hai).
 */
export function offlineSummaryText(group: OfflineEventItem[]): { title: string; body: string } | null {
  if (group.length < 2) return null;
  const names = group.map((i) => i.name).join(", ");
  return {
    title: `⚠️ Power cut detected — ${describeGroup(group)} offline`,
    body: `${names} ek saath offline ho gaye — lagta hai power/WiFi cut hai. Power wapas aate hi sab wapas online ho jayenge.`,
  };
}

/** 2+ items ek saath wapas online = power restored summary, warna null. */
export function recoverySummaryText(group: OfflineEventItem[]): { title: string; body: string } | null {
  if (group.length < 2) return null;
  return {
    title: `✅ Power restored — ${describeGroup(group)} online`,
    body: "Sab wapas connected ho gaye — ab koi action nahi chahiye.",
  };
}

/** Home ke owner/admin members (notifications + email inhi ko jaati hain). */
async function membersForHome(homeId: number): Promise<number[]> {
  const rows = await prisma.homeMember.findMany({
    where: { homeId, role: { in: ["owner", "admin"] } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/** Ek home ke group ko notify karo — summary (2+) ya individual (1). */
async function notifyGroup(group: OfflineEventItem[], direction: "offline" | "online"): Promise<void> {
  const homeId = group[0]!.homeId;
  const summary = direction === "offline" ? offlineSummaryText(group) : recoverySummaryText(group);
  const members = await membersForHome(homeId);
  if (members.length === 0) return;

  if (summary) {
    for (const userId of members) {
      await createNotificationWithEmail(
        userId,
        {
          category: "device",
          type: direction === "offline" ? "warning" : "info",
          title: summary.title,
          body: summary.body,
        },
        { emailSubject: summary.title },
      );
    }
    return;
  }

  for (const it of group) {
    const title = direction === "offline" ? `📡 ${it.name} offline` : `✅ ${it.name} online`;
    const body =
      direction === "offline"
        ? `${it.name} ne 2+ min se sync nahi kiya — WiFi/power check karo.`
        : `${it.name} wapas connected ho gaya.`;
    for (const userId of members) {
      await createNotificationWithEmail(
        userId,
        { category: "device", type: direction === "offline" ? "warning" : "info", title, body },
        { emailSubject: title },
      );
    }
  }
}

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
    select: { id: true, homeId: true, name: true, serialCode: true, macAddress: true },
    take: 50,
  });
  const anyStaleBoardIds = new Set(
    (await prisma.espDevice.findMany({ where: { lastSeen: { lt: cutoff } }, select: { id: true } })).map((b) => b.id),
  );

  const offlineEvents: OfflineEventItem[] = [];
  for (const board of staleBoards) {
    await prisma.espDevice.update({ where: { id: board.id }, data: { offline: true } });
    emitToHome(board.homeId, "esp:updated", { id: board.id, offline: true });
    const boardName = board.name ?? board.serialCode ?? `ESP-${board.macAddress.slice(-6).toUpperCase()}`;
    offlineEvents.push({ homeId: board.homeId, name: boardName, kind: "board" });
    console.log(`[offline] board ${boardName} (${board.id}) marked offline`);
  }

  // Boards that came back online
  const backBoards = await prisma.espDevice.findMany({
    where: { offline: true, lastSeen: { gte: cutoff } },
    select: { id: true, homeId: true, name: true, serialCode: true, macAddress: true },
    take: 50,
  });
  const onlineEvents: OfflineEventItem[] = [];
  for (const board of backBoards) {
    await prisma.espDevice.update({ where: { id: board.id }, data: { offline: false } });
    emitToHome(board.homeId, "esp:updated", { id: board.id, offline: false });
    const boardName = board.name ?? board.serialCode ?? `ESP-${board.macAddress.slice(-6).toUpperCase()}`;
    onlineEvents.push({ homeId: board.homeId, name: boardName, kind: "board" });
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
    select: { id: true, homeId: true, name: true, lastSeen: true, offline: true },
    take: 50,
  });

  for (const device of stale) {
    const wasOnline = device.lastSeen !== null && !device.offline;
    if (!wasOnline) continue; // already flagged

    await prisma.device.update({ where: { id: device.id }, data: { offline: true } });
    await emitDeviceUpdated(device.homeId, device.id);
    offlineEvents.push({ homeId: device.homeId, name: device.name, kind: "device" });
    console.log(`[offline] ${device.name} (${device.id}) marked offline`);
  }

  // Devices that came back online
  const backOnline = await prisma.device.findMany({
    where: { offline: true, lastSeen: { gte: cutoff } },
    select: { id: true, homeId: true, name: true },
    take: 50,
  });

  for (const device of backOnline) {
    await prisma.device.update({ where: { id: device.id }, data: { offline: false } });
    await emitDeviceUpdated(device.homeId, device.id);
    onlineEvents.push({ homeId: device.homeId, name: device.name, kind: "device" });
    console.log(`[offline] ${device.name} (${device.id}) back online`);
  }

  // ===================== NOTIFICATIONS (batched) =====================
  // Pehle saare mark+emit ho chuke — ab notifications bhejte hain. Har home ke
  // 2+ events ek saath = power-cut summary (ek notification+email), warna
  // individual (purana behavior).
  for (const group of groupOfflineEvents(offlineEvents)) {
    await notifyGroup(group, "offline");
  }
  for (const group of groupOfflineEvents(onlineEvents)) {
    await notifyGroup(group, "online");
  }
}
