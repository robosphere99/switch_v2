import { prisma } from "../lib/prisma";
import type { DeviceStatus } from "@robosphere/shared";

/**
 * Phase 7 — Suggested automations.
 * DeviceLog (status_change) se pattern detect karo: "is device ko roz 7 baje ON
 * karte ho → daily schedule banao?" Pure function (testable), DB fetch alag.
 */

export interface AutomationSuggestion {
  deviceId: number;
  deviceName: string;
  type: "daily";
  /** Local time "HH:MM" — daily schedule ka base time */
  time: string;
  action: DeviceStatus;
  confidence: number; // 0..1 — kitne din same time pe pattern mila
  days: number; // pattern wale distinct din
  reason: string;
}

interface SuggestionLog {
  deviceId: number;
  deviceName: string;
  logMessage: string;
  createdAt: Date;
}

const MIN_DAYS = 2; // kam se kam 2 din ka data chahiye
const MIN_CONFIDENCE = 0.5; // >=50% din same hour pe action

export function suggestAutomationsFromLogs(
  logs: SuggestionLog[],
  minDays = MIN_DAYS,
  minConfidence = MIN_CONFIDENCE,
): AutomationSuggestion[] {
  const byDevice = new Map<number, { name: string; days: Set<string>; hours: Map<string, Set<string>> }>();

  for (const log of logs) {
    const msg = log.logMessage.trim();
    if (!msg.endsWith("on") && !msg.endsWith("off")) continue;

    const action: DeviceStatus = msg.endsWith("on") ? "on" : "off";
    const d = log.createdAt;
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const hourKey = `${String(d.getHours()).padStart(2, "0")}:00`; // per-hour bucket

    const dev = byDevice.get(log.deviceId) ?? {
      name: log.deviceName,
      days: new Set<string>(),
      hours: new Map<string, Set<string>>(), // "07:00:on" -> set of dates
    };
    dev.days.add(dateKey);
    const slotKey = `${hourKey}|${action}`; // "|" — time me ":" hai isliye split-safe
    const slot = dev.hours.get(slotKey) ?? new Set<string>();
    slot.add(dateKey);
    dev.hours.set(slotKey, slot);
    byDevice.set(log.deviceId, dev);
  }

  const suggestions: AutomationSuggestion[] = [];

  for (const [deviceId, dev] of byDevice) {
    const totalDays = dev.days.size;
    if (totalDays < minDays) continue;

    for (const [slotKey, dates] of dev.hours) {
      const [time, action] = slotKey.split("|") as [string, DeviceStatus];
      const confidence = dates.size / totalDays;
      if (confidence < minConfidence) continue;

      const hour = Number(time.slice(0, 2));
      const period = hour < 12 ? "subah" : hour < 17 ? "dopahar" : hour < 21 ? "shaam" : "raat";
      suggestions.push({
        deviceId,
        deviceName: dev.name,
        type: "daily",
        time,
        action,
        confidence: Math.round(confidence * 100) / 100,
        days: dates.size,
        reason: `Aap "${dev.name}" ${time} baje (${period}) ${action === "on" ? "ON" : "OFF"} karte ho — ${dates.size}/${totalDays} din me.`,
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

/** Home ke devices ke logs se suggestions — route handler ke liye. */
export async function getAutomationSuggestions(homeId: number): Promise<AutomationSuggestion[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // last 14 din

  const logs = await prisma.deviceLog.findMany({
    where: {
      logType: "status_change",
      createdAt: { gte: since },
      device: { homeId },
    },
    include: { device: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return suggestAutomationsFromLogs(
    logs.map((l) => ({
      deviceId: l.deviceId,
      deviceName: l.device.name,
      logMessage: l.logMessage,
      createdAt: l.createdAt,
    })),
  );
}
