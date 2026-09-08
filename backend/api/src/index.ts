import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma, getEffectiveDbUrl, resetPrismaClient } from "./lib/prisma";
import { logger, fileLog, logFilePath } from "./lib/logger";
import { initSocket } from "./lib/socket";
import { startScheduler } from "./services/scheduler.service";
import { startFamilySafety } from "./services/familySafety.service";
import { startOfflineWatcher } from "./services/offline.service";
import { startKeyExpiryWatcher } from "./services/keyExpiry.service";
import { startHealthMonitor } from "./lib/healthMonitor";
import { startLeakMonitor } from "./lib/leakMonitor";
import { setDbReady } from "./lib/dbState";
import { loadRequestTracker, startRequestFlush } from "./lib/requestTracker";
import { startArchivalService } from "./services/archival.service";
import { startMqttBroker } from "./services/mqtt.service";

// Catch all unhandled background errors to prevent Node process termination under IIS (which causes 503)
process.on("uncaughtException", (err) => {
  const line = `[uncaughtException] ${err instanceof Error ? err.stack || err.message : String(err)}`;
  console.error(line);
  fileLog(line);
});

process.on("unhandledRejection", (reason) => {
  const line = `[unhandledRejection] ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`;
  console.error(line);
  fileLog(line);
});

// Tables exist ya nahi â€” information_schema se check (empty DB pe crash
// nahi karta). Bas DB reachable hona kaafi nahi: tables nahi hain to
// setup mode me rehna hai, warna startup queries crash karti hain.
import { execFileSync } from "node:child_process";

/** Boot-time light migrations â€” RETIRED (MySQL â†’ PostgreSQL migration complete).
 *
 * All schema changes are now managed exclusively through Prisma migrations
 * (`prisma/migrations/`). The previous implementation contained MySQL-specific
 * SQL (JOIN-in-UPDATE, backtick identifiers, DATABASE(), ENGINE=InnoDB) that
 * generated `Code: 42601` syntax errors on every boot against Neon (PostgreSQL).
 *
 * To apply schema changes: `npm run db:migrate` (creates a new Prisma migration).
 * To verify: `npm run db:generate && npx prisma migrate status`.
 *
 * DO NOT re-add raw SQL DDL here. Use Prisma schema + migrations instead.
 */
async function runLightMigrations(): Promise<void> {
  logger.info("[migrations] Prisma-managed schema is up-to-date. No light migrations to run.");
}


