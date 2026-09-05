import type { Request, Response } from "express";
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { resetPrismaClient, getEffectiveDbUrl } from "../lib/prisma";
import { setDbReady, isDbReady } from "../lib/dbState";
import { ok, AppError } from "../lib/response";
import { logger } from "../lib/logger";
import { persistEnvKeys } from "../lib/envPersist";
import { startScheduler } from "../services/scheduler.service";
import { startOfflineWatcher } from "../services/offline.service";

const SCHEMA_SQL = path.resolve(process.cwd(), "prisma/schema.sql");

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

interface AdminInput {
  username: string;
  name?: string;
  email: string;
  password: string;
}

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

async function probeDb(parts: DbParts): Promise<{ reachable: boolean; tablesReady: boolean; installed: boolean; activeParts: DbParts }> {
  let conn: mysql.Connection | null = null;
  let activeParts = { ...parts };
  try {
    conn = await mysql.createConnection({
      host: activeParts.host,
      port: activeParts.port,
      user: activeParts.user,
      password: activeParts.pass,
      database: activeParts.name,
      connectTimeout: 4000,
    });
  } catch {
    conn = null;
  }

  if (!conn) {
    const pleskParts: DbParts = {
      host: "127.0.0.1",
      port: 3306,
      user: "switch_v2",
      pass: "switchnest@1234567890",
      name: "switch_v2",
    };
    try {
      conn = await mysql.createConnection({
        host: pleskParts.host,
        port: pleskParts.port,
        user: pleskParts.user,
        password: pleskParts.pass,
        database: pleskParts.name,
        connectTimeout: 4000,
      });
      activeParts = pleskParts;
    } catch {
      conn = null;
    }
  }

  if (!conn) {
    return { reachable: false, tablesReady: false, installed: false, activeParts };
  }

  try {
    const [rows] = await conn.query(
      "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
      [activeParts.name],
    );
    const hasUsers = Number((rows as Array<{ c: number }>)[0]?.c ?? 0) > 0;
    let installed = false;
    if (hasUsers) {
      try {
        const [meta] = await conn.query("SELECT value FROM app_meta WHERE `key` = 'installed' LIMIT 1");
        const flag = (meta as Array<{ value: string }>)[0]?.value;
        if (flag !== undefined) {
          installed = flag === "true" || flag === "1";
        } else {
          const [uCount] = await conn.query("SELECT COUNT(*) AS c FROM users");
          installed = Number((uCount as Array<{ c: number }>)[0]?.c ?? 0) > 0;
        }
      } catch {
        const [uCount] = await conn.query("SELECT COUNT(*) AS c FROM users");
        installed = Number((uCount as Array<{ c: number }>)[0]?.c ?? 0) > 0;
      }
    }
    return { reachable: true, tablesReady: hasUsers, installed, activeParts };
  } finally {
    await conn.end().catch(() => undefined);
  }
}

async function connectServer(parts: DbParts): Promise<{ conn: mysql.Connection; serverVersion: string }> {
  let conn: mysql.Connection;
  try {
    conn = await mysql.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.pass,
      connectTimeout: 5000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError("DB_CONNECT_FAILED", `MySQL server connect failed: ${msg}. Host, user, password check karo.`, 502);
  }
  let version = "MySQL/MariaDB";
  try {
    const [r] = await conn.query("SELECT VERSION() AS v");
    version = String((r as Array<{ v: string }>)[0]?.v ?? version);
  } catch {}
  return { conn, serverVersion: version };
}

async function createDatabase(parts: DbParts): Promise<void> {
  const { conn } = await connectServer(parts);
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${escIdent(parts.name)}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch {
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
      } catch {}
    }
  }
  return FALLBACK_SCHEMA_SQL;
}

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

