/**
 * Leak Monitor — app.log heartbeat ([hb]) lines se per-process RSS growth
 * detect karta hai. Koi bhi process last 4h window me 20%+ RSS growth
 * (kam se kam 30 min data) dikhaye → leak incident (admin pe red alert +
 * persistent file site/apps/logs/leak-incidents.jsonl).
 *
 * Har 60s check — process recycle ho jaye to bhi log se data milta hai,
 * incident history intact rehti hai (health-check.jsonl jaisa pattern).
 *
 * IMPORTANT: SIRF real `ts=` wali heartbeat lines detection me count hoti
 * hain. Purana format (bina ts — `[hb] alive uptime=N pid=N rss=NMB`) ko
 * `now - uptime` se date karna chronological order ULTA kar deta tha →
 * RSS decline ko +growth dikhata tha (false leak alert). Legacy lines ko
 * detection se bahar rakha gaya hai; ab har process ts= log karta hai.
 */
import * as fs from "fs";
import * as path from "path";
import { logFilePath } from "./logger";

const CHECK_INTERVAL_MS = 60_000;
const LEAK_WINDOW_MS = 4 * 3600_000; // 4h window
const LEAK_MIN_SPAN_MS = 30 * 60_000; // kam se kam 30 min data
const LEAK_STALE_MS = 2 * 60_000; // heartbeat 2 min se purana = process mar gaya
const LEAK_THRESHOLD_PCT = 20; // 20%+ growth = leak
const TAIL_MAX = 5 * 1024 * 1024; // log tail (5MB cap)

export interface LeakDetail {
  pid: number;
  growthPct: number;
  spanH: number;
  rssFirst: number;
  rssLast: number;
  firstTs: string;
  lastTs: string;
}

const startedAt = Date.now();
let lastCheckedAt: string | null = null;
let activeLeak: LeakDetail | null = null;
let incidents: Array<Record<string, unknown>> = [];

function incidentFile(): string | null {
  if (!logFilePath) return null;
  return path.join(path.dirname(logFilePath), "leak-incidents.jsonl");
}

function append(ev: Record<string, unknown>): void {
  const f = incidentFile();
  if (!f) return;
  try {
    fs.appendFileSync(f, JSON.stringify(ev) + "\n");
  } catch {
    /* ignore */
  }
}

/** Boot pe file se incidents load + last open leak adopt (recycle continuity). */
function loadIncidents(): void {
  const f = incidentFile();
  if (!f || !fs.existsSync(f)) return;
  try {
    const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean).slice(-500);
    const evs: Array<Record<string, unknown>> = [];
    for (const l of lines) {
      try {
        evs.push(JSON.parse(l));
      } catch {
        /* skip corrupt */
      }
    }
    incidents = evs.slice(-200);
    // last event leak_start hai aur uske baad leak_end nahi → active leak adopt
    for (const e of evs) {
      if (e.type === "leak_start") {
        activeLeak = {
          pid: Number(e.pid),
          growthPct: Number(e.growthPct ?? 0),
          spanH: Number(e.spanH ?? 0),
          rssFirst: Number(e.rssFirst ?? 0),
          rssLast: Number(e.rssLast ?? 0),
          firstTs: String(e.firstTs ?? e.ts ?? ""),
          lastTs: String(e.lastTs ?? e.ts ?? ""),
        };
      } else if (e.type === "leak_end") {
        activeLeak = null;
      }
    }
    // Adoption guard: open leak tabhi adopt karo jab pid ABHI bhi log me
    // fresh heartbeats de raha ho. Warna purana incident (jiski lines tail
    // se nikal gayi hain / process mar gaya) dobara "leaking" dikhega —
    // stale alert admin pe phir se red ho jata tha.
    if (activeLeak) {
      const pid = activeLeak.pid;
      const alive = readHeartbeatPoints().some((p) => p.pid === pid && Date.now() - p.ts < LEAK_STALE_MS);
      if (!alive) activeLeak = null;
    }
  } catch {
    /* ignore */
  }
}

/** app.log tail se [hb] lines parse → {ts, pid, rss} points.
 *  Sirf real `ts=` wali lines count hoti hain — bina ts ke lines ko
 *  approximate karna trend ulta kar deta hai (false positive leak).
 */
function readHeartbeatPoints(): Array<{ ts: number; pid: number; rss: number }> {
  if (!logFilePath || !fs.existsSync(logFilePath)) return [];
  try {
    const st = fs.statSync(logFilePath);
    if (st.size <= 0) return [];
    const start = Math.max(0, st.size - TAIL_MAX);
    const len = st.size - start;
    const fd = fs.openSync(logFilePath, "r");
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    fs.closeSync(fd);
    const text = buf.toString("utf8");
    const re = /\[hb\] alive ts=([\d:.TZ-]+) uptime=(\d+)s pid=(\d+) rss=(\d+)MB(?: heap=(\d+)MB)?/g;
    const points: Array<{ ts: number; pid: number; rss: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const t = Date.parse(m[1]);
      if (Number.isNaN(t)) continue;
      points.push({ ts: t, pid: Number(m[3]), rss: Number(m[4]) });
    }
    return points;
  } catch {
    return [];
  }
}

