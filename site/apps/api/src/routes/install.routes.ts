import { Router } from "express";
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { resetPrismaClient } from "../lib/prisma";
import { setDbReady, isDbReady } from "../lib/dbState";
import { ok } from "../lib/response";
import { AppError } from "../lib/response";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL = path.resolve(__dirname, "../../prisma/schema.sql");

export const installRouter = Router();

/** Fresh install pe shop ke liye default product catalog (seed.ts jaisa). */
const DEFAULT_PRODUCTS = [
  { name: "2CH WiFi Relay Module", modelCode: "2CH", relayCount: 2, price: "599", description: "Two-channel WiFi relay board for lights and small appliances. 10A per channel, ESP32 based, works with the RoboSphere app and voice assistant.", features: { channels: 2, wifi: true, ota: true, voice: true } },
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
    // users table hai = data pehle se hai = installed. app_meta flag sirf
    // confirmation hai — purane installs (bina app_meta table ke) bhi
    // installed hi maane jaate hain.
    let installed = hasUsers;
    if (hasUsers) {
      try {
        const [meta] = await conn.query("SELECT value FROM app_meta WHERE `key` = 'installed' LIMIT 1");
        const flag = (meta as Array<{ value: string }>)[0]?.value;
        if (flag !== undefined) installed = flag === "1";
      } catch {
        // app_meta table abhi bani nahi — users table hi kaafi hai
      }
    }
    return { reachable: true, tablesReady: hasUsers, installed };
  } catch {
    return { reachable: true, tablesReady: false, installed: false };
  } finally {
    await conn.end().catch(() => undefined);
  }
}

/** Install ka status — web wizard isse poll karta hai. */
installRouter.get("/status", async (_req, res) => {
  const parts = parseDatabaseUrl(env.DATABASE_URL);
  const probe = await probeDb(parts);

  ok(res, {
    installed: probe.installed,
    dbReachable: probe.reachable,
    tablesReady: probe.tablesReady,
    dbConfigured: Boolean(env.DATABASE_URL),
    // Wizard me pre-fill karne ke liye (password kabhi wapas nahi bhejte)
    db: {
      host: parts.host,
      port: parts.port,
      user: parts.user,
      name: parts.name,
    },
    admin: {
      username: env.ADMIN_USERNAME,
      email: env.ADMIN_EMAIL,
      // password only hint — kya set hoga, value nahi
      passwordSet: Boolean(env.ADMIN_PASSWORD),
    },
  });
});

/**
 * First-run install:
 *   1. DB create (agar nahi hai)  2. saari tables (schema.sql)
 *   3. default admin + home       4. app_meta installed=1
 *   5. Prisma naye DB se connect  6. server turant normal mode
 */
installRouter.post("/", async (req, res) => {
  if (isDbReady()) {
    throw new AppError("ALREADY_INSTALLED", "Database already installed and connected", 409);
  }

  const bodyDb = (req.body?.db ?? {}) as Partial<DbParts>;
  const bodyAdmin = (req.body?.admin ?? {}) as { username?: string; email?: string; password?: string };

  const base = parseDatabaseUrl(env.DATABASE_URL);
  const parts: DbParts = {
    host: (bodyDb.host ?? base.host).trim(),
    port: Number(bodyDb.port ?? base.port) || 3306,
    user: (bodyDb.user ?? base.user).trim(),
    pass: bodyDb.pass ?? base.pass,
    name: (bodyDb.name ?? base.name).trim(),
  };

  if (!parts.host || !parts.name || !parts.user) {
    throw new AppError("BAD_REQUEST", "DB host, user aur name required hain", 400);
  }

  const admin = {
    username: (bodyAdmin.username ?? env.ADMIN_USERNAME).trim(),
    email: (bodyAdmin.email ?? env.ADMIN_EMAIL).trim().toLowerCase(),
    password: bodyAdmin.password ?? env.ADMIN_PASSWORD,
  };
  if (!admin.username || !admin.email || !admin.password) {
    throw new AppError("BAD_REQUEST", "Admin username, email aur password required hain", 400);
  }

  const dbName = escIdent(parts.name);

  // 1) Server se connect karke database banao (bina db select kiye)
  let server: mysql.Connection;
  try {
    server = await mysql.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.pass,
      connectTimeout: 8000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError(
      "DB_CONNECT_FAILED",
      `Database server se connect nahi ho paya: ${msg}`,
      502,
    );
  }

  try {
    await server.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await server.end().catch(() => undefined);
  }

  // 2) Tables — schema.sql (Prisma schema se generate kiya hua)
  if (!fs.existsSync(SCHEMA_SQL)) {
    throw new AppError(
      "SCHEMA_MISSING",
      "prisma/schema.sql nahi mila — install package incomplete hai",
      500,
    );
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
    throw new AppError("SCHEMA_FAILED", `Tables create nahi hui: ${msg}`, 500);
  } finally {
    await conn.end().catch(() => undefined);
  }

  // 3) Prisma ko naye DB se connect karo — ab normal app chalta hai
  const nextUrl = buildDatabaseUrl(parts);
  const prisma = await resetPrismaClient(nextUrl);

  // 4) Default admin + home + installed flag (signup flow jaisa hi)
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: admin.username }, { email: admin.email }] },
  });
  if (existing) {
    throw new AppError("ADMIN_EXISTS", "Usernam/email pehle se exist karta hai", 409);
  }

  const password = await bcrypt.hash(admin.password, 10);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { username: admin.username, email: admin.email, password, role: "system_admin" },
    });
    await tx.home.create({
      data: {
        name: `${admin.username}'s Home`,
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

  ok(res, {
    installed: true,
    database: parts.name,
    admin: admin.username,
    message: "RoboSphere installed — site ab normal chal raha hai",
  });
});
