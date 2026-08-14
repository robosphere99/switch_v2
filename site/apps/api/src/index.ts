import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";
import { initSocket } from "./lib/socket";
import { startScheduler } from "./services/scheduler.service";
import { startOfflineWatcher } from "./services/offline.service";
import { setDbReady } from "./lib/dbState";

async function main() {
  // First-run: DB ya tables nahi hain to crash mat karo — setup mode me
  // server chalta hai aur /api/install se installation hoti hai.
  let dbReady = false;
  try {
    await prisma.$connect();
    dbReady = true;
    logger.info("✅ Database connected");
  } catch (err) {
    logger.warn(
      "⚠️ Database not reachable — setup mode. Visit /api/install/status and run installation.",
    );
    logger.debug(err instanceof Error ? err.message : String(err));
  }
  setDbReady(dbReady);

  const app = createApp();
  const server = createServer(app);

  // Realtime (Socket.IO) — device updates, notifications, assistant replies.
  initSocket(server);

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

  server.listen(env.API_PORT, env.API_HOST, () => {
    logger.info(`🚀 API listening on http://${env.API_HOST}:${env.API_PORT}`);
    logger.info(`   Health check: http://localhost:${env.API_PORT}/api/health`);
    logger.info(`   Realtime (Socket.IO): ws://${env.API_HOST}:${env.API_PORT}`);
  });
}

main().catch((err) => {
  logger.error("Failed to start API", err instanceof Error ? err.stack : err);
  process.exit(1);
});