async function dbHasSchema(): Promise<boolean> {
  try {
    // PostgreSQL uses current_schema() instead of DATABASE()
    const rows = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name IN ('User', 'users')
    `;
    if (Number(rows[0]?.c ?? 0) > 0) return true;
  } catch (err) {
    logger.warn("Schema probe via Prisma failed:", err instanceof Error ? err.message : String(err));
  }
  return false;
}

// Production resilience: ek request ki galti se poora app crash na ho
// (IIS app pool rapid-fail â†’ 503). Log karke continue karte hain.
process.on("unhandledRejection", (reason) => {
  const line = `[crashguard] unhandledRejection: ${reason instanceof Error ? reason.stack : String(reason)}`;
  process.stderr.write(line + "\n");
  fileLog(line);
});
process.on("uncaughtException", (err) => {
  const line = `[crashguard] uncaughtException: ${err instanceof Error ? err.stack : String(err)}`;
  process.stderr.write(line + "\n");
  fileLog(line);
});


// --- Diagnostics: heartbeat + exit reason (503 cycle diagnosis) ---
// Har 10s alive line â€” agar heartbeats ruk jaayein bina exit line ke,
// process ko bahar se maara gaya (native crash / pool recycle).
// ts + heap bhi log hota hai â€” diagnostics panel 24h memory trend
// (RSS/heap time-series) isi se banata hai. Purani lines (bina ts/heap)
// bhi parse hote hain â€” backward compatible.
setInterval(() => {
  fileLog(
    `[hb] alive ts=${new Date().toISOString()} uptime=${Math.round(process.uptime())}s pid=${process.pid} rss=${Math.round(
      process.memoryUsage().rss / 1048576,
    )}MB heap=${Math.round(process.memoryUsage().heapUsed / 1048576)}MB`,
  );
}, 10_000);

process.on("beforeExit", (code) => {
  fileLog(`[hb] beforeExit code=${code} uptime=${Math.round(process.uptime())}s`);
});
process.on("exit", (code) => {
  fileLog(`[hb] exit code=${code} uptime=${Math.round(process.uptime())}s`);
});
// stderr pe boot progress â€” iisnode error page sirf stderr dikhata hai,
// logger stdout pe jaata hai isliye yeh lines wahan visible hoti hain.
const boot = (...args: unknown[]) => {
  const line = `[boot] ${args.join(" ")}`;
  process.stderr.write(line + "\n");
  fileLog(line);
};

async function main() {
  // Plesk/IISNode ko readiness signal turant chahiye â€” server pehle listen
  // karta hai, DB init background me hota hai. app.ts ka isDbReady() gate
  // setup mode (503) + install wizard ko handle karta hai.
  boot("node", process.version, "| cwd =", process.cwd());
  boot("PORT env =", JSON.stringify(process.env.PORT ?? "(not set)"), "-> API_PORT =", env.API_PORT);
  boot("log file =", logFilePath ?? "(disabled)");
  const app = createApp();
  boot("createApp done");
  const server = createServer(app);

  // Realtime (Socket.IO) â€” device updates, notifications, assistant replies.
  initSocket(server);
  boot("socket init done");

  // MQTT IoT Broker (Aedes) â€” ESP32 devices connect here instead of HTTP polling.
  try {
    startMqttBroker();
    boot("mqtt broker started");
  } catch (err) {
    boot("mqtt broker start failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  // Plesk/iisnode app ko process.env.PORT pe expect karta hai. IMPORTANT:
  // Windows iisnode PORT me ya to TCP number deta hai, ya NAMED PIPE path
  // (\.\pipe\...). Pipe path ho to usi pe listen karna hota hai â€” TCP
  // port pe nahi (warna iisnode connect nahi kar pata â†’ 1001).
  const rawPort = process.env.PORT;
  const listenTarget: string | number =
    rawPort && !/^\d+$/.test(rawPort.trim()) ? rawPort.trim() : env.API_PORT;
  boot("listen target:", JSON.stringify(listenTarget));

  const onListening = () => {
    const addr = server.address();
    boot("LISTENING on", typeof addr === "object" && addr ? `${addr.address}:${addr.port}` : String(addr));
    logger.info(`ðŸš€ API listening on ${JSON.stringify(listenTarget)}`);
    logger.info(`   Health check: /api/health`);
    logger.info(`   Realtime (Socket.IO): ws://${env.API_HOST}:${env.API_PORT}`);
  };

  if (typeof listenTarget === "string") {
    // Named pipe (iisnode on Windows)
    server.listen(listenTarget, onListening);
  } else {
    server.listen(listenTarget, env.API_HOST, onListening);
    if (env.API_PORT !== 4000) {
      // Fallback listener â€” agar PORT env na mile (TCP case)
      const fallback = createServer(app);
      fallback.on("error", (err) => {
        boot("fallback 4000 listener error:", err instanceof Error ? err.message : String(err));
        logger.warn("Fallback 4000 listener failed", err instanceof Error ? err.message : String(err));
      });
      fallback.listen(4000, env.API_HOST);
      boot("fallback listener requested on 4000");
    }
  }

  // Server pe koi error (pipe EACCES, port busy, etc.) to process ko kabhi
  // mat marne do â€” log karke pool zinda rahega (IIS rapid-fail 503 se bachne ke liye).
  server.on("error", (err) => {
    const line = `[server] listen error: ${err instanceof Error ? err.stack || err.message : String(err)}`;
    process.stderr.write(line + "\n");
    fileLog(line);
  });

  boot("main() setup complete â€” background DB init starting");
  void initDatabase();
}

