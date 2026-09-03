#!/usr/bin/env node
/**
 * SwitchNest Production Health Monitor
 * =====================================
 * Har CHECK_INTERVAL_MS (default 30s) pe production endpoints hit karta hai,
 * har check ko JSONL me log karta hai, aur outage detect karke recovery time
 * measure karta hai (fast-poll mode).
 *
 * Usage:
 *   node health-checker.mjs                 # forever loop (default)
 *   node health-checker.mjs --once          # single check (smoke test)
 *   node health-checker.mjs --report        # saare logs ka summary report
 *   node health-checker.mjs --report --days 7   # sirf last 7 din
 *
 * Logs:  logs/health-YYYY-MM-DD.jsonl  (har din nayi file, append-only)
 *
 * Zero dependencies — sirf Node 18+ (global fetch).
 */

const CHECK_INTERVAL_MS = 30_000;      // normal cadence
const RECOVERY_POLL_MS = 5_000;        // outage ke dauran fast-poll
const OUTAGE_THRESHOLD = 2;            // itne consecutive fails = outage
const FETCH_TIMEOUT_MS = 10_000;       // har request ka timeout
const RECOVERY_MAX_MS = 30 * 60_000;   // recovery poll max 30 min, phir wapas 30s

function resolveTargets(args = process.argv.slice(2)) {
  const urlArg = args.find((a) => a.startsWith("http://") || a.startsWith("https://") || a.startsWith("--url="));
  const custom = urlArg
    ? urlArg.replace(/^--url=/, "").trim()
    : process.env.TARGET_URL || process.env.SITE_URL || process.env.HEALTH_CHECK_URL;
  const base = custom ? custom.replace(/\/+$/, "") : "https://onlineswitch.bhartitechnical.com";
  return [
    { name: "api", url: `${base}/api/health`, altUrl: `${base}/health`, expect: 200 },
    { name: "web", url: `${base}/`, expect: 200 },
  ];
}

const TARGETS = resolveTargets();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "logs");

function logFileFor(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return path.join(LOG_DIR, `health-${y}-${m}-${day}.jsonl`);
}

function appendLine(obj) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(logFileFor(), JSON.stringify(obj) + "\n", "utf8");
  } catch (err) {
    console.error("[monitor] LOG WRITE FAILED:", err.message);
  }
}

function diagnose500(text = "", status = 500) {
  if (status === 500) {
    if (/500\.19/i.test(text) || /duplicate.*handler/i.test(text)) {
      return "Plesk IIS duplicate handler (HTTP 500.19). Check if custom web.config was uploaded. Plesk generates its own web.config.";
    }
    if (/500\.1001/i.test(text) || /iisnode/i.test(text) || /Cannot find module/i.test(text)) {
      return "iisnode startup failure (HTTP 500.1001). Check Application Startup File in Plesk (should be dist/index.cjs or dist/index.mjs) and verify node_modules.";
    }
    if (/Prisma/i.test(text) || /database/i.test(text) || /connect.*ECONNREFUSED/i.test(text)) {
      return "Database connection failure. Verify DB_HOST, DB_USER, DB_PASS, DB_NAME in Plesk environment or site/.env.";
    }
  }
  return null;
}

async function fetchWithDetails(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const t0 = Date.now();
  let status = null;
  let ok = false;
  let errType = null;
  let details = null;
  let tip = null;

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "SwitchNestHealthMonitor/1.0" },
    });
    status = res.status;
    ok = res.status === 200;
    if (!ok) {
      errType = `status_${res.status}`;
      try {
        const text = await res.text();
        if (text) {
          try {
            const json = JSON.parse(text);
            details = json.error?.message || json.message || text.slice(0, 300);
          } catch {
            const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            const h1Match = text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            const bodyClean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            details = titleMatch ? titleMatch[1].trim() : h1Match ? h1Match[1].trim() : bodyClean.slice(0, 200);
          }
          tip = diagnose500(text, status);
        }
      } catch {
        /* ignore text read */
      }
    }
  } catch (err) {
    errType = err.name === "AbortError" ? "timeout" : err.cause?.code || err.name || "error";
    details = err.message || String(err);
    if (/SELF_SIGNED|CERT_|certificate/i.test(details)) {
      tip = "SSL Certificate error. Plesk SSL might be pending propagation or self-signed. Try http:// or install SSL in Plesk.";
    }
    ok = false;
  } finally {
    clearTimeout(timer);
  }
  const ms = Date.now() - t0;
  return { ok, status, ms, errType, details, tip };
}

