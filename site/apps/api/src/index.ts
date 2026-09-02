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

// Tables exist ya nahi — information_schema se check (empty DB pe crash
// nahi karta). Bas DB reachable hona kaafi nahi: tables nahi hain to
// setup mode me rehna hai, warna startup queries crash karti hain.
import { execFileSync } from "node:child_process";

/** Lightweight boot-time migrations — naye installs ke liye schema.sql me hai,
 *  purane (already-installed) DBs ke liye yahan idempotent patches chalao.
 *  Fail hone pe app crash mat karo — bas log karo (agle boot pe dobara try). */
async function runLightMigrations(): Promise<void> {
  // Har migration apne try/catch me — koi fail ho to baaki skip na ho.
  const migration = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      logger.warn(`Migration skip/fail (${label})`, err instanceof Error ? err.message : String(err));
    }
  };
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
    //     dobara kuch match nahi karega.) Broad LIKE rakha hai (emoji format ke
    //     fark se bachne ke liye) — read-time normalization bhi hai (notification
    //     service), isliye double protection.
    const fixed = await prisma.$executeRawUnsafe(`
      UPDATE notifications
      SET category = 'schedule'
      WHERE category = 'system' AND (title LIKE '⏰ Schedule fired:%' OR title LIKE '%Schedule fired:%')
    `);
    logger.info(`✅ Backfill: ${fixed} schedule notification(s) category → schedule`);
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
    // 5b) support_messages.deleted_at — chat delete (soft delete, WhatsApp-style).
    await migration("support_messages.deleted_at", async () => {
      const dl = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'support_messages' AND column_name = 'deleted_at'
      `;
      if (Number(dl[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `support_messages` ADD COLUMN `deleted_at` DATETIME(3) NULL",
        );
        logger.info("✅ Migration: support_messages.deleted_at added");
      }
    });
    // 5b2) support_messages.attachment_path — naye attachments file disk pe (DB me blob nahi).
    await migration("support_messages.attachment_path", async () => {
      const ap = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'support_messages' AND column_name = 'attachment_path'
      `;
      if (Number(ap[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `support_messages` ADD COLUMN `attachment_path` VARCHAR(255) NULL",
        );
        logger.info("✅ Migration: support_messages.attachment_path added");
      }
    });
    // 5c) support_chat_settings — mute/pin per conversation (user ya admin ka apna view).
    await migration("support_chat_settings table", async () => {
      const cs = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'support_chat_settings'
      `;
      if (Number(cs[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE support_chat_settings (
            id INT NOT NULL AUTO_INCREMENT,
            userId INT NOT NULL,
            peer_user_id INT NOT NULL,
            muted_at DATETIME(3) NULL,
            pinned_at DATETIME(3) NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            UNIQUE INDEX support_chat_settings_userId_peerUserId_key (userId, peer_user_id),
            INDEX support_chat_settings_userId_idx (userId),
            CONSTRAINT support_chat_settings_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.info("✅ Migration: support_chat_settings table created");
      }
    });
    // 5d) app_meta.value VARCHAR(255) -> TEXT — request tracker + site settings
    //     JSON payload ke liye (255 chars kaafi nahi).
    await migration("app_meta.value TEXT", async () => {
      const am = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'app_meta' AND column_name = 'value'
      `;
      if (Number(am[0]?.c ?? 0) > 0) {
        const typ = await prisma.$queryRaw<{ data_type: string }[]>`
          SELECT DATA_TYPE AS data_type FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'app_meta' AND column_name = 'value'
        `;
        if (typ[0]?.data_type === "varchar") {
          await prisma.$executeRawUnsafe(
            "ALTER TABLE `app_meta` MODIFY COLUMN `value` TEXT NOT NULL",
          );
          logger.info("✅ Migration: app_meta.value -> TEXT");
        }
      }
    });
    // 6) Family safety — child mode: home_members.restricted + daily_limit_minutes,
    //    device_access (member → granted devices), device_usage (daily ON-time).
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
    // 7) password_reset_tokens — forgot-password flow (hashed token, 1-use, 30min expiry).
    await migration("password_reset_tokens table", async () => {
      const prt = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'password_reset_tokens'
      `;
      if (Number(prt[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE password_reset_tokens (
            id INT NOT NULL AUTO_INCREMENT,
            userId INT NOT NULL,
            token_hash VARCHAR(64) NOT NULL,
            expires_at DATETIME(3) NOT NULL,
            used_at DATETIME(3) NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            UNIQUE INDEX password_reset_tokens_token_hash_key (token_hash),
            INDEX password_reset_tokens_userId_idx (userId),
            CONSTRAINT password_reset_tokens_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.info("✅ Migration: password_reset_tokens table created");
      }
    });
    // 7) api_keys.revoked_at — key revocation tracking.
    await migration("api_keys.revoked_at", async () => {
      const ra = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'api_keys' AND column_name = 'revoked_at'
      `;
      if (Number(ra[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `api_keys` ADD COLUMN `revoked_at` DATETIME(3) NULL",
        );
        logger.info("✅ Migration: api_keys.revoked_at added");
      }
    });
    // 8) esp_devices.led_enabled — allow user to disable the blue status LED on ESP32 boards
    await migration("esp_devices.led_enabled", async () => {
      const le = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'esp_devices' AND column_name = 'led_enabled'
      `;
      if (Number(le[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `esp_devices` ADD COLUMN `led_enabled` BOOLEAN NOT NULL DEFAULT TRUE",
        );
        logger.info("✅ Migration: esp_devices.led_enabled added");
      }
    });
    // 9) devices.channel — Relay channel index (1..N) within ESP board
    await migration("devices.channel", async () => {
      const ch = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'devices' AND column_name = 'channel'
      `;
      if (Number(ch[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `devices` ADD COLUMN `channel` INT NULL",
        );
        logger.info("✅ Migration: devices.channel column added");
      }
    });
    // 10) users.avatar_url & profile fields
    await migration("users.avatar_url & profile", async () => {
      const au = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'avatar_url'
      `;
      if (Number(au[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `users` ADD COLUMN `avatar_url` VARCHAR(500) NULL, ADD COLUMN `dob` DATE NULL, ADD COLUMN `gender` VARCHAR(20) NULL, ADD COLUMN `phone` VARCHAR(20) NULL, ADD COLUMN `address` TEXT NULL",
        );
        logger.info("✅ Migration: users.avatar_url & profile columns added");
      }
    });
    // 11) products.stock_count & rating
    await migration("products.stock_count & rating", async () => {
      const sc = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'stock_count'
      `;
      if (Number(sc[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `products` ADD COLUMN `stock_count` INT NOT NULL DEFAULT 0, ADD COLUMN `rating` DECIMAL(3,2) NOT NULL DEFAULT 0.0, ADD COLUMN `total_reviews` INT NOT NULL DEFAULT 0",
        );
        logger.info("✅ Migration: products.stock_count & rating columns added");
      }
    });
    // 12) orders payment fields
    await migration("orders payment fields", async () => {
      const rz = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'razorpay_order_id'
      `;
      if (Number(rz[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `orders` ADD COLUMN `razorpay_order_id` VARCHAR(64) NULL, ADD COLUMN `payment_ref` VARCHAR(64) NULL, ADD COLUMN `paid_at` DATETIME(3) NULL",
        );
        logger.info("✅ Migration: orders payment fields added");
      }
    });
    // 13) serial_registry warranty fields
    await migration("serial_registry warranty fields", async () => {
      const ws = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'serial_registry' AND column_name = 'warranty_status'
      `;
      if (Number(ws[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `serial_registry` ADD COLUMN `warranty_status` VARCHAR(20) NOT NULL DEFAULT 'active', ADD COLUMN `warranty_expires_at` DATETIME(3) NULL, ADD COLUMN `console_password` VARCHAR(64) NULL, ADD COLUMN `tested_at` DATETIME(3) NULL",
        );
        logger.info("✅ Migration: serial_registry warranty fields added");
      }
    });
    // 14) refresh_tokens table — session persistence & token refresh
    await migration("refresh_tokens table", async () => {
      const rt = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'refresh_tokens'
      `;
      if (Number(rt[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE refresh_tokens (
            id INT NOT NULL AUTO_INCREMENT,
            userId INT NOT NULL,
            token_hash VARCHAR(64) NOT NULL,
            device_info VARCHAR(255) NULL,
            ip_address VARCHAR(45) NULL,
            last_active DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            expires_at DATETIME(3) NOT NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            revoked_at DATETIME(3) NULL,
            PRIMARY KEY (id),
            UNIQUE INDEX refresh_tokens_token_hash_key (token_hash),
            INDEX refresh_tokens_userId_idx (userId),
            CONSTRAINT refresh_tokens_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.info("✅ Migration: refresh_tokens table created");
      }
    });
    // 15) users.push_device_toggles & push_system_alerts
    await migration("users push_device_toggles & push_system_alerts", async () => {
      const pdt = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'push_device_toggles'
      `;
      if (Number(pdt[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `users` ADD COLUMN `push_device_toggles` BOOLEAN NOT NULL DEFAULT TRUE, ADD COLUMN `push_system_alerts` BOOLEAN NOT NULL DEFAULT TRUE, ADD COLUMN `token_version` INT NOT NULL DEFAULT 0",
        );
        logger.info("✅ Migration: users.push_device_toggles & push_system_alerts added");
      }
    });
    // 16) home_members.joined_at
    await migration("home_members.joined_at", async () => {
      const ja = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'home_members' AND column_name = 'joined_at'
      `;
      if (Number(ja[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `home_members` ADD COLUMN `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)",
        );
        logger.info("✅ Migration: home_members.joined_at added");
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
    if (Number(rows[0]?.c ?? 0) > 0) return true;
  } catch (err) {
    logger.warn("Schema probe via Prisma failed — trying direct mysql probe:", err instanceof Error ? err.message : String(err));
  }
  try {
    const mysql = (await import("mysql2/promise")).default;
    const dbUrl = getEffectiveDbUrl();
    const u = new URL(dbUrl);
    const conn = await mysql.createConnection({
      host: u.hostname === "localhost" ? "127.0.0.1" : u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: decodeURIComponent(u.pathname.replace(/^\//, "")),
      connectTimeout: 5000,
    });
    const [rows] = await conn.query(
      "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'",
    );
    await conn.end().catch(() => undefined);
    return Number((rows as Array<{ c: number }>)[0]?.c ?? 0) > 0;
  } catch {
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
// ts + heap bhi log hota hai — diagnostics panel 24h memory trend
// (RSS/heap time-series) isi se banata hai. Purani lines (bina ts/heap)
// bhi parse hote hain — backward compatible.
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

  // MQTT IoT Broker (Aedes) — ESP32 devices connect here instead of HTTP polling.
  try {
    startMqttBroker();
    boot("mqtt broker started");
  } catch (err) {
    boot("mqtt broker start failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

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

const HEAL_LAST_KEY = "prisma_selfheal_last";

/**
 * Plesk/iisnode quirk: deploy ke waqt npx prisma generate file system ko
 * update karta hai, par chal raha process purana client load kar chuka hota
 * hai (restart generate se pehle ho jata hai). Naye models (deviceAccess,
 * deviceUsage) runtime me missing → 500. Yahan: generate fir se chalao + ek
 * baar reboot (10 min guard — loop nahi).
 */
async function selfHealPrismaClient(): Promise<void> {
  const p = prisma as unknown as Record<string, unknown>;
  if (p.deviceAccess && p.deviceUsage && p.supportChatSettings) return;
  fileLog("[boot] prisma client stale (deviceAccess/deviceUsage/supportChatSettings missing) — self-heal try");

  const last = await prisma.appMeta
    .findUnique({ where: { key: HEAL_LAST_KEY } })
    .catch(() => null);
  if (last && Date.now() - new Date(last.value).getTime() < 10 * 60 * 1000) {
    fileLog("[boot] self-heal 10 min pehle try hua — skip (degraded mode, koi loop nahi)");
    return;
  }

  let ok = false;
  for (const args of [
    ["npx.cmd", "--no-install", "prisma", "generate"],
    ["npx.cmd", "prisma", "generate"],
  ]) {
    try {
      execFileSync(args[0], args.slice(1), {
        cwd: process.cwd(),
        stdio: "pipe",
        timeout: 180_000,
        windowsHide: true,
      });
      ok = true;
      break;
    } catch (err) {
      fileLog(`[boot] prisma generate try fail: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (!ok) {
    fileLog("[boot] prisma generate FAILED — degraded mode (restrictions off, site chalega)");
    return;
  }

  await prisma.appMeta
    .upsert({
      where: { key: HEAL_LAST_KEY },
      create: { key: HEAL_LAST_KEY, value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    })
    .catch(() => undefined);
  // IMPORTANT: turant process.exit(0) NAHI — iisnode startup ke waqt exit ko
  // "startup failure" maan leta hai → IIS rapid-fail protection pool ko stop
  // kar deta hai → 503 jab tak manual restart na ho (yahi recurring 503 ka
  // source tha). Reboot ko HAMESHA 120s uptime ke baad rakho — koi bhi exit
  // iisnode startup window (pehle ~60s) me nahi aata. 10-min guard loop hone
  // nahi deta.
  const healUptime = Math.round(process.uptime());
  const healDelayMs = healUptime < 120 ? (120 - healUptime) * 1000 : 5_000;
  fileLog(`[boot] prisma generate OK — ${Math.round(healDelayMs / 1000)}s baad safe reboot (fresh client load)`);
  setTimeout(() => process.exit(0), healDelayMs);
}

async function initDatabase(): Promise<void> {
  boot("db probe: connecting...");

  // Ek probe — DB reachable + schema ready? (install wizard route apna
  // setDbReady(true) install ke baad khud karta hai.)
  const probeOnce = async (): Promise<boolean> => {
    try {
      await prisma.$connect();
    } catch (err) {
      // Primary connect fail hua to Plesk MariaDB credentials try karo
      const pleskUrl = "mysql://switch_v2:switchnest%401234567890@127.0.0.1:3306/switch_v2";
      try {
        await resetPrismaClient(pleskUrl);
        await prisma.$connect();
      } catch {
        boot("db probe: NOT reachable —", err instanceof Error ? err.message : String(err));
        return false;
      }
    }
    if (await dbHasSchema()) {
      logger.info("✅ Database connected (schema ready)");
      await runLightMigrations();
      // Client sync check — stale ho to regenerate + reboot (Plesk quirk)
      await selfHealPrismaClient();
      return true;
    }
    logger.warn("⚠️ Database reachable par installed nahi — setup mode. /api/install se installation karo.");
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
    // Request traffic tracker — AppMeta se load + periodic flush
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

  // ASLI FIX (recurring 503): pehle ek hi probe tha — DB thoda sa bhi blip
  // hua (deploy churn, MySQL restart, connection limit spike) to setDbReady
  // false ho jata tha aur process 503 mode me PHANSA rehta tha jab tak
  // manual node disable/enable na ho. Ab retry loop — har 15s dobara probe,
  // DB aate hi ready + services start. Kabhi manual restart nahi chahiye.
  boot("db probe: retry loop start (har 15s) — DB aate hi ready ho jayega");
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
  // process.exit kabhi nahi — pool stop ho jata hai to 503. Log karke
  // zinda rehte hain; iisnode process ko tab tak rakhta hai jab tak zinda.
  const line = `[fatal] main() failed: ${err instanceof Error ? err.stack || err.message : String(err)}`;
  process.stderr.write(line + "\n");
  fileLog(line);
  logger.error("Failed to start API", err instanceof Error ? err.stack : err);
});
