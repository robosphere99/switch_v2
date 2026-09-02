import { Router } from "express";
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { resetPrismaClient, getEffectiveDbUrl } from "../lib/prisma";
import { setDbReady, isDbReady } from "../lib/dbState";
import { ok } from "../lib/response";
import { AppError } from "../lib/response";
import { logger } from "../lib/logger";
import { persistEnvKeys, persistEnvKey } from "../lib/envPersist";
import { startScheduler } from "../services/scheduler.service";
import { startOfflineWatcher } from "../services/offline.service";

// cwd = application root (apps/api) — dev (tsx) aur Plesk bundle dono me
// yahi hota hai. __dirname bundle me dist/ ho jata hai isliye use nahi karte.
const SCHEMA_SQL = path.resolve(process.cwd(), "prisma/schema.sql");

export const installRouter = Router();

/** Fresh install pe shop ke liye default product catalog (seed.ts jaisa). */
const DEFAULT_PRODUCTS = [
  { name: "2CH WiFi Relay Module", modelCode: "2CH", relayCount: 2, price: "599", description: "Two-channel WiFi relay board for lights and small appliances. 10A per channel, ESP32 based, works with the SwitchNest app and voice assistant.", features: { channels: 2, wifi: true, ota: true, voice: true } },
  { name: "4CH WiFi Relay Module", modelCode: "4CH", relayCount: 4, price: "799", description: "Four-channel WiFi relay board — the classic choice for room-wide control. 10A per channel with status LED and manual override switches.", features: { channels: 4, wifi: true, ota: true, voice: true } },
  { name: "5CH WiFi Relay Module", modelCode: "5CH", relayCount: 5, price: "899", description: "Five-channel relay board — perfect for combining 4 devices plus one spare. ESP32 with OTA updates and two-way sync.", features: { channels: 5, wifi: true, ota: true, voice: true } },
  { name: "6CH WiFi Relay Module", modelCode: "6CH", relayCount: 6, price: "999", description: "Six-channel WiFi relay board for medium-size homes. Control lights, fans and appliances from one compact board.", features: { channels: 6, wifi: true, ota: true, voice: true } },
  { name: "8CH WiFi Relay Module", modelCode: "8CH", relayCount: 8, price: "1199", description: "Eight-channel WiFi relay board — full-home control. Ideal for new construction wiring with all loads in one panel.", features: { channels: 8, wifi: true, ota: true, voice: true } },
  { name: "4CH IR WiFi Relay Module", modelCode: "4CH-IR", relayCount: 4, price: "999", description: "Four-channel relay board with built-in IR receiver — control with the app and any IR remote. Works with ACs, TVs and IR appliances.", features: { channels: 4, ir: true, wifi: true, ota: true, voice: true } },
  { name: "Fan Speed Dimmer (WiFi)", modelCode: "FAN-DIM", relayCount: 1, price: "899", description: "WiFi fan regulator with stepped speed control. Replace your old 5-step regulator and control the fan from the app or voice.", features: { fanDimmer: true, steps: 5, wifi: true, ota: true, voice: true } },
  { name: "3-State Touch Dimmer", modelCode: "DIM-3S", relayCount: 1, price: "749", description: "Touch dimmer with 3 brightness steps (off → 50% → 100%). WiFi + touch control, works with existing bulb holders.", features: { dimmer: true, steps: 3, touch: true, wifi: true, ota: true } },
  { name: "4-State Touch Dimmer", modelCode: "DIM-4S", relayCount: 1, price: "799", description: "Touch dimmer with 4 brightness steps (off → 33% → 66% → 100%). WiFi + touch control, app dimming via steps.", features: { dimmer: true, steps: 4, touch: true, wifi: true, ota: true } },
];

interface DbParts {
  host: string;
  port: number;
  user: string;
  pass: string;
  name: string;
}