async function checkOnce(target) {
  let r = await fetchWithDetails(target.url);
  // If api check got 404 and has altUrl, retry with altUrl
  if (!r.ok && r.status === 404 && target.altUrl) {
    const altR = await fetchWithDetails(target.altUrl);
    if (altR.ok) r = altR;
  }
  return r;
}

/** Single check + log + console. */
async function runCheck(state, target) {
  const r = await checkOnce(target);
  const entry = {
    ts: new Date().toISOString(),
    type: "check",
    target: target.name,
    ok: r.ok,
    status: r.status,
    ms: Math.round(r.ms),
    err: r.errType,
    details: r.details || null,
  };
  appendLine(entry);

  const now = Date.now();
  const st = (state.fail[target.name] ||= { count: 0, outageId: null, lastTs: 0 });

  if (!r.ok) {
    st.count += 1;
    st.lastTs = now;
    console.log(
      `[${entry.ts.slice(11, 19)}] ${target.name.padEnd(4)} FAIL  ${r.status ?? "-"}  ${entry.ms}ms  (${r.errType})  fail#${st.count}`,
    );
    if (r.details) {
      console.log(`       ↳ Error: ${r.details}`);
    }
    if (r.tip) {
      console.log(`       💡 Tip: ${r.tip}`);
    }
    if (st.count >= OUTAGE_THRESHOLD && !st.outageId) {
      st.outageId = `${now}`;
      appendLine({
        ts: entry.ts,
        type: "outage_start",
        target: target.name,
        outageId: st.outageId,
        failCount: st.count,
        lastStatus: r.status,
        lastErr: r.errType,
        details: r.details || null,
      });
      console.log(`\n  🔴 OUTAGE START  ${target.name}  (${r.status ?? r.errType})  id=${st.outageId}\n`);
    }
  } else {
    if (st.outageId) {
      const durSec = Math.round((now - st.lastTs) / 1000);
      appendLine({
        ts: entry.ts,
        type: "outage_end",
        target: target.name,
        outageId: st.outageId,
        durationSec: durSec,
        recoveredStatus: r.status,
      });
      console.log(`  🟢 OUTAGE END    ${target.name}  downtime ~${durSec}s  id=${st.outageId}\n`);
      st.outageId = null;
    }
    st.count = 0;
    console.log(`[${entry.ts.slice(11, 19)}] ${target.name.padEnd(4)} OK    ${r.status}  ${entry.ms}ms`);
  }
  return r.ok;
}

