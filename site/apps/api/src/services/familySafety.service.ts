import { prisma } from "../lib/prisma";
import { createNotification } from "./notification.service";
import { emitToHome } from "../lib/socket";
import { fileLog } from "../lib/logger";

/**
 * Child safety monitor — har 60s restricted members ke daily ON-time limits
 * check karta hai. Limit cross → device auto-OFF + mom/dad (owner) ko
 * notification + bachche ko bhi pata. Har device pe ek baar notify/day.
 */
const CHECK_INTERVAL_MS = 60_000;
let timer: NodeJS.Timeout | null = null;
let running = false;

export function startFamilySafety() {
  if (timer) return;
  timer = setInterval(() => void runSafetyCheck(), CHECK_INTERVAL_MS);
  fileLog("[family-safety] monitor started (60s)");
}

export function stopFamilySafety() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Aaj ka (device, user) ON-time minutes — DeviceLog ke status_change entries se. */
async function usageMinutesToday(deviceId: number, userId: number): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const logs = await prisma.deviceLog.findMany({
    where: {
      deviceId,
      actorId: userId,
      logType: "status_change",
      createdAt: { gte: start },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, logMessage: true },
  });

  let minutes = 0;
  let onAt: Date | null = null;
  for (const l of logs) {
    if (l.logMessage.includes("turned on")) {
      onAt = l.createdAt;
    } else if (l.logMessage.includes("turned off") && onAt) {
      minutes += Math.round((l.createdAt.getTime() - onAt.getTime()) / 60_000);
      onAt = null;
    }
  }

  // Abhi bhi ON hai to ab tak ka time bhi gino
  if (onAt) {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { status: true },
    });
    if (device?.status === "on") {
      minutes += Math.round((Date.now() - onAt.getTime()) / 60_000);
    }
  }
  return minutes;
}

/** Device ko off karo (command + log + realtime). */
async function autoOffDevice(deviceId: number, homeId: number) {
  await prisma.$transaction([
    prisma.device.update({ where: { id: deviceId }, data: { status: "off" } }),
    prisma.deviceCommand.create({
      data: { deviceId, actorId: null, command: "set_status:off" },
    }),
    prisma.deviceLog.create({
      data: {
        deviceId,
        actorId: null,
        logType: "child_safety",
        logMessage: "Auto-off by child safety daily limit",
      },
    }),
  ]);
  const updated = await prisma.device.findUnique({ where: { id: deviceId } });
  if (updated) emitToHome(homeId, "device:updated", updated);
}

export async function runSafetyCheck(): Promise<void> {
  if (running) return;
  // Defensive: stale prisma client (model missing) pe skip — 500/crash nahi
  if (!prisma.deviceAccess || !prisma.deviceUsage) {
    fileLog("[family-safety] prisma models missing (stale client?) — run npx prisma generate, monitor skip");
    return;
  }
  running = true;
  try {
    const members = await prisma.homeMember.findMany({
      where: { restricted: true, dailyLimitMinutes: { not: null } },
      include: { home: { select: { ownerId: true, name: true } } },
    });
    if (members.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const m of members) {
      const limit = m.dailyLimitMinutes!;
      const grants = await prisma.deviceAccess.findMany({
        where: { homeId: m.homeId, userId: m.userId },
        select: { deviceId: true },
      });
      for (const acc of grants) {
        const usage = await usageMinutesToday(acc.deviceId, m.userId);

        // Usage table update — future dashboard ke liye bhi ready
        await prisma.deviceUsage.upsert({
          where: {
            deviceId_userId_date: { deviceId: acc.deviceId, userId: m.userId, date: today },
          },
          create: {
            homeId: m.homeId,
            deviceId: acc.deviceId,
            userId: m.userId,
            date: today,
            onMinutes: usage,
          },
          update: { onMinutes: usage },
        });

        if (usage < limit) continue;

        const device = await prisma.device.findUnique({
          where: { id: acc.deviceId },
          select: { name: true, status: true },
        });
        if (!device || device.status !== "on") continue;

        // Din me ek baar hi notify karo (enforcement har baar chalta hai).
        // NOTE: already-check AUTO-OFF se PEHLE — kyunki auto-off khud
        // 'child_safety' log banata hai (warna notification kabhi na aati).
        const already = await prisma.deviceLog.findFirst({
          where: { deviceId: acc.deviceId, logType: "child_safety", createdAt: { gte: today } },
        });

        await autoOffDevice(acc.deviceId, m.homeId);
        if (already) continue;

        const child = await prisma.user.findUnique({
          where: { id: m.userId },
          select: { username: true },
        });
        const who = child?.username ?? "Member";
        const msg = `${who} ne aaj "${device.name}" ${limit} min se zyada ON rakha — safety limit khatam, humne band kar diya.`;
        await createNotification(m.home.ownerId, {
          category: "device",
          type: "warning",
          title: `👶 Child safety: "${device.name}" band kiya`,
          body: msg,
        });
        await createNotification(m.userId, {
          category: "device",
          type: "warning",
          title: `⏳ "${device.name}" ka time khatam`,
          body: `Aaj ka ${limit} min limit poora ho gaya — device band kar diya gaya.`,
        });
        fileLog(`[family-safety] auto-off ${device.name} for user ${m.userId} (${usage}min >= ${limit}min)`);
      }
    }
  } catch (err) {
    fileLog(`[family-safety] ERROR: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    running = false;
  }
}
