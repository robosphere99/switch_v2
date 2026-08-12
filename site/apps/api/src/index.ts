import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";
import { initSocket } from "./lib/socket";
import { startScheduler } from "./services/scheduler.service";
import { startOfflineWatcher } from "./services/offline.service";

async function main() {
  await prisma.$connect();
  logger.info("✅ Database connected");

  const app = createApp();
  const server = createServer(app);

  // Realtime (Socket.IO) — device updates, notifications, assistant replies.
  initSocket(server);

  startScheduler();
  startOfflineWatcher();

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
