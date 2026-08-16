/**
 * In-app Health Monitor — har 30s apne hi production health endpoint ko hit
 * karta hai (IIS → iisnode → node full chain), 503/outage detect karta hai,
 * aur incident history ko persistent file me log karta hai
 * (site/apps/logs/health-check.jsonl — process recycle ke baad bhi intact).
 *
 * Diagnostics panel (admin → Logs) isi se "Health checker" card dikhata hai.
 */
import * as fs from "fs";
import * as path from "path";
import { logFilePath } from "./logger";
import { isDbReady } from "./dbState";

const CHECK_INTERVAL_MS = 30_000;
const INCIDENT_THRESHOLD = 2; // 2 consecutive fails = incident
const FETCH_TIMEOUT_MS = 10_000;

let lastSeenHost: string | null = null;
const startedAt = Date.now();
let lastCheck: { ts: string; ok: boolean; status: number | null; ms: number; err: string | null } | null = null;
let checksTotal = 0;
let checksOk = 0;
let failStreak = 0;
let checking = false;
let activeIncident: { id: string; startedAt: string; lastStatus: number | null; lastErr: string | null } | null = null;

function hcFile(): string | null {
  if (!logFilePath) return null;
  return path.join(path.dirname(logFilePath), "health-check.jsonl");
}

function append(ev: Record<string, unknown>): void {
  const f = hcFile();
  if (!f) return;
  try {
    fs.appendFileSync(f, JSON.stringify(ev) + "\n");
  } catch {
    /* ignore */
  }
}

/** Admin/ESP requests ke Host header se apna public URL seekhna. */
export function setLastSeenHost(host: string): void {
  if (!host) return;
  const h = host.toLowerCase();
  // localhost / IPs ko ignore — monitor ko sirf real domain chahiye
  // (local dev me HTTPS nahi hai, isliye galat incidents log ho jate).
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)/.test(h)) return;
  if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(h)) return;
  if (/^[a-z0-9.-]+(:\d+)?$/i.test(h)) lastSeenHost = host;
}

/** Boot pe file se open incident adopt karo (recycle ke baad continuity). */
function adoptOpenIncident(): void {
  const f = hcFile();
  if (!f || !fs.existsSync(f)) return;
  try {
    const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean).slice(-200);
    let open: { id: string; ts: string; lastStatus?: number | null; lastErr?: string | null } | null = null;
    for (const l of lines) {
      try {
        const e = JSON.parse(l) as { type: string; id: string; ts: string; lastStatus?: number | null; lastErr?: string | null };
        if (e.type === "incident_start") open = e;
        else if (e.type === "incident_end" && open && e.id === open.id) open = null;
      } catch {
        /* skip corrupt */
      }
    }
    if (open) {
      activeIncident = {
        id: open.id,
        startedAt: open.ts,
        lastStatus: open.lastStatus ?? null,
        lastErr: open.lastErr ?? null,
      };
    }
  } catch {
    /* ignore */
  }
}

