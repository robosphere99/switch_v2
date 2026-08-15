import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { logger, fileLog, logFilePath } from "./lib/logger";
import { initSocket } from "./lib/socket";
import { startScheduler } from "./services/scheduler.service";
import { startFamilySafety } from "./services/familySafety.service";
import { startOfflineWatcher } from "./services/offline.service";
import { setDbReady } from "./lib/dbState";

// Tables exist ya nahi — information_schema se check (empty DB pe crash
// nahi karta). Bas DB reachable hona kaafi nahi: tables nahi hain to
// setup mode me rehna hai, warna startup queries crash karti hain.
/** Lightweight boot-time migrations — naye installs ke liye schema.sql me hai,
 *  purane (already-installed) DBs ke liye yahan idempotent patches chalao.
 *  Fail hone pe app crash mat karo — bas log karo (agle boot pe dobara try). */
async function runLightMigrations(): Promise<void> {
  try {
    // 1) ESP serial code unique — tracking/security: ek serial sirf ek board pe.
    //    Pehle duplicates (agar koi ho) me se sirf sabse naya wala rakho.
    await prisma.$executeRawUnsafe(
      `UPDATE esp_devices e
       JOIN (
         SELECT serial_code, MAX(id) AS keep_id
         FROM esp_devices
         WHERE serial_code IS NOT NULL
         GROUP BY serial_code
         HAVING COUNT(*) > 1
       ) d ON e.serial_code = d.serial_code AND e.id <> d.keep_id
       SET e.serial_code = NULL`,
    );
    const idx = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'esp_devices' AND index_name = 'esp_devices_serial_code_key'
    `;
    if (Number(idx[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `esp_devices` ADD UNIQUE INDEX `esp_devices_serial_code_key`(`serial_code`)",
      );
      logger.info("✅ Migration: esp_devices.serial_code unique index added");
    }
    // 2) notifications.category — Notification Center filters (support/device/schedule/system).
    const col = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'notifications' AND column_name = 'category'
    `;
    if (Number(col[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `notifications` ADD COLUMN `category` VARCHAR(20) NOT NULL DEFAULT 'system'",
      );
      logger.info("✅ Migration: notifications.category column added");
    }
    // 2b) Backfill: schedule notifications category fix — pehle (bina category ke)
    //     default 'system' me banti thi, ab 'schedule' me aati hain. Purani wali ko
    //     bhi fix karo taaki Schedule filter me dikhen. (Idempotent — ek baar update,
    //     dobara kuch match nahi karega.)
    const fixed = await prisma.$executeRawUnsafe(`
      UPDATE notifications
      SET category = 'schedule'
      WHERE category = 'system' AND title LIKE '⏰ Schedule fired:%'
    `);
    if (Number(fixed) > 0) {
      logger.info(`✅ Backfill: ${fixed} schedule notification(s) category → schedule`);
    }
    // 3) support_messages - admin <-> user support chat table.
    const sm = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'support_messages'
    `;
    if (Number(sm[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE support_messages (
          id INT NOT NULL AUTO_INCREMENT,
          userId INT NOT NULL,
          senderRole VARCHAR(10) NOT NULL DEFAULT 'admin',
          senderName VARCHAR(100) NOT NULL,
          message TEXT NOT NULL,
          read_by_user BOOLEAN NOT NULL DEFAULT FALSE,
          read_by_admin BOOLEAN NOT NULL DEFAULT TRUE,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          INDEX support_messages_userId_createdAt_idx (userId, created_at),
          INDEX support_messages_readByAdmin_idx (read_by_admin),
          CONSTRAINT support_messages_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      logger.info("✅ Migration: support_messages table created");
    }
    // 4) users.theme_pref — theme preference account pe save (cross-device sync).
    const tp = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'theme_pref'
    `;
    if (Number(tp[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `users` ADD COLUMN `theme_pref` VARCHAR(16) NULL",
      );
      logger.info("✅ Migration: users.theme_pref column added");
    }
    // 5) support_messages.attachment_* — support chat files (photos/invoice/screenshots).
    const att = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'support_messages' AND column_name = 'attachment_name'
    `;
    if (Number(att[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `support_messages` ADD COLUMN `attachment_name` VARCHAR(255) NULL, ADD COLUMN `attachment_type` VARCHAR(100) NULL, ADD COLUMN `attachment_data` MEDIUMTEXT NULL",
      );
      logger.info("✅ Migration: support_messages.attachment_* columns added");
    }
    // 6) Family safety — child mode: home_members.restricted + daily_limit_minutes,
    //    device_access (member → granted devices), device_usage (daily ON-time).
    //    Har ek apne try/catch me — koi fail ho to baaki skip na ho.
    const migration = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (err) {
        logger.warn(`Migration skip/fail (${label})`, err instanceof Error ? err.message : String(err));
      }
    };
    await migration("home_members restricted", async () => {
      const rm = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'home_members' AND column_name = 'restricted'
      `;
      if (Number(rm[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `home_members` ADD COLUMN `restricted` BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN `daily_limit_minutes` INT NULL",
        );
        logger.info("✅ Migration: home_members.restricted + daily_limit_minutes added");
      }
    });
    await migration("device_access table", async () => {
      const da = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'device_access'
      `;
      if (Number(da[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE device_access (
            id INT NOT NULL AUTO_INCREMENT,
            homeId INT NOT NULL,
            deviceId INT NOT NULL,
            userId INT NOT NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            UNIQUE INDEX device_access_deviceId_userId_key (deviceId, userId),
            INDEX device_access_homeId_idx (homeId),
            INDEX device_access_userId_idx (userId),
            CONSTRAINT device_access_homeId_fkey FOREIGN KEY (homeId) REFERENCES homes(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT device_access_deviceId_fkey FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT device_access_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.info("✅ Migration: device_access table created");
      }
    });
    await migration("device_usage table", async () => {
      const du = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'device_usage'
      `;
      if (Number(du[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE device_usage (
            id INT NOT NULL AUTO_INCREMENT,
            homeId INT NOT NULL,
            deviceId INT NOT NULL,
            userId INT NOT NULL,
            date DATE NOT NULL,
            on_minutes INT NOT NULL,
            updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            UNIQUE INDEX device_usage_deviceId_userId_date_key (deviceId, userId, date),
            INDEX device_usage_homeId_idx (homeId),
            CONSTRAINT device_usage_homeId_fkey FOREIGN KEY (homeId) REFERENCES homes(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT device_usage_deviceId_fkey FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT device_usage_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.info("✅ Migration: device_usage table created");
      }
    });
  } catch (err) {
    logger.warn("Light migration (esp serial unique) skip/fail", err instanceof Error ? err.message : String(err));
  }
}

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

// Production resilience: ek request ki galti se poora app crash na ho
// (IIS app pool rapid-fail → 503). Log karke continue karte hain.
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
// Har 10s alive line — agar heartbeats ruk jaayein bina exit line ke,
// process ko bahar se maara gaya (native crash / pool recycle).
setInterval(() => {
  fileLog(
    `[hb] alive uptime=${Math.round(process.uptime())}s pid=${process.pid} rss=${Math.round(
      process.memoryUsage().rss / 1048576,
    )}MB`,
  );
}, 10_000);

process.on("beforeExit", (code) => {
  fileLog(`[hb] beforeExit code=${code} uptime=${Math.round(process.uptime())}s`);
});
process.on("exit", (code) => {
  fileLog(`[hb] exit code=${code} uptime=${Math.round(process.uptime())}s`);
});
// stderr pe boot progress — iisnode error page sirf stderr dikhata hai,
// logger stdout pe jaata hai isliye yeh lines wahan visible hoti hain.
const boot = (...args: unknown[]) => {
  const line = `[boot] ${args.join(" ")}`;
  process.stderr.write(line + "\n");
  fileLog(line);
};

async function main() {
  // Plesk/IISNode ko readiness signal turant chahiye — server pehle listen
  // karta hai, DB init background me hota hai. app.ts ka isDbReady() gate
  // setup mode (503) + install wizard ko handle karta hai.
  boot("node", process.version, "| cwd =", process.cwd());
  boot("PORT env =", JSON.stringify(process.env.PORT ?? "(not set)"), "-> API_PORT =", env.API_PORT);
  boot("log file =", logFilePath ?? "(disabled)");
  const app = createApp();
  boot("createApp done");
  const server = createServer(app);

  // Realtime (Socket.IO) — device updates, notifications, assistant replies.
  initSocket(server);
  boot("socket init done");

  // Plesk/iisnode app ko process.env.PORT pe expect karta hai. IMPORTANT:
  // Windows iisnode PORT me ya to TCP number deta hai, ya NAMED PIPE path
  // (\.\pipe\...). Pipe path ho to usi pe listen karna hota hai — TCP
  // port pe nahi (warna iisnode connect nahi kar pata → 1001).
  const rawPort = process.env.PORT;
  const listenTarget: string | number =
    rawPort && !/^\d+$/.test(rawPort.trim()) ? rawPort.trim() : env.API_PORT;
  boot("listen target:", JSON.stringify(listenTarget));

  const onListening = () => {
    const addr = server.address();
    boot("LISTENING on", typeof addr === "object" && addr ? `${addr.address}:${addr.port}` : String(addr));
    logger.info(`🚀 API listening on ${JSON.stringify(listenTarget)}`);
    logger.info(`   Health check: /api/health`);
    logger.info(`   Realtime (Socket.IO): ws://${env.API_HOST}:${env.API_PORT}`);
  };

  if (typeof listenTarget === "string") {
    // Named pipe (iisnode on Windows)
    server.listen(listenTarget, onListening);
  } else {
    server.listen(listenTarget, env.API_HOST, onListening);
    if (env.API_PORT !== 4000) {
      // Fallback listener — agar PORT env na mile (TCP case)
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
  // mat marne do — log karke pool zinda rahega (IIS rapid-fail 503 se bachne ke liye).
  server.on("error", (err) => {
    const line = `[server] listen error: ${err instanceof Error ? err.stack || err.message : String(err)}`;
    process.stderr.write(line + "\n");
    fileLog(line);
  });

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
      await runLightMigrations();
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

  // Probe result hamesha set karo. Fresh install (tables nahi) -> false
  // -> setup mode. Installed site -> true. (Install route apna
  // setDbReady(true) probe ke baad hi chalta hai — koi race nahi.)
  setDbReady(dbReady);
  if (dbReady) {
    try {
      startScheduler();
      startFamilySafety();
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
  // process.exit kabhi nahi — pool stop ho jata hai to 503. Log karke
  // zinda rehte hain; iisnode process ko tab tak rakhta hai jab tak zinda.
  const line = `[fatal] main() failed: ${err instanceof Error ? err.stack || err.message : String(err)}`;
  process.stderr.write(line + "\n");
  fileLog(line);
  logger.error("Failed to start API", err instanceof Error ? err.stack : err);
});