async function printReport(args) {
  const daysIdx = args.indexOf("--days");
  const days = daysIdx >= 0 ? Number(args[daysIdx + 1]) : Infinity;
  const cutoff = days === Infinity ? 0 : Date.now() - days * 86_400_000;
  const files = fs.existsSync(LOG_DIR)
    ? fs.readdirSync(LOG_DIR).filter((f) => f.startsWith("health-") && f.endsWith(".jsonl")).sort()
    : [];
  if (!files.length) {
    console.log("❌ Koi log nahi mila. Pehle health-checker chalao (logs/ me health-*.jsonl banega).");
    process.exit(0);
  }
  const all = [];
  for (const f of files) {
    for (const line of fs.readFileSync(path.join(LOG_DIR, f), "utf8").split("\n").filter(Boolean)) {
      try {
        const e = JSON.parse(line);
        if (Date.parse(e.ts) >= cutoff) all.push(e);
      } catch { /* skip corrupt */ }
    }
  }
  if (!all.length) {
    console.log("Is window me koi data nahi.");
    process.exit(0);
  }
  const checks = all.filter((e) => e.type === "check");
  const byTarget = {};
  for (const c of checks) (byTarget[c.target] ||= []).push(c);
  const firstTs = checks.length ? Math.min(...checks.map((c) => Date.parse(c.ts))) : Date.now();
  console.log(`\n📊 SwitchNest Health Report`);
  console.log(`   Window: ${new Date(firstTs).toISOString()} → ${new Date().toISOString()}  (${files.length} log file(s))`);
  console.log(`   Total checks: ${checks.length}\n`);

  let totalTime = 0;
  for (const [name, list] of Object.entries(byTarget)) {
    list.sort((a, b) => a.ts.localeCompare(b.ts));
    const okN = list.filter((c) => c.ok).length;
    const msArr = list.map((c) => c.ms).sort((a, b) => a - b);
    const pct = (p) => msArr[Math.min(msArr.length - 1, Math.floor((p / 100) * msArr.length))];
    const avg = Math.round(msArr.reduce((a, b) => a + b, 0) / msArr.length);
    let upMs = 0, spanMs = 0;
    for (let i = 1; i < list.length; i++) {
      const gap = Date.parse(list[i].ts) - Date.parse(list[i - 1].ts);
      if (gap > 0 && gap < 5 * 60_000) {
        spanMs += gap;
        if (list[i - 1].ok) upMs += gap;
      }
    }
    const up = spanMs ? (upMs / spanMs) * 100 : (okN / list.length) * 100;
    if (name === "api") totalTime = spanMs;

    const statuses = {};
    for (const c of list) statuses[c.status ?? "ERR"] = (statuses[c.status ?? "ERR"] || 0) + 1;
    const statLine = Object.entries(statuses).map(([s, n]) => `${s}:${n}`).join("  ");

    console.log(`── ${name.toUpperCase()} ──`);
    console.log(`  Uptime:      ${up.toFixed(2)}%   (${okN}/${list.length} checks OK)`);
    console.log(`  Latency:     min ${msArr[0]}ms  avg ${avg}ms  p95 ${pct(95)}ms  max ${msArr[msArr.length - 1]}ms`);
    console.log(`  Statuses:    ${statLine}`);
    console.log();
  }

  const outages = all.filter((e) => e.type === "outage_start");
  if (outages.length) {
    console.log(`🚨 OUTAGES: ${outages.length}`);
    let totalDown = 0;
    for (const o of outages) {
      const end = all.find((e) => e.type === "outage_end" && e.outageId === o.outageId);
      const dur = end ? end.durationSec : "OPEN";
      if (typeof dur === "number") totalDown += dur;
      console.log(`  ${o.ts}  ${o.target.padEnd(4)} id=${o.outageId}  down=${dur}s  last=${o.lastStatus ?? o.lastErr}`);
    }
    const closed = outages.filter((o) => all.find((e) => e.type === "outage_end" && e.outageId === o.outageId));
    if (totalTime && closed.length) {
      const eff = 100 - (totalDown / (totalTime / 1000)) * 100;
      console.log(`  Total downtime (closed): ${totalDown}s  → effective uptime ${eff.toFixed(2)}%`);
    } else if (totalTime) {
      console.log(`  Total downtime: ${totalDown}s (saare outages abhi OPEN hain)`);
    }
  } else {
    console.log("🚨 OUTAGES: 0  ✅ Site poore window me stable raha!");
  }
  process.exit(0);
}

async function main() {
  const args = process.argv.slice(2);
  const targets = resolveTargets(args);

  if (args.includes("--report")) return printReport(args);

  if (args.includes("--once")) {
    const state = { fail: {} };
    for (const t of targets) await runCheck(state, t);
    process.exit(0);
  }

  console.log(`🚀 SwitchNest Health Monitor started ${new Date().toISOString()}`);
  console.log(`   Targets: ${targets.map((t) => `${t.name} → ${t.url}`).join("\n            ")}`);
  console.log(`   Interval: ${CHECK_INTERVAL_MS / 1000}s  (outage me ${RECOVERY_POLL_MS / 1000}s fast-poll)`);
  console.log(`   Logs: ${LOG_DIR}\n`);

  const state = { fail: {} };
  let lastOk = Date.now();
  const run = async () => {
    for (const t of targets) {
      const ok = await runCheck(state, t);
      if (ok) lastOk = Date.now();
    }
  };

  // self-scheduling loop — har round pe interval dobara decide hota hai,
  // taaki outage me fast-poll (5s) engage ho aur recovery pe wapas 30s.
  const tick = async () => {
    try {
      await run();
    } catch (err) {
      console.error("[monitor] loop error:", err.message);
    }
    const inOutage = Object.values(state.fail).some((s) => s.outageId);
    let delay = inOutage ? RECOVERY_POLL_MS : CHECK_INTERVAL_MS;
    if (inOutage && Date.now() - lastOk > RECOVERY_MAX_MS) {
      // recovery poll timeout — wapas normal cadence (report open outage hoga)
      console.warn("[monitor] recovery poll timeout — normal cadence pe wapas");
      for (const s of Object.values(state.fail)) s.outageId = null;
      lastOk = Date.now();
      delay = CHECK_INTERVAL_MS;
    }
    setTimeout(tick, delay);
  };
  tick();
}

main().catch((err) => {
  console.error("[monitor] fatal:", err);
  process.exit(1);
});