/** mysql://user:pass@host:port/dbname -> parts (hosting pe .env me type karne ki zaroorat nahi) */
function parseDatabaseUrl(url: string): DbParts {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    pass: decodeURIComponent(u.password),
    name: decodeURIComponent(u.pathname.replace(/^\//, "")),
  };
}

function buildDatabaseUrl(p: DbParts): string {
  return `mysql://${encodeURIComponent(p.user)}:${encodeURIComponent(p.pass)}@${p.host}:${p.port}/${encodeURIComponent(p.name)}`;
}

function escIdent(name: string): string {
  return name.replace(/`/g, "``");
}

/** DB reachable hai ya nahi + tables bani hui hain ya nahi (setup probe). */
async function probeDb(parts: DbParts): Promise<{ reachable: boolean; tablesReady: boolean; installed: boolean }> {
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.pass,
      database: parts.name,
      connectTimeout: 5000,
    });
  } catch {
    return { reachable: false, tablesReady: false, installed: false };
  }
  try {
    const [rows] = await conn.query(
      "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
      [parts.name],
    );
    const hasUsers = Number((rows as Array<{ c: number }>)[0]?.c ?? 0) > 0;
    // installed = asli data hai (admin/user rows). app_meta flag confirm
    // karta hai; flag na ho toh users count decide karta hai — isse factory
    // reset (sab empty) pe install wizard sahi dikhta hai.
    let installed = false;
    if (hasUsers) {
      try {
        const [meta] = await conn.query("SELECT value FROM app_meta WHERE `key` = 'installed' LIMIT 1");
        const flag = (meta as Array<{ value: string }>)[0]?.value;
        if (flag !== undefined) {
          installed = flag === "1";
        } else {
          const [urows] = await conn.query("SELECT COUNT(*) AS c FROM users");
          installed = Number((urows as Array<{ c: number }>)[0]?.c ?? 0) > 0;
        }
      } catch {
        // app_meta table abhi bani nahi — users table hi kaafi hai
        installed = true;
      }
    }
    return { reachable: true, tablesReady: hasUsers, installed };
  } catch {
    return { reachable: true, tablesReady: false, installed: false };
  } finally {
    await conn.end().catch(() => undefined);
  }
}

/**
 * Wizard jo DB details deta hai unhe site/.env me PERSIST karta hai —
 * isse user ko khud .env banane ki zaroorat nahi. Restart ke baad bhi
 * app sahi DB se judta hai. Best-effort: write fail ho to sirf warn.
 * (Asli write logic lib/envPersist me — admin password sync bhi wahi.)
 */
function persistDatabaseConfig(p: DbParts): { path: string; ok: boolean } {
  // Granular DB_* vars + explicit DATABASE_URL (env.ts me DATABASE_URL
  // precedence leta hai — dono ko consistent rakhna zaroori hai).
  return persistEnvKeys([
    ["DB_HOST", p.host],
    ["DB_PORT", String(p.port)],
    ["DB_USER", p.user],
    ["DB_PASS", p.pass],
    ["DB_NAME", p.name],
    ["DATABASE_URL", `${buildDatabaseUrl(p)}?connection_limit=10`],
  ]);
}

/** Server se connect karke (bina DB select kiye) connection test + version. */
async function connectServer(parts: DbParts): Promise<{ serverVersion: string }> {
  const hostsToTry = parts.host === "localhost" ? ["127.0.0.1", "localhost"] : [parts.host, "127.0.0.1"];
  let lastErr: unknown = null;
  for (const h of hostsToTry) {
    let conn: mysql.Connection | null = null;
    try {
      conn = await mysql.createConnection({
        host: h,
        port: parts.port,
        user: parts.user,
        password: parts.pass,
        connectTimeout: 8000,
      });
      parts.host = h; // lock onto working host
      const [rows] = await conn.query("SELECT VERSION() AS v");
      await conn.end().catch(() => undefined);
      return { serverVersion: String((rows as Array<{ v: string }>)[0]?.v ?? "") };
    } catch (err) {
      lastErr = err;
      if (conn) await conn.end().catch(() => undefined);
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new AppError("DB_CONNECT_FAILED", `Database server se connect nahi ho paya: ${msg}`, 502);
}

/** DB create (agar nahi hai) — server-level permission chahiye. */
async function createDatabase(parts: DbParts): Promise<void> {
  const dbName = escIdent(parts.name);
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.pass,
      connectTimeout: 8000,
    });
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } catch (_err) {
    // Shared hosting (Plesk) pe DB user ke paas global CREATE DATABASE permission
    // nahi hoti, lekin DB Plesk UI se pehle hi ban chuka hota hai — skip query error.
  } finally {
    if (conn) await conn.end().catch(() => undefined);
  }
}

function getSchemaSql(): string {
  const candidates = [
    path.resolve(process.cwd(), "prisma/schema.sql"),
    path.resolve(process.cwd(), "dist/schema.sql"),
    path.resolve(process.cwd(), "apps/api/prisma/schema.sql"),
    path.resolve(process.cwd(), "site/apps/api/prisma/schema.sql"),
    path.resolve(__dirname, "../prisma/schema.sql"),
    path.resolve(__dirname, "schema.sql"),
    path.resolve(__dirname, "prisma/schema.sql"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const sql = fs.readFileSync(p, "utf-8");
        if (sql && sql.trim().length > 50) return sql;
      } catch {
        /* try next */
      }
    }
  }
  return FALLBACK_SCHEMA_SQL;
}

/** Saari tables banao — schema.sql (Prisma schema se generate kiya hua). */
async function applySchema(parts: DbParts): Promise<void> {
  const schemaSql = getSchemaSql();
  let conn: mysql.Connection;
  try {
    conn = await mysql.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.pass,
      database: parts.name,
      multipleStatements: true,
      connectTimeout: 8000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError("DB_CONNECT_FAILED", `Database connect failed: ${msg}`, 502);
  }
  try {
    await conn.query(schemaSql);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists") || msg.includes("ER_TABLE_EXISTS_ERROR")) {
      logger.info("[install] Tables already present in database — proceeding to next step");
    } else {
      throw new AppError(
        "SCHEMA_FAILED",
        `Tables create nahi hui: ${msg}. Database khali (fresh) hona chahiye — purana data ho to factory reset karo ya naya DB use karo.`,
        500,
      );
    }
  } finally {
    await conn.end().catch(() => undefined);
  }
}

interface AdminInput {
  username: string;
  name?: string;
  email: string;
  password: string;
}

/**
 * Last step: admin + home + default catalog + installed flag.
 * Direct MySQL queries use karke 100% reliable execution.
 */
async function completeInstall(parts: DbParts, admin: AdminInput) {
  const nextUrl = buildDatabaseUrl(parts);
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.pass,
      database: parts.name,
      connectTimeout: 10000,
    });

    // Check existing admin
    const [existingRows] = await conn.query(
      "SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1",
      [admin.username, admin.email],
    );
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      logger.info("[install] Admin user already exists in DB — marking installed");
    } else {
      const passwordHash = await bcrypt.hash(admin.password, 10);
      const homeName = `${(admin.name || admin.username).trim()}${admin.name ? "" : "'s"} Home`;

      // 1. Create Admin User
      const [resUser] = await conn.query(
        "INSERT INTO users (username, email, password, role, status, created_at) VALUES (?, ?, ?, 'system_admin', 'active', NOW(3))",
        [admin.username, admin.email, passwordHash],
      );
      const userId = (resUser as { insertId: number }).insertId;

      // 2. Create Home
      const [resHome] = await conn.query(
        "INSERT INTO homes (name, ownerId, status, maxDevices, maxMembers, created_at) VALUES (?, ?, 'active', 20, 10, NOW(3))",
        [homeName, userId],
      );
      const homeId = (resHome as { insertId: number }).insertId;

      // 3. Create Home Member (Owner)
      await conn.query(
        "INSERT INTO home_members (homeId, userId, role, restricted, joined_at) VALUES (?, ?, 'owner', false, NOW(3))",
        [homeId, userId],
      );

      // 4. Default Products
      for (const p of DEFAULT_PRODUCTS) {
        await conn.query(
          `INSERT INTO products (name, modelCode, relayCount, price, description, features, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, true, NOW(3))
           ON DUPLICATE KEY UPDATE active = true`,
          [p.name, p.modelCode, p.relayCount, p.price, p.description, JSON.stringify(p.features)],
        );
      }

      // 5. App Meta installed flag
      await conn.query(
        "INSERT INTO app_meta (`key`, `value`, updated_at) VALUES ('installed', '1', NOW(3)) ON DUPLICATE KEY UPDATE `value` = '1'",
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[install] completeInstall mysql error", err);
    throw new AppError("INSTALL_FAILED", `Admin account create nahi ho paya: ${msg}`, 500);
  } finally {
    if (conn) await conn.end().catch(() => undefined);
  }

  // 5) Config persist — restart ke baad bhi yehi DB chale
  const persisted = persistDatabaseConfig(parts);
  persistEnvKey("ADMIN_PASSWORD", admin.password);

  // Try Prisma client reset (non-fatal if Prisma Engine binary has environment warnings)
  try {
    await resetPrismaClient(nextUrl);
  } catch (_pErr) {
    logger.warn("[install] resetPrismaClient warning (non-fatal)", _pErr);
  }

  setDbReady(true);

  // Services jo normal mode me chalti hain — install ke turant baad start
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

  return {
    installed: true,
    database: parts.name,
    admin: admin.username,
    configPersisted: persisted.ok,
    configPath: persisted.path,
  };
}

/** Wizard body se DB parts nikaalo (env fallback ke saath). */
function dbFromBody(bodyDb: Partial<DbParts> | undefined): DbParts {
  const base = parseDatabaseUrl(env.DATABASE_URL);
  const parts: DbParts = {
    host: (bodyDb?.host ?? base.host).trim(),
    port: Number(bodyDb?.port ?? base.port) || 3306,
    user: (bodyDb?.user ?? base.user).trim(),
    pass: bodyDb?.pass ?? base.pass,
    name: (bodyDb?.name ?? base.name).trim(),
  };
  if (!parts.host || !parts.name || !parts.user) {
    throw new AppError("BAD_REQUEST", "DB host, user aur name required hain", 400);
  }
  return parts;
}

/** Install ka status — web wizard isse poll karta hai. */
installRouter.get("/status", async (_req, res) => {
  try {
    const dbUrl = getEffectiveDbUrl();
    const parts = parseDatabaseUrl(dbUrl);
    const probe = await probeDb(parts);

    ok(res, {
      installed: probe.installed,
      dbReachable: probe.reachable,
      tablesReady: probe.tablesReady,
      dbConfigured: Boolean(process.env.DATABASE_URL || env.DATABASE_URL),
      db: {
        host: parts.host || "127.0.0.1",
        port: parts.port || 3306,
        user: parts.user || "root",
        name: parts.name || "switchnest",
      },
      admin: {
        username: env.ADMIN_USERNAME || "admin",
        email: env.ADMIN_EMAIL || "admin@switchnest.in",
        passwordSet: Boolean(env.ADMIN_PASSWORD),
      },
    });
  } catch (_err) {
    ok(res, {
      installed: true,
      dbReachable: true,
      tablesReady: true,
      dbConfigured: true,
      db: { host: "127.0.0.1", port: 3306, user: "root", name: "switchnest" },
      admin: { username: "admin", email: "admin@switchnest.in", passwordSet: true },
    });
  }
});

/**
 * STEP 1 — Database connection.
 * POST /api/install/connect { db: { host, port, user, pass, name } }
 * Connection test + DB create (agar nahi hai). Tables nahi banti yahan.
 */
installRouter.post("/connect", async (req, res) => {
  const parts = dbFromBody((req.body?.db ?? {}) as Partial<DbParts>);
  const { serverVersion } = await connectServer(parts);
  await createDatabase(parts);
  const probe = await probeDb(parts);
  ok(res, {
    connected: true,
    serverVersion,
    database: parts.name,
    dbCreated: probe.reachable,
    tablesReady: probe.tablesReady,
  });
});

/**
 * STEP 2 — Tables.
 * POST /api/install/schema { db: {...} }
 * Saari tables banao (fresh DB pe). Pehle DB exists hona chahiye.
 */
installRouter.post("/schema", async (req, res) => {
  const parts = dbFromBody((req.body?.db ?? {}) as Partial<DbParts>);
  // DB exists nahi to create karo (kuch users sirf connect step skip karte hain)
  await createDatabase(parts);
  await applySchema(parts);
  const probe = await probeDb(parts);
  ok(res, {
    tablesReady: probe.tablesReady,
    installed: probe.installed,
    database: parts.name,
    message: "Saari tables ban gayi — ab admin account banao",
  });
});

/**
 * STEP 3 — Admin account + complete.
 * POST /api/install/admin { db: {...}, admin: { username, name?, email, password } }
 */
installRouter.post("/admin", async (req, res) => {
  const parts = dbFromBody((req.body?.db ?? {}) as Partial<DbParts>);
  const bodyAdmin = (req.body?.admin ?? {}) as AdminInput;

  const admin: AdminInput = {
    username: (bodyAdmin.username ?? env.ADMIN_USERNAME).trim(),
    name: bodyAdmin.name?.trim() || undefined,
    email: (bodyAdmin.email ?? env.ADMIN_EMAIL).trim().toLowerCase(),
    password: bodyAdmin.password ?? env.ADMIN_PASSWORD,
  };
  if (!admin.username || !admin.email || !admin.password) {
    throw new AppError("BAD_REQUEST", "Admin username, email aur password required hain", 400);
  }

  // Installed already hai to mat chhedo (double install se data nahi udta)
  const probe = await probeDb(parts);
  if (probe.installed) {
    throw new AppError("ALREADY_INSTALLED", "Database already installed and connected", 409);
  }
  if (!probe.tablesReady) {
    throw new AppError(
      "SCHEMA_PENDING",
      "Pehle database + tables step complete karo (users table nahi mili)",
      400,
    );
  }

  const result = await completeInstall(parts, admin);
  ok(res, result);
});

/**
 * First-run install (single-shot, backward compatible):
 *   POST /api/install { db: {...}, admin: {...} }
 *   1. DB create   2. tables   3. admin + home   4. installed flag
 *   5. Prisma naye DB se connect   6. .env persist   7. server normal mode
 */
installRouter.post("/", async (req, res) => {
  if (isDbReady()) {
    // In-memory flag to set hai (process restart pe default true), par asli
    // check DB me koi admin/data hai ya nahi — factory reset ke baad empty
    // DB pe install dobara chalta rahe.
    const parts = parseDatabaseUrl(env.DATABASE_URL);
    const probe = await probeDb(parts);
    if (probe.installed) {
      throw new AppError("ALREADY_INSTALLED", "Database already installed and connected", 409);
    }
  }

  const parts = dbFromBody((req.body?.db ?? {}) as Partial<DbParts>);
  const bodyAdmin = (req.body?.admin ?? {}) as AdminInput;
  const admin: AdminInput = {
    username: (bodyAdmin.username ?? env.ADMIN_USERNAME).trim(),
    name: bodyAdmin.name?.trim() || undefined,
    email: (bodyAdmin.email ?? env.ADMIN_EMAIL).trim().toLowerCase(),
    password: bodyAdmin.password ?? env.ADMIN_PASSWORD,
  };
  if (!admin.username || !admin.email || !admin.password) {
    throw new AppError("BAD_REQUEST", "Admin username, email aur password required hain", 400);
  }

  // 1) DB create   2) tables
  await createDatabase(parts);
  await applySchema(parts);

  // 3-6) admin + home + catalog + flag + persist + services
  const result = await completeInstall(parts, admin);
  ok(res, result);
});

const FALLBACK_SCHEMA_SQL = `-- CreateTable
CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`username\` VARCHAR(50) NOT NULL,
    \`email\` VARCHAR(100) NOT NULL,
    \`password\` VARCHAR(255) NOT NULL,
    \`role\` ENUM('user', 'system_admin') NOT NULL DEFAULT 'user',
    \`status\` ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`last_login_at\` DATETIME(3) NULL,
    \`theme_pref\` VARCHAR(16) NULL,
    \`token_version\` INTEGER NOT NULL DEFAULT 0,
    UNIQUE INDEX \`users_username_key\`(\`username\`),
    UNIQUE INDEX \`users_email_key\`(\`email\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`assistant_chats\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NOT NULL,
    \`homeId\` INTEGER NOT NULL,
    \`title\` VARCHAR(100) NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`assistant_chats_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`assistant_messages\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`chatId\` INTEGER NOT NULL,
    \`role\` VARCHAR(20) NOT NULL,
    \`content\` TEXT NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`assistant_messages_chatId_idx\`(\`chatId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`homes\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`name\` VARCHAR(100) NOT NULL,
    \`ownerId\` INTEGER NOT NULL,
    \`status\` ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
    \`maxDevices\` INTEGER NOT NULL DEFAULT 20,
    \`maxMembers\` INTEGER NOT NULL DEFAULT 10,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`homes_ownerId_idx\`(\`ownerId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`home_members\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`homeId\` INTEGER NOT NULL,
    \`userId\` INTEGER NOT NULL,
    \`role\` ENUM('owner', 'admin', 'member', 'viewer') NOT NULL DEFAULT 'member',
    \`restricted\` BOOLEAN NOT NULL DEFAULT false,
    \`daily_limit_minutes\` INTEGER NULL,
    \`joined_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`home_members_userId_idx\`(\`userId\`),
    UNIQUE INDEX \`home_members_homeId_userId_key\`(\`homeId\`, \`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`device_access\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`homeId\` INTEGER NOT NULL,
    \`deviceId\` INTEGER NOT NULL,
    \`userId\` INTEGER NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`device_access_homeId_idx\`(\`homeId\`),
    INDEX \`device_access_userId_idx\`(\`userId\`),
    UNIQUE INDEX \`device_access_deviceId_userId_key\`(\`deviceId\`, \`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`device_usage\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`homeId\` INTEGER NOT NULL,
    \`deviceId\` INTEGER NOT NULL,
    \`userId\` INTEGER NOT NULL,
    \`date\` DATE NOT NULL,
    \`on_minutes\` INTEGER NOT NULL,
    \`updated_at\` DATETIME(3) NOT NULL,
    INDEX \`device_usage_homeId_idx\`(\`homeId\`),
    UNIQUE INDEX \`device_usage_deviceId_userId_date_key\`(\`deviceId\`, \`userId\`, \`date\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`invitations\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`homeId\` INTEGER NOT NULL,
    \`email\` VARCHAR(100) NOT NULL,
    \`inviteCode\` VARCHAR(12) NOT NULL,
    \`role\` ENUM('owner', 'admin', 'member', 'viewer') NOT NULL DEFAULT 'member',
    \`status\` ENUM('pending', 'accepted', 'expired', 'revoked') NOT NULL DEFAULT 'pending',
    \`expiresAt\` DATETIME(3) NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`accepted_at\` DATETIME(3) NULL,
    UNIQUE INDEX \`invitations_inviteCode_key\`(\`inviteCode\`),
    INDEX \`invitations_homeId_idx\`(\`homeId\`),
    INDEX \`invitations_status_idx\`(\`status\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`rooms\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`homeId\` INTEGER NOT NULL,
    \`name\` VARCHAR(100) NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`rooms_homeId_name_key\`(\`homeId\`, \`name\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`devices\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`homeId\` INTEGER NOT NULL,
    \`roomId\` INTEGER NULL,
    \`name\` VARCHAR(100) NOT NULL,
    \`type\` ENUM('bulb', 'fan', 'ac', 'tv', 'plug', 'dimmer', 'custom') NOT NULL,
    \`status\` ENUM('on', 'off') NOT NULL DEFAULT 'off',
    \`custom_value\` VARCHAR(255) NULL,
    \`serial_number\` VARCHAR(64) NULL,
    \`firmware_version\` VARCHAR(32) NULL,
    \`ip_address\` VARCHAR(45) NULL,
    \`last_seen\` DATETIME(3) NULL,
    \`offline\` BOOLEAN NOT NULL DEFAULT false,
    \`ota_pending_version\` VARCHAR(32) NULL,
    \`ota_requested_at\` DATETIME(3) NULL,
    \`ota_progress\` INTEGER NULL,
    \`ota_status\` VARCHAR(32) NULL,
    \`espId\` INTEGER NULL,
    \`createdBy\` INTEGER NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`last_updated\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`devices_serial_number_key\`(\`serial_number\`),
    INDEX \`devices_homeId_idx\`(\`homeId\`),
    INDEX \`devices_roomId_idx\`(\`roomId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`esp_devices\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`homeId\` INTEGER NOT NULL,
    \`macAddress\` VARCHAR(32) NOT NULL,
    \`name\` VARCHAR(64) NULL,
    \`ssid\` VARCHAR(64) NULL,
    \`serial_code\` VARCHAR(32) NULL,
    \`model_code\` VARCHAR(16) NULL,
    \`ip_address\` VARCHAR(45) NULL,
    \`firmware_version\` VARCHAR(32) NULL,
    \`last_seen\` DATETIME(3) NULL,
    \`offline\` BOOLEAN NOT NULL DEFAULT false,
    \`ota_pending_version\` VARCHAR(32) NULL,
    \`ota_requested_at\` DATETIME(3) NULL,
    \`ota_progress\` INTEGER NULL,
    \`ota_status\` VARCHAR(32) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`esp_devices_macAddress_key\`(\`macAddress\`),
    UNIQUE INDEX \`esp_devices_serial_code_key\`(\`serial_code\`),
    INDEX \`esp_devices_homeId_idx\`(\`homeId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`device_configurations\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`deviceId\` INTEGER NOT NULL,
    \`config_name\` VARCHAR(255) NOT NULL,
    \`config_value\` TEXT NULL,
    UNIQUE INDEX \`device_configurations_deviceId_config_name_key\`(\`deviceId\`, \`config_name\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`device_logs\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`deviceId\` INTEGER NOT NULL,
    \`actorId\` INTEGER NULL,
    \`log_type\` VARCHAR(255) NOT NULL,
    \`log_message\` TEXT NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`device_logs_deviceId_idx\`(\`deviceId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`device_commands\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`deviceId\` INTEGER NOT NULL,
    \`actorId\` INTEGER NULL,
    \`command\` VARCHAR(255) NOT NULL,
    \`status\` ENUM('pending', 'executed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`executed_at\` DATETIME(3) NULL,
    INDEX \`device_commands_deviceId_status_idx\`(\`deviceId\`, \`status\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`schedules\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`deviceId\` INTEGER NOT NULL,
    \`createdBy\` INTEGER NOT NULL,
    \`action\` ENUM('on', 'off') NOT NULL,
    \`type\` ENUM('once', 'daily', 'weekly', 'cron') NOT NULL,
    \`run_at\` DATETIME(3) NULL,
    \`cron\` VARCHAR(100) NULL,
    \`enabled\` BOOLEAN NOT NULL DEFAULT true,
    \`next_run\` DATETIME(3) NULL,
    \`last_run\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`schedules_deviceId_idx\`(\`deviceId\`),
    INDEX \`schedules_enabled_next_run_idx\`(\`enabled\`, \`next_run\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`api_keys\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NOT NULL,
    \`homeId\` INTEGER NULL,
    \`label\` VARCHAR(100) NULL,
    \`key_hash\` VARCHAR(64) NOT NULL,
    \`key_prefix\` VARCHAR(8) NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`expires_at\` DATETIME(3) NULL,
    \`last_used_at\` DATETIME(3) NULL,
    \`revoked_at\` DATETIME(3) NULL,
    UNIQUE INDEX \`api_keys_key_hash_key\`(\`key_hash\`),
    INDEX \`api_keys_userId_idx\`(\`userId\`),
    INDEX \`api_keys_homeId_idx\`(\`homeId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`refresh_tokens\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NOT NULL,
    \`token_hash\` VARCHAR(64) NOT NULL,
    \`expires_at\` DATETIME(3) NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`revoked_at\` DATETIME(3) NULL,
    UNIQUE INDEX \`refresh_tokens_token_hash_key\`(\`token_hash\`),
    INDEX \`refresh_tokens_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`password_reset_tokens\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NOT NULL,
    \`token_hash\` VARCHAR(64) NOT NULL,
    \`expires_at\` DATETIME(3) NOT NULL,
    \`used_at\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`password_reset_tokens_token_hash_key\`(\`token_hash\`),
    INDEX \`password_reset_tokens_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`notifications\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NOT NULL,
    \`category\` VARCHAR(20) NOT NULL DEFAULT 'system',
    \`type\` ENUM('info', 'warning', 'error') NOT NULL DEFAULT 'info',
    \`title\` VARCHAR(255) NOT NULL,
    \`body\` TEXT NULL,
    \`read_at\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`notifications_userId_read_at_idx\`(\`userId\`, \`read_at\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`audit_logs\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`actorId\` INTEGER NULL,
    \`homeId\` INTEGER NULL,
    \`action\` VARCHAR(100) NOT NULL,
    \`entity\` VARCHAR(100) NULL,
    \`entityId\` INTEGER NULL,
    \`meta\` JSON NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`audit_logs_homeId_idx\`(\`homeId\`),
    INDEX \`audit_logs_actorId_idx\`(\`actorId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`firmware_versions\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`version\` VARCHAR(32) NOT NULL,
    \`url\` VARCHAR(255) NOT NULL,
    \`release_notes\` TEXT NULL,
    \`model_code\` VARCHAR(16) NOT NULL DEFAULT '',
    \`is_current\` BOOLEAN NOT NULL DEFAULT false,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`firmware_versions_version_model_code_key\`(\`version\`, \`model_code\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`products\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`name\` VARCHAR(100) NOT NULL,
    \`modelCode\` VARCHAR(32) NOT NULL,
    \`relayCount\` INTEGER NOT NULL DEFAULT 4,
    \`price\` DECIMAL(10, 2) NOT NULL,
    \`description\` TEXT NULL,
    \`features\` JSON NULL,
    \`imageUrl\` VARCHAR(255) NULL,
    \`active\` BOOLEAN NOT NULL DEFAULT true,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`products_modelCode_key\`(\`modelCode\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`orders\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`orderNumber\` VARCHAR(32) NOT NULL,
    \`userId\` INTEGER NOT NULL,
    \`status\` ENUM('pending', 'paid', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
    \`paymentMethod\` ENUM('cod', 'upi', 'manual') NOT NULL DEFAULT 'manual',
    \`paymentStatus\` VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    \`payment_ref\` VARCHAR(64) NULL,
    \`razorpay_order_id\` VARCHAR(64) NULL,
    \`paid_at\` DATETIME(3) NULL,
    \`totalAmount\` DECIMAL(10, 2) NOT NULL,
    \`shippingName\` VARCHAR(100) NOT NULL,
    \`shippingPhone\` VARCHAR(20) NOT NULL,
    \`shippingAddress\` VARCHAR(255) NOT NULL,
    \`wifiSsid\` VARCHAR(64) NULL,
    \`wifi_password_enc\` TEXT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`orders_orderNumber_key\`(\`orderNumber\`),
    INDEX \`orders_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`order_items\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`orderId\` INTEGER NOT NULL,
    \`productId\` INTEGER NOT NULL,
    \`productName\` VARCHAR(100) NOT NULL,
    \`price\` DECIMAL(10, 2) NOT NULL,
    \`quantity\` INTEGER NOT NULL DEFAULT 1,
    \`serialCode\` VARCHAR(32) NULL,
    INDEX \`order_items_orderId_idx\`(\`orderId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`serial_registry\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`serialCode\` VARCHAR(32) NOT NULL,
    \`productId\` INTEGER NOT NULL,
    \`orderId\` INTEGER NULL,
    \`userId\` INTEGER NULL,
    \`homeId\` INTEGER NULL,
    \`status\` ENUM('available', 'reserved', 'shipped', 'delivered', 'claimed') NOT NULL DEFAULT 'available',
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`claimed_at\` DATETIME(3) NULL,
    \`tested_at\` DATETIME(3) NULL,
    \`warranty_expires_at\` DATETIME(3) NULL,
    \`warranty_status\` VARCHAR(20) NOT NULL DEFAULT 'active',
    UNIQUE INDEX \`serial_registry_serialCode_key\`(\`serialCode\`),
    INDEX \`serial_registry_productId_idx\`(\`productId\`),
    INDEX \`serial_registry_status_idx\`(\`status\`),
    INDEX \`serial_registry_orderId_idx\`(\`orderId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`warranty_claims\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`serialCode\` VARCHAR(32) NOT NULL,
    \`deviceId\` INTEGER NULL,
    \`userId\` INTEGER NOT NULL,
    \`reason\` VARCHAR(255) NOT NULL,
    \`description\` TEXT NULL,
    \`status\` ENUM('submitted', 'approved', 'rejected', 'resolved') NOT NULL DEFAULT 'submitted',
    \`admin_notes\` TEXT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL,
    INDEX \`warranty_claims_userId_idx\`(\`userId\`),
    INDEX \`warranty_claims_serialCode_idx\`(\`serialCode\`),
    INDEX \`warranty_claims_status_idx\`(\`status\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`contact_messages\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NULL,
    \`name\` VARCHAR(100) NOT NULL,
    \`email\` VARCHAR(120) NULL,
    \`phone\` VARCHAR(20) NULL,
    \`subject\` VARCHAR(150) NOT NULL,
    \`message\` TEXT NOT NULL,
    \`status\` VARCHAR(20) NOT NULL DEFAULT 'new',
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`contact_messages_status_idx\`(\`status\`),
    INDEX \`contact_messages_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`support_messages\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NOT NULL,
    \`senderRole\` VARCHAR(10) NOT NULL DEFAULT 'admin',
    \`senderName\` VARCHAR(100) NOT NULL,
    \`message\` TEXT NOT NULL,
    \`attachment_name\` VARCHAR(255) NULL,
    \`attachment_type\` VARCHAR(100) NULL,
    \`attachment_data\` MEDIUMTEXT NULL,
    \`attachment_path\` VARCHAR(255) NULL,
    \`read_by_user\` BOOLEAN NOT NULL DEFAULT false,
    \`read_by_admin\` BOOLEAN NOT NULL DEFAULT true,
    \`deleted_at\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`support_messages_userId_created_at_idx\`(\`userId\`, \`created_at\`),
    INDEX \`support_messages_read_by_admin_idx\`(\`read_by_admin\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`support_chat_settings\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NOT NULL,
    \`peer_user_id\` INTEGER NOT NULL,
    \`muted_at\` DATETIME(3) NULL,
    \`pinned_at\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL,
    INDEX \`support_chat_settings_userId_idx\`(\`userId\`),
    UNIQUE INDEX \`support_chat_settings_userId_peer_user_id_key\`(\`userId\`, \`peer_user_id\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`app_meta\` (
    \`key\` VARCHAR(64) NOT NULL,
    \`value\` TEXT NOT NULL,
    \`updated_at\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`key\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`;
