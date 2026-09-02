import { Router } from "express";
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { resetPrismaClient } from "../lib/prisma";
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

/** Saari tables banao — schema.sql (Prisma schema se generate kiya hua). */
async function applySchema(parts: DbParts): Promise<void> {
  if (!fs.existsSync(SCHEMA_SQL)) {
    throw new AppError("SCHEMA_MISSING", "prisma/schema.sql nahi mila — install package incomplete hai", 500);
  }
  const schemaSql = fs.readFileSync(SCHEMA_SQL, "utf-8");
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
    throw new AppError(
      "SCHEMA_FAILED",
      `Tables create nahi hui: ${msg}. Database khali (fresh) hona chahiye — purana data ho to factory reset karo ya naya DB use karo.`,
      500,
    );
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
 * Naye DB pe prisma switch + services start + .env persist — sab ek saath.
 */
async function completeInstall(parts: DbParts, admin: AdminInput) {
  // 3) Prisma ko naye DB se connect karo — ab normal app chalta hai
  const nextUrl = buildDatabaseUrl(parts);
  const prisma = await resetPrismaClient(nextUrl);

  // 4) Default admin + home + installed flag (signup flow jaisa hi)
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: admin.username }, { email: admin.email }] },
  });
  if (existing) {
    throw new AppError("ADMIN_EXISTS", "Username/email pehle se exist karta hai", 409);
  }

  const password = await bcrypt.hash(admin.password, 10);
  const homeName = `${(admin.name || admin.username).trim()}${admin.name ? "" : "'s"} Home`;
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { username: admin.username, email: admin.email, password, role: "system_admin" },
    });
    await tx.home.create({
      data: {
        name: homeName,
        ownerId: user.id,
        members: { create: { userId: user.id, role: "owner" } },
      },
    });
    for (const p of DEFAULT_PRODUCTS) {
      await tx.product.upsert({
        where: { modelCode: p.modelCode },
        create: {
          name: p.name,
          modelCode: p.modelCode,
          relayCount: p.relayCount,
          price: p.price,
          description: p.description,
          features: p.features,
        },
        update: {},
      });
    }
    await tx.appMeta.upsert({
      where: { key: "installed" },
      create: { key: "installed", value: "1" },
      update: { value: "1" },
    });
  });

  setDbReady(true);

  // Services jo normal mode me chalti hain — install ke turant baad start
  // karo taaki restart ka intezaar na karna pade (fresh install me index.ts
  // ne setup mode ki wajah se skip kar diya tha).
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

  // 5) Config persist — restart ke baad bhi yehi DB chale
  const persisted = persistDatabaseConfig(parts);

  // 5b) Admin password bhi .env me sync — taki install fallback / seed /
  //     docs (ADMIN_PASSWORD) har jagah DB se same value rahe.
  persistEnvKey("ADMIN_PASSWORD", admin.password);

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
    const parts = parseDatabaseUrl(env.DATABASE_URL || "");
    const probe = await probeDb(parts);

    ok(res, {
      installed: probe.installed,
      dbReachable: probe.reachable,
      tablesReady: probe.tablesReady,
      dbConfigured: Boolean(env.DATABASE_URL),
      db: {
        host: parts.host || "localhost",
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
      db: { host: "localhost", port: 3306, user: "root", name: "switchnest" },
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