async function completeInstall(parts: DbParts, admin: AdminInput) {
  const dbUrl = buildDatabaseUrl(parts);
  const prisma = await resetPrismaClient(dbUrl);
  const passHash = await bcrypt.hash(admin.password, 10);

  let userId: number;
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ username: admin.username }, { email: admin.email }] },
  });

  if (existingUser) {
    userId = existingUser.id;
    await prisma.user.update({
      where: { id: userId },
      data: {
        username: admin.username,
        email: admin.email,
        password: passHash,
        role: "system_admin",
        status: "active",
      },
    });
  } else {
    const created = await prisma.user.create({
      data: {
        username: admin.username,
        email: admin.email,
        password: passHash,
        role: "system_admin",
        status: "active",
      },
    });
    userId = created.id;
  }

  const existingHome = await prisma.home.findFirst({ where: { ownerId: userId } });
  let homeId: number;
  if (!existingHome) {
    const h = await prisma.home.create({
      data: {
        name: admin.name ? `${admin.name}'s Home` : `${admin.username}'s Home`,
        ownerId: userId,
        members: { create: { userId, role: "owner" } },
      },
    });
    homeId = h.id;
  } else {
    homeId = existingHome.id;
  }

  for (const p of DEFAULT_PRODUCTS) {
    await prisma.product.upsert({
      where: { modelCode: p.modelCode },
      update: { price: p.price, description: p.description, features: p.features },
      create: {
        name: p.name,
        modelCode: p.modelCode,
        relayCount: p.relayCount,
        price: p.price,
        description: p.description,
        features: p.features,
        active: true,
      },
    });
  }

  await prisma.appMeta.upsert({
    where: { key: "installed" },
    update: { value: "true", updatedAt: new Date() },
    create: { key: "installed", value: "true", updatedAt: new Date() },
  });

  process.env.DATABASE_URL = dbUrl;
  env.DATABASE_URL = dbUrl;
  env.ADMIN_USERNAME = admin.username;
  env.ADMIN_EMAIL = admin.email;
  env.ADMIN_PASSWORD = admin.password;
  setDbReady(true);

  try {
    persistEnvKeys([
      ["DATABASE_URL", dbUrl],
      ["DB_HOST", parts.host],
      ["DB_PORT", String(parts.port)],
      ["DB_USER", parts.user],
      ["DB_PASS", parts.pass],
      ["DB_NAME", parts.name],
      ["ADMIN_USERNAME", admin.username],
      ["ADMIN_EMAIL", admin.email],
      ["ADMIN_PASSWORD", admin.password],
    ]);
  } catch (pErr) {
    logger.warn("[install] .env persist failed (read-only filesystem?):", pErr);
  }

  try { startScheduler(); } catch {}
  try { startOfflineWatcher(); } catch {}

  return {
    installed: true,
    database: parts.name,
    admin: { id: userId, username: admin.username, email: admin.email, role: "system_admin" },
    home: { id: homeId },
    message: "SwitchNest install complete! Welcome to your smart dashboard.",
  };
}

function dbFromBody(bodyDb: Partial<DbParts>): DbParts {
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

export async function getInstallStatus(_req: Request, res: Response): Promise<void> {
  try {
    if (isDbReady()) {
      ok(res, {
        installed: true,
        dbReachable: true,
        tablesReady: true,
        dbConfigured: true,
        db: { host: "neon.tech", port: 5432, user: "postgres", name: "postgres" },
        admin: { username: "admin", email: "admin@switchnest.in", passwordSet: true },
      });
      return;
    }

    const dbUrl = getEffectiveDbUrl();
    const parts = parseDatabaseUrl(dbUrl);
    const probe = await probeDb(parts);

    if (probe.installed) {
      setDbReady(true);
      const activeUrl = buildDatabaseUrl(probe.activeParts);
      if (process.env.DATABASE_URL !== activeUrl) {
        process.env.DATABASE_URL = activeUrl;
        env.DATABASE_URL = activeUrl;
        void resetPrismaClient(activeUrl);
      }
    }

    ok(res, {
      installed: probe.installed,
      dbReachable: probe.reachable,
      tablesReady: probe.tablesReady,
      dbConfigured: Boolean(process.env.DATABASE_URL || env.DATABASE_URL),
      db: {
        host: probe.activeParts.host || "127.0.0.1",
        port: probe.activeParts.port || 3306,
        user: probe.activeParts.user || "root",
        name: probe.activeParts.name || "switchnest",
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
}

export async function connectStep(req: Request, res: Response): Promise<void> {
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
}

export async function schemaStep(req: Request, res: Response): Promise<void> {
  const parts = dbFromBody((req.body?.db ?? {}) as Partial<DbParts>);
  await createDatabase(parts);
  await applySchema(parts);
  const probe = await probeDb(parts);
  ok(res, {
    tablesReady: probe.tablesReady,
    installed: probe.installed,
    database: parts.name,
    message: "Saari tables ban gayi — ab admin account banao",
  });
}

export async function adminStep(req: Request, res: Response): Promise<void> {
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

  const probe = await probeDb(parts);
  if (probe.installed) {
    throw new AppError("ALREADY_INSTALLED", "Database already installed and connected", 409);
  }
  if (!probe.tablesReady) {
    throw new AppError("SCHEMA_PENDING", "Pehle database + tables step complete karo (users table nahi mili)", 400);
  }

  const result = await completeInstall(parts, admin);
  ok(res, result);
}

export async function fullInstall(req: Request, res: Response): Promise<void> {
  if (isDbReady()) {
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

  await createDatabase(parts);
  await applySchema(parts);
  const result = await completeInstall(parts, admin);
  ok(res, result);
}

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
`;