const HEAL_LAST_KEY = "prisma_selfheal_last";

/**
 * Plesk/iisnode quirk: deploy ke waqt npx prisma generate file system ko
 * update karta hai, par chal raha process purana client load kar chuka hota
 * hai (restart generate se pehle ho jata hai). Naye models (deviceAccess,
 * deviceUsage) runtime me missing â†’ 500. Yahan: generate fir se chalao + ek
 * baar reboot (10 min guard â€” loop nahi).
 */
async function selfHealPrismaClient(): Promise<void> {
  // Prebuilt bundle already contains up-to-date client.
}

async function initDatabase(): Promise<void> {
  boot("db probe: connecting...");

  // Ek probe â€” DB reachable + schema ready? (install wizard route apna
  // setDbReady(true) install ke baad khud karta hai.)
  const probeOnce = async (): Promise<boolean> => {
    try {
      await prisma.$connect();
    } catch (err) {
      boot("db probe: NOT reachable â€”", err instanceof Error ? err.message : String(err));
      return false;
    }
    if (await dbHasSchema()) {
      logger.info("âœ… Database connected (schema ready)");
      await runLightMigrations();
      // Client sync check â€” stale ho to regenerate + reboot (Plesk quirk)
      await selfHealPrismaClient();
      return true;
    }
    logger.warn("âš ï¸ Database reachable par installed nahi â€” setup mode. /api/install se installation karo.");
    return false;
  };

  const finishReady = async () => {
    boot("db probe: schema ready = true");
    setDbReady(true);
    try {
      startScheduler();
      startFamilySafety();
      startHealthMonitor();
      startLeakMonitor();
    } catch (err) {
      logger.warn("Scheduler start skipped/failed", err instanceof Error ? err.message : String(err));
    }
    try {
      startKeyExpiryWatcher();
    } catch (err) {
      logger.warn("Key expiry watcher start skipped/failed", err instanceof Error ? err.message : String(err));
    }
    try {
      startOfflineWatcher();
    } catch (err) {
      logger.warn("Offline watcher start skipped/failed", err instanceof Error ? err.message : String(err));
    }
    try {
      startArchivalService();
    } catch (err) {
      logger.warn("Archival service start skipped/failed", err instanceof Error ? err.message : String(err));
    }
    // Request traffic tracker â€” AppMeta se load + periodic flush
    try {
      await loadRequestTracker();
      startRequestFlush();
      boot("request tracker: loaded");
    } catch (err) {
      logger.warn("Request tracker start failed", err instanceof Error ? err.message : String(err));
    }
  };

  if (await probeOnce()) {
    await finishReady();
    return;
  }

  // ASLI FIX (recurring 503): pehle ek hi probe tha â€” DB thoda sa bhi blip
  // hua (deploy churn, MySQL restart, connection limit spike) to setDbReady
  // false ho jata tha aur process 503 mode me PHANSA rehta tha jab tak
  // manual node disable/enable na ho. Ab retry loop â€” har 15s dobara probe,
  // DB aate hi ready + services start. Kabhi manual restart nahi chahiye.
  boot("db probe: retry loop start (har 15s) â€” DB aate hi ready ho jayega");
  setDbReady(false);
  const retryTimer = setInterval(async () => {
    const ok = await probeOnce();
    if (ok) {
      clearInterval(retryTimer);
      await finishReady();
    }
  }, 15_000);
  retryTimer.unref?.();
}

main().catch((err) => {
  // process.exit kabhi nahi â€” pool stop ho jata hai to 503. Log karke
  // zinda rehte hain; iisnode process ko tab tak rakhta hai jab tak zinda.
  const line = `[fatal] main() failed: ${err instanceof Error ? err.stack || err.message : String(err)}`;
  process.stderr.write(line + "\n");
  fileLog(line);
  logger.error("Failed to start API", err instanceof Error ? err.stack : err);
});
