import { prisma } from "../lib/prisma";

export interface UsageAnalytics {
  days: number;
  totals: { toggles: number; onMs: number };
  togglesPerDay: { date: string; count: number }[];
  perDevice: { deviceId: number; name: string; toggles: number; onMs: number }[];
  perMember: { userId: number | null; username: string; toggles: number }[];
}

export interface AnalyticsLog {
  deviceId: number;
  deviceName: string;
  actorId: number | null;
  actorName?: string;
  logMessage: string;
  createdAt: Date;
}

/**
 * Pure computation — logs array se analytics derive karta hai (testable).
 *  - togglesPerDay: last `days` din ke events (har din 0 se fill — chart gaps)
 *  - perDevice.onMs: consecutive ON→OFF pairs sum; currently-ON period abhi tak
 *    count hota hai (approximation — logs duration store nahi karte)
 *  - perMember: actor ke hisaab se toggles; actor null → schedule/device
 */
export function computeUsageAnalytics(logs: AnalyticsLog[], days: number, now = Date.now()): UsageAnalytics {
  // Last `days` din — sab 0 se fill (chart me gaps na dikhein)
  const perDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    perDay.set(d.toISOString().slice(0, 10), 0);
  }

  const deviceMap = new Map<
    number,
    { deviceId: number; name: string; toggles: number; onMs: number; lastOnAt?: number }
  >();
  const memberMap = new Map<
    number,
    { userId: number | null; username: string; toggles: number }
  >();

  for (const log of logs) {
    const day = log.createdAt.toISOString().slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);

    const dev = deviceMap.get(log.deviceId) ?? {
      deviceId: log.deviceId,
      name: log.deviceName,
      toggles: 0,
      onMs: 0,
    };
    dev.toggles += 1;

    const turnedOn = log.logMessage.trim().endsWith("on");
    if (turnedOn) {
      dev.lastOnAt = log.createdAt.getTime();
    } else if (dev.lastOnAt !== undefined) {
      dev.onMs += log.createdAt.getTime() - dev.lastOnAt;
      dev.lastOnAt = undefined;
    }
    deviceMap.set(log.deviceId, dev);

    const actorId = log.actorId ?? -1; // null → auto/schedule
    const member = memberMap.get(actorId) ?? {
      userId: log.actorId,
      username: log.actorId === null ? "Auto (schedule/device)" : log.actorName ?? "Unknown",
      toggles: 0,
    };
    member.toggles += 1;
    memberMap.set(actorId, member);
  }

  // Currently-ON devices: abhi tak chalu period bhi count karo
  for (const dev of deviceMap.values()) {
    if (dev.lastOnAt !== undefined) {
      dev.onMs += now - dev.lastOnAt;
      dev.lastOnAt = undefined;
    }
  }

  const perDevice = [...deviceMap.values()]
    .map(({ deviceId, name, toggles, onMs }) => ({ deviceId, name, toggles, onMs }))
    .sort((a, b) => b.toggles - a.toggles);
  const perMember = [...memberMap.values()].sort((a, b) => b.toggles - a.toggles);

  return {
    days,
    totals: {
      toggles: logs.length,
      onMs: perDevice.reduce((s, d) => s + d.onMs, 0),
    },
    togglesPerDay: [...perDay.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    perDevice,
    perMember,
  };
}

/** Fetch + compute — route handler ke liye. */
export async function getUsageAnalytics(homeId: number, days: number): Promise<UsageAnalytics> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await prisma.deviceLog.findMany({
    where: {
      logType: "status_change",
      createdAt: { gte: since },
      device: { homeId },
    },
    include: {
      device: { select: { id: true, name: true } },
      actor: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return computeUsageAnalytics(
    logs.map((l) => ({
      deviceId: l.deviceId,
      deviceName: l.device.name,
      actorId: l.actorId,
      actorName: l.actor?.username,
      logMessage: l.logMessage,
      createdAt: l.createdAt,
    })),
    days,
  );
}
