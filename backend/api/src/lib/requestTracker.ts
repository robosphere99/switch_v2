import { prisma } from "./prisma";

/**
 * API request traffic tracker — in-memory hourly/daily buckets, AppMeta me
 * periodically flush (process restart pe thoda data loss chalta hai — monitoring
 * ke liye kaafi accurate). Admin Overview "site usage / requests / traffic"
 * cards isi se aate hain.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const STORE_KEY = "req_tracker";

const hourly = new Map<string, number>(); // "2026-08-15T21" -> count
const daily = new Map<string, number>(); // "2026-08-15" -> count
let total = 0;
let loaded = false;

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function hourKey(d: Date) {
  return d.toISOString().slice(0, 13);
}

export function trackRequest(): void {
  const now = new Date();
  const hk = hourKey(now);
  const dk = dayKey(now);
  hourly.set(hk, (hourly.get(hk) ?? 0) + 1);
  daily.set(dk, (daily.get(dk) ?? 0) + 1);
  total++;
}

export interface RequestStats {
  today: number;
  last24h: number;
  total: number;
}

export function getRequestStats(): RequestStats {
  const now = new Date();
  const cutoff = now.getTime() - DAY_MS;
  let last24h = 0;
  for (const [k, v] of hourly) {
    const t = new Date(`${k}:00:00.000Z`).getTime();
    if (t >= cutoff) last24h += v;
  }
  return { today: daily.get(dayKey(now)) ?? 0, last24h, total };
}

export async function loadRequestTracker(): Promise<void> {
  if (loaded) return;
  try {
    const row = await prisma.appMeta.findUnique({ where: { key: STORE_KEY } });
    if (row?.value) {
      const p = JSON.parse(row.value) as {
        hourly?: Record<string, number>;
        daily?: Record<string, number>;
        total?: number;
      };
      for (const [k, v] of Object.entries(p.hourly ?? {})) hourly.set(k, v);
      for (const [k, v] of Object.entries(p.daily ?? {})) daily.set(k, v);
      total = p.total ?? Object.values(p.daily ?? {}).reduce((a, b) => a + b, 0);
      // Purane buckets hatao (30+ din purana data monitoring ke liye zaroori nahi)
      const cutoff = Date.now() - 40 * DAY_MS;
      for (const k of [...hourly.keys()]) {
        if (new Date(`${k}:00:00.000Z`).getTime() < cutoff) hourly.delete(k);
      }
      for (const k of [...daily.keys()]) {
        if (new Date(`${k}T00:00:00.000Z`).getTime() < cutoff) daily.delete(k);
      }
    }
  } catch {
    /* ignore — tracker optional */
  }
  loaded = true;
}

let flushTimer: NodeJS.Timeout | null = null;

export function startRequestFlush(intervalMs = 60_000): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushRequestTracker();
  }, intervalMs);
  flushTimer.unref?.();
}

export async function flushRequestTracker(): Promise<void> {
  try {
    await prisma.appMeta.upsert({
      where: { key: STORE_KEY },
      create: {
        key: STORE_KEY,
        value: JSON.stringify({
          hourly: Object.fromEntries(hourly),
          daily: Object.fromEntries(daily),
          total,
        }),
      },
      update: {
        value: JSON.stringify({
          hourly: Object.fromEntries(hourly),
          daily: Object.fromEntries(daily),
          total,
        }),
      },
    });
  } catch {
    /* ignore */
  }
}
