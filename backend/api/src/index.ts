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

async function addColumnIfMissing(table: string, column: string, definition: string) {
  try {
    const exists = await prisma.$queryRaw<unknown[]>`
      SELECT COLUMN_NAME FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ${table} AND column_name = ${column}
    `;
    if (!exists || (Array.isArray(exists) && exists.length === 0)) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      logger.info(`[migration] Added missing column ${table}.${column}`);
    }
  } catch {
    /* ignore */
  }
}

async function runLightMigrations(): Promise<void> {
  try {
    // 1. Create auxiliary tables if missing
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`coupons\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`code\` VARCHAR(32) UNIQUE NOT NULL,
        \`discountType\` VARCHAR(16) NOT NULL DEFAULT 'percentage',
        \`discountValue\` DECIMAL(10, 2) NOT NULL,
        \`min_order_amount\` DECIMAL(10, 2) NULL,
        \`max_discount\` DECIMAL(10, 2) NULL,
        \`usage_limit\` INT NULL,
        \`used_count\` INT NOT NULL DEFAULT 0,
        \`expires_at\` DATETIME(3) NULL,
        \`active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`serial_registry\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`serialCode\` VARCHAR(32) UNIQUE NOT NULL,
        \`productId\` INT NOT NULL,
        \`orderId\` INT NULL,
        \`userId\` INT NULL,
        \`homeId\` INT NULL,
        \`console_password\` VARCHAR(64) NULL,
        \`status\` ENUM('available','reserved','shipped','delivered','claimed') NOT NULL DEFAULT 'available',
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`claimed_at\` DATETIME(3) NULL,
        \`tested_at\` DATETIME(3) NULL,
        \`warranty_expires_at\` DATETIME(3) NULL,
        \`warranty_status\` VARCHAR(20) NOT NULL DEFAULT 'active'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`product_media\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`productId\` INT NULL,
        \`reviewId\` INT NULL,
        \`url\` VARCHAR(500) NOT NULL,
        \`type\` VARCHAR(20) NOT NULL DEFAULT 'image',
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`product_reviews\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`productId\` INT NOT NULL,
        \`userId\` INT NOT NULL,
        \`rating\` DECIMAL(3, 2) NOT NULL DEFAULT 5.0,
        \`comment\` TEXT NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`app_meta\` (
        \`key\` VARCHAR(64) PRIMARY KEY,
        \`value\` LONGTEXT NOT NULL,
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`support_messages\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`userId\` INT NOT NULL,
        \`senderRole\` VARCHAR(10) NOT NULL DEFAULT 'admin',
        \`senderName\` VARCHAR(100) NOT NULL,
        \`message\` TEXT NOT NULL,
        \`attachment_name\` VARCHAR(255) NULL,
        \`attachment_type\` VARCHAR(100) NULL,
        \`attachment_data\` TEXT NULL,
        \`attachment_path\` VARCHAR(255) NULL,
        \`read_by_user\` TINYINT(1) NOT NULL DEFAULT 0,
        \`read_by_admin\` TINYINT(1) NOT NULL DEFAULT 1,
        \`deleted_at\` DATETIME(3) NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => {});

    // 2. Ensure columns in products
    await addColumnIfMissing("products", "upcoming", "TINYINT(1) NOT NULL DEFAULT 0");
    await addColumnIfMissing("products", "featured", "TINYINT(1) NOT NULL DEFAULT 0");
    await addColumnIfMissing("products", "sortOrder", "INT NOT NULL DEFAULT 0");
    await addColumnIfMissing("products", "tag", "VARCHAR(32) NULL");
    await addColumnIfMissing("products", "features", "JSON NULL");
    await addColumnIfMissing("products", "imageUrl", "VARCHAR(255) NULL");
    await addColumnIfMissing("products", "active", "TINYINT(1) NOT NULL DEFAULT 1");
    await addColumnIfMissing("products", "relayCount", "INT NOT NULL DEFAULT 4");
    await addColumnIfMissing("products", "rating", "DECIMAL(3,2) NOT NULL DEFAULT 0.00");
    await addColumnIfMissing("products", "total_reviews", "INT NOT NULL DEFAULT 0");
    await addColumnIfMissing("products", "stock_count", "INT NOT NULL DEFAULT 10");

    // 3. Ensure columns in orders
    await addColumnIfMissing("orders", "coupon_id", "INT NULL");
    await addColumnIfMissing("orders", "discount_amount", "DECIMAL(10,2) NOT NULL DEFAULT 0.00");
    await addColumnIfMissing("orders", "payment_ref", "VARCHAR(64) NULL");
    await addColumnIfMissing("orders", "razorpay_order_id", "VARCHAR(64) NULL");
    await addColumnIfMissing("orders", "paid_at", "DATETIME(3) NULL");
    await addColumnIfMissing("orders", "wifi_ssid", "VARCHAR(64) NULL");
    await addColumnIfMissing("orders", "wifi_password_enc", "TEXT NULL");
    await addColumnIfMissing("orders", "paymentStatus", "VARCHAR(20) NOT NULL DEFAULT 'unpaid'");
    await addColumnIfMissing("orders", "paymentMethod", "ENUM('cod','upi','manual') NOT NULL DEFAULT 'manual'");

    // 4. Ensure columns in esp_devices
    await addColumnIfMissing("esp_devices", "last_api_key_id", "INT NULL");
    await addColumnIfMissing("esp_devices", "console_password", "VARCHAR(64) NULL");
    await addColumnIfMissing("esp_devices", "ota_pending_version", "VARCHAR(32) NULL");
    await addColumnIfMissing("esp_devices", "ota_requested_at", "DATETIME(3) NULL");
    await addColumnIfMissing("esp_devices", "ota_progress", "INT NULL");
    await addColumnIfMissing("esp_devices", "ota_status", "VARCHAR(32) NULL");
    await addColumnIfMissing("esp_devices", "led_enabled", "TINYINT(1) NOT NULL DEFAULT 1");
    await addColumnIfMissing("esp_devices", "serial_code", "VARCHAR(32) NULL");
    await addColumnIfMissing("esp_devices", "model_code", "VARCHAR(16) NULL");
    await addColumnIfMissing("esp_devices", "ssid", "VARCHAR(64) NULL");

    // 5. Ensure columns in serial_registry
    await addColumnIfMissing("serial_registry", "orderId", "INT NULL");
    await addColumnIfMissing("serial_registry", "userId", "INT NULL");
    await addColumnIfMissing("serial_registry", "homeId", "INT NULL");
    await addColumnIfMissing("serial_registry", "console_password", "VARCHAR(64) NULL");
    await addColumnIfMissing("serial_registry", "tested_at", "DATETIME(3) NULL");
    await addColumnIfMissing("serial_registry", "warranty_expires_at", "DATETIME(3) NULL");
    await addColumnIfMissing("serial_registry", "warranty_status", "VARCHAR(20) NOT NULL DEFAULT 'active'");

    // 6. Ensure columns in devices
    await addColumnIfMissing("devices", "ota_pending_version", "VARCHAR(32) NULL");
    await addColumnIfMissing("devices", "ota_requested_at", "DATETIME(3) NULL");
    await addColumnIfMissing("devices", "ota_progress", "INT NULL");
    await addColumnIfMissing("devices", "ota_status", "VARCHAR(32) NULL");
    await addColumnIfMissing("devices", "channel", "INT NULL");
    await addColumnIfMissing("devices", "serial_number", "VARCHAR(64) NULL");
    await addColumnIfMissing("devices", "firmware_version", "VARCHAR(32) NULL");
    await addColumnIfMissing("devices", "ip_address", "VARCHAR(45) NULL");

    // 7. Ensure columns in users
    await addColumnIfMissing("users", "theme_pref", "VARCHAR(16) NULL");
    await addColumnIfMissing("users", "push_device_toggles", "TINYINT(1) NOT NULL DEFAULT 1");
    await addColumnIfMissing("users", "push_system_alerts", "TINYINT(1) NOT NULL DEFAULT 1");
    await addColumnIfMissing("users", "token_version", "INT NOT NULL DEFAULT 0");
    await addColumnIfMissing("users", "expo_push_token", "VARCHAR(100) NULL");
    await addColumnIfMissing("users", "avatar_url", "VARCHAR(500) NULL");
    await addColumnIfMissing("users", "dob", "DATE NULL");
    await addColumnIfMissing("users", "gender", "VARCHAR(20) NULL");
    await addColumnIfMissing("users", "phone", "VARCHAR(20) NULL");
    await addColumnIfMissing("users", "address", "TEXT NULL");

    // 8. Ensure columns in home_members
    await addColumnIfMissing("home_members", "restricted", "TINYINT(1) NOT NULL DEFAULT 0");
    await addColumnIfMissing("home_members", "daily_limit_minutes", "INT NULL");

    // Seed default products if products table is empty
    const productCount = await prisma.product.count().catch(() => 0);
    if (productCount === 0) {
      logger.info("[seed] Seeding initial SwitchNest products...");
      await prisma.product.createMany({
        data: [
          {
            name: "SwitchNest 4-Channel Smart Relay",
            modelCode: "RS-4CH-RELAY",
            relayCount: 4,
            price: 1499.00,
            description: "4-channel smart WiFi + MQTT relay module for home automation. Fits in standard modular switchboard.",
            features: ["4 Relays (10A each)", "Local WiFi + Cloud MQTT", "Realtime WebSocket Control", "OTA Firmware Updates"],
            active: true,
            upcoming: false,
            stockCount: 10,
          },
          {
            name: "SwitchNest 2-Channel Smart Relay",
            modelCode: "RS-2CH-RELAY",
            relayCount: 2,
            price: 999.00,
            description: "Compact 2-channel smart relay module for lights, fans, and sockets.",
            features: ["2 Relays (10A)", "Compact Size", "LAN + Cloud Sync"],
            active: true,
            upcoming: false,
            stockCount: 10,
          },
          {
            name: "SwitchNest 8-Channel Pro SwitchBoard",
            modelCode: "RS-8CH-PRO",
            relayCount: 8,
            price: 2799.00,
            description: "High-density 8-channel smart controller for whole room/living hall.",
            features: ["8 Relays (16A Heavy Load)", "Dual WiFi Antenna", "Family Safety Mode"],
            active: true,
            upcoming: false,
            stockCount: 5,
          },
          {
            name: "SwitchNest Smart Triac Dimmer 3S",
            modelCode: "RS-DIM-3S",
            relayCount: 3,
            price: 1899.00,
            description: "3-step trailing edge silent fan & light speed controller.",
            features: ["Zero Buzzing / Hum", "Precision Step Control", "Smooth Fade"],
            active: true,
            upcoming: true,
            stockCount: 0,
          }
        ],
        skipDuplicates: true
      });
      logger.info("[seed] Initial SwitchNest products seeded successfully!");
    }

    // 9. Ensure ALL home owners have explicit 'owner' role in home_members (fixes /boards permissions for all users)
    try {
      const allHomes = await prisma.home.findMany({ select: { id: true, ownerId: true } });
      for (const h of allHomes) {
        await prisma.homeMember.upsert({
          where: { homeId_userId: { homeId: h.id, userId: h.ownerId } },
          create: { homeId: h.id, userId: h.ownerId, role: "owner" },
          update: { role: "owner" },
        });
      }
      logger.info(`[sync] Verified owner permissions across ${allHomes.length} homes`);
    } catch (e) {
      logger.warn("[sync] Home member verification note:", e instanceof Error ? e.message : String(e));
    }

    // 10. Self-heal and link the 2 sold ESP devices and historical orders
    try {
      const product4ch = await prisma.product.findFirst({
        where: { modelCode: { in: ["4CH", "RS-4CH-RELAY"] } },
      }) ?? await prisma.product.findFirst();

      const pId = product4ch?.id ?? 1;

      // Board 1: Robo's board
      // MAC: 10:06:1c:f4:f4:a0, Serial: RS-4CH-3GW2ES, Home: 4 (Jhatu's Home), User: 6 (Robo)
      const roboUser = await prisma.user.findFirst({
        where: { OR: [{ id: 6 }, { username: { in: ["Robo", "robo", "jhatu"] } }] },
      });
      const roboUserId = roboUser?.id ?? 6;

      // Ensure Robo owns Home 4
      await prisma.home.updateMany({
        where: { id: 4 },
        data: { ownerId: roboUserId, name: "Robo's Home" },
      }).catch(() => {});

      await prisma.homeMember.upsert({
        where: { homeId_userId: { homeId: 4, userId: roboUserId } },
        create: { homeId: 4, userId: roboUserId, role: "owner" },
        update: { role: "owner" },
      }).catch(() => {});

      // Link ESP device for Robo
      await prisma.espDevice.updateMany({
        where: { OR: [{ macAddress: "10:06:1c:f4:f4:a0" }, { homeId: 4 }] },
        data: {
          serialCode: "RS-4CH-3GW2ES",
          modelCode: "4CH",
          homeId: 4,
          name: "SwitchNest 4CH (Robo Lab)",
        },
      }).catch(() => {});

      // Register Serial for Robo
      await prisma.serialRegistry.upsert({
        where: { serialCode: "RS-4CH-3GW2ES" },
        create: {
          serialCode: "RS-4CH-3GW2ES",
          productId: pId,
          homeId: 4,
          userId: roboUserId,
          status: "claimed",
          claimedAt: new Date(),
          warrantyStatus: "active",
        },
        update: {
          homeId: 4,
          userId: roboUserId,
          status: "claimed",
        },
      }).catch(() => {});

      // Board 2: Shinde's board
      // MAC: c0:cd:d6:85:41:a4, Serial: RS-4CH-FFYJR3, Home: 15 (shinde's Home), User: 17 (shinde)
      const shindeUser = await prisma.user.findFirst({
        where: { OR: [{ id: 17 }, { username: "shinde" }] },
      });
      const shindeUserId = shindeUser?.id ?? 17;

      await prisma.homeMember.upsert({
        where: { homeId_userId: { homeId: 15, userId: shindeUserId } },
        create: { homeId: 15, userId: shindeUserId, role: "owner" },
        update: { role: "owner" },
      }).catch(() => {});

      await prisma.espDevice.updateMany({
        where: { OR: [{ macAddress: "c0:cd:d6:85:41:a4" }, { homeId: 15 }] },
        data: {
          serialCode: "RS-4CH-FFYJR3",
          modelCode: "4CH",
          homeId: 15,
          name: "SwitchNest 4CH (Shinde Home)",
        },
      }).catch(() => {});

      await prisma.serialRegistry.upsert({
        where: { serialCode: "RS-4CH-FFYJR3" },
        create: {
          serialCode: "RS-4CH-FFYJR3",
          productId: pId,
          homeId: 15,
          userId: shindeUserId,
          status: "claimed",
          claimedAt: new Date(),
          warrantyStatus: "active",
        },
        update: {
          homeId: 15,
          userId: shindeUserId,
          status: "claimed",
        },
      }).catch(() => {});

      // Link historical orders: Order 8 and Order 2 to Robo
      await prisma.order.updateMany({
        where: { orderNumber: { in: ["RSMTL2SCKYM9SI", "RSMTK8Y8J56PXG"] } },
        data: { userId: roboUserId, status: "delivered", paymentStatus: "paid" },
      }).catch(() => {});

      // Heal any orphaned order whose userId does not exist in users table -> set to admin (id: 1) or robo
      const validUsers = await prisma.user.findMany({ select: { id: true } });
      const validUserIds = new Set(validUsers.map(u => u.id));
      const allOrders = await prisma.order.findMany({ select: { id: true, userId: true } });
      for (const ord of allOrders) {
        if (!validUserIds.has(ord.userId)) {
          await prisma.order.update({
            where: { id: ord.id },
            data: { userId: 1 },
          }).catch(() => {});
        }
      }

      logger.info("[sync] Successfully recovered and linked sold boards, serials, and historical orders!");
    } catch (e) {
      logger.warn("[sync] Sold board recovery note:", e instanceof Error ? e.message : String(e));
    }
  } catch (err) {
    logger.warn("[migrations] Error ensuring schema columns:", err instanceof Error ? err.message : String(err));
  }
}


async function dbHasSchema(): Promise<boolean> {
  try {
    const userCount = await prisma.user.count();
    return userCount >= 0;
  } catch {
    try {
      const rows = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name IN ('User', 'users')
      `;
      if (Number(rows[0]?.c ?? 0) > 0) return true;
    } catch (err) {
      logger.warn("Schema probe via Prisma failed:", err instanceof Error ? err.message : String(err));
    }
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