/** 4h window me sabse bada 20%+ RSS growth wala process dhundho. */
function detectLeak(): LeakDetail | null {
  const points = readHeartbeatPoints();
  if (points.length < 2) return null;
  const byPid = new Map<number, Array<{ ts: number; rss: number }>>();
  for (const p of points) {
    const arr = byPid.get(p.pid) || [];
    arr.push({ ts: p.ts, rss: p.rss });
    byPid.set(p.pid, arr);
  }
  let worst: LeakDetail | null = null;
  for (const [pid, pts] of byPid) {
    const tEnd = Math.max(...pts.map((p) => p.ts));
    const tStart = tEnd - LEAK_WINDOW_MS;
    const win = pts.filter((p) => p.ts >= tStart);
    if (win.length < 2) continue;
    const times = win.map((p) => p.ts);
    const span = Math.max(...times) - Math.min(...times);
    if (span < LEAK_MIN_SPAN_MS) continue; // 30 min se kam data = reliable nahi
    const sorted = [...win].sort((a, b) => a.ts - b.ts);
    const first = sorted[0].rss;
    const last = sorted[sorted.length - 1].rss;
    if (first <= 0) continue;
    const pct = ((last - first) / first) * 100;
    if (pct >= LEAK_THRESHOLD_PCT && tEnd >= Date.now() - LEAK_STALE_MS) {
      // stale heartbeat (process mar gaya) wale candidates ko skip —
      // warna sabse bada growth stale ho to fresh wala kabhi nahi dikhta
      const cand: LeakDetail = {
        pid,
        growthPct: pct,
        spanH: span / 3600_000,
        rssFirst: first,
        rssLast: last,
        firstTs: new Date(sorted[0].ts).toISOString(),
        lastTs: new Date(sorted[sorted.length - 1].ts).toISOString(),
      };
      if (!worst || cand.growthPct > worst.growthPct) worst = cand;
    }
  }
  return worst;
}

function push(ev: Record<string, unknown>): void {
  append(ev);
  incidents.push(ev);
  if (incidents.length > 200) incidents = incidents.slice(-200);
}

/** Incidents file ki LAST line — cross-instance dedup ke liye.
 *  Multiple API instances same leak-incidents.jsonl me likhte hain; in-memory
 *  array me doosre instance ki entry nahi dikhti, isliye file hi asli source.
 */
function lastFileEvent(): Record<string, unknown> | null {
  const f = incidentFile();
  if (!f || !fs.existsSync(f)) return null;
  try {
    const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
    if (!lines.length) return null;
    return JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function openLeak(leak: LeakDetail): void {
  activeLeak = leak;
  // duplicate guard — same pid ka leak already open hai to dobara mat likho
  // (multi-process / restart churn me consecutive duplicate entries na aayen)
  const last = incidents[incidents.length - 1];
  const alreadyOpen = last && last.type === "leak_start" && Number(last.pid) === leak.pid;
  // Cross-instance guard: doosre instance ne abhi file me unclosed leak_start
  // likha ho to bhi skip (in-memory array me wo entry nahi hoti).
  const fileLast = lastFileEvent();
  const fileOpen = fileLast && fileLast.type === "leak_start" && Number(fileLast.pid) === leak.pid;
  if (!alreadyOpen && !fileOpen) {
    push({
      ts: new Date().toISOString(),
      type: "leak_start",
      pid: leak.pid,
      growthPct: Number(leak.growthPct.toFixed(1)),
      spanH: Number(leak.spanH.toFixed(2)),
      rssFirst: leak.rssFirst,
      rssLast: leak.rssLast,
      firstTs: leak.firstTs,
      lastTs: leak.lastTs,
    });
  }
}

function closeLeak(): void {
  if (!activeLeak) return;
  // Sirf tabhi leak_end likho jab file ka last event matching leak_start ho —
  // doosre instance ne pehle hi end likh diya ho to orphan duplicate na aaye.
  const fileLast = lastFileEvent();
  const matches = fileLast && fileLast.type === "leak_start" && Number(fileLast.pid) === activeLeak.pid;
  if (matches) {
    push({
      ts: new Date().toISOString(),
      type: "leak_end",
      pid: activeLeak.pid,
      growthPct: Number(activeLeak.growthPct.toFixed(1)),
    });
  }
  activeLeak = null;
}

function tick(): void {
  lastCheckedAt = new Date().toISOString();
  const leak = detectLeak();
  if (activeLeak && (!leak || leak.pid !== activeLeak.pid)) closeLeak();
  if (leak && !activeLeak) openLeak(leak);
}

export function startLeakMonitor(): void {
  loadIncidents();
  tick(); // boot pe turant pehla check
  setInterval(tick, CHECK_INTERVAL_MS);
}

export function getLeakMonitorState(): {
  running: boolean;
  startedAt: string;
  lastCheckedAt: string | null;
  leaking: boolean;
  detail: LeakDetail | null;
  thresholdPct: number;
  windowH: number;
  incidents: Array<Record<string, unknown>>;
} {
  return {
    running: true,
    startedAt: new Date(startedAt).toISOString(),
    lastCheckedAt,
    leaking: !!activeLeak,
    detail: activeLeak,
    thresholdPct: LEAK_THRESHOLD_PCT,
    windowH: LEAK_WINDOW_MS / 3600_000,
    incidents: incidents.slice(-20),
  };
}
