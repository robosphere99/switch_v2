import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";
import { initSocket } from "./lib/socket";
import { startScheduler } from "./services/scheduler.service";
import { startOfflineWatcher } from "./services/offline.service";
import { setDbReady, isDbReady } from "./lib/dbState";

// Tables exist ya nahi — information_schema se check (empty DB pe crash
// nahi karta). Bas DB reachable hona kaafi nahi: tables nahi hain to
// setup mode me rehna hai, warna startup queries crash karti hain.
async function dbHasSchema(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'users'
    `;
    return Number(rows[0]?.c ?? 0) > 0;
  } catch (err) {
    logger.warn("Schema probe failed", err instanceof Error ? err.message : String(err));
    return false;
  }
}

// stderr pe boot progress — iisnode error page sirf stderr dikhata hai,
// logger stdout pe jaata hai isliye yeh lines wahan visible hoti hain.
const boot = (...args: unknown[]) => process.stderr.write(`[boot] ${args.join(" ")}
`);

async function main() {
  // Plesk/IISNode ko readiness signal turant chahiye — server pehle listen
  // karta hai, DB init background me hota hai. app.ts ka isDbReady() gate
  // setup mode (503) + install wizard ko handle karta hai.
  boot("node", process.version, "| cwd =", process.cwd());
  boot("PORT env =", JSON.stringify(process.env.PORT ?? "(not set)"), "-> API_PORT =", env.API_PORT);
  const app = createApp();
  boot("createApp done");
  const server = createServer(app);

  // Realtime (Socket.IO) — device updates, notifications, assistant replies.
  initSocket(server);
  boot("socket init done");

  // Plesk/iisnode app ko process.env.PORT pe expect karta hai. Kabhi kabhi
  // PORT env aata hi nahi (tab default 4000) — dono cases cover karne ke liye
  // primary port + 4000 fallback dono pe listen karte hain.
  server.listen(env.API_PORT, env.API_HOST, () => {
    const addr = server.address();
    boot("LISTENING on", typeof addr === "object" && addr ? `${addr.address}:${addr.port}` : String(addr));
    logger.info(`🚀 API listening on http://${env.API_HOST}:${env.API_PORT}`);
    logger.info(`   Health check: http://localhost:${env.API_PORT}/api/health`);
    logger.info(`   Realtime (Socket.IO): ws://${env.API_HOST}:${env.API_PORT}`);
  });

  if (env.API_PORT !== 4000) {
    // Fallback listener — agar Plesk 4000 pe expect kare (PORT env nahi mila)
    const fallback = createServer(app);
    fallback.on("error", (err) => {
      boot("fallback 4000 listener error:", err instanceof Error ? err.message : String(err));
      logger.warn("Fallback 4000 listener failed", err instanceof Error ? err.message : String(err));
    });
    fallback.listen(4000, env.API_HOST);
    boot("fallback listener requested on 4000");
  }

  boot("main() setup complete — background DB init starting");
  void initDatabase();
}

async function initDatabase(): Promise<void> {
  let dbReady = false;
  boot("db probe: connecting...");
  try {
    await prisma.$connect();
    boot("db probe: connected");
    if (await dbHasSchema()) {
      dbReady = true;
      logger.info("✅ Database connected (schema ready)");
    } else {
      logger.warn(
        "⚠️ Database reachable par installed nahi — setup mode. /api/install se installation karo.",
      );
    }
  } catch (err) {
    boot("db probe: NOT reachable —", err instanceof Error ? err.message : String(err));
    logger.warn(
      "⚠️ Database not reachable — setup mode. Visit /api/install/status and run installation.",
    );
    logger.debug(err instanceof Error ? err.message : String(err));
  }
  boot("db probe: schema ready =", dbReady);

  // Install route bhi setDbReady(true) karta hai — yahan kabhi ready ko
  // false-override nahi karte agar kisi aur ne pehle hi ready kar diya ho.
  if (dbReady || !isDbReady()) {
    setDbReady(dbReady);
  }
  if (dbReady) {
    try {
      startScheduler();
    } catch (err) {
      logger.warn("Scheduler start skipped/failed", err instanceof Error ? err.message : String(err));
    }
    try {
      startOfflineWatcher();
    } catch (err) {
      logger.warn("Offline watcher start skipped/failed", err instanceof Error ? err.message : String(err));
    }
  }
}

main().catch((err) => {
  logger.error("Failed to start API", err instanceof Error ? err.stack : err);
  process.exit(1);
});