async function checkOnce(): Promise<void> {
  checking = true;
  const t0 = Date.now();
  let ok = false;
  let status: number | null = null;
  let err: string | null = null;

  if (lastSeenHost) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`https://${lastSeenHost}/api/health`, {
        signal: ctrl.signal,
        headers: { "user-agent": "SwitchNestHealthMonitor/1.0" },
      });
      status = res.status;
      ok = res.status === 200;
      if (!ok) err = `status_${res.status}`;
    } catch (e) {
      const anyErr = e as { name?: string; cause?: { code?: string } };
      err = anyErr?.name === "AbortError" ? "timeout" : String(anyErr?.cause?.code || anyErr?.name || e);
      ok = false;
    } finally {
      clearTimeout(timer);
    }
  } else {
    // host abhi nahi mila (boot ke pehle requests) — in-process readiness check
    ok = isDbReady();
    status = ok ? 200 : 503;
    err = ok ? null : "db_not_ready";
  }
  const ms = Date.now() - t0;
  checking = false;

  checksTotal++;
  if (ok) checksOk++;
  const ev: Record<string, unknown> = { ts: new Date().toISOString(), type: "check", ok, status, ms: Math.round(ms), err };
  append(ev);
  lastCheck = { ts: ev.ts as string, ok, status, ms: Math.round(ms), err };

  if (!ok) {
    failStreak++;
    if (failStreak >= INCIDENT_THRESHOLD && !activeIncident) {
      activeIncident = { id: `${Date.now()}`, startedAt: ev.ts as string, lastStatus: status, lastErr: err };
      append({
        ts: ev.ts,
        type: "incident_start",
        id: activeIncident.id,
        failCount: failStreak,
        lastStatus: status,
        lastErr: err,
      });
    }
  } else if (activeIncident) {
    const durSec = Math.round((Date.now() - Date.parse(activeIncident.startedAt)) / 1000);
    append({ ts: ev.ts, type: "incident_end", id: activeIncident.id, durationSec: durSec, recoveredStatus: status });
    activeIncident = null;
    failStreak = 0;
  }
}

/** finishReady() me call karo — DB ready hone ke baad. */
export function startHealthMonitor(): void {
  // Optional env override — PUBLIC_SITE_URL set ho to use karo
  // (multiple domains/production misconfig me kaam aata hai).
  try {
    const envUrl = process.env.PUBLIC_SITE_URL;
    if (envUrl) {
      const u = new URL(envUrl);
      if (u.host) setLastSeenHost(u.host);
    }
  } catch {
    /* ignore */
  }
  adoptOpenIncident();
  checkOnce().catch(() => undefined);
  setInterval(() => {
    checkOnce().catch(() => undefined);
  }, CHECK_INTERVAL_MS);
}

export interface HealthIncident {
  ts: string;
  type: string;
  id: string;
  failCount?: number;
  lastStatus?: number | null;
  lastErr?: string | null;
  end?: { ts: string; durationSec: number; recoveredStatus?: number | null } | null;
}

/** Diagnostics endpoint ke liye — live state + file se incident history. */
export function getHealthMonitorState(): {
  running: boolean;
  intervalSec: number;
  startedAt: string;
  lastCheck: typeof lastCheck;
  checksTotal: number;
  checksOk: number;
  successRate: number | null;
  activeIncident: typeof activeIncident;
  checking: boolean;
  incidents: HealthIncident[];
} {
  const incidents: HealthIncident[] = [];
  const f = hcFile();
  if (f && fs.existsSync(f)) {
    try {
      const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean).slice(-500);
      for (const l of lines) {
        try {
          const e = JSON.parse(l) as HealthIncident;
          if (e.type === "incident_start" || e.type === "incident_end") incidents.push(e);
        } catch {
          /* skip corrupt */
        }
      }
    } catch {
      /* ignore */
    }
  }
  const ends = new Map<string, { ts: string; durationSec: number; recoveredStatus?: number | null }>();
  for (const e of incidents) {
    if (e.type === "incident_end") {
      const endEv = e as HealthIncident & { durationSec?: number; recoveredStatus?: number | null };
      ends.set(e.id, { ts: e.ts, durationSec: endEv.durationSec ?? 0, recoveredStatus: endEv.recoveredStatus });
    }
  }
  const paired: HealthIncident[] = [];
  for (const e of incidents) {
    if (e.type === "incident_start") {
      paired.push({ ...e, end: ends.get(e.id) ?? null });
    }
  }
  paired.reverse();

  return {
    running: true,
    intervalSec: CHECK_INTERVAL_MS / 1000,
    startedAt: new Date(startedAt).toISOString(),
    lastCheck,
    checksTotal,
    checksOk,
    successRate: checksTotal ? Number(((checksOk / checksTotal) * 100).toFixed(1)) : null,
    activeIncident,
    checking,
    incidents: paired.slice(0, 20),
  };
}
