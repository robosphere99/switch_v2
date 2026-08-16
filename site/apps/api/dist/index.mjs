var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
function withConnLimit(url, limit = 2) {
  try {
    const u = new URL(url);
    u.searchParams.set("connection_limit", String(limit));
    return u.toString();
  } catch {
    return url;
  }
}
async function resetPrismaClient(databaseUrl) {
  try {
    await prisma.$disconnect();
  } catch {
  }
  process.env.DATABASE_URL = withConnLimit(databaseUrl);
  const next = new PrismaClient();
  await next.$connect();
  prisma = next;
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = next;
  return next;
}
var globalForPrisma, prisma;
var init_prisma = __esm({
  "src/lib/prisma.ts"() {
    "use strict";
    globalForPrisma = globalThis;
    prisma = globalForPrisma.prisma ?? new PrismaClient({
      datasources: { db: { url: withConnLimit(process.env.DATABASE_URL ?? "") } }
    });
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
  }
});

// src/services/audit.service.ts
var audit_service_exports = {};
__export(audit_service_exports, {
  audit: () => audit
});
async function audit(actorId, action, opts = {}) {
  try {
    const data = {
      actorId,
      homeId: opts.homeId ?? null,
      action,
      entity: opts.entity ?? null,
      entityId: opts.entityId ?? null
    };
    if (opts.meta) data.meta = opts.meta;
    await prisma.auditLog.create({ data });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}
var init_audit_service = __esm({
  "src/services/audit.service.ts"() {
    "use strict";
    init_prisma();
  }
});

// src/services/firmware.service.ts
var firmware_service_exports = {};
__export(firmware_service_exports, {
  MODEL_CODES: () => MODEL_CODES,
  resolveFirmware: () => resolveFirmware
});
async function resolveFirmware(modelCode) {
  const model = (modelCode ?? "").trim().toUpperCase();
  return prisma.firmwareVersion.findFirst({
    where: {
      isCurrent: true,
      OR: model ? [{ modelCode: model }, { modelCode: "" }] : [{ modelCode: "" }]
    },
    orderBy: { modelCode: "desc" }
    // "" sabse chhota -> model-specific wins
  });
}
var MODEL_CODES;
var init_firmware_service = __esm({
  "src/services/firmware.service.ts"() {
    "use strict";
    init_prisma();
    MODEL_CODES = ["2CH", "4CH", "5CH", "6CH", "8CH", "4CH-IR", "FAN-DIM", "DIM-3S", "DIM-4S"];
  }
});

// src/index.ts
import { createServer } from "http";

// src/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path7 from "node:path";
import fs6 from "node:fs";

// src/config/env.ts
import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST ?? "localhost";
  const port = process.env.DB_PORT ?? "3306";
  const user = process.env.DB_USER ?? "root";
  const pass = process.env.DB_PASS ?? "";
  const name = process.env.DB_NAME ?? "switch_v2";
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${name}?connection_limit=2`;
}
var envSchema = z.object({
  // Empty DATABASE_URL diya ho to ignore karke DB_* vars use hote hain
  DATABASE_URL: z.preprocess(
    (v) => typeof v === "string" && v.trim() ? v : void 0,
    z.string().default(buildDatabaseUrl)
  ),
  JWT_ACCESS_SECRET: z.string().default("dev-access-secret"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret"),
  JWT_ACCESS_EXPIRES: z.string().default("15m"),
  JWT_REFRESH_EXPIRES: z.string().default("7d"),
  // Plesk/Paas PORT env var ko respect karta hai (Plesk nginx app ko assigned
  // port pe proxy karta hai); nahi diya to 4000.
  API_PORT: z.coerce.number().default(Number(process.env.PORT) || 4e3),
  API_HOST: z.string().default("0.0.0.0"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  WIFI_ENC_KEY: z.string().default("switchnest-dev-wifi-key-change-me"),
  // Payment gateway (optional) — nahi diya to demo/manual mode chalta hai
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  UPI_ID: z.string().optional().default("switchnest@upi"),
  // First-run admin (install route) — hosting pe yahan se set hota hai
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_EMAIL: z.string().default("admin@switchnest.local"),
  ADMIN_PASSWORD: z.string().default("admin123"),
  // Install ko lock karne ke liye (installed flag ke saath match karta hai)
  INSTALL_TOKEN: z.string().optional().default("")
});
var parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("\u26A0\uFE0F Invalid environment variables \u2014 defaults use kar rahe hain:", parsed.error.flatten().fieldErrors);
}
var env = parsed.success ? parsed.data : envSchema.parse({});
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
var corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim());

// src/middleware/errorHandler.ts
import { ZodError } from "zod";

// src/lib/response.ts
function ok(res, data, status = 200) {
  const body = { success: true, data };
  res.status(status).json(body);
}
function fail(res, code, message, status = 400, details) {
  const body = { success: false, error: { code, message, details } };
  res.status(status).json(body);
}
var AppError = class extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
  code;
  status;
  details;
};

// src/lib/logger.ts
import * as fs from "fs";
import * as path2 from "path";
import * as os from "os";
var logFilePath = (() => {
  const candidates = [
    path2.resolve(process.cwd(), "../logs"),
    // site/apps/logs — iisnode yahi likhta hai (writable)
    path2.resolve(process.cwd(), "logs"),
    // site/apps/api/logs
    path2.join(os.tmpdir(), "switchnest-logs")
  ];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return path2.join(dir, "app.log");
    } catch {
      continue;
    }
  }
  return null;
})();
function fileLog(line) {
  if (!logFilePath) return;
  try {
    fs.appendFileSync(logFilePath, line.endsWith("\n") ? line : line + "\n");
  } catch {
  }
}
var ORDER = { debug: 0, info: 1, warn: 2, error: 3 };
function log(level, msg, meta) {
  if (ORDER[level] < ORDER[env.LOG_LEVEL]) return;
  const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] [${level.toUpperCase()}] ${msg}`;
  if (meta !== void 0) {
    const suffix = typeof meta === "string" ? meta : JSON.stringify(meta);
    fileLog(`${line} ${suffix}`);
    if (level === "error") console.error(line, suffix);
    else console.log(line, suffix);
  } else {
    fileLog(line);
    if (level === "error") console.error(line);
    else console.log(line);
  }
}
var logger = {
  debug: (msg, meta) => log("debug", msg, meta),
  info: (msg, meta) => log("info", msg, meta),
  warn: (msg, meta) => log("warn", msg, meta),
  error: (msg, meta) => log("error", msg, meta)
};

// src/middleware/errorHandler.ts
var errorHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return fail(res, "VALIDATION_ERROR", "Invalid input", 400, err.flatten());
  }
  if (err instanceof AppError) {
    return fail(res, err.code, err.message, err.status, err.details);
  }
  logger.error("Unhandled error", err instanceof Error ? err.stack : err);
  return fail(res, "INTERNAL_ERROR", "Internal server error", 500);
};

// src/lib/paths.ts
import * as fs2 from "fs";
import * as path3 from "path";
function findRepoRoot(start) {
  let dir = path3.resolve(start);
  for (let i = 0; i < 8; i++) {
    if (fs2.existsSync(path3.join(dir, "hardware"))) return dir;
    const parent = path3.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
var repoRoot = findRepoRoot(process.cwd());
var firmwareDir = repoRoot ? path3.join(repoRoot, "hardware", "firmware") : path3.resolve(process.cwd(), "../../../hardware/firmware");
var attachmentDir = repoRoot ? path3.join(repoRoot, "hardware", "attachments") : path3.resolve(process.cwd(), "../../../hardware/attachments");
var webDist = repoRoot ? path3.join(repoRoot, "site", "apps", "web", "dist") : path3.resolve(process.cwd(), "../../apps/web/dist");

// src/routes/index.ts
import { Router as Router17 } from "express";

// src/routes/auth.routes.ts
import { Router } from "express";
import { z as z2 } from "zod";

// src/controllers/auth.controller.ts
init_prisma();

// src/services/auth.service.ts
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
init_prisma();
function toAuthUser(user) {
  return { id: user.id, username: user.username, email: user.email, role: user.role, themePref: user.themePref };
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      ver: user.tokenVersion,
      jti: crypto.randomUUID()
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES }
  );
}
function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, ver: user.tokenVersion, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES
  });
}
async function signup(input) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: input.username }, { email: input.email }] }
  });
  if (existing) {
    throw new AppError("EMAIL_OR_USERNAME_TAKEN", "Username or email already exists", 409);
  }
  const password = await bcrypt.hash(input.password, 10);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username: input.username,
        email: input.email,
        password
      }
    });
    await tx.home.create({
      data: {
        name: input.homeName?.trim() || `${input.username}'s Home`,
        ownerId: created.id,
        members: {
          create: { userId: created.id, role: "owner" }
        }
      }
    });
    return created;
  });
  return issueTokens(user);
}
async function updateProfile(userId, input) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("USER_NOT_FOUND", "User not found", 404);
  const data = {};
  if (input.username && input.username !== user.username) {
    const taken = await prisma.user.findUnique({ where: { username: input.username } });
    if (taken) throw new AppError("USERNAME_TAKEN", "Username already taken", 409);
    data.username = input.username;
  }
  if (input.email && input.email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email: input.email } });
    if (taken) throw new AppError("EMAIL_TAKEN", "Email already taken", 409);
    data.email = input.email;
  }
  if (input.newPassword) {
    if (!input.currentPassword) {
      throw new AppError("CURRENT_PASSWORD_REQUIRED", "Current password required to set a new one", 400);
    }
    if (!await bcrypt.compare(input.currentPassword, user.password)) {
      throw new AppError("WRONG_PASSWORD", "Current password is incorrect", 401);
    }
    data.password = await bcrypt.hash(input.newPassword, 10);
    data.tokenVersion = { increment: 1 };
  }
  const updated = await prisma.user.update({ where: { id: userId }, data });
  if (input.newPassword) {
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }
  return toAuthUser(updated);
}
async function updateThemePref(userId, theme) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { themePref: theme }
  });
  return toAuthUser(updated);
}
async function login(usernameEmail, password) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: usernameEmail }, { email: usernameEmail }] }
  });
  if (!user || !await bcrypt.compare(password, user.password)) {
    throw new AppError("INVALID_CREDENTIALS", "Invalid username/email or password", 401);
  }
  if (user.status !== "active") {
    throw new AppError("ACCOUNT_SUSPENDED", "Account is suspended", 403);
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: /* @__PURE__ */ new Date() } });
  return issueTokens(user);
}
async function issueTokens(user) {
  const refreshToken = signRefreshToken(user);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3)
    }
  });
  return {
    accessToken: signAccessToken(user),
    refreshToken,
    user: toAuthUser(user)
  };
}
async function refresh(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError("INVALID_REFRESH_TOKEN", "Invalid or expired refresh token", 401);
  }
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) }
  });
  if (!stored || stored.revokedAt) {
    throw new AppError("INVALID_REFRESH_TOKEN", "Refresh token has been revoked", 401);
  }
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: /* @__PURE__ */ new Date() } });
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AppError("USER_NOT_FOUND", "User no longer exists", 401);
  const tokenVer = payload.ver;
  if (tokenVer !== user.tokenVersion) {
    await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken) }, data: { revokedAt: /* @__PURE__ */ new Date() } }).catch(() => void 0);
    throw new AppError("INVALID_REFRESH_TOKEN", "Session invalidated \u2014 dobara login karo", 401);
  }
  return issueTokens(user);
}
async function logout(refreshToken) {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) }
  });
  if (stored) {
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: /* @__PURE__ */ new Date() } });
  }
}

// src/controllers/auth.controller.ts
async function signup2(req, res) {
  const { username, email, password, homeName } = req.body;
  const result = await signup({ username, email, password, homeName });
  ok(res, result, 201);
}
async function login2(req, res) {
  const { usernameEmail, password } = req.body;
  const result = await login(usernameEmail, password);
  ok(res, result);
}
async function me(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, username: true, email: true, role: true, themePref: true, createdAt: true }
  });
  ok(res, user);
}
async function refresh2(req, res) {
  const { refreshToken } = req.body;
  const result = await refresh(refreshToken);
  ok(res, result);
}
async function logout2(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) await logout(refreshToken);
  ok(res, { message: "Logged out" });
}
async function updateProfile2(req, res) {
  const user = await updateProfile(req.user.sub, req.body);
  ok(res, user);
}
async function updateTheme(req, res) {
  const user = await updateThemePref(req.user.sub, req.body.theme);
  ok(res, user);
}

// src/middleware/auth.ts
import jwt2 from "jsonwebtoken";
init_prisma();
var requireAuth = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("UNAUTHORIZED", "Missing bearer token", 401));
  }
  try {
    const payload = jwt2.verify(header.slice(7), env.JWT_ACCESS_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true, status: true }
    });
    if (!user || payload.ver !== user.tokenVersion) {
      return next(new AppError("UNAUTHORIZED", "Session invalidated \u2014 dobara login karo", 401));
    }
    if (user.status !== "active") {
      return next(new AppError("ACCOUNT_SUSPENDED", "Account is suspended", 403));
    }
    req.user = payload;
    next();
  } catch {
    next(new AppError("UNAUTHORIZED", "Invalid or expired token", 401));
  }
};
var optionalAuth = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt2.verify(header.slice(7), env.JWT_ACCESS_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { tokenVersion: true, status: true }
      });
      if (user && payload.ver === user.tokenVersion && user.status === "active") {
        req.user = payload;
      }
    } catch {
    }
  }
  next();
};

// src/middleware/validate.ts
function validateBody(schema) {
  return (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}
function validateQuery(schema) {
  return (req, _res, next) => {
    schema.parse(req.query);
    next();
  };
}
function validateParams(schema) {
  return (req, _res, next) => {
    schema.parse(req.params);
    next();
  };
}

// src/routes/auth.routes.ts
var authRouter = Router();
var signupSchema = z2.object({
  username: z2.string().min(3).max(50),
  email: z2.string().email().max(100),
  password: z2.string().min(6).max(255),
  homeName: z2.string().max(100).optional()
});
var loginSchema = z2.object({
  usernameEmail: z2.string().min(1).max(100),
  password: z2.string().min(1).max(255)
});
var refreshSchema = z2.object({
  refreshToken: z2.string().min(1)
});
var logoutSchema = z2.object({
  refreshToken: z2.string().min(1)
});
var themeSchema = z2.object({
  theme: z2.enum(["light", "dark", "system"])
});
var profileSchema = z2.object({
  username: z2.string().min(3).max(50).optional(),
  email: z2.string().email().max(100).optional(),
  currentPassword: z2.string().min(1).max(255).optional(),
  newPassword: z2.string().min(6).max(255).optional()
}).refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" });
authRouter.post("/signup", validateBody(signupSchema), signup2);
authRouter.post("/login", validateBody(loginSchema), login2);
authRouter.post("/refresh", validateBody(refreshSchema), refresh2);
authRouter.post("/logout", validateBody(logoutSchema), logout2);
authRouter.get("/me", requireAuth, me);
authRouter.patch("/me", requireAuth, validateBody(profileSchema), updateProfile2);
authRouter.put("/theme", requireAuth, validateBody(themeSchema), updateTheme);

// src/routes/home.routes.ts
import { Router as Router2 } from "express";
import { z as z3 } from "zod";

// src/services/home.service.ts
init_prisma();
async function createHome(userId, name) {
  return prisma.$transaction(async (tx) => {
    const home = await tx.home.create({
      data: {
        name,
        ownerId: userId,
        members: { create: { userId, role: "owner" } }
      }
    });
    return home;
  });
}
async function listHomesForUser(userId) {
  return prisma.home.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { where: { userId }, select: { role: true } },
      _count: { select: { devices: true, members: true } }
    },
    orderBy: { createdAt: "asc" }
  });
}
async function getHomeDetail(homeId) {
  return prisma.home.findUnique({
    where: { id: homeId },
    include: {
      rooms: { orderBy: { name: "asc" } },
      devices: { orderBy: { createdAt: "desc" } },
      members: { include: { user: { select: { id: true, username: true, email: true } } } },
      _count: { select: { devices: true, members: true } }
    }
  });
}
async function renameHome(homeId, name) {
  return prisma.home.update({ where: { id: homeId }, data: { name } });
}
async function transferOwnership(homeId, newOwnerId) {
  const [home, target] = await Promise.all([
    prisma.home.findUnique({ where: { id: homeId } }),
    prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId: newOwnerId } }
    })
  ]);
  if (!home) throw new AppError("HOME_NOT_FOUND", "Home not found", 404);
  if (!target) throw new AppError("NOT_A_MEMBER", "Target user is not a member of this home", 400);
  if (target.role === "owner") throw new AppError("ALREADY_OWNER", "Target is already the owner", 400);
  return prisma.$transaction([
    prisma.homeMember.update({
      where: { homeId_userId: { homeId, userId: newOwnerId } },
      data: { role: "owner" }
    }),
    prisma.homeMember.update({
      where: { homeId_userId: { homeId, userId: home.ownerId } },
      data: { role: "admin" }
    }),
    prisma.home.update({ where: { id: homeId }, data: { ownerId: newOwnerId } })
  ]);
}
async function deleteHome(homeId) {
  await prisma.home.delete({ where: { id: homeId } });
}

// src/controllers/home.controller.ts
async function create(req, res) {
  const home = await createHome(req.user.sub, req.body.name);
  ok(res, home, 201);
}
async function list(req, res) {
  const homes = await listHomesForUser(req.user.sub);
  ok(res, homes);
}
async function detail(req, res) {
  const home = await getHomeDetail(Number(req.params.homeId));
  ok(res, home);
}
async function rename(req, res) {
  const home = await renameHome(Number(req.params.homeId), req.body.name);
  ok(res, home);
}
async function transfer(req, res) {
  const home = await transferOwnership(
    Number(req.params.homeId),
    Number(req.body.newOwnerId)
  );
  ok(res, home);
}
async function remove(req, res) {
  await deleteHome(Number(req.params.homeId));
  ok(res, { message: "Home deleted" });
}

// src/services/device.service.ts
init_prisma();

// src/lib/socket.ts
import { Server } from "socket.io";
import jwt3 from "jsonwebtoken";
init_prisma();
var io = null;
function initSocket(server) {
  io = new Server(server, {
    cors: { origin: corsOrigins, credentials: true }
  });
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) throw new Error("missing token");
      const payload = jwt3.verify(token, env.JWT_ACCESS_SECRET);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });
  io.on("connection", async (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);
    let joined = 0;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      const isAdmin = user?.role === "system_admin";
      const homes = isAdmin ? await prisma.home.findMany({ select: { id: true } }) : await prisma.homeMember.findMany({ where: { userId }, select: { homeId: true } });
      for (const h of homes) {
        socket.join(`home:${"homeId" in h ? h.homeId : h.id}`);
        joined++;
      }
    } catch {
    }
    console.log(`[socket] user ${userId} connected (${joined} homes)`);
  });
  return io;
}
function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}
function emitToHome(homeId, event, payload) {
  io?.to(`home:${homeId}`).emit(event, payload);
}

// src/services/device.service.ts
init_audit_service();

// src/services/notification.service.ts
init_prisma();

// ../../packages/shared/src/notificationDraft.ts
function parseNotificationBody(body) {
  if (!body) return { text: "" };
  try {
    const obj = JSON.parse(body);
    if (obj && typeof obj === "object" && typeof obj.t === "string") {
      const o = obj;
      return {
        text: o.t,
        targetUserId: typeof o.u === "number" ? o.u : void 0,
        draft: typeof o.d === "string" && o.d.length > 0 ? o.d : void 0
      };
    }
  } catch {
  }
  return { text: body };
}
function buildClientSupportDraft(n) {
  const title = n.title ?? "";
  const body = n.body ?? "";
  if (/Support ne message bheja/.test(title)) return null;
  if (/User ne support me reply kiya/.test(title)) return null;
  let m = title.match(/Support ne (.+?) (ON|OFF) kiya/i);
  if (m) {
    const on = m[2].toUpperCase() === "ON";
    return `Aapne mera device "${m[1].trim()}" ${on ? "ON" : "OFF"} kar diya, lekin maine aisa koi action nahi kiya tha. Kya yeh sahi hai? Please check karein.`;
  }
  m = title.match(/board renamed kiya: (.+?) → (.+)/i);
  if (m) {
    return `Aapne mera board rename kar diya hai (${m[1].trim()} \u2192 ${m[2].trim()}). Mujhe yeh samajh nahi aaya \u2014 kya yeh galat hua?`;
  }
  m = title.match(/"(.*?)" ke stuck commands clear/i);
  if (m) {
    return `Mera device "${m[1].trim()}" abhi kaam nahi kar raha tha. Ab kya karna hoga? Koi aur dikkat ho toh bata dijiye.`;
  }
  m = title.match(/"(.*?)" ke liye firmware update push/i);
  if (m) {
    return `Aapne mere device "${m[1].trim()}" pe firmware update push kiya hai \u2014 kya yeh expected tha? Update ke baad koi dikkat aaye toh yahi bataunga.`;
  }
  m = title.match(/Board offline: (.+)/i);
  if (m) return `Mera board "${m[1].trim()}" offline ho gaya hai \u2014 WiFi/power check kar liya, phir bhi connect nahi ho raha. Please help karein.`;
  m = title.match(/Board online: (.+)/i);
  if (m) return `Mera board "${m[1].trim()}" wapas online aa gaya hai. Sab theek hai ya kuch aur check karna hai?`;
  m = title.match(/^📡 (.+?) offline$/i);
  if (m) return `Mera device "${m[1].trim()}" offline ho gaya hai \u2014 WiFi/power check kar liya, phir bhi nahi aa raha. Please help karein.`;
  m = title.match(/^✅ (.+?) online$/i);
  if (m) return `Mera device "${m[1].trim()}" wapas online ho gaya hai. Sab theek hai ya kuch aur check karna hai?`;
  m = title.match(/"(.*?)" pe firmware update push/i);
  if (m) return `Mere device "${m[1].trim()}" pe firmware update chal raha hai \u2014 kya yeh sahi hai?`;
  m = title.match(/Board renamed: (.+?) → (.+)/i);
  if (m) return `Mera board rename ho gaya hai (${m[1].trim()} \u2192 ${m[2].trim()}). Kya yeh theek hai ya kuch galat hua?`;
  m = title.match(/Child safety: "(.*?)" band kiya/i);
  if (m) {
    return `Mera device "${m[1].trim()}" child safety ke karan band ho gaya \u2014 kya yeh sahi tha? Agar main ab bhi use kar sakta hoon to bata dijiye.`;
  }
  m = title.match(/"(.*?)" ka time khatam/i);
  if (m) {
    return `Mujhe bataya gaya ki device "${m[1].trim()}" ka aaj ka time khatam ho gaya. Kya main isse dobara ON kar sakta hoon?`;
  }
  m = title.match(/Schedule fired: (.+?) (ON|OFF)/i);
  if (m) return `Mera schedule device "${m[1].trim()}" ko ${m[2].toLowerCase()} kar diya \u2014 kya time aur action sahi tha? Please confirm karein.`;
  if (/Order placed/.test(title)) {
    const num = body.match(/Order ([A-Z0-9-]+)/i);
    return `Mere order${num ? ` ${num[1]}` : ""} ke baare me ek sawal hai \u2014 please madad karein.`;
  }
  m = title.match(/New member joined (.+)/i);
  if (m) return `Mere home "${m[1].trim()}" me koi naya member join hua hai \u2014 kya yeh expected tha?`;
  const text = body ? ` \u2014 ${body}` : "";
  return `Mujhe yeh notification mili: "${title}"${text}. Iske baare me madad chahiye.`;
}
function buildClientAdminReplyDraft(n) {
  const title = n.title ?? "";
  if (!/User ne support me reply kiya/.test(title)) return null;
  const { text } = parseNotificationBody(n.body);
  const trimmed = text.trim();
  if (trimmed) {
    const quote = trimmed.slice(0, 120);
    return `Namaste, aapka message padh liya: "${quote}" \u2014 hum isse check kar rahe hain, jald hi update denge. \u{1F64F}`;
  }
  return `Namaste, aapka support message note kar liya \u2014 hum jald hi update denge. \u{1F64F}`;
}
function buildNotificationDraft(n) {
  return buildClientSupportDraft(n) ?? buildClientAdminReplyDraft(n);
}

// ../../packages/shared/src/index.ts
var HOME_MEMBER_ROLES = ["owner", "admin", "member", "viewer"];

// src/services/notificationQuery.ts
var SCHEDULE_TITLE_RE = /Schedule fired/i;
function normalizeCategory(category, title) {
  if (category === "system" && SCHEDULE_TITLE_RE.test(title ?? "")) return "schedule";
  return category;
}
function buildNotificationWhere(userId, args = {}) {
  const where = { userId };
  if (args.category && args.category !== "all") {
    if (args.category === "schedule") {
      where.OR = [{ category: "schedule" }, { category: "system", title: { contains: "Schedule fired" } }];
    } else if (args.category === "system") {
      where.OR = [{ category: "system", NOT: { title: { contains: "Schedule fired" } } }];
    } else {
      where.category = args.category;
    }
  }
  if (args.type && args.type !== "all") where.type = args.type;
  if (args.unread) where.readAt = null;
  return where;
}

// src/services/notification.service.ts
function attachDraftToBody(body, title) {
  const draft = buildNotificationDraft({ category: "", title, body });
  if (!draft) return body;
  let parsed2 = {};
  if (body) {
    try {
      const o = JSON.parse(body);
      if (o && typeof o === "object") parsed2 = o;
    } catch {
    }
  }
  const t = typeof parsed2.t === "string" ? parsed2.t : body ?? "";
  return JSON.stringify({
    t,
    ...typeof parsed2.u === "number" ? { u: parsed2.u } : {},
    d: draft
  });
}
async function createNotification(userId, input) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      category: input.category ?? "system",
      type: input.type ?? "info",
      title: input.title,
      body: attachDraftToBody(input.body ?? null, input.title)
    }
  });
  emitToUser(userId, "notification:new", notification);
  return notification;
}
async function listNotifications(userId, args = {}) {
  const page = Math.max(1, Math.floor(args.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(args.pageSize ?? 20)));
  const where = buildNotificationWhere(userId, args);
  const [raw, total2] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.notification.count({ where })
  ]);
  const items = raw.map((n) => ({ ...n, category: normalizeCategory(n.category, n.title) }));
  return { items, total: total2, page, pageSize, totalPages: Math.max(1, Math.ceil(total2 / pageSize)) };
}
async function remove2(userId, notificationId) {
  await prisma.notification.deleteMany({ where: { id: notificationId, userId } });
  return { ok: true };
}
async function unreadCount(userId) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
async function markRead(userId, notificationId) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: /* @__PURE__ */ new Date() }
  });
  return { ok: true };
}
async function markAllRead(userId) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: /* @__PURE__ */ new Date() }
  });
  return { ok: true };
}

// src/services/device.service.ts
init_firmware_service();
async function listDevices(homeId, viewerId) {
  const where = { homeId };
  if (viewerId && prisma.deviceAccess) {
    const membership2 = await prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId: viewerId } },
      select: { restricted: true }
    });
    if (membership2?.restricted) {
      const granted = await prisma.deviceAccess.findMany({
        where: { homeId, userId: viewerId },
        select: { deviceId: true }
      });
      where.id = { in: granted.map((g) => g.deviceId) };
    }
  }
  return prisma.device.findMany({
    where,
    include: {
      esp: { select: { id: true, name: true, serialCode: true, modelCode: true, firmwareVersion: true, offline: true, lastSeen: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}
async function createDevice(input) {
  if (input.roomId) {
    const room = await prisma.room.findFirst({
      where: { id: input.roomId, homeId: input.homeId }
    });
    if (!room) throw new AppError("ROOM_NOT_FOUND", "Room does not belong to this home", 400);
  }
  const dup = await prisma.device.findFirst({
    where: { homeId: input.homeId, name: input.name },
    select: { id: true }
  });
  if (dup) {
    throw new AppError("DUPLICATE_NAME", `Naam "${input.name}" already is home me hai \u2014 har device ka unique naam chahiye`, 409);
  }
  return prisma.device.create({
    data: {
      homeId: input.homeId,
      createdBy: input.createdBy,
      name: input.name,
      type: input.type,
      roomId: input.roomId,
      serialNumber: input.serialNumber
    }
  });
}
async function setDeviceStatus(input) {
  const device = await prisma.device.findFirst({
    where: { id: input.deviceId, homeId: input.homeId }
  });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  const membership2 = prisma.deviceAccess ? await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId: input.homeId, userId: input.actorId } },
    select: { restricted: true }
  }) : null;
  if (membership2?.restricted && prisma.deviceAccess) {
    const granted = await prisma.deviceAccess.findUnique({
      where: { deviceId_userId: { deviceId: device.id, userId: input.actorId } }
    });
    if (!granted) {
      throw new AppError("FORBIDDEN", "Is device ka access nahi hai (child mode)", 403);
    }
  }
  await prisma.$transaction([
    prisma.device.update({
      where: { id: device.id },
      data: { status: input.status }
    }),
    prisma.deviceCommand.create({
      data: {
        deviceId: device.id,
        actorId: input.actorId,
        command: `set_status:${input.status}`
      }
    }),
    prisma.deviceLog.create({
      data: {
        deviceId: device.id,
        actorId: input.actorId,
        logType: "status_change",
        logMessage: `Device turned ${input.status}`
      }
    })
  ]);
  const updated = await prisma.device.findUnique({ where: { id: device.id } });
  if (updated) emitToHome(input.homeId, "device:updated", updated);
  return updated;
}
async function updateDevice(homeId, deviceId, patch) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, homeId } });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  if (patch.roomId !== void 0 && patch.roomId !== null) {
    const room = await prisma.room.findFirst({ where: { id: patch.roomId, homeId } });
    if (!room) throw new AppError("ROOM_NOT_FOUND", "Room does not belong to this home", 400);
  }
  if (patch.name !== void 0) {
    const dup = await prisma.device.findFirst({
      where: { homeId, name: patch.name, id: { not: deviceId } },
      select: { id: true }
    });
    if (dup) {
      throw new AppError("DUPLICATE_NAME", `Naam "${patch.name}" already is home me kisi aur device pe hai \u2014 unique naam chahiye`, 409);
    }
  }
  return prisma.device.update({
    where: { id: deviceId },
    data: { name: patch.name, roomId: patch.roomId }
  });
}
async function getDeviceLogs(homeId, deviceId, limit = 50) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, homeId } });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  return prisma.deviceLog.findMany({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { id: true, username: true } } }
  });
}
async function deleteDevice(homeId, deviceId) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, homeId } });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  await prisma.device.delete({ where: { id: deviceId } });
}
async function renameEsp(homeId, espId, name, actorId) {
  if (!name) throw new AppError("BAD_REQUEST", "Board ka naam required hai", 400);
  if (name.length > 60) throw new AppError("BAD_REQUEST", "Naam 60 chars se chhota rakho", 400);
  const esp = await prisma.espDevice.findFirst({ where: { id: espId, homeId } });
  if (!esp) throw new AppError("NOT_FOUND", "Board is home me nahi mila", 404);
  const dup = await prisma.espDevice.findFirst({ where: { name, id: { not: espId } }, select: { id: true } });
  if (dup) {
    throw new AppError("DUPLICATE_NAME", `Naam "${name}" already kisi aur board pe hai \u2014 unique naam chahiye`, 409);
  }
  const updated = await prisma.espDevice.update({ where: { id: espId }, data: { name } });
  await audit(actorId, "user.esp.rename", {
    homeId,
    entity: "esp",
    entityId: espId,
    meta: { from: esp.name ?? null, to: name }
  });
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { username: true } });
  const home = await prisma.home.findUnique({
    where: { id: homeId },
    include: { members: { where: { role: { in: ["owner", "admin"] } }, select: { userId: true } } }
  });
  if (home) {
    const oldName = esp.name ?? esp.serialCode ?? `ESP-${esp.macAddress.slice(-6).toUpperCase()}`;
    for (const m of home.members) {
      await createNotification(m.userId, {
        category: "device",
        type: "info",
        title: `\u{1F6F0}\uFE0F Board renamed: ${oldName} \u2192 ${name}`,
        body: `${actor?.username ?? "Kisi ne"} ne board ka naam "${oldName}" se "${name}" kar diya.`
      });
    }
    emitToHome(homeId, "esp:updated", { id: espId, name });
  }
  return updated;
}
async function listMyBoards(userId) {
  const homes = await prisma.home.findMany({
    where: { members: { some: { userId } } },
    select: {
      id: true,
      name: true,
      members: { where: { userId }, select: { role: true } }
    },
    orderBy: { createdAt: "asc" }
  });
  const homeIds = homes.map((h) => h.id);
  const boards = await prisma.espDevice.findMany({
    where: { homeId: { in: homeIds } },
    include: {
      devices: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          offline: true,
          lastSeen: true
        },
        orderBy: { id: "asc" }
      }
    },
    orderBy: { id: "asc" }
  });
  const byHome = /* @__PURE__ */ new Map();
  for (const b of boards) {
    const arr = byHome.get(b.homeId) ?? [];
    arr.push(b);
    byHome.set(b.homeId, arr);
  }
  return homes.map((h) => ({
    homeId: h.id,
    homeName: h.name,
    role: h.members[0]?.role ?? "member",
    boards: byHome.get(h.id) ?? []
  }));
}
async function requestOta(homeId, deviceId, actorId) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, homeId } });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device is home me nahi mila", 404);
  const esp = device.espId ? await prisma.espDevice.findUnique({ where: { id: device.espId } }) : null;
  const current = await resolveFirmware(esp?.modelCode);
  if (!current) {
    throw new AppError("NO_FIRMWARE", "Abhi koi current firmware published nahi hai", 400);
  }
  await prisma.device.update({
    where: { id: deviceId },
    data: { otaPendingVersion: current.version, otaRequestedAt: /* @__PURE__ */ new Date() }
  });
  let espId = null;
  if (esp) {
    espId = esp.id;
    await prisma.espDevice.update({
      where: { id: esp.id },
      data: { otaPendingVersion: current.version, otaRequestedAt: /* @__PURE__ */ new Date() }
    });
  }
  await audit(actorId, "user.ota.push", {
    homeId,
    entity: "device",
    entityId: deviceId,
    meta: { version: current.version, model: esp?.modelCode ?? null }
  });
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { username: true } });
  const home = await prisma.home.findUnique({
    where: { id: homeId },
    include: { members: { where: { role: { in: ["owner", "admin"] } }, select: { userId: true } } }
  });
  if (home) {
    for (const m of home.members) {
      await createNotification(m.userId, {
        category: "device",
        type: "info",
        title: `\u{1F4F2} "${device.name}" pe firmware update push kiya`,
        body: `${actor?.username ?? "Kisi ne"} ne board ke liye v${current.version} request kiya \u2014 agle heartbeat pe install hoga.`
      });
    }
  }
  emitToHome(homeId, "device:updated", { id: deviceId });
  return {
    deviceId,
    espId,
    version: current.version,
    model: current.modelCode || "universal",
    message: "OTA update pushed \u2014 device agle heartbeat pe update ho jayega"
  };
}

// src/controllers/device.controller.ts
async function list2(req, res) {
  const devices = await listDevices(
    Number(req.params.homeId),
    req.user?.sub
  );
  ok(res, devices);
}
async function create2(req, res) {
  const device = await createDevice({
    homeId: Number(req.params.homeId),
    createdBy: req.user.sub,
    name: req.body.name,
    type: req.body.type,
    roomId: req.body.roomId,
    serialNumber: req.body.serialNumber
  });
  ok(res, device, 201);
}
async function setStatus(req, res) {
  const device = await setDeviceStatus({
    homeId: Number(req.params.homeId),
    deviceId: Number(req.params.deviceId),
    actorId: req.user.sub,
    status: req.body.status
  });
  ok(res, device);
}
async function update(req, res) {
  const device = await updateDevice(
    Number(req.params.homeId),
    Number(req.params.deviceId),
    { name: req.body.name, roomId: req.body.roomId }
  );
  ok(res, device);
}
async function logs(req, res) {
  const logs2 = await getDeviceLogs(
    Number(req.params.homeId),
    Number(req.params.deviceId),
    Number(req.query.limit ?? 50)
  );
  ok(res, logs2);
}
async function remove3(req, res) {
  await deleteDevice(Number(req.params.homeId), Number(req.params.deviceId));
  ok(res, { message: "Device deleted" });
}
async function renameEsp2(req, res) {
  const board = await renameEsp(
    Number(req.params.homeId),
    Number(req.params.espId),
    String(req.body?.name ?? "").trim().slice(0, 60),
    req.user.sub
  );
  ok(res, board);
}
async function listMyBoards2(req, res) {
  const data = await listMyBoards(req.user.sub);
  ok(res, data);
}
async function requestOta2(req, res) {
  const data = await requestOta(
    Number(req.params.homeId),
    Number(req.params.deviceId),
    req.user.sub
  );
  ok(res, data);
}

// src/middleware/requireRole.ts
init_prisma();
var ROLE_INDEX = Object.fromEntries(HOME_MEMBER_ROLES.map((r, i) => [r, i]));
function requireHomeMember(minRole = "member") {
  return async (req, _res, next) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return next(new AppError("UNAUTHORIZED", "Not authenticated", 401));
      const homeId = Number(req.params.homeId);
      if (!Number.isInteger(homeId)) return next(new AppError("BAD_REQUEST", "Invalid home id"));
      const membership2 = await prisma.homeMember.findUnique({
        where: { homeId_userId: { homeId, userId } }
      });
      if (!membership2) {
        return next(new AppError("FORBIDDEN", "Not a member of this home", 403));
      }
      if (ROLE_INDEX[membership2.role] > ROLE_INDEX[minRole]) {
        return next(new AppError("FORBIDDEN", "Insufficient role for this action", 403));
      }
      req.homeMembership = membership2;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// src/routes/home.routes.ts
var homeRouter = Router2();
var idParams = z3.object({ homeId: z3.coerce.number().int().positive() });
var createSchema = z3.object({ name: z3.string().min(1).max(100) });
var renameSchema = z3.object({ name: z3.string().min(1).max(100) });
var transferSchema = z3.object({ newOwnerId: z3.coerce.number().int().positive() });
homeRouter.post("/", requireAuth, validateBody(createSchema), create);
homeRouter.get("/", requireAuth, list);
homeRouter.get("/my-boards", requireAuth, listMyBoards2);
homeRouter.get(
  "/:homeId",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("viewer"),
  detail
);
homeRouter.patch(
  "/:homeId",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("admin"),
  validateBody(renameSchema),
  rename
);
homeRouter.delete(
  "/:homeId",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("owner"),
  remove
);
homeRouter.post(
  "/:homeId/transfer",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("owner"),
  validateBody(transferSchema),
  transfer
);

// src/routes/member.routes.ts
import { Router as Router3 } from "express";
import { z as z4 } from "zod";

// src/services/member.service.ts
init_prisma();
import crypto2 from "node:crypto";
function generateInviteCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto2.randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
async function listMembers(homeId, viewerRole) {
  const members = await prisma.homeMember.findMany({
    where: { homeId },
    include: { user: { select: { id: true, username: true, email: true } } },
    orderBy: { joinedAt: "asc" }
  });
  if ((viewerRole === "owner" || viewerRole === "admin") && prisma.deviceAccess) {
    const grants = await prisma.deviceAccess.findMany({
      where: { homeId },
      select: { userId: true, deviceId: true }
    });
    const byUser = /* @__PURE__ */ new Map();
    for (const g of grants) {
      const arr = byUser.get(g.userId) ?? [];
      arr.push({ deviceId: g.deviceId });
      byUser.set(g.userId, arr);
    }
    return members.map((m) => ({ ...m, deviceAccess: byUser.get(m.userId) ?? [] }));
  }
  return members;
}
async function createInvitation(input) {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    const already = await prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId: input.homeId, userId: existingUser.id } }
    });
    if (already) throw new AppError("ALREADY_MEMBER", "User is already a member of this home", 409);
  }
  const expiresInHours = input.expiresInHours ?? 48;
  let inviteCode = generateInviteCode();
  for (let attempt = 0; attempt < 3; attempt++) {
    const exists = await prisma.invitation.findUnique({ where: { inviteCode } });
    if (!exists) break;
    inviteCode = generateInviteCode();
  }
  return prisma.invitation.create({
    data: {
      homeId: input.homeId,
      email: input.email,
      inviteCode,
      role: input.role,
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1e3)
    }
  });
}
async function acceptInvitation(inviteCode, userId, userEmail) {
  const invitation = await prisma.invitation.findUnique({
    where: { inviteCode: inviteCode.trim().toUpperCase() },
    include: { home: true }
  });
  if (!invitation || invitation.status !== "pending") {
    throw new AppError("INVALID_INVITE", "Invitation not found or no longer active", 404);
  }
  if (invitation.expiresAt < /* @__PURE__ */ new Date()) {
    throw new AppError("INVITE_EXPIRED", "Invitation has expired", 410);
  }
  if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new AppError("INVITE_EMAIL_MISMATCH", "Invitation was sent to a different email", 403);
  }
  return prisma.$transaction(async (tx) => {
    const existing = await tx.homeMember.findUnique({
      where: { homeId_userId: { homeId: invitation.homeId, userId } }
    });
    if (existing) throw new AppError("ALREADY_MEMBER", "You are already a member of this home", 409);
    await tx.homeMember.create({
      data: { homeId: invitation.homeId, userId, role: invitation.role }
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: /* @__PURE__ */ new Date() }
    });
    await createNotification(invitation.home.ownerId, {
      category: "system",
      type: "info",
      title: `\u{1F464} New member joined ${invitation.home.name}`,
      body: `A user joined your home with the ${invitation.role} role.`
    });
    return invitation.home;
  });
}
async function listInvitations(homeId) {
  return prisma.invitation.findMany({
    where: { homeId, status: "pending" },
    orderBy: { createdAt: "desc" }
  });
}
async function revokeInvitation(homeId, invitationId) {
  const invitation = await prisma.invitation.findFirst({ where: { id: invitationId, homeId } });
  if (!invitation) throw new AppError("INVITATION_NOT_FOUND", "Invitation not found", 404);
  return prisma.invitation.update({
    where: { id: invitationId },
    data: { status: "revoked" }
  });
}
async function changeRole(homeId, userId, role) {
  const member = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId } }
  });
  if (!member) throw new AppError("NOT_A_MEMBER", "User is not a member of this home", 404);
  if (member.role === "owner") {
    throw new AppError("CANNOT_DEMOTE_OWNER", "The owner's role cannot be changed", 400);
  }
  return prisma.homeMember.update({
    where: { homeId_userId: { homeId, userId } },
    data: { role }
  });
}
async function removeMember(homeId, userId) {
  const member = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId } }
  });
  if (!member) throw new AppError("NOT_A_MEMBER", "User is not a member of this home", 404);
  if (member.role === "owner") {
    throw new AppError("CANNOT_REMOVE_OWNER", "The owner cannot be removed", 400);
  }
  await prisma.homeMember.delete({ where: { homeId_userId: { homeId, userId } } });
}
async function updateMemberSafety(input) {
  if (input.actorRole !== "owner" && input.actorRole !== "admin") {
    throw new AppError("FORBIDDEN", "Only owner/admin can manage member safety", 403);
  }
  const member = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId: input.homeId, userId: input.targetUserId } }
  });
  if (!member) throw new AppError("NOT_A_MEMBER", "User is not a member of this home", 404);
  if (member.role === "owner") throw new AppError("BAD_REQUEST", "Owner ko child mode me nahi rakha ja sakta", 400);
  const data = {};
  if (input.restricted !== void 0) data.restricted = input.restricted;
  if (input.dailyLimitMinutes !== void 0) {
    const mins = Number(input.dailyLimitMinutes);
    data.dailyLimitMinutes = Number.isFinite(mins) && mins > 0 ? Math.floor(mins) : null;
  }
  if (data.restricted === false) data.dailyLimitMinutes = null;
  const updated = await prisma.homeMember.update({
    where: { homeId_userId: { homeId: input.homeId, userId: input.targetUserId } },
    data,
    include: { user: { select: { id: true, username: true } } }
  });
  const { audit: audit2 } = await Promise.resolve().then(() => (init_audit_service(), audit_service_exports));
  await audit2(input.actorId, "member.safety", {
    homeId: input.homeId,
    entity: "homeMember",
    entityId: member.id,
    meta: { targetUserId: input.targetUserId, ...data }
  });
  return updated;
}
async function setDeviceAccess(input) {
  if (input.actorRole !== "owner" && input.actorRole !== "admin") {
    throw new AppError("FORBIDDEN", "Only owner/admin can manage device access", 403);
  }
  const member = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId: input.homeId, userId: input.targetUserId } }
  });
  if (!member) throw new AppError("NOT_A_MEMBER", "User is not a member of this home", 404);
  if (member.role === "owner") throw new AppError("BAD_REQUEST", "Owner pe device access set nahi kar sakte", 400);
  const ids = [...new Set(input.deviceIds)];
  if (ids.length > 0) {
    const devices = await prisma.device.findMany({
      where: { id: { in: ids }, homeId: input.homeId },
      select: { id: true }
    });
    if (devices.length !== ids.length) {
      throw new AppError("BAD_REQUEST", "Kuch devices is home ke nahi hain", 400);
    }
  }
  await prisma.$transaction([
    prisma.deviceAccess.deleteMany({ where: { homeId: input.homeId, userId: input.targetUserId } }),
    ...ids.length > 0 ? [
      prisma.deviceAccess.createMany({
        data: ids.map((deviceId) => ({
          homeId: input.homeId,
          deviceId,
          userId: input.targetUserId
        }))
      })
    ] : []
  ]);
  const { audit: audit2 } = await Promise.resolve().then(() => (init_audit_service(), audit_service_exports));
  await audit2(input.actorId, "member.access", {
    homeId: input.homeId,
    entity: "homeMember",
    entityId: member.id,
    meta: { targetUserId: input.targetUserId, deviceIds: ids }
  });
  return { deviceIds: ids };
}

// src/controllers/member.controller.ts
async function list3(req, res) {
  const members = await listMembers(
    Number(req.params.homeId),
    req.homeMembership?.role
  );
  ok(res, members);
}
async function invite(req, res) {
  const invitation = await createInvitation({
    homeId: Number(req.params.homeId),
    email: req.body.email,
    role: req.body.role
  });
  ok(res, invitation, 201);
}
async function accept(req, res) {
  const home = await acceptInvitation(
    req.body.inviteCode,
    req.user.sub,
    req.user.email
  );
  ok(res, home);
}
async function listInvitations2(req, res) {
  const invitations = await listInvitations(Number(req.params.homeId));
  ok(res, invitations);
}
async function revokeInvitation2(req, res) {
  const invitation = await revokeInvitation(
    Number(req.params.homeId),
    Number(req.params.invitationId)
  );
  ok(res, invitation);
}
async function changeRole2(req, res) {
  const member = await changeRole(
    Number(req.params.homeId),
    Number(req.params.userId),
    req.body.role
  );
  ok(res, member);
}
async function remove4(req, res) {
  await removeMember(Number(req.params.homeId), Number(req.params.userId));
  ok(res, { message: "Member removed" });
}
async function updateSafety(req, res) {
  const member = await updateMemberSafety({
    homeId: Number(req.params.homeId),
    actorId: req.user.sub,
    actorRole: req.homeMembership.role,
    targetUserId: Number(req.params.userId),
    restricted: req.body.restricted,
    dailyLimitMinutes: req.body.dailyLimitMinutes
  });
  ok(res, member);
}
async function updateAccess(req, res) {
  const result = await setDeviceAccess({
    homeId: Number(req.params.homeId),
    actorId: req.user.sub,
    actorRole: req.homeMembership.role,
    targetUserId: Number(req.params.userId),
    deviceIds: req.body.deviceIds
  });
  ok(res, result);
}

// src/routes/member.routes.ts
var memberRouter = Router3();
var idParams2 = z4.object({ homeId: z4.coerce.number().int().positive() });
var memberParams = z4.object({
  homeId: z4.coerce.number().int().positive(),
  userId: z4.coerce.number().int().positive()
});
var inviteSchema = z4.object({
  email: z4.string().email().max(100),
  role: z4.enum(["admin", "member", "viewer"])
  // cannot invite as owner
});
var acceptSchema = z4.object({ inviteCode: z4.string().min(6).max(12) });
var roleSchema = z4.object({ role: z4.enum(["admin", "member", "viewer"]) });
var safetySchema = z4.object({
  restricted: z4.boolean().optional(),
  dailyLimitMinutes: z4.coerce.number().int().min(1).max(1440).nullable().optional()
});
var accessSchema = z4.object({
  deviceIds: z4.array(z4.number().int().positive()).max(100)
});
memberRouter.get(
  "/:homeId/members",
  requireAuth,
  validateParams(idParams2),
  requireHomeMember("viewer"),
  list3
);
memberRouter.get(
  "/:homeId/invitations",
  requireAuth,
  validateParams(idParams2),
  requireHomeMember("admin"),
  listInvitations2
);
memberRouter.delete(
  "/:homeId/invitations/:invitationId",
  requireAuth,
  validateParams(
    z4.object({
      homeId: z4.coerce.number().int().positive(),
      invitationId: z4.coerce.number().int().positive()
    })
  ),
  requireHomeMember("admin"),
  revokeInvitation2
);
memberRouter.post(
  "/:homeId/invitations",
  requireAuth,
  validateParams(idParams2),
  requireHomeMember("admin"),
  validateBody(inviteSchema),
  invite
);
memberRouter.patch(
  "/:homeId/members/:userId/role",
  requireAuth,
  validateParams(memberParams),
  requireHomeMember("admin"),
  validateBody(roleSchema),
  changeRole2
);
memberRouter.delete(
  "/:homeId/members/:userId",
  requireAuth,
  validateParams(memberParams),
  requireHomeMember("admin"),
  remove4
);
memberRouter.patch(
  "/:homeId/members/:userId/safety",
  requireAuth,
  validateParams(memberParams),
  requireHomeMember("admin"),
  validateBody(safetySchema),
  updateSafety
);
memberRouter.put(
  "/:homeId/members/:userId/access",
  requireAuth,
  validateParams(memberParams),
  requireHomeMember("admin"),
  validateBody(accessSchema),
  updateAccess
);
memberRouter.post("/invitations/accept", requireAuth, validateBody(acceptSchema), accept);

// src/routes/device.routes.ts
import { Router as Router4 } from "express";
import { z as z5 } from "zod";
var deviceRouter = Router4();
var idParams3 = z5.object({ homeId: z5.coerce.number().int().positive() });
var deviceParams = z5.object({
  homeId: z5.coerce.number().int().positive(),
  deviceId: z5.coerce.number().int().positive()
});
var createSchema2 = z5.object({
  name: z5.string().min(1).max(100),
  type: z5.enum(["bulb", "fan", "ac", "tv", "plug", "custom"]),
  roomId: z5.coerce.number().int().positive().optional(),
  serialNumber: z5.string().min(1).max(64).optional()
});
var statusSchema = z5.object({ status: z5.enum(["on", "off"]) });
var espNameSchema = z5.object({ name: z5.string().min(1).max(60) });
var updateSchema = z5.object({
  name: z5.string().min(1).max(100).optional(),
  roomId: z5.coerce.number().int().positive().nullable().optional()
});
deviceRouter.get(
  "/:homeId/devices",
  requireAuth,
  validateParams(idParams3),
  requireHomeMember("viewer"),
  list2
);
deviceRouter.post(
  "/:homeId/devices",
  requireAuth,
  validateParams(idParams3),
  requireHomeMember("admin"),
  validateBody(createSchema2),
  create2
);
deviceRouter.patch(
  "/:homeId/devices/:deviceId",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("admin"),
  validateBody(updateSchema),
  update
);
deviceRouter.get(
  "/:homeId/devices/:deviceId/logs",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("viewer"),
  logs
);
deviceRouter.post(
  "/:homeId/devices/:deviceId/status",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("member"),
  validateBody(statusSchema),
  setStatus
);
deviceRouter.delete(
  "/:homeId/devices/:deviceId",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("admin"),
  remove3
);
deviceRouter.post(
  "/:homeId/devices/:deviceId/ota",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("admin"),
  requestOta2
);
deviceRouter.patch(
  "/:homeId/esp/:espId",
  requireAuth,
  validateParams(idParams3),
  requireHomeMember("admin"),
  validateBody(espNameSchema),
  renameEsp2
);

// src/routes/deviceApi.routes.ts
import { Router as Router5 } from "express";
import { z as z6 } from "zod";

// src/middleware/apiKey.ts
init_prisma();
import crypto3 from "node:crypto";
function hashKey(raw) {
  return crypto3.createHash("sha256").update(raw).digest("hex");
}
function extractKey(req) {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer rs_")) {
    return header.slice(7);
  }
  const query = req.query["api_key"];
  if (typeof query === "string" && query.length > 0) return query;
  const body = req.body["api_key"];
  if (typeof body === "string" && body.length > 0) return body;
  return null;
}
var requireApiKey = async (req, _res, next) => {
  try {
    const raw = extractKey(req);
    if (!raw) {
      return next(new AppError("UNAUTHORIZED", "Missing api_key", 401));
    }
    const key = await prisma.apiKey.findUnique({ where: { keyHash: hashKey(raw) } });
    if (!key) {
      return next(new AppError("UNAUTHORIZED", "Invalid api_key", 401));
    }
    if (key.expiresAt && key.expiresAt < /* @__PURE__ */ new Date()) {
      return next(new AppError("UNAUTHORIZED", "API key has expired", 401));
    }
    if (!key.homeId) {
      return next(
        new AppError(
          "KEY_NOT_SCOPED",
          "This API key is not scoped to a home \u2014 create a device key for a home first",
          400
        )
      );
    }
    await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: /* @__PURE__ */ new Date() } }).catch(() => void 0);
    req.apiKey = key;
    next();
  } catch (err) {
    next(err);
  }
};

// src/services/deviceApi.service.ts
init_prisma();
function homeScope(key) {
  if (!key.homeId) {
    throw new AppError("KEY_NOT_SCOPED", "API key is not scoped to a home", 400);
  }
  return key.homeId;
}
async function readAll(key) {
  const homeId = homeScope(key);
  const devices = await prisma.device.findMany({
    where: { homeId },
    orderBy: { createdAt: "desc" }
  });
  const result = await prisma.device.updateMany({ where: { homeId }, data: { lastSeen: /* @__PURE__ */ new Date(), offline: false } }).catch(() => null);
  if (result?.count) {
    const offlineDevices = devices.filter((d) => d.offline);
    for (const d of offlineDevices) {
      emitToHome(homeId, "device:updated", { id: d.id, offline: false, lastSeen: (/* @__PURE__ */ new Date()).toISOString() });
    }
  }
  return devices;
}
async function updateFromDevice(key, deviceId, status) {
  const homeId = homeScope(key);
  const device = await prisma.device.findFirst({ where: { id: deviceId, homeId } });
  if (!device) {
    throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  }
  await prisma.$transaction([
    prisma.device.update({
      where: { id: deviceId },
      data: { status, lastSeen: /* @__PURE__ */ new Date(), offline: false }
    }),
    prisma.deviceLog.create({
      data: {
        deviceId,
        actorId: null,
        logType: "status_change",
        logMessage: `Device switched ${status} (physical switch)`
      }
    })
  ]);
  const updated = await prisma.device.findUnique({ where: { id: deviceId } });
  if (updated) emitToHome(homeId, "device:updated", updated);
  return updated;
}
async function reportOtaProgress(key, input) {
  const homeId = homeScope(key);
  const device = await prisma.device.findFirst({
    where: { id: input.device_id, homeId }
  });
  if (!device) {
    throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  }
  const progress = Math.max(0, Math.min(100, Math.round(input.progress)));
  const status = input.status ?? null;
  if (device.espId) {
    const esp = await prisma.espDevice.update({
      where: { id: device.espId },
      data: { otaProgress: progress, otaStatus: status, lastSeen: /* @__PURE__ */ new Date(), offline: false }
    });
    emitToHome(homeId, "esp:updated", esp);
  }
  const updated = await prisma.device.update({
    where: { id: device.id },
    data: { otaProgress: progress, otaStatus: status, lastSeen: /* @__PURE__ */ new Date(), offline: false }
  });
  emitToHome(homeId, "device:updated", updated);
  return { progress, status };
}
async function heartbeat(key, input, baseUrl) {
  const homeId = homeScope(key);
  const device = await prisma.device.findFirst({
    where: { id: input.device_id, homeId }
  });
  if (!device) {
    throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  }
  const fw = input.fw_version?.trim() || void 0;
  const ip = input.ip?.trim() || void 0;
  const mac = input.mac?.trim() || void 0;
  const ssid = input.ssid?.trim() || void 0;
  const serial = input.serial?.trim().toUpperCase() || void 0;
  const model = input.model?.trim().toUpperCase() || void 0;
  let esp = null;
  const macKey = mac ? mac.replace(/[^0-9A-Fa-f:]/g, "").toLowerCase() : "";
  let attachSerial = serial;
  if (macKey && serial) {
    const other = await prisma.espDevice.findFirst({
      where: { serialCode: serial, macAddress: { not: macKey } },
      select: { id: true }
    });
    if (other) attachSerial = void 0;
  }
  const macTail = macKey.replace(/:/g, "").slice(-6).toUpperCase();
  if (macKey) {
    esp = await prisma.espDevice.upsert({
      where: { macAddress: macKey },
      create: {
        homeId,
        macAddress: macKey,
        // Unique + searchable naam: serial (product code) pehle, SSID baad me.
        // Serial na ho to MAC-tail se unique `ESP-XXXXXX` fallback.
        name: attachSerial ? `${attachSerial} \xB7 ${ssid ?? "SwitchNest"}` : ssid ? `${ssid} \xB7 ESP-${macTail}` : `ESP-${macTail}`,
        ssid,
        serialCode: attachSerial,
        modelCode: model,
        ipAddress: ip,
        firmwareVersion: fw,
        lastSeen: /* @__PURE__ */ new Date(),
        offline: false
      },
      update: {
        homeId,
        ssid: ssid ?? void 0,
        serialCode: attachSerial ?? void 0,
        modelCode: model ?? void 0,
        ipAddress: ip ?? void 0,
        firmwareVersion: fw ?? void 0,
        lastSeen: /* @__PURE__ */ new Date(),
        offline: false
      }
    });
    emitToHome(homeId, "esp:updated", esp);
  }
  const data = {
    lastSeen: /* @__PURE__ */ new Date(),
    offline: false
  };
  if (ip) data.ipAddress = ip;
  if (fw) data.firmwareVersion = fw;
  if (esp) data.esp = { connect: { id: esp.id } };
  const pendingVer = esp ? esp.otaPendingVersion : device.otaPendingVersion ?? null;
  if (fw && pendingVer && fw === pendingVer) {
    if (esp) {
      await prisma.espDevice.update({
        where: { id: esp.id },
        data: { otaPendingVersion: null, otaRequestedAt: null, otaProgress: null, otaStatus: null }
      });
    }
    data.otaPendingVersion = null;
    data.otaRequestedAt = null;
    data.otaProgress = null;
    data.otaStatus = null;
  }
  const updated = await prisma.device.update({ where: { id: device.id }, data });
  if (device.offline) {
    emitToHome(homeId, "device:updated", updated);
  }
  let synced = 0;
  let statesParsed = false;
  const controlledIds = [device.id];
  if (input.states && input.states.trim()) {
    let states = [];
    try {
      const parsed2 = JSON.parse(input.states);
      if (Array.isArray(parsed2)) states = parsed2;
    } catch {
      states = [];
    }
    if (states.length > 0) statesParsed = true;
    for (const st of states) {
      if (!st || typeof st.id !== "number" || st.status !== "on" && st.status !== "off") {
        continue;
      }
      const value = typeof st.value === "string" && /^\d+$/.test(st.value) ? st.value : void 0;
      const res = await prisma.device.updateMany({
        where: { id: st.id, homeId },
        data: {
          status: st.status,
          ...value ? { customValue: value } : {},
          lastSeen: /* @__PURE__ */ new Date(),
          offline: false
        }
      });
      if (res.count > 0) {
        synced++;
        controlledIds.push(st.id);
        emitToHome(homeId, "device:updated", { id: st.id, status: st.status });
      }
    }
  }
  if (esp) {
    await prisma.device.updateMany({
      where: { homeId, id: { in: [...new Set(controlledIds)] } },
      data: { espId: esp.id }
    });
    if (statesParsed) {
      await prisma.device.updateMany({
        where: { espId: esp.id, id: { notIn: [...new Set(controlledIds)] } },
        data: { espId: null }
      });
    }
  }
  const { resolveFirmware: resolveFirmware2 } = await Promise.resolve().then(() => (init_firmware_service(), firmware_service_exports));
  const current = await resolveFirmware2(esp?.modelCode);
  const running3 = fw ?? updated.firmwareVersion ?? device.firmwareVersion;
  const pendingNow = esp ? esp.otaPendingVersion : updated.otaPendingVersion ?? device.otaPendingVersion;
  let ota = null;
  if (pendingNow && current && running3 !== current.version) {
    ota = {
      version: current.version,
      url: baseUrl + current.url,
      releaseNotes: current.releaseNotes,
      required: true
    };
  }
  return {
    device: updated,
    esp: esp ? { id: esp.id, macAddress: esp.macAddress, name: esp.name, ssid: esp.ssid, serialCode: esp.serialCode, modelCode: esp.modelCode, ipAddress: esp.ipAddress, firmwareVersion: esp.firmwareVersion } : null,
    synced,
    ota
  };
}
async function pendingCommands(key) {
  const commands = await findPendingCommands(key);
  await markHomeAlive(key);
  return commands;
}
async function findPendingCommands(key) {
  const homeId = homeScope(key);
  return prisma.deviceCommand.findMany({
    where: { device: { homeId }, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 20
  });
}
async function markHomeAlive(key) {
  const homeId = homeScope(key);
  await prisma.device.updateMany({ where: { homeId }, data: { lastSeen: /* @__PURE__ */ new Date() } }).catch(() => void 0);
}
async function pendingCommandsLongPoll(key, holdMs, signal) {
  const deadline = Date.now() + holdMs;
  let commands = await findPendingCommands(key);
  while (commands.length === 0 && Date.now() < deadline) {
    if (signal?.aborted) break;
    await new Promise((r) => setTimeout(r, 300));
    commands = await findPendingCommands(key);
  }
  await markHomeAlive(key);
  return commands;
}
async function ackCommand(key, commandId, deviceId, status) {
  const homeId = homeScope(key);
  const command = await prisma.deviceCommand.findFirst({
    where: { id: commandId, deviceId },
    include: { device: true }
  });
  if (!command) {
    throw new AppError("COMMAND_NOT_FOUND", "Command not found", 404);
  }
  if (command.device.homeId !== homeId) {
    throw new AppError("FORBIDDEN", "Command does not belong to this home", 403);
  }
  if (command.status !== "pending") {
    return command;
  }
  const updated = await prisma.deviceCommand.update({
    where: { id: commandId },
    data: { status, executedAt: /* @__PURE__ */ new Date() }
  });
  emitToHome(homeId, "command:updated", { id: commandId, status, executedAt: updated.executedAt });
  return updated;
}

// src/routes/deviceApi.routes.ts
var deviceApiRouter = Router5();
var keyQuery = z6.object({
  api_key: z6.string().min(1),
  // Long-poll mode (ESP32 v2 firmware): `long=1&hold=20` — server response ko
  // hold karta hai jab tak command na aaye (max hold seconds). Old firmware
  // bina long=1 ke same instant behaviour paata hai.
  long: z6.string().optional(),
  hold: z6.string().optional()
});
var updateSchema2 = z6.object({
  api_key: z6.string().optional(),
  device_id: z6.coerce.number().int().positive(),
  status: z6.enum(["on", "off"])
});
var ackSchema = z6.object({
  api_key: z6.string().optional(),
  command_id: z6.coerce.number().int().positive(),
  device_id: z6.coerce.number().int().positive(),
  status: z6.enum(["executed", "failed"])
});
var heartbeatSchema = z6.object({
  api_key: z6.string().optional(),
  device_id: z6.coerce.number().int().positive(),
  ip: z6.string().optional(),
  fw_version: z6.string().optional(),
  mac: z6.string().optional(),
  ssid: z6.string().optional(),
  serial: z6.string().optional(),
  model: z6.string().optional(),
  states: z6.string().optional()
});
deviceApiRouter.get(
  "/read-all",
  validateQuery(keyQuery),
  requireApiKey,
  async (req, res) => ok(res, { devices: await readAll(req.apiKey) })
);
deviceApiRouter.post(
  "/update",
  requireApiKey,
  validateBody(updateSchema2),
  async (req, res) => ok(res, await updateFromDevice(req.apiKey, req.body.device_id, req.body.status))
);
deviceApiRouter.post(
  "/heartbeat",
  requireApiKey,
  validateBody(heartbeatSchema),
  async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    ok(
      res,
      await heartbeat(
        req.apiKey,
        {
          device_id: req.body.device_id,
          ip: req.body.ip,
          fw_version: req.body.fw_version,
          mac: req.body.mac,
          ssid: req.body.ssid,
          serial: req.body.serial,
          model: req.body.model,
          states: req.body.states
        },
        baseUrl
      )
    );
  }
);
var otaProgressSchema = z6.object({
  api_key: z6.string().optional(),
  device_id: z6.coerce.number().int().positive(),
  progress: z6.coerce.number().min(0).max(100),
  status: z6.string().max(32).optional()
});
deviceApiRouter.post(
  "/ota-progress",
  requireApiKey,
  validateBody(otaProgressSchema),
  async (req, res) => ok(res, await reportOtaProgress(req.apiKey, {
    device_id: req.body.device_id,
    progress: req.body.progress,
    status: req.body.status
  }))
);
deviceApiRouter.get(
  "/commands",
  validateQuery(keyQuery),
  requireApiKey,
  async (req, res) => {
    const long = req.query.long === "1" || req.query.long === "true";
    if (!long) {
      return ok(res, { commands: await pendingCommands(req.apiKey) });
    }
    const holdSec = Math.min(25, Math.max(1, Number(req.query.hold) || 20));
    const ac = new AbortController();
    res.on("close", () => ac.abort());
    const commands = await pendingCommandsLongPoll(
      req.apiKey,
      holdSec * 1e3,
      ac.signal
    );
    if (!res.headersSent) ok(res, { commands });
  }
);
deviceApiRouter.post(
  "/commands/ack",
  requireApiKey,
  validateBody(ackSchema),
  async (req, res) => ok(
    res,
    await ackCommand(
      req.apiKey,
      req.body.command_id,
      req.body.device_id,
      req.body.status
    )
  )
);

// src/routes/apiKey.routes.ts
import { Router as Router6 } from "express";
import crypto4 from "node:crypto";
import { z as z7 } from "zod";
init_prisma();
var apiKeyRouter = Router6();
var createSchema3 = z7.object({
  label: z7.string().min(1).max(100).optional(),
  homeId: z7.coerce.number().int().positive().optional(),
  expiresInDays: z7.coerce.number().int().positive().max(3650).optional()
});
function hashKey2(raw) {
  return crypto4.createHash("sha256").update(raw).digest("hex");
}
function generateKey() {
  const raw = `rs_${crypto4.randomBytes(24).toString("hex")}`;
  return { raw, prefix: raw.slice(0, 8) };
}
apiKeyRouter.get("/", requireAuth, async (req, res) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.user.sub },
    orderBy: { createdAt: "desc" }
  });
  ok(res, keys);
});
apiKeyRouter.post("/", requireAuth, validateBody(createSchema3), async (req, res) => {
  const { raw, prefix } = generateKey();
  const key = await prisma.apiKey.create({
    data: {
      userId: req.user.sub,
      homeId: req.body.homeId,
      label: req.body.label,
      keyHash: hashKey2(raw),
      keyPrefix: prefix,
      expiresAt: req.body.expiresInDays ? new Date(Date.now() + req.body.expiresInDays * 24 * 60 * 60 * 1e3) : null
    }
  });
  ok(res, { ...key, keyHash: void 0, rawKey: raw }, 201);
});
apiKeyRouter.delete("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.apiKey.findFirst({ where: { id, userId: req.user.sub } });
  if (!existing) throw new AppError("API_KEY_NOT_FOUND", "API key not found", 404);
  await prisma.apiKey.delete({ where: { id } });
  ok(res, { message: "API key revoked" });
});

// src/routes/room.routes.ts
import { Router as Router7 } from "express";
import { z as z8 } from "zod";

// src/services/room.service.ts
init_prisma();
async function createRoom(homeId, name) {
  const existing = await prisma.room.findUnique({
    where: { homeId_name: { homeId, name } }
  });
  if (existing) throw new AppError("ROOM_EXISTS", "A room with this name already exists", 409);
  return prisma.room.create({ data: { homeId, name } });
}
async function deleteRoom(homeId, roomId) {
  const room = await prisma.room.findFirst({ where: { id: roomId, homeId } });
  if (!room) throw new AppError("ROOM_NOT_FOUND", "Room not found in this home", 404);
  await prisma.room.delete({ where: { id: roomId } });
}

// src/routes/room.routes.ts
var roomRouter = Router7();
var idParams4 = z8.object({ homeId: z8.coerce.number().int().positive() });
var roomParams = z8.object({
  homeId: z8.coerce.number().int().positive(),
  roomId: z8.coerce.number().int().positive()
});
var createSchema4 = z8.object({ name: z8.string().min(1).max(100) });
roomRouter.post(
  "/:homeId/rooms",
  requireAuth,
  validateParams(idParams4),
  requireHomeMember("admin"),
  validateBody(createSchema4),
  async (req, res) => ok(res, await createRoom(Number(req.params.homeId), req.body.name), 201)
);
roomRouter.delete(
  "/:homeId/rooms/:roomId",
  requireAuth,
  validateParams(roomParams),
  requireHomeMember("admin"),
  async (req, res) => {
    await deleteRoom(Number(req.params.homeId), Number(req.params.roomId));
    ok(res, { message: "Room deleted" });
  }
);

// src/routes/schedule.routes.ts
import { Router as Router8 } from "express";
import { z as z9 } from "zod";

// src/services/schedule.service.ts
init_prisma();
function parseField(field, min, max) {
  const values = /* @__PURE__ */ new Set();
  for (const part of field.split(",")) {
    if (part === "*") {
      for (let i = min; i <= max; i++) values.add(i);
      continue;
    }
    let m = part.match(/^\*\/(\d+)$/);
    if (m) {
      const step = Number(m[1]);
      for (let i = min; i <= max; i += step) values.add(i);
      continue;
    }
    m = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const step = Number(m[3] ?? 1);
      for (let i = a; i <= b; i += step) values.add(i);
      continue;
    }
    m = part.match(/^(\d+)$/);
    if (m) {
      values.add(Number(m[1]));
      continue;
    }
    if (/^\d+$/.test(part)) values.add(Number(part) % 7);
  }
  return values;
}
function parseCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new AppError("BAD_REQUEST", "Cron must have 5 fields: minute hour day-of-month month day-of-week");
  }
  return {
    minutes: parseField(parts[0], 0, 59),
    hours: parseField(parts[1], 0, 23),
    dom: parseField(parts[2], 1, 31),
    months: parseField(parts[3], 1, 12),
    dow: parseField(parts[4], 0, 7)
  };
}
function matches(cron, d) {
  if (!cron.minutes.has(d.getMinutes())) return false;
  if (!cron.hours.has(d.getHours())) return false;
  if (!cron.dom.has(d.getDate())) return false;
  if (!cron.months.has(d.getMonth() + 1)) return false;
  if (!cron.dow.has(d.getDay())) return false;
  return true;
}
function nextCronRun(expr, from) {
  let cron;
  try {
    cron = parseCron(expr);
  } catch {
    return null;
  }
  const t = new Date(from);
  t.setSeconds(0, 0);
  t.setMinutes(t.getMinutes() + 1);
  const end = from.getTime() + 366 * 24 * 60 * 60 * 1e3;
  while (t.getTime() <= end) {
    if (matches(cron, t)) return t;
    t.setMinutes(t.getMinutes() + 1);
  }
  return null;
}
function computeNextRun(input) {
  const from = input.from ?? /* @__PURE__ */ new Date();
  if (input.type === "once") return input.runAt && input.runAt > from ? input.runAt : null;
  if (input.type === "cron") {
    if (!input.cron) return null;
    return nextCronRun(input.cron, from);
  }
  if (!input.runAt) return null;
  const intervalMs = input.type === "daily" ? 24 * 60 * 60 * 1e3 : 7 * 24 * 60 * 60 * 1e3;
  let next = new Date(input.runAt.getTime());
  const maxIterations = 400;
  for (let i = 0; i < maxIterations && next.getTime() <= from.getTime(); i++) {
    next = new Date(next.getTime() + intervalMs);
  }
  return next.getTime() > from.getTime() ? next : null;
}
async function createSchedule(input) {
  const device = await prisma.device.findFirst({
    where: { id: input.deviceId, homeId: input.homeId }
  });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  const membership2 = prisma.deviceAccess ? await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId: input.homeId, userId: input.actorId } },
    select: { restricted: true }
  }) : null;
  if (membership2?.restricted && prisma.deviceAccess) {
    const granted = await prisma.deviceAccess.findUnique({
      where: { deviceId_userId: { deviceId: input.deviceId, userId: input.actorId } }
    });
    if (!granted) {
      throw new AppError("FORBIDDEN", "Is device ka access nahi hai (child mode)", 403);
    }
  }
  let runAt = input.runAt ? new Date(input.runAt) : null;
  if (input.type !== "once" && input.type !== "cron" && runAt) {
    const now = /* @__PURE__ */ new Date();
    runAt = computeNextRun({ type: input.type, runAt, cron: null, from: now });
  }
  const nextRun = computeNextRun({ type: input.type, runAt, cron: input.cron ?? null });
  return prisma.schedule.create({
    data: {
      deviceId: input.deviceId,
      createdBy: input.actorId,
      action: input.action,
      type: input.type,
      runAt,
      cron: input.type === "cron" ? input.cron : null,
      nextRun
    }
  });
}
async function listSchedules(homeId) {
  const schedules = await prisma.schedule.findMany({
    where: { device: { homeId } },
    include: { device: { select: { id: true, name: true, type: true } } },
    orderBy: [{ enabled: "desc" }, { nextRun: "asc" }]
  });
  return schedules;
}
async function updateSchedule(homeId, scheduleId, input) {
  const existing = await prisma.schedule.findFirst({
    where: { id: scheduleId, device: { homeId } }
  });
  if (!existing) throw new AppError("NOT_FOUND", "Schedule not found", 404);
  const action = input.action ?? existing.action;
  const type = existing.type;
  let runAt = input.runAt !== void 0 ? input.runAt ? new Date(input.runAt) : null : existing.runAt;
  const cron = input.cron !== void 0 ? input.cron : existing.cron;
  const nextRun = input.enabled === false ? existing.nextRun : computeNextRun({ type, runAt, cron, from: /* @__PURE__ */ new Date() });
  return prisma.schedule.update({
    where: { id: scheduleId },
    data: { action, runAt, cron, nextRun, enabled: input.enabled ?? existing.enabled }
  });
}
async function deleteSchedule(homeId, scheduleId) {
  const existing = await prisma.schedule.findFirst({
    where: { id: scheduleId, device: { homeId } }
  });
  if (!existing) throw new AppError("NOT_FOUND", "Schedule not found", 404);
  await prisma.schedule.delete({ where: { id: scheduleId } });
  return { deleted: true };
}

// src/routes/schedule.routes.ts
var scheduleRouter = Router8();
var homeParams = z9.object({ homeId: z9.coerce.number().int().positive() });
var scheduleParams = z9.object({
  homeId: z9.coerce.number().int().positive(),
  scheduleId: z9.coerce.number().int().positive()
});
var createSchema5 = z9.object({
  deviceId: z9.number().int().positive(),
  action: z9.enum(["on", "off"]),
  type: z9.enum(["once", "daily", "weekly", "cron"]),
  runAt: z9.string().datetime({ offset: true }).optional().nullable(),
  cron: z9.string().regex(/^(\S+\s){4}\S+$/, "Cron must have 5 fields: minute hour day-of-month month day-of-week").optional().nullable()
});
var updateSchema3 = z9.object({
  action: z9.enum(["on", "off"]).optional(),
  enabled: z9.boolean().optional(),
  runAt: z9.string().datetime({ offset: true }).optional().nullable(),
  cron: z9.string().regex(/^(\S+\s){4}\S+$/, "Cron must have 5 fields").optional().nullable()
}).refine((d) => Object.keys(d).length > 0, "At least one field to update is required");
scheduleRouter.post(
  "/:homeId/schedules",
  requireAuth,
  validateParams(homeParams),
  requireHomeMember("member"),
  validateBody(createSchema5),
  async (req, res) => {
    const { deviceId, action, type, runAt, cron } = req.body;
    const schedule = await createSchedule({
      homeId: Number(req.params.homeId),
      actorId: req.user.sub,
      deviceId,
      action,
      type,
      runAt,
      cron: type === "cron" ? cron : null
    });
    ok(res, schedule, 201);
  }
);
scheduleRouter.get(
  "/:homeId/schedules",
  requireAuth,
  validateParams(homeParams),
  requireHomeMember("viewer"),
  async (req, res) => {
    ok(res, await listSchedules(Number(req.params.homeId)));
  }
);
scheduleRouter.patch(
  "/:homeId/schedules/:scheduleId",
  requireAuth,
  validateParams(scheduleParams),
  requireHomeMember("member"),
  validateBody(updateSchema3),
  async (req, res) => {
    const updated = await updateSchedule(
      Number(req.params.homeId),
      Number(req.params.scheduleId),
      req.body
    );
    ok(res, updated);
  }
);
scheduleRouter.delete(
  "/:homeId/schedules/:scheduleId",
  requireAuth,
  validateParams(scheduleParams),
  requireHomeMember("member"),
  async (req, res) => {
    await deleteSchedule(Number(req.params.homeId), Number(req.params.scheduleId));
    ok(res, { message: "Schedule deleted" });
  }
);

// src/routes/notification.routes.ts
import { Router as Router9 } from "express";
import { z as z10 } from "zod";
var notificationRouter = Router9();
notificationRouter.get("/", requireAuth, async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  const category = String(req.query.category ?? "all");
  const type = String(req.query.type ?? "all");
  const unread = req.query.unread === "1" || req.query.unread === "true";
  ok(
    res,
    await listNotifications(req.user.sub, { page, pageSize, category, type, unread })
  );
});
notificationRouter.get("/unread-count", requireAuth, async (req, res) => {
  ok(res, await unreadCount(req.user.sub));
});
notificationRouter.post("/read-all", requireAuth, async (req, res) => {
  ok(res, await markAllRead(req.user.sub));
});
var idParams5 = z10.object({ id: z10.coerce.number().int().positive() });
notificationRouter.post("/:id/read", requireAuth, validateParams(idParams5), async (req, res) => {
  ok(res, await markRead(req.user.sub, Number(req.params.id)));
});
notificationRouter.delete("/:id", requireAuth, validateParams(idParams5), async (req, res) => {
  ok(res, await remove2(req.user.sub, Number(req.params.id)));
});

// src/routes/assistant.routes.ts
import { Router as Router10 } from "express";
import { z as z11 } from "zod";
init_prisma();

// src/services/assistant.service.ts
init_prisma();
init_audit_service();
var ON_PATTERNS = [
  /\b(turn\s+)?on\b/,
  /\bstart\b/,
  /\bchalu\b/,
  /\bjalo\b/,
  /\bopen\b/,
  /\bkholo\b/
];
var OFF_PATTERNS = [
  /\b(turn\s+)?off\b/,
  /\bstop\b/,
  /\bband\b/,
  /\bbujha\b/,
  /\bclose\b/,
  /\bband karo\b/
];
var ALL_PATTERNS = [/\ball\b/, /\bsab\b/, /\bsabhi\b/, /\bsaare\b/, /\beverything\b/, /\bhar ek\b/];
var TYPE_KEYWORDS = [
  { types: ["fan"], words: /\bfan\b|\bpankh/ },
  { types: ["bulb", "light"], words: /\blight|\bbulb\b|\blamp\b|\bdiya\b/ },
  { types: ["tv"], words: /\btv\b|\btelevision\b/ },
  { types: ["ac"], words: /\bac\b|\bair\s*condition|\bcooler\b/ },
  { types: ["plug"], words: /\bplug\b|\bsocket\b/ }
];
function detectAction(text) {
  const lower = text.toLowerCase();
  const hasOn = ON_PATTERNS.some((r) => r.test(lower));
  const hasOff = OFF_PATTERNS.some((r) => r.test(lower));
  if (hasOn && hasOff) return null;
  if (hasOn) return "on";
  if (hasOff) return "off";
  return null;
}
function isAllRequest(text) {
  const lower = text.toLowerCase();
  return ALL_PATTERNS.some((r) => r.test(lower));
}
function matchedTypes(text) {
  const lower = text.toLowerCase();
  const found = /* @__PURE__ */ new Set();
  for (const t of TYPE_KEYWORDS) {
    if (t.words.test(lower)) for (const ty of t.types) found.add(ty);
  }
  return [...found];
}
function parseIntent(text, devices) {
  const action = detectAction(text);
  const lower = text.toLowerCase();
  const all = isAllRequest(text);
  const types = matchedTypes(text);
  let matches2 = [];
  if (all && types.length === 0) {
    matches2 = devices;
  } else {
    for (const d of devices) {
      if (lower.includes(d.name.toLowerCase())) matches2.push(d);
    }
    if (types.length > 0) {
      for (const d of devices) {
        if (types.includes(d.type) && !matches2.includes(d)) matches2.push(d);
      }
    }
  }
  return {
    action,
    actions: action ? matches2.map((d) => ({ deviceId: d.id, deviceName: d.name, action })) : [],
    matchedBy: all ? "all" : types.length > 0 ? `type:${types.join(",")}` : matches2.length > 0 ? "name" : "none"
  };
}
async function createChat(userId, homeId, title) {
  return prisma.assistantChat.create({
    data: { userId, homeId, title: title?.trim() || "AI Assist" }
  });
}
async function listChats(userId) {
  return prisma.assistantChat.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20
  });
}
async function getChat(userId, chatId) {
  return prisma.assistantChat.findFirst({ where: { id: chatId, userId } });
}
async function listMessages(chatId) {
  return prisma.assistantMessage.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" }
  });
}
function encodeAssistantContent(text, proposal) {
  return JSON.stringify({ text, proposal });
}
function decodeAssistantContent(content) {
  try {
    const parsed2 = JSON.parse(content);
    return { text: parsed2.text ?? content, proposal: parsed2.proposal ?? null };
  } catch {
    return { text: content, proposal: null };
  }
}
var STATUS_PATTERNS = [
  /\bstatus\b/,
  /\bstates?\b/,
  /\bkya (haal|hal)\b/,
  /\bkaise (hai|hain)\b/,
  /\bcheck\b/,
  /\bcondition\b/,
  /\bkaun se (on|chalu)\b/,
  /\bwhich.*(on|chalu)\b/,
  /\bsab (on|off|chalu|band)\b/,
  /\bkitne (on|chalu)\b/
];
var TROUBLE_PATTERNS = [
  /\bkaam nahi (kar raha|kar rahi)\b/,
  /\bnahi (chal|chalu|khul|khuli|ja raha|ho raha)\b/,
  /\bnot (working|turning|responding)\b/,
  /\bproblem\b/,
  /\bissue\b/,
  /\bkharab\b/,
  /\bgadbad\b/,
  /\btrouble\b/,
  /\bbroken\b/,
  /\bkyu(n)?\b.*\bnahi\b/,
  /\bwhy.*(not|isn.t)\b/,
  /\bmadad\b/
];
var ONLINE_PATTERNS = [/online/, /offline/, /connected/, /zinda/, /available/];
function detectQueryType(text) {
  const lower = text.toLowerCase();
  if (TROUBLE_PATTERNS.some((r) => r.test(lower))) return "troubleshoot";
  if (STATUS_PATTERNS.some((r) => r.test(lower)) || ONLINE_PATTERNS.some((r) => r.test(lower))) return "status";
  return null;
}
function fmtRelative(ts) {
  if (!ts) return "kabhi nahi";
  const mins = Math.floor((Date.now() - ts.getTime()) / 6e4);
  if (mins < 1) return "abhi";
  if (mins < 60) return `${mins} min pehle`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ghante pehle`;
  return `${Math.floor(hrs / 24)} din pehle`;
}
function deviceOnline(d) {
  if (d.offline) return false;
  if (!d.lastSeen) return false;
  return Date.now() - d.lastSeen.getTime() < 24 * 60 * 60 * 1e3;
}
function buildStatusReply(devices, content) {
  const lower = content.toLowerCase();
  const matched = devices.filter((d) => lower.includes(d.name.toLowerCase()));
  const list4 = matched.length > 0 ? matched : devices;
  const lines = list4.map((d) => {
    const st = d.status === "on" ? "ON \u2705" : "OFF";
    const conn = deviceOnline(d) ? "online" : "offline \u26A0\uFE0F";
    return `\u2022 ${d.name} \u2014 ${st} (${conn}, last seen ${fmtRelative(d.lastSeen)})`;
  });
  const header = matched.length > 0 ? `\u{1F4CA} "${content.trim()}" ka status:` : `\u{1F4CA} Tumhare home ke devices ka status:`;
  return `${header}
${lines.join(String.fromCharCode(10))}

Kisi device ki problem ho to bolo \u2014 jaise "bulb kyu kaam nahi kar raha".`;
}
function buildTroubleshootReply(devices, content) {
  const lower = content.toLowerCase();
  const matched = devices.filter((d) => lower.includes(d.name.toLowerCase()));
  const target = matched.length > 0 ? matched : devices;
  const parts = [];
  for (const d of target) {
    const pending = d._count?.commands ?? 0;
    parts.push(`\u{1F527} ${d.name}:`);
    parts.push(`  \u2022 Status: ${d.status.toUpperCase()}`);
    parts.push(`  \u2022 Connection: ${deviceOnline(d) ? "ONLINE" : "OFFLINE \u26A0\uFE0F"} (last seen ${fmtRelative(d.lastSeen)})`);
    if (d.firmwareVersion) parts.push(`  \u2022 Firmware: ${d.firmwareVersion}`);
    if (d.ipAddress) parts.push(`  \u2022 Board IP: ${d.ipAddress}`);
    parts.push(`  \u2022 Pending commands: ${pending}`);
    if (!deviceOnline(d)) {
      parts.push(`  \u2192 ${d.name} board se connected NAHI hai.`);
      parts.push(`    Fix: (1) Board ka power check karo (USB/adapter)  (2) WiFi router on hai?  (3) Board reboot karo`);
    } else if (pending > 0) {
      parts.push(`  \u2192 Kuch commands atki hui hain (pending queue).`);
      parts.push(`    Fix: (1) 5-10 sec wait karo \u2014 board har 5s poll karta hai  (2) fir bhi na ho to support se "clear stuck commands" karwao`);
    } else if (d.status === "on") {
      parts.push(`  \u2192 Device ON dikh raha hai par kaam nahi kar raha?`);
      parts.push(`    Fix: (1) wiring/connection check karo  (2) kisi dusre device se relay test karo`);
    } else {
      parts.push(`  \u2192 Device OFF hai. Pehle ON karo \u2014 "ON karo" bolo ya dashboard se toggle karo.`);
    }
  }
  return parts.join(String.fromCharCode(10)) + `

Aur madad chahiye? Board level ki details ke liye admin/support se baat karo.`;
}
async function sendMessage(userId, chatId, content) {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new AppError("NOT_FOUND", "Chat not found", 404);
  const userMessage = await prisma.assistantMessage.create({
    data: { chatId, role: "user", content }
  });
  const devices = await prisma.device.findMany({
    where: { homeId: chat.homeId },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      lastSeen: true,
      offline: true,
      ipAddress: true,
      firmwareVersion: true,
      _count: { select: { commands: { where: { status: "pending" } } } }
    }
  });
  const queryType = detectQueryType(content);
  if (queryType) {
    const replyText2 = queryType === "troubleshoot" ? buildTroubleshootReply(devices, content) : buildStatusReply(devices, content);
    const assistantMessage2 = await prisma.assistantMessage.create({
      data: { chatId, role: "assistant", content: encodeAssistantContent(replyText2, null) }
    });
    if (chat.title === "AI Assist" && content.trim().length > 0) {
      await prisma.assistantChat.update({
        where: { id: chat.id },
        data: { title: content.trim().slice(0, 60) }
      });
    }
    return { chat, userMessage, assistantMessage: { ...assistantMessage2, content: replyText2, proposal: null } };
  }
  const parsed2 = parseIntent(content, devices);
  let replyText;
  let proposal = null;
  if (!parsed2.action) {
    replyText = 'Mujhe samajh nahi aaya ki device ON karni hai ya OFF. Kuch aise bolo:\n\u2022 "turn on the fan" / "pankha chalu karo"\n\u2022 "turn off all lights" / "saare bulbs band karo"\n\u2022 "TV on karo"';
  } else if (parsed2.actions.length === 0) {
    replyText = 'Mujhe koi device nahi mili is home me jo tumhari baat se match kare. Device ka naam batao (jaise PANKHA, TV, Bulb) ya "all devices" bolo.';
  } else {
    proposal = parsed2.actions;
    const labels = parsed2.actions.map((a) => `${a.deviceName} (${a.action.toUpperCase()})`);
    replyText = `Main in devices ko ${parsed2.action.toUpperCase()} kar dunga:
\u2022 ${labels.join(
      "\n\u2022 "
    )}

Confirm karo to execute ho jayega.`;
  }
  const assistantMessage = await prisma.assistantMessage.create({
    data: { chatId, role: "assistant", content: encodeAssistantContent(replyText, proposal) }
  });
  if (chat.title === "AI Assist" && content.trim().length > 0) {
    await prisma.assistantChat.update({
      where: { id: chat.id },
      data: { title: content.trim().slice(0, 60) }
    });
  }
  return { chat, userMessage, assistantMessage: { ...assistantMessage, content: replyText, proposal } };
}
async function confirmProposal(userId, chatId, messageId) {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new AppError("NOT_FOUND", "Chat not found", 404);
  const message = await prisma.assistantMessage.findFirst({
    where: { id: messageId, chatId, role: "assistant" }
  });
  if (!message) throw new AppError("NOT_FOUND", "Proposal message not found", 404);
  const { proposal } = decodeAssistantContent(message.content);
  if (!proposal || proposal.length === 0) {
    throw new AppError("BAD_REQUEST", "This message has no executable proposal", 400);
  }
  const results = [];
  for (const p of proposal) {
    try {
      await setDeviceStatus({ homeId: chat.homeId, deviceId: p.deviceId, actorId: userId, status: p.action });
      results.push({ deviceId: p.deviceId, deviceName: p.deviceName, action: p.action, ok: true });
    } catch (err) {
      results.push({
        deviceId: p.deviceId,
        deviceName: p.deviceName,
        action: p.action,
        ok: false,
        error: err instanceof Error ? err.message : "failed"
      });
    }
  }
  const done = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  let replyText = `\u2705 ${done} device(s) ${results[0]?.action.toUpperCase() ?? ""} ho gaye: ${results.filter((r) => r.ok).map((r) => r.deviceName).join(", ")}.`;
  if (failed.length > 0) {
    replyText += `
\u274C Failed: ${failed.map((r) => `${r.deviceName} (${r.error})`).join(", ")}`;
  }
  const assistantMessage = await prisma.assistantMessage.create({
    data: { chatId, role: "assistant", content: encodeAssistantContent(replyText, null) }
  });
  await audit(userId, "assistant.execute", {
    homeId: chat.homeId,
    entity: "assistant",
    entityId: chat.id,
    meta: { results }
  });
  return { results, assistantMessage: { ...assistantMessage, content: replyText, proposal: null } };
}

// src/routes/assistant.routes.ts
var assistantRouter = Router10();
var chatParams = z11.object({ chatId: z11.coerce.number().int().positive() });
var createSchema6 = z11.object({
  homeId: z11.number().int().positive(),
  title: z11.string().max(100).optional()
});
var messageSchema = z11.object({ content: z11.string().min(1).max(2e3) });
var confirmSchema = z11.object({ messageId: z11.number().int().positive() });
async function membership(userId, homeId) {
  return prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId } }
  });
}
assistantRouter.post("/chats", requireAuth, validateBody(createSchema6), async (req, res) => {
  const { homeId, title } = req.body;
  const member = await membership(req.user.sub, homeId);
  if (!member) {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not a member of this home" } });
  }
  ok(res, await createChat(req.user.sub, homeId, title), 201);
});
assistantRouter.get("/chats", requireAuth, async (req, res) => {
  ok(res, await listChats(req.user.sub));
});
assistantRouter.post(
  "/chats/:chatId/messages",
  requireAuth,
  validateParams(chatParams),
  validateBody(messageSchema),
  async (req, res) => {
    const result = await sendMessage(req.user.sub, Number(req.params.chatId), req.body.content);
    const member = await membership(req.user.sub, result.chat.homeId);
    if (!member) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not a member of this home" } });
    }
    ok(res, result);
  }
);
assistantRouter.post(
  "/chats/:chatId/confirm",
  requireAuth,
  validateParams(chatParams),
  validateBody(confirmSchema),
  async (req, res) => {
    const chat = await getChat(req.user.sub, Number(req.params.chatId));
    if (!chat) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Chat not found" } });
    }
    const member = await membership(req.user.sub, chat.homeId);
    if (!member) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not a member of this home" } });
    }
    ok(res, await confirmProposal(req.user.sub, Number(req.params.chatId), req.body.messageId));
  }
);
assistantRouter.get("/chats/:chatId/messages", requireAuth, validateParams(chatParams), async (req, res) => {
  const chat = await getChat(req.user.sub, Number(req.params.chatId));
  if (!chat) {
    return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Chat not found" } });
  }
  const messages = await listMessages(chat.id);
  ok(
    res,
    messages.map((m) => {
      if (m.role !== "assistant") return m;
      const { text, proposal } = decodeAssistantContent(m.content);
      return { ...m, content: text, proposal };
    })
  );
});

// src/routes/admin.routes.ts
import { Router as Router11 } from "express";
import { z as z12 } from "zod";
import multer from "multer";
import path4 from "node:path";
import fs3 from "node:fs";
init_prisma();
init_audit_service();

// src/services/shop.service.ts
init_prisma();

// src/lib/crypto.ts
import crypto5 from "node:crypto";
var KEY = crypto5.createHash("sha256").update(env.WIFI_ENC_KEY).digest();
function encryptSecret(plain) {
  const iv = crypto5.randomBytes(12);
  const cipher = crypto5.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}
function decryptSecret(payload) {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted payload");
  const decipher = crypto5.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final()
  ]).toString("utf8");
}

// src/services/shop.service.ts
var ORDER_STATUS_FLOW = {
  pending: ["paid", "cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: []
};
function makeOrderNumber() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RS${t}${r}`;
}
function makeSerialCode(modelCode) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rnd = "";
  for (let i = 0; i < 6; i++) rnd += chars[Math.floor(Math.random() * chars.length)];
  return `RS-${modelCode}-${rnd}`;
}
async function reserveSerials(tx, orderId, productId, qty) {
  const found = await tx.serialRegistry.findMany({
    where: { productId, status: "available" },
    orderBy: { id: "asc" },
    take: qty
  });
  if (!found.length) return [];
  await tx.serialRegistry.updateMany({
    where: { id: { in: found.map((f) => f.id) } },
    data: { status: "reserved", orderId }
  });
  return found.map((f) => f.serialCode);
}
async function createOrder(input) {
  if (!input.items.length) throw new AppError("BAD_REQUEST", "Cart is empty");
  const products = await prisma.product.findMany({
    where: { id: { in: input.items.map((i) => i.productId) }, active: true }
  });
  if (!products.length) throw new AppError("NOT_FOUND", "No valid products in cart");
  const productMap = new Map(products.map((p) => [p.id, p]));
  let total2 = 0;
  for (const it of input.items) {
    const prod = productMap.get(it.productId);
    if (!prod) throw new AppError("NOT_FOUND", `Product ${it.productId} not found`);
    if (!Number.isInteger(it.quantity) || it.quantity < 1) {
      throw new AppError("BAD_REQUEST", `Invalid quantity for ${prod.name}`);
    }
    total2 += Number(prod.price) * it.quantity;
  }
  const wifiPasswordEnc = input.wifi?.password ? encryptSecret(input.wifi.password) : null;
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: makeOrderNumber(),
        userId: input.userId,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentMethod === "cod" ? "pending" : "unpaid",
        totalAmount: total2,
        shippingName: input.shipping.name,
        shippingPhone: input.shipping.phone,
        shippingAddress: input.shipping.address,
        wifiSsid: input.wifi?.ssid?.trim() || null,
        wifiPasswordEnc
      }
    });
    for (const it of input.items) {
      const prod = productMap.get(it.productId);
      const serials = await reserveSerials(tx, created.id, prod.id, it.quantity);
      await tx.orderItem.create({
        data: {
          orderId: created.id,
          productId: prod.id,
          productName: prod.name,
          price: prod.price,
          quantity: it.quantity,
          serialCode: serials[0] ?? null
        }
      });
    }
    return tx.order.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: true }
    });
  });
  try {
    await createNotification(input.userId, {
      category: "system",
      type: "info",
      title: "\u{1F4E6} Order placed",
      body: `Order ${order.orderNumber} \u2014 \u20B9${Number(order.totalAmount).toLocaleString("en-IN")}, ${order.items.length} item(s). Status: ${order.status}.`
    });
  } catch (err) {
    console.error("[shop] order notification failed", err);
  }
  return order;
}
async function generateSerials(productId, count) {
  if (count < 1 || count > 500) throw new AppError("BAD_REQUEST", "Count must be between 1 and 500");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError("NOT_FOUND", "Product not found");
  const data = [];
  while (data.length < count) {
    const code = makeSerialCode(product.modelCode);
    const exists = await prisma.serialRegistry.findUnique({ where: { serialCode: code } });
    if (!exists) data.push({ serialCode: code, productId });
  }
  await prisma.serialRegistry.createMany({ data });
  return data.map((d) => d.serialCode);
}
async function updateOrderStatus(orderId, status) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });
  if (!order) throw new AppError("NOT_FOUND", "Order not found");
  if (!(status in ORDER_STATUS_FLOW)) {
    throw new AppError("BAD_REQUEST", `Invalid status ${status}`);
  }
  const allowed = ORDER_STATUS_FLOW[order.status] ?? [];
  if (!allowed.includes(status)) {
    throw new AppError("BAD_REQUEST", `Cannot move order from ${order.status} to ${status}`);
  }
  return prisma.$transaction(async (tx) => {
    if (status === "cancelled") {
      await tx.serialRegistry.updateMany({
        where: { orderId: order.id },
        data: { status: "available", orderId: null }
      });
    } else if (status === "shipped") {
      for (const item of order.items) {
        if (item.serialCode) continue;
        const need = item.quantity;
        const found = await tx.serialRegistry.findMany({
          where: { productId: item.productId, status: "available" },
          orderBy: { id: "asc" },
          take: need
        });
        if (found.length) {
          await tx.serialRegistry.updateMany({
            where: { id: { in: found.map((f) => f.id) } },
            data: { status: "shipped", orderId: order.id }
          });
          await tx.orderItem.update({
            where: { id: item.id },
            data: { serialCode: found[0].serialCode }
          });
        }
      }
      await tx.serialRegistry.updateMany({
        where: { orderId: order.id, status: "reserved" },
        data: { status: "shipped" }
      });
    } else if (status === "delivered") {
      await tx.serialRegistry.updateMany({
        where: { orderId: order.id, status: { in: ["shipped", "reserved"] } },
        data: { status: "delivered" }
      });
    }
    return tx.order.update({
      where: { id: order.id },
      data: {
        status,
        paymentStatus: status === "paid" ? "paid" : order.paymentStatus
      },
      include: { items: true, user: { select: { id: true, username: true, email: true } } }
    });
  });
}

// src/routes/admin.routes.ts
init_firmware_service();

// src/lib/requestTracker.ts
init_prisma();
var DAY_MS = 24 * 60 * 60 * 1e3;
var STORE_KEY = "req_tracker";
var hourly = /* @__PURE__ */ new Map();
var daily = /* @__PURE__ */ new Map();
var total = 0;
var loaded = false;
function dayKey(d) {
  return d.toISOString().slice(0, 10);
}
function hourKey(d) {
  return d.toISOString().slice(0, 13);
}
function trackRequest() {
  const now = /* @__PURE__ */ new Date();
  const hk = hourKey(now);
  const dk = dayKey(now);
  hourly.set(hk, (hourly.get(hk) ?? 0) + 1);
  daily.set(dk, (daily.get(dk) ?? 0) + 1);
  total++;
}
function getRequestStats() {
  const now = /* @__PURE__ */ new Date();
  const cutoff = now.getTime() - DAY_MS;
  let last24h = 0;
  for (const [k, v] of hourly) {
    const t = (/* @__PURE__ */ new Date(`${k}:00:00.000Z`)).getTime();
    if (t >= cutoff) last24h += v;
  }
  return { today: daily.get(dayKey(now)) ?? 0, last24h, total };
}
async function loadRequestTracker() {
  if (loaded) return;
  try {
    const row = await prisma.appMeta.findUnique({ where: { key: STORE_KEY } });
    if (row?.value) {
      const p = JSON.parse(row.value);
      for (const [k, v] of Object.entries(p.hourly ?? {})) hourly.set(k, v);
      for (const [k, v] of Object.entries(p.daily ?? {})) daily.set(k, v);
      total = p.total ?? Object.values(p.daily ?? {}).reduce((a, b) => a + b, 0);
      const cutoff = Date.now() - 40 * DAY_MS;
      for (const k of [...hourly.keys()]) {
        if ((/* @__PURE__ */ new Date(`${k}:00:00.000Z`)).getTime() < cutoff) hourly.delete(k);
      }
      for (const k of [...daily.keys()]) {
        if ((/* @__PURE__ */ new Date(`${k}T00:00:00.000Z`)).getTime() < cutoff) daily.delete(k);
      }
    }
  } catch {
  }
  loaded = true;
}
var flushTimer = null;
function startRequestFlush(intervalMs = 6e4) {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushRequestTracker();
  }, intervalMs);
  flushTimer.unref?.();
}
async function flushRequestTracker() {
  try {
    await prisma.appMeta.upsert({
      where: { key: STORE_KEY },
      create: {
        key: STORE_KEY,
        value: JSON.stringify({
          hourly: Object.fromEntries(hourly),
          daily: Object.fromEntries(daily),
          total
        })
      },
      update: {
        value: JSON.stringify({
          hourly: Object.fromEntries(hourly),
          daily: Object.fromEntries(daily),
          total
        })
      }
    });
  } catch {
  }
}

// src/services/siteSettings.service.ts
init_prisma();
var DEFAULT_SITE_SETTINGS = {
  siteName: "SwitchNest",
  supportEmail: "support@switchnest.in",
  supportPhone: "+91 98765 43210",
  supportAddress: "SwitchNest Labs, Sector 62, Noida, UP 201309",
  supportHours: "Mon\u2013Sat \xB7 9:00 AM \u2013 7:00 PM",
  brandColor: "#2563eb",
  siteUrl: "https://onlineswitch.bhartitechnical.com",
  // SMTP defaults yahan empty — asli defaults (587, STARTTLS) email.service me resolve hote hain,
  // taaki SMTP_* env vars hamesha precedence le saken jab settings me kuch set na ho.
  smtpHost: "",
  smtpPort: 0,
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "",
  smtpSecure: false
};
var KEY2 = "site_settings";
async function getSiteSettings() {
  try {
    const row = await prisma.appMeta.findUnique({ where: { key: KEY2 } });
    if (row?.value) {
      return { ...DEFAULT_SITE_SETTINGS, ...JSON.parse(row.value) };
    }
  } catch {
  }
  return DEFAULT_SITE_SETTINGS;
}
async function getPublicSiteSettings() {
  const s = await getSiteSettings();
  const { smtpHost: _h, smtpPort: _p, smtpUser: _u, smtpPass: _pp, smtpFrom: _f, smtpSecure: _sc, ...pub } = s;
  return pub;
}
async function updateSiteSettings(patch) {
  const current = await getSiteSettings();
  const next = { ...current, ...patch };
  if (patch.smtpPass !== void 0) {
    if (patch.smtpPass) next.smtpPass = encryptSecret(patch.smtpPass);
    else next.smtpPass = current.smtpPass;
  }
  await prisma.appMeta.upsert({
    where: { key: KEY2 },
    create: { key: KEY2, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) }
  });
  return next;
}

// src/lib/dbState.ts
var ready = true;
function setDbReady(value) {
  ready = value;
}
function isDbReady() {
  return ready;
}

// src/lib/email.service.ts
import * as net from "node:net";
import * as tls from "node:tls";
import * as os2 from "node:os";
async function getSmtpConfig() {
  const s = await getSiteSettings().catch(() => null);
  let pass = "";
  if (s?.smtpPass) {
    try {
      pass = decryptSecret(s.smtpPass);
    } catch {
      pass = s.smtpPass;
    }
  }
  return {
    host: s?.smtpHost || process.env.SMTP_HOST || "",
    port: s?.smtpPort || Number(process.env.SMTP_PORT) || 587,
    user: s?.smtpUser || process.env.SMTP_USER || "",
    pass: pass || process.env.SMTP_PASS || "",
    from: s?.smtpFrom || process.env.SMTP_FROM || s?.supportEmail || env.ADMIN_EMAIL,
    secure: s?.smtpSecure || process.env.SMTP_SECURE === "true"
  };
}
function isEmailConfigured(cfg) {
  return !!(cfg.host && cfg.user && cfg.pass);
}
function createReader(sock, timeoutMs) {
  let buf = "";
  let pending = null;
  let timer4 = null;
  const tryResolve = () => {
    if (!pending || !buf.endsWith("\r\n")) return false;
    const lines = buf.split("\r\n").filter((l) => l.length > 0);
    const last = lines[lines.length - 1] ?? "";
    if (!/^\d{3} /.test(last)) return false;
    const p = pending;
    pending = null;
    if (timer4) clearTimeout(timer4);
    buf = "";
    p.resolve(lines);
    return true;
  };
  const onData = (chunk) => {
    buf += chunk.toString("utf8");
    tryResolve();
  };
  sock.on("data", onData);
  return {
    next() {
      if (pending) return Promise.reject(new Error("SMTP: concurrent read"));
      return new Promise((resolve3, reject) => {
        pending = { resolve: resolve3, reject };
        timer4 = setTimeout(() => {
          if (pending) {
            const p = pending;
            pending = null;
            p.reject(new Error("SMTP timeout"));
          }
        }, timeoutMs);
        tryResolve();
      });
    },
    detach() {
      sock.off("data", onData);
      if (timer4) clearTimeout(timer4);
    }
  };
}
function send(sock, line) {
  sock.write(line + "\r\n");
}
function encodeHeader(value) {
  return /[^\x20-\x7E]/.test(value) ? `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=` : value;
}
function buildMessage(from, to, subject, text, html) {
  const date = (/* @__PURE__ */ new Date()).toUTCString();
  const boundary = `----switchnest_${Date.now().toString(36)}`;
  const head = [
    `Date: ${date}`,
    `From: ${encodeHeader("SwitchNest")} <${from}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0"
  ];
  const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
  const lines = html ? [
    ...head,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(html),
    `--${boundary}--`,
    "."
  ] : [
    ...head,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(text),
    "."
  ];
  return lines.join("\r\n");
}
async function sendEmail(opts) {
  const cfg = await getSmtpConfig().catch(() => null);
  if (!cfg || !isEmailConfigured(cfg)) {
    logger.warn(`[email] SMTP configured nahi hai \u2014 email skip (to=${opts.to})`);
    return { ok: false, skipped: true, error: "SMTP not configured" };
  }
  return new Promise((resolve3) => {
    let sock;
    try {
      sock = net.connect({ host: cfg.host, port: cfg.port });
    } catch (e) {
      logger.error("[email] connect error", e);
      return resolve3({ ok: false, error: String(e) });
    }
    let reader = createReader(sock, 2e4);
    let done = false;
    const fail2 = (msg) => {
      if (done) return;
      done = true;
      try {
        reader.detach();
        sock.destroy();
      } catch {
      }
      logger.warn(`[email] SMTP fail (${cfg.host}): ${msg}`);
      resolve3({ ok: false, error: msg });
    };
    const succeed = () => {
      if (done) return;
      done = true;
      try {
        reader.detach();
        sock.destroy();
      } catch {
      }
      logger.info(`[email] sent to ${opts.to}`);
      resolve3({ ok: true });
    };
    sock.on("error", (e) => fail2(String(e.message || e)));
    (async () => {
      try {
        let r = await reader.next();
        if (!r[0]?.startsWith("220")) return fail2(`Greeting: ${r[0] ?? "no response"}`);
        const ehloName = os2.hostname() || "switchnest";
        send(sock, `EHLO ${ehloName}`);
        r = await reader.next();
        let ehlo = r.join("\r\n");
        const useTls = cfg.secure || cfg.port === 465;
        if (!useTls && /STARTTLS/i.test(ehlo)) {
          send(sock, "STARTTLS");
          r = await reader.next();
          if (!r[0]?.startsWith("220")) return fail2(`STARTTLS: ${r[0]}`);
          reader.detach();
          sock = tls.connect({ socket: sock, servername: cfg.host });
          reader = createReader(sock, 2e4);
          await new Promise((res, rej) => {
            sock.once("secureConnect", () => res());
            sock.once("error", rej);
          });
          sock.on("error", (e) => fail2(String(e.message || e)));
          send(sock, `EHLO ${ehloName}`);
          r = await reader.next();
          ehlo = r.join("\r\n");
        }
        const mech = ehlo.toUpperCase();
        if (/AUTH/.test(mech) && !/AUTH=NONE/.test(mech)) {
          if (/LOGIN/.test(mech)) {
            send(sock, "AUTH LOGIN");
            r = await reader.next();
            if (!r[0]?.startsWith("334")) return fail2(`AUTH LOGIN: ${r[0]}`);
            send(sock, Buffer.from(cfg.user, "utf8").toString("base64"));
            r = await reader.next();
            if (!r[0]?.startsWith("334")) return fail2(`AUTH user: ${r[0]}`);
            send(sock, Buffer.from(cfg.pass, "utf8").toString("base64"));
            r = await reader.next();
            if (!r[0]?.startsWith("235")) return fail2(`AUTH pass: ${r[0]}`);
          } else if (/PLAIN/.test(mech)) {
            const token = Buffer.from(`\0${cfg.user}\0${cfg.pass}`, "utf8").toString("base64");
            send(sock, `AUTH PLAIN ${token}`);
            r = await reader.next();
            if (!r[0]?.startsWith("235")) return fail2(`AUTH PLAIN: ${r[0]}`);
          } else {
            return fail2("No supported AUTH mechanism (LOGIN/PLAIN required)");
          }
        }
        send(sock, `MAIL FROM:<${cfg.from}>`);
        r = await reader.next();
        if (!r[0]?.startsWith("250")) return fail2(`MAIL FROM: ${r[0]}`);
        send(sock, `RCPT TO:<${opts.to}>`);
        r = await reader.next();
        if (!r[0]?.startsWith("250")) return fail2(`RCPT TO: ${r[0]}`);
        send(sock, "DATA");
        r = await reader.next();
        if (!r[0]?.startsWith("354")) return fail2(`DATA: ${r[0]}`);
        send(sock, buildMessage(cfg.from, opts.to, opts.subject, opts.text, opts.html));
        r = await reader.next();
        if (!r[0]?.startsWith("250")) return fail2(`send: ${r[0]}`);
        send(sock, "QUIT");
        try {
          r = await reader.next();
          if (!r[0]?.startsWith("221")) return fail2(`QUIT: ${r[0]}`);
        } catch {
        }
        succeed();
      } catch (e) {
        fail2(e instanceof Error ? e.message : String(e));
      }
    })();
  });
}
async function sendSupportReplyEmail(opts) {
  const s = await getSiteSettings().catch(() => null);
  const siteName = s?.siteName || "SwitchNest";
  const siteUrl = s?.siteUrl || "";
  const subject = `\u{1F6E0}\uFE0F ${siteName} Support \u2014 Admin ne reply kiya`;
  const text = [
    `Namaste ${opts.userName},`,
    "",
    `Aapke support message pe ${siteName} team ne reply kiya hai:`,
    "",
    `"${opts.replyText}"`,
    "",
    siteUrl ? `Reply dekhne aur jawab dene ke liye: ${siteUrl}` : "Support chat khol kar turant jawab de sakte ho.",
    "",
    `\u2014 ${siteName} Support Team`
  ].join("\n");
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#2563eb;margin:0 0 16px">${siteName} Support</h2>
      <p style="font-size:15px;color:#333">Namaste <b>${opts.userName}</b>,</p>
      <p style="font-size:15px;color:#333">Aapke support message pe team ne reply kiya hai:</p>
      <div style="border-left:4px solid #2563eb;background:#f5f7fb;padding:12px 16px;border-radius:8px;color:#333;white-space:pre-wrap">${opts.replyText.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</div>
      ${siteUrl ? `<p style="font-size:15px;color:#333;margin-top:16px">Reply dekhne aur jawab dene ke liye: <a href="${siteUrl}" style="color:#2563eb">${siteUrl}</a></p>` : ""}
      <p style="font-size:13px;color:#888;margin-top:24px">\u2014 ${siteName} Support Team</p>
    </div>
  `.trim();
  return sendEmail({ to: opts.to, subject, text, html });
}

// src/routes/admin.routes.ts
var adminRouter = Router11();
function requireAdmin(req, _res, next) {
  if (req.user?.role !== "system_admin") {
    return next(new AppError("FORBIDDEN", "Admin access required", 403));
  }
  next();
}
adminRouter.use(requireAuth, requireAdmin);
var DAY_MS2 = 24 * 60 * 60 * 1e3;
function dayKey2(d) {
  return d.toISOString().slice(0, 10);
}
adminRouter.get("/stats", async (_req, res) => {
  const dayAgo = new Date(Date.now() - DAY_MS2);
  const weekAgo = new Date(Date.now() - 7 * DAY_MS2);
  const twoMin = new Date(Date.now() - 12e4);
  const monthStart = /* @__PURE__ */ new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [
    users,
    homes,
    devices,
    activeToday,
    onlineDevices,
    pendingCommands2,
    apiKeys,
    auditCount,
    espBoards,
    offlineBoards,
    orders,
    pendingOrders,
    ordersToday,
    ordersThisMonth,
    revenueTotal,
    revenueThisMonth,
    newUsers7d,
    supportMessages,
    contactMessages,
    deviceLogs24h,
    usersRecent,
    ordersRecent
  ] = await Promise.all([
    prisma.user.count(),
    prisma.home.count(),
    prisma.device.count(),
    prisma.user.count({ where: { lastLoginAt: { gte: dayAgo } } }),
    prisma.device.count({ where: { lastSeen: { gte: dayAgo } } }),
    prisma.deviceCommand.count({ where: { status: "pending" } }),
    prisma.apiKey.count(),
    prisma.auditLog.count(),
    prisma.espDevice.count(),
    prisma.espDevice.count({ where: { OR: [{ offline: true }, { lastSeen: { lt: twoMin } }] } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.order.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paidAt: { not: null } } }),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paidAt: { not: null }, createdAt: { gte: monthStart } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.supportMessage.count(),
    prisma.contactMessage.count(),
    prisma.deviceLog.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.user.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true } }),
    prisma.order.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true, totalAmount: true, paidAt: true } })
  ]);
  const usersByDay = {};
  for (const u of usersRecent) {
    const k = dayKey2(u.createdAt);
    usersByDay[k] = (usersByDay[k] ?? 0) + 1;
  }
  const ordersByDay = {};
  const revenueByDay = {};
  for (const o of ordersRecent) {
    const k = dayKey2(o.createdAt);
    ordersByDay[k] = (ordersByDay[k] ?? 0) + 1;
    if (o.paidAt) {
      const pk = dayKey2(o.paidAt);
      revenueByDay[pk] = (revenueByDay[pk] ?? 0) + Number(o.totalAmount);
    }
  }
  ok(res, {
    users,
    homes,
    devices,
    activeToday,
    onlineDevices,
    pendingCommands: pendingCommands2,
    apiKeys,
    auditCount,
    espBoards,
    offlineBoards,
    orders,
    pendingOrders,
    ordersToday,
    ordersThisMonth,
    revenueTotal: Number(revenueTotal._sum.totalAmount ?? 0),
    revenueThisMonth: Number(revenueThisMonth._sum.totalAmount ?? 0),
    newUsers7d,
    supportMessages,
    contactMessages,
    deviceLogs24h,
    requests: getRequestStats(),
    usersByDay,
    ordersByDay,
    revenueByDay
  });
});
var settingsSchema = z12.object({
  siteName: z12.string().min(1).max(60).optional(),
  supportEmail: z12.string().email().max(100).optional(),
  supportPhone: z12.string().min(1).max(30).optional(),
  supportAddress: z12.string().min(1).max(200).optional(),
  supportHours: z12.string().min(1).max(100).optional(),
  brandColor: z12.string().regex(/^#[0-9a-fA-F]{6}$/, "Hex color (#RRGGBB)").optional(),
  siteUrl: z12.string().url().max(200).optional().or(z12.literal("")),
  smtpHost: z12.string().max(150).optional(),
  smtpPort: z12.number().int().min(1).max(65535).optional(),
  smtpUser: z12.string().max(150).optional(),
  smtpPass: z12.string().max(200).optional(),
  // blank = purana rakho
  smtpFrom: z12.string().email().max(150).optional().or(z12.literal("")),
  smtpSecure: z12.boolean().optional()
}).refine((d) => Object.keys(d).length > 0, { message: "At least one field to update" });
adminRouter.get("/settings", async (_req, res) => {
  const s = await getSiteSettings();
  ok(res, { ...s, smtpPass: s.smtpPass ? "********" : "", smtpPassSet: !!s.smtpPass });
});
adminRouter.put("/settings", validateBody(settingsSchema), async (req, res) => {
  ok(res, await updateSiteSettings(req.body));
  void audit(req.user.sub, "settings.update", { entity: "site", meta: { fields: Object.keys(req.body) } });
});
adminRouter.post("/settings/test-email", async (req, res) => {
  const me2 = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { email: true, username: true }
  });
  if (!me2?.email) {
    throw new AppError("VALIDATION_ERROR", "Aapke account pe email set nahi hai \u2014 test bhejne ke liye email chahiye", 400);
  }
  const r = await sendEmail({
    to: me2.email,
    subject: "\u{1F9EA} SwitchNest test email",
    text: `Ye test email hai, ${me2.username}. SMTP settings sahi kaam kar rahi hain. \u2705`
  });
  if (!r.ok) {
    if (r.skipped) {
      throw new AppError("CONFIG_ERROR", "SMTP configured nahi hai \u2014 Settings me host/user/pass daalo aur Save karo", 400);
    }
    throw new AppError("SMTP_ERROR", `Email fail: ${r.error ?? "unknown"}`, 500);
  }
  ok(res, { sent: true });
});
adminRouter.get("/users", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { ownedHomes: true, memberships: true } }
    },
    where: q ? {
      OR: [
        { username: { contains: q } },
        { email: { contains: q } }
      ]
    } : void 0,
    orderBy: { createdAt: "desc" },
    take: 200
  });
  ok(res, users);
});
adminRouter.patch("/users/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.sub) throw new AppError("BAD_REQUEST", "You cannot suspend your own account");
  const status = String(req.body.status ?? "");
  if (!["active", "suspended"].includes(status)) {
    throw new AppError("BAD_REQUEST", "Status must be active or suspended");
  }
  const user = await prisma.user.update({
    where: { id },
    data: { status }
  });
  await audit(req.user.sub, `admin.user.${status}`, { entity: "user", entityId: id, meta: { username: user.username } });
  ok(res, user);
});
adminRouter.patch("/users/:id/role", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.sub) throw new AppError("BAD_REQUEST", "You cannot change your own role");
  const role = String(req.body.role ?? "");
  if (!["user", "system_admin"].includes(role)) {
    throw new AppError("BAD_REQUEST", "Role must be user or system_admin");
  }
  const user = await prisma.user.update({
    where: { id },
    data: { role }
  });
  await audit(req.user.sub, `admin.user.role`, { entity: "user", entityId: id, meta: { username: user.username, role } });
  ok(res, user);
});
adminRouter.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.sub) throw new AppError("BAD_REQUEST", "You cannot delete your own account");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  await audit(req.user.sub, "admin.user.delete", { entity: "user", entityId: id, meta: { username: user.username, email: user.email } });
  await prisma.user.delete({ where: { id } });
  ok(res, { deleted: true });
});
adminRouter.get("/homes", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const homes = await prisma.home.findMany({
    include: {
      owner: { select: { id: true, username: true, email: true } },
      _count: { select: { devices: true, members: true, rooms: true } }
    },
    where: q ? { name: { contains: q } } : void 0,
    orderBy: { createdAt: "desc" },
    take: 200
  });
  ok(res, homes);
});
adminRouter.get("/homes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const home = await prisma.home.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, username: true, email: true } },
      members: { include: { user: { select: { id: true, username: true, email: true } } } },
      devices: { orderBy: { id: "asc" } },
      rooms: true,
      _count: { select: { devices: true, members: true, invitations: true } }
    }
  });
  if (!home) throw new AppError("NOT_FOUND", "Home not found");
  ok(res, home);
});
adminRouter.patch("/homes/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status ?? "");
  if (!["active", "suspended"].includes(status)) {
    throw new AppError("BAD_REQUEST", "Status must be active or suspended");
  }
  const home = await prisma.home.update({
    where: { id },
    data: { status }
  });
  await audit(req.user.sub, `admin.home.${status}`, { homeId: id, entity: "home", entityId: id, meta: { name: home.name } });
  ok(res, home);
});
adminRouter.delete("/homes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const home = await prisma.home.findUnique({ where: { id } });
  if (!home) throw new AppError("NOT_FOUND", "Home not found");
  await audit(req.user.sub, "admin.home.delete", { homeId: id, entity: "home", entityId: id, meta: { name: home.name } });
  await prisma.home.delete({ where: { id } });
  ok(res, { deleted: true });
});
adminRouter.get("/devices", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const devices = await prisma.device.findMany({
    include: {
      home: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          owner: { select: { username: true } },
          apiKeys: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { keyPrefix: true, label: true, createdAt: true }
          }
        }
      },
      room: { select: { name: true } },
      _count: { select: { commands: true, logs: true } }
    },
    where: q ? {
      OR: [
        { name: { contains: q } },
        { serialNumber: { contains: q } },
        { ipAddress: { contains: q } },
        { home: { name: { contains: q } } },
        { home: { owner: { username: { contains: q } } } }
      ]
    } : void 0,
    orderBy: { id: "desc" },
    take: 200
  });
  ok(
    res,
    devices.map((d) => ({
      ...d,
      online: d.lastSeen !== null && d.lastSeen.getTime() > dayAgo.getTime()
    }))
  );
});
adminRouter.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return ok(res, { q, users: [], homes: [], devices: [], esps: [], orders: [], serials: [] });
  const qUp = q.toUpperCase();
  const [users, homes, devices, esps, orders, serials] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ username: { contains: q } }, { email: { contains: q } }] },
      select: { id: true, username: true, email: true, role: true, status: true, createdAt: true },
      orderBy: { id: "desc" },
      take: 5
    }),
    prisma.home.findMany({
      where: { OR: [{ name: { contains: q } }, { owner: { username: { contains: q } } }] },
      select: {
        id: true,
        name: true,
        status: true,
        owner: { select: { username: true } },
        _count: { select: { devices: true, members: true } }
      },
      orderBy: { id: "desc" },
      take: 5
    }),
    prisma.device.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { serialNumber: { contains: q } },
          { ipAddress: { contains: q } },
          { home: { name: { contains: q } } }
        ]
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        serialNumber: true,
        ipAddress: true,
        home: { select: { name: true } }
      },
      orderBy: { id: "desc" },
      take: 5
    }),
    prisma.espDevice.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { serialCode: { contains: q } },
          { macAddress: { contains: q } },
          { ipAddress: { contains: q } },
          { ssid: { contains: q } },
          { modelCode: { contains: q } }
        ]
      },
      select: {
        id: true,
        name: true,
        serialCode: true,
        modelCode: true,
        ipAddress: true,
        offline: true,
        home: { select: { name: true } }
      },
      orderBy: { id: "desc" },
      take: 5
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: qUp } },
          { shippingName: { contains: q } },
          { shippingPhone: { contains: q } },
          { user: { username: { contains: q } } }
        ]
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true,
        user: { select: { username: true } }
      },
      orderBy: { id: "desc" },
      take: 5
    }),
    prisma.serialRegistry.findMany({
      where: { serialCode: { contains: qUp } },
      select: {
        id: true,
        serialCode: true,
        status: true,
        orderId: true,
        product: { select: { name: true } },
        user: { select: { username: true } }
      },
      orderBy: { id: "desc" },
      take: 5
    })
  ]);
  ok(res, { q, users, homes, devices, esps, orders, serials });
});
adminRouter.get("/api-keys", async (_req, res) => {
  const keys = await prisma.apiKey.findMany({
    include: {
      user: { select: { id: true, username: true, email: true } },
      home: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  ok(res, keys);
});
adminRouter.delete("/api-keys/:id", async (req, res) => {
  const id = Number(req.params.id);
  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) throw new AppError("NOT_FOUND", "API key not found");
  await audit(req.user.sub, "admin.apikey.revoke", { homeId: key.homeId, entity: "api_key", entityId: id, meta: { prefix: key.keyPrefix } });
  await prisma.apiKey.delete({ where: { id } });
  ok(res, { deleted: true });
});
adminRouter.get("/find", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    return ok(res, { q, users: [], orders: [], serials: [], boards: [], devices: [], messages: [], claims: [] });
  }
  const contains = { contains: q };
  const phone = q.replace(/\D/g, "");
  const users = await prisma.user.findMany({
    where: { OR: [{ username: contains }, { email: contains }] },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      _count: { select: { ownedHomes: true, createdDevices: true, orders: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  const orders = await prisma.order.findMany({
    where: { OR: [{ orderNumber: contains }, { shippingPhone: contains }, { shippingName: contains }] },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      shippingName: true,
      shippingPhone: true,
      totalAmount: true,
      createdAt: true,
      userId: true,
      user: { select: { username: true, email: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  const serials = await prisma.serialRegistry.findMany({
    where: { serialCode: contains },
    select: {
      id: true,
      serialCode: true,
      status: true,
      warrantyStatus: true,
      warrantyExpiresAt: true,
      orderId: true,
      userId: true,
      homeId: true,
      product: { select: { name: true, modelCode: true } },
      order: { select: { orderNumber: true } },
      user: { select: { id: true, username: true, email: true } },
      home: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  const boards = await prisma.espDevice.findMany({
    where: { OR: [{ macAddress: contains }, { serialCode: contains }, { name: contains }] },
    select: {
      id: true,
      name: true,
      macAddress: true,
      serialCode: true,
      modelCode: true,
      offline: true,
      lastSeen: true,
      firmwareVersion: true,
      homeId: true,
      home: { select: { id: true, name: true, owner: { select: { id: true, username: true, email: true } } } }
    },
    orderBy: { id: "desc" },
    take: 10
  });
  const devices = await prisma.device.findMany({
    where: { OR: [{ name: contains }, { serialNumber: contains }] },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      serialNumber: true,
      offline: true,
      home: { select: { id: true, name: true, owner: { select: { id: true, username: true, email: true } } } }
    },
    orderBy: { id: "desc" },
    take: 10
  });
  const messages = await prisma.contactMessage.findMany({
    where: { OR: [{ phone: phone ? { contains: phone } : contains }, { email: contains }, { name: contains }] },
    select: { id: true, name: true, phone: true, email: true, subject: true, status: true, createdAt: true, userId: true },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  const claims = await prisma.warrantyClaim.findMany({
    where: { OR: [{ serialCode: contains }] },
    select: {
      id: true,
      serialCode: true,
      reason: true,
      status: true,
      createdAt: true,
      userId: true,
      user: { select: { id: true, username: true, email: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  ok(res, { q, users, orders, serials, boards, devices, messages, claims });
});
adminRouter.get("/audit", async (req, res) => {
  const action = String(req.query.action ?? "");
  const where = action ? { action } : void 0;
  const logs2 = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  ok(res, logs2);
});
adminRouter.get("/logs", async (_req, res) => {
  const n = Math.min(Number(_req.query.lines ?? 300) || 300, 1e3);
  const result = { path: logFilePath ?? null, totalLines: 0, lines: [], crashes: [], iisnodeLogs: [] };
  if (logFilePath && fs3.existsSync(logFilePath)) {
    const raw = fs3.readFileSync(logFilePath, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean).slice(-n);
    result.lines = lines;
    result.totalLines = lines.length;
    const crashMap = /* @__PURE__ */ new Map();
    for (const l of lines) {
      if (!/crashguard|unhandled|error|fail|exception/i.test(l)) continue;
      const key = l.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, " ").replace(/pid=\d+/g, "pid=N").replace(/uptime=\d+s/g, "uptime=N").replace(/rss=\d+MB/g, "rss=N").replace(/\[(boot|req|hb|scheduler|offline)\]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
      if (!key) continue;
      const cur = crashMap.get(key);
      if (cur) cur.count += 1;
      else crashMap.set(key, { line: l, count: 1 });
    }
    result.crashes = [...crashMap.values()];
  }
  const dirs = /* @__PURE__ */ new Set();
  if (logFilePath) dirs.add(path4.dirname(logFilePath));
  dirs.add(path4.resolve(process.cwd(), "../logs"));
  dirs.add(path4.resolve(process.cwd(), "../../logs"));
  for (const dir of dirs) {
    let entries = [];
    try {
      entries = fs3.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isFile()) continue;
      const name = e.name;
      if (!/^stdout_/i.test(name) && !/^stderr_/i.test(name) && !/\.log$/i.test(name)) continue;
      const full = path4.join(dir, name);
      try {
        const size = fs3.statSync(full).size;
        const buf = fs3.readFileSync(full, "utf8");
        const ls = buf.split(/\r?\n/).filter(Boolean).slice(-200);
        result.iisnodeLogs.push({ name, path: full, size, lines: ls });
      } catch {
      }
    }
  }
  ok(res, result);
});
try {
  fs3.mkdirSync(firmwareDir, { recursive: true });
} catch (err) {
  console.warn(`[firmware] cannot create ${firmwareDir}:`, err instanceof Error ? err.message : err);
}
var upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, firmwareDir),
    filename: (_req, _file, cb) => cb(null, "firmware.bin")
  }),
  limits: { fileSize: 8 * 1024 * 1024 }
  // 8 MB is plenty for ESP32 .bin
});
adminRouter.get("/esp", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const current = await prisma.firmwareVersion.findFirst({ where: { isCurrent: true } });
  const esps = await prisma.espDevice.findMany({
    where: q ? {
      OR: [
        { name: { contains: q } },
        { serialCode: { contains: q } },
        { macAddress: { contains: q } },
        { ipAddress: { contains: q } },
        { ssid: { contains: q } },
        { modelCode: { contains: q } },
        { home: { OR: [{ name: { contains: q } }, { owner: { username: { contains: q } } }] } }
      ]
    } : void 0,
    select: {
      id: true,
      homeId: true,
      macAddress: true,
      name: true,
      ssid: true,
      serialCode: true,
      modelCode: true,
      ipAddress: true,
      firmwareVersion: true,
      lastSeen: true,
      offline: true,
      otaPendingVersion: true,
      otaRequestedAt: true,
      otaProgress: true,
      otaStatus: true,
      home: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          owner: { select: { username: true } },
          apiKeys: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { keyPrefix: true, label: true, createdAt: true }
          }
        }
      },
      devices: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          room: { select: { name: true } }
        },
        orderBy: { id: "asc" }
      }
    },
    orderBy: { lastSeen: "desc" },
    take: 100
  });
  const unlinked = await prisma.device.findMany({
    where: { espId: null },
    select: {
      id: true,
      homeId: true,
      name: true,
      type: true,
      status: true,
      firmwareVersion: true,
      ipAddress: true,
      lastSeen: true,
      offline: true,
      serialNumber: true,
      home: { select: { name: true } }
    },
    orderBy: { id: "asc" },
    take: 100
  });
  ok(res, { esps, unlinked, currentVersion: current?.version ?? null });
});
adminRouter.post("/esp/:id/key", async (req, res) => {
  const id = Number(req.params.id);
  const esp = await prisma.espDevice.findUnique({
    where: { id },
    include: { home: { select: { id: true, ownerId: true } } }
  });
  if (!esp?.home) throw new AppError("NOT_FOUND", "ESP ya home nahi mila");
  const crypto7 = await import("node:crypto");
  const plain = `rs_${crypto7.randomBytes(9).toString("base64url").replace(/-/g, "").slice(0, 16)}`;
  const keyHash = crypto7.createHash("sha256").update(plain).digest("hex");
  const keyPrefix = plain.slice(0, 8);
  await prisma.apiKey.create({
    data: {
      userId: esp.home.ownerId,
      homeId: esp.home.id,
      label: `admin-support-${Date.now()}`,
      keyHash,
      keyPrefix
    }
  });
  await audit(req.user.sub, "admin.esp.key.issue", {
    entity: "esp",
    entityId: id,
    meta: { homeId: esp.home.id }
  });
  ok(res, { apiKey: plain, keyPrefix });
});
adminRouter.patch("/esp/:id", async (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body?.name ?? "").trim().slice(0, 60);
  if (!name) throw new AppError("BAD_REQUEST", "Name required");
  const dup = await prisma.espDevice.findFirst({ where: { name, id: { not: id } }, select: { id: true } });
  if (dup) {
    throw new AppError("DUPLICATE_NAME", `Naam "${name}" already kisi aur board pe hai \u2014 har board ka unique naam chahiye`, 409);
  }
  const before = await prisma.espDevice.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Board nahi mila", 404);
  const esp = await prisma.espDevice.update({ where: { id }, data: { name } });
  await audit(req.user.sub, "admin.esp.rename", {
    entity: "esp",
    entityId: id,
    meta: { from: before.name ?? null, to: name }
  });
  const home = await prisma.home.findUnique({
    where: { id: esp.homeId },
    include: { members: { where: { role: { in: ["owner", "admin"] } }, select: { userId: true } } }
  });
  if (home) {
    const oldName = before.name ?? before.serialCode ?? `ESP-${before.macAddress.slice(-6).toUpperCase()}`;
    for (const m of home.members) {
      await createNotification(m.userId, {
        category: "support",
        type: "info",
        title: `\u{1F6F0}\uFE0F Support ne board renamed kiya: ${oldName} \u2192 ${name}`,
        body: `Support team ne board ka naam "${oldName}" se "${name}" kar diya.`
      });
    }
    emitToHome(esp.homeId, "esp:updated", { id, name });
  }
  ok(res, esp);
});
adminRouter.get("/esp/:id/history", async (req, res) => {
  const id = Number(req.params.id);
  const logs2 = await prisma.auditLog.findMany({
    where: {
      entity: "esp",
      entityId: id,
      action: { in: ["user.esp.rename", "admin.esp.rename"] }
    },
    include: { actor: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  ok(res, logs2);
});
adminRouter.get("/firmware", async (_req, res) => {
  const versions = await prisma.firmwareVersion.findMany({ orderBy: { createdAt: "desc" } });
  const current = versions.find((v) => v.isCurrent) ?? null;
  ok(res, { versions, current });
});
adminRouter.post("/firmware", upload.single("firmware"), async (req, res) => {
  const version = String(req.body.version ?? "").trim();
  const releaseNotes = String(req.body.release_notes ?? "").trim();
  const modelCode = String(req.body.model ?? "").trim().toUpperCase();
  if (!version) throw new AppError("BAD_REQUEST", "Version is required (e.g. 1.0.1)");
  if (!req.file) throw new AppError("BAD_REQUEST", "Firmware .bin file is required");
  if (!req.file.originalname.toLowerCase().endsWith(".bin")) {
    throw new AppError("BAD_REQUEST", "Only .bin files are accepted");
  }
  if (!/^[A-Z0-9-]*$/.test(modelCode)) {
    throw new AppError("BAD_REQUEST", "Model code me sirf A-Z 0-9 - allowed");
  }
  const filename = modelCode ? `firmware-${modelCode.toLowerCase()}.bin` : "firmware.bin";
  const url = `/firmware/${filename}`;
  if (modelCode && filename !== "firmware.bin") {
    const uploaded = path4.join(firmwareDir, "firmware.bin");
    const target = path4.join(firmwareDir, filename);
    if (fs3.existsSync(uploaded) && uploaded !== target) {
      if (fs3.existsSync(target)) fs3.unlinkSync(target);
      fs3.renameSync(uploaded, target);
    }
  }
  await prisma.$transaction([
    // Sirf isi model ke puraane current deactivate karo — doosre models ke current untouched
    prisma.firmwareVersion.updateMany({ where: { modelCode, isCurrent: true }, data: { isCurrent: false } }),
    prisma.firmwareVersion.upsert({
      where: { version_modelCode: { version, modelCode } },
      create: { version, modelCode, url, releaseNotes, isCurrent: true },
      update: { releaseNotes, isCurrent: true, url }
    })
  ]);
  await audit(req.user.sub, "admin.firmware.upload", {
    entity: "firmware",
    meta: { version, modelCode: modelCode || "universal", releaseNotes }
  });
  ok(res, { version, modelCode, releaseNotes, published: true, url });
});
adminRouter.post("/firmware/:id/activate", async (req, res) => {
  const id = Number(req.params.id);
  const fw = await prisma.firmwareVersion.findUnique({ where: { id } });
  if (!fw) throw new AppError("NOT_FOUND", "Firmware version not found", 404);
  await prisma.$transaction([
    prisma.firmwareVersion.updateMany({ where: { modelCode: fw.modelCode }, data: { isCurrent: false } }),
    prisma.firmwareVersion.update({ where: { id }, data: { isCurrent: true } })
  ]);
  await audit(req.user.sub, "admin.firmware.activate", {
    entity: "firmware",
    entityId: id,
    meta: { version: fw.version }
  });
  ok(res, { id, version: fw.version, isCurrent: true });
});
adminRouter.post("/devices/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (status !== "on" && status !== "off") throw new AppError("VALIDATION_ERROR", "status must be 'on' or 'off'", 400);
  const device = await prisma.device.findUnique({
    where: { id },
    include: { home: { select: { ownerId: true } } }
  });
  if (!device) throw new AppError("NOT_FOUND", "Device not found", 404);
  await prisma.$transaction([
    prisma.device.update({ where: { id }, data: { status } }),
    prisma.deviceCommand.create({
      data: { deviceId: id, actorId: req.user.sub, command: `set_status:${status}` }
    }),
    prisma.deviceLog.create({
      data: { deviceId: id, actorId: req.user.sub, logType: "status_change", logMessage: `Admin turned device ${status}` }
    })
  ]);
  await audit(req.user.sub, "admin.device.control", {
    homeId: device.homeId,
    entity: "device",
    entityId: id,
    meta: { name: device.name, status }
  });
  await createNotification(device.home.ownerId, {
    category: "support",
    type: "info",
    title: `Support ne ${device.name} ${status === "on" ? "ON" : "OFF"} kiya`,
    body: `Admin ne aapke device "${device.name}" ko ${status === "on" ? "chalu (ON)" : "band (OFF)"} kiya. Agar yeh galat hai to turant support ko batayein.`
  });
  ok(res, { id, status });
});
adminRouter.get("/devices/:id/support", async (req, res) => {
  const id = Number(req.params.id);
  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      home: {
        select: {
          id: true,
          name: true,
          owner: { select: { id: true, username: true, email: true } },
          apiKeys: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { keyPrefix: true, label: true, createdAt: true }
          }
        }
      },
      room: { select: { name: true } },
      esp: {
        include: {
          devices: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              customValue: true,
              lastSeen: true
            },
            orderBy: { id: "asc" }
          }
        }
      },
      logs: { orderBy: { createdAt: "desc" }, take: 20 },
      commands: { orderBy: { createdAt: "desc" }, take: 20 }
    }
  });
  if (!device) throw new AppError("NOT_FOUND", "Device not found", 404);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  ok(res, { ...device, online: device.lastSeen !== null && device.lastSeen.getTime() > dayAgo.getTime() });
});
adminRouter.post("/devices/:id/clear-commands", async (req, res) => {
  const id = Number(req.params.id);
  const device = await prisma.device.findUnique({
    where: { id },
    include: { home: { select: { ownerId: true } } }
  });
  if (!device) throw new AppError("NOT_FOUND", "Device not found", 404);
  const cleared = await prisma.deviceCommand.updateMany({
    where: { deviceId: id, status: "pending" },
    data: { status: "failed", executedAt: /* @__PURE__ */ new Date() }
  });
  await prisma.deviceLog.create({
    data: { deviceId: id, actorId: req.user.sub, logType: "support", logMessage: `Admin cleared ${cleared.count} stuck command(s)` }
  });
  await audit(req.user.sub, "admin.device.fix", {
    homeId: device.homeId,
    entity: "device",
    entityId: id,
    meta: { name: device.name, cleared: cleared.count }
  });
  if (cleared.count > 0) {
    await createNotification(device.home.ownerId, {
      category: "support",
      type: "warning",
      title: `Support ne "${device.name}" ke stuck commands clear kiye`,
      body: `${cleared.count} pending command(s) clear kiye gaye. Device ab dobara responsive hoga.`
    });
  }
  ok(res, { cleared: cleared.count });
});
adminRouter.post("/devices/:id/push-ota", async (req, res) => {
  const id = Number(req.params.id);
  const device = await prisma.device.findUnique({
    where: { id },
    include: { home: { select: { ownerId: true } } }
  });
  if (!device) throw new AppError("NOT_FOUND", "Device not found", 404);
  const esp = device.espId ? await prisma.espDevice.findUnique({ where: { id: device.espId } }) : null;
  const current = await resolveFirmware(esp?.modelCode);
  if (!current) {
    throw new AppError("NO_FIRMWARE", "No current firmware published yet \u2014 upload a .bin first", 400);
  }
  await prisma.device.update({
    where: { id },
    data: { otaPendingVersion: current.version, otaRequestedAt: /* @__PURE__ */ new Date() }
  });
  let espId = null;
  if (device.espId) {
    espId = device.espId;
    await prisma.espDevice.update({
      where: { id: espId },
      data: { otaPendingVersion: current.version, otaRequestedAt: /* @__PURE__ */ new Date() }
    });
  }
  await audit(req.user.sub, "admin.ota.push", {
    homeId: device.homeId,
    entity: "device",
    entityId: id,
    meta: { version: current.version, model: esp?.modelCode ?? null }
  });
  await createNotification(device.home.ownerId, {
    category: "support",
    type: "info",
    title: `Support ne "${device.name}" ke liye firmware update push kiya`,
    body: `Naya firmware v${current.version} aapke device pe agle heartbeat pe install hoga.`
  });
  ok(res, {
    deviceId: id,
    espId,
    version: current.version,
    model: current.modelCode || "universal",
    message: "OTA update pushed \u2014 the device will update on its next heartbeat"
  });
});
adminRouter.post("/devices/push-ota-all", async (req, res) => {
  const current = await prisma.firmwareVersion.findFirst({ where: { isCurrent: true } });
  if (!current) {
    throw new AppError("NO_FIRMWARE", "No current firmware published yet \u2014 upload a .bin first", 400);
  }
  const rawHome = Number(req.body.homeId ?? 0);
  const homeId = rawHome > 0 ? rawHome : void 0;
  const espResult = await prisma.espDevice.updateMany({
    where: homeId ? { homeId } : {},
    data: { otaPendingVersion: current.version, otaRequestedAt: /* @__PURE__ */ new Date() }
  });
  const deviceResult = await prisma.device.updateMany({
    where: { ...homeId ? { homeId } : {}, espId: null },
    data: { otaPendingVersion: current.version, otaRequestedAt: /* @__PURE__ */ new Date() }
  });
  const count = espResult.count + deviceResult.count;
  await audit(req.user.sub, "admin.ota.push_all", {
    homeId,
    entity: "device",
    meta: { version: current.version, count }
  });
  const homeIds = /* @__PURE__ */ new Set();
  if (homeId) {
    homeIds.add(homeId);
  } else {
    (await prisma.espDevice.findMany({ select: { homeId: true } })).forEach((r) => r.homeId && homeIds.add(r.homeId));
    (await prisma.device.findMany({ where: { espId: null }, select: { homeId: true } })).forEach((r) => r.homeId && homeIds.add(r.homeId));
  }
  const ownerIds = new Set(
    (await prisma.home.findMany({ where: { id: { in: [...homeIds] } }, select: { ownerId: true } })).map((h) => h.ownerId)
  );
  await Promise.all(
    [...ownerIds].map(
      (ownerId) => createNotification(ownerId, {
        category: "support",
        type: "info",
        title: "Support ne firmware update push kiya",
        body: `Aapke ${count} device(s) ke liye naya firmware v${current.version} available hai \u2014 agle heartbeat pe auto-install hoga.`
      })
    )
  );
  ok(res, { count, version: current.version });
});
adminRouter.get("/esp/:id/probe", async (req, res) => {
  const id = Number(req.params.id);
  const esp = await prisma.espDevice.findUnique({ where: { id } });
  if (!esp) throw new AppError("NOT_FOUND", "ESP not found", 404);
  const ip = esp.ipAddress?.trim();
  if (!ip) {
    return ok(res, { reachable: false, reason: "no_ip" });
  }
  if (!/^[\d.a-fA-F:]+$/.test(ip)) {
    return ok(res, { reachable: false, reason: "invalid_ip" });
  }
  const url = `http://${ip}/`;
  const started = Date.now();
  const controller = new AbortController();
  const timer4 = setTimeout(() => controller.abort(), 3e3);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "SwitchNest-Admin/1.0" }
    });
    return ok(res, { reachable: true, latencyMs: Date.now() - started, statusCode: r.status });
  } catch {
    return ok(res, { reachable: false, reason: "unreachable", latencyMs: Date.now() - started });
  } finally {
    clearTimeout(timer4);
  }
});
adminRouter.get("/products", async (_req, res) => {
  const products = await prisma.product.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { serials: true } } }
  });
  ok(res, products);
});
adminRouter.post("/products", async (req, res) => {
  const { name, modelCode, relayCount, price, description, features, imageUrl } = req.body ?? {};
  if (!name || !modelCode || price == null) {
    throw new AppError("BAD_REQUEST", "name, modelCode and price are required");
  }
  const product = await prisma.product.create({
    data: {
      name: String(name).slice(0, 100),
      modelCode: String(modelCode).trim().toUpperCase().slice(0, 32),
      relayCount: Number(relayCount) || 0,
      price: Number(price),
      description: description ? String(description) : void 0,
      features: features ? typeof features === "string" ? JSON.parse(features) : features : void 0,
      imageUrl: imageUrl ? String(imageUrl).slice(0, 255) : void 0
    }
  });
  await audit(req.user.sub, "admin.product.create", { entity: "product", entityId: product.id, meta: { modelCode } });
  ok(res, product, 201);
});
adminRouter.patch("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, price, description, features, imageUrl, active } = req.body ?? {};
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: name != null ? String(name).slice(0, 100) : void 0,
      price: price != null ? Number(price) : void 0,
      description: description != null ? String(description) : void 0,
      features: features ? typeof features === "string" ? JSON.parse(features) : features : void 0,
      imageUrl: imageUrl != null ? String(imageUrl).slice(0, 255) : void 0,
      active: active != null ? Boolean(active) : void 0
    }
  });
  await audit(req.user.sub, "admin.product.update", { entity: "product", entityId: id });
  ok(res, product);
});
adminRouter.delete("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.product.delete({ where: { id } });
  await audit(req.user.sub, "admin.product.delete", { entity: "product", entityId: id });
  ok(res, { deleted: true });
});
adminRouter.get("/orders", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : void 0;
  const orders = await prisma.order.findMany({
    where: status ? { status } : void 0,
    include: {
      items: true,
      user: { select: { id: true, username: true, email: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  ok(res, orders);
});
adminRouter.patch("/orders/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  const order = await updateOrderStatus(id, status);
  await audit(req.user.sub, `admin.order.${status}`, {
    entity: "order",
    entityId: id,
    meta: { orderNumber: order.orderNumber }
  });
  ok(res, order);
});
adminRouter.get("/serials", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : void 0;
  const productId = req.query.productId ? Number(req.query.productId) : void 0;
  const serials = await prisma.serialRegistry.findMany({
    where: {
      ...status ? { status } : {},
      ...productId ? { productId } : {}
    },
    include: { product: { select: { id: true, name: true, modelCode: true } } },
    orderBy: { id: "desc" },
    take: 500
  });
  ok(res, serials);
});
adminRouter.post("/serials/generate", async (req, res) => {
  const productId = Number(req.body?.productId);
  const count = Number(req.body?.count ?? 10);
  const codes = await generateSerials(productId, count);
  await audit(req.user.sub, "admin.serial.generate", {
    entity: "product",
    entityId: productId,
    meta: { count, codes: codes.slice(0, 5) }
  });
  ok(res, { generated: codes.length, codes }, 201);
});
adminRouter.post("/orders/:id/serials/generate", async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true }
  });
  if (!order) throw new AppError("NOT_FOUND", "Order not found", 404);
  const item = order.items[0];
  if (!item) throw new AppError("BAD_REQUEST", "Order me koi item nahi", 400);
  const made = await prisma.serialRegistry.count({ where: { orderId: order.id } });
  const totalQty = order.items.reduce((sum, it) => sum + it.quantity, 0);
  if (made >= totalQty) {
    return ok(res, { done: true, serialCode: null, modelCode: null });
  }
  const product = await prisma.product.findUnique({ where: { id: item.productId } });
  const modelCode = product?.modelCode ?? "4CH";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let tries = 0; tries < 10; tries++) {
    let rnd = "";
    for (let i = 0; i < 6; i++) rnd += chars[Math.floor(Math.random() * chars.length)];
    const candidate = `RS-${modelCode}-${rnd}`;
    const dup = await prisma.serialRegistry.findUnique({ where: { serialCode: candidate } });
    if (!dup) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new AppError("CONFLICT", "Serial generate nahi ho paya \u2014 try again", 409);
  await prisma.serialRegistry.create({
    data: { serialCode: code, productId: item.productId, orderId: order.id, status: "reserved" }
  });
  if (!item.serialCode) {
    await prisma.orderItem.update({ where: { id: item.id }, data: { serialCode: code } });
  }
  await audit(req.user.sub, "admin.serial.generate.order", {
    entity: "order",
    entityId: order.id,
    meta: { serialCode: code, orderNumber: order.orderNumber }
  });
  ok(res, { done: false, serialCode: code, modelCode }, 201);
});
adminRouter.get("/orders/:id/provision", async (req, res) => {
  const include = {
    items: true,
    user: { select: { id: true, username: true, email: true } }
  };
  const raw = String(req.params.id).trim();
  let order = /^\d+$/.test(raw) ? await prisma.order.findUnique({ where: { id: Number(raw) }, include }) : null;
  if (!order && raw) {
    const matches2 = await prisma.order.findMany({
      where: { orderNumber: { contains: raw.toUpperCase() } },
      orderBy: { id: "desc" },
      take: 1,
      include
    });
    order = matches2[0] ?? null;
  }
  if (!order) throw new AppError("NOT_FOUND", "Order not found");
  const items = await Promise.all(
    order.items.map(async (it) => {
      const prod = await prisma.product.findUnique({
        where: { id: it.productId },
        select: { modelCode: true }
      });
      return {
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        price: Number(it.price),
        quantity: it.quantity,
        serialCode: it.serialCode,
        modelCode: prod?.modelCode ?? null
      };
    })
  );
  let wifiPassword = null;
  if (order.wifiPasswordEnc) {
    try {
      wifiPassword = decryptSecret(order.wifiPasswordEnc);
    } catch {
      wifiPassword = null;
    }
  }
  const crypto7 = await import("node:crypto");
  const plain = `rs_${crypto7.randomBytes(9).toString("base64url").replace(/-/g, "").slice(0, 16)}`;
  const keyHash = crypto7.createHash("sha256").update(plain).digest("hex");
  const keyPrefix = plain.slice(0, 8);
  const home = await prisma.home.findFirst({ where: { ownerId: order.userId } });
  if (home) {
    await prisma.apiKey.create({
      data: {
        userId: order.userId,
        homeId: home.id,
        label: `factory-order-${order.orderNumber}`,
        keyHash,
        keyPrefix
      }
    });
  }
  const apiKeyPlain = home ? plain : null;
  ok(res, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    wifiSsid: order.wifiSsid,
    wifiPassword,
    apiKey: apiKeyPlain,
    user: order.user,
    items
  });
});
adminRouter.post("/serials/:code/mark-tested", async (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const serial = await prisma.serialRegistry.findUnique({ where: { serialCode: code } });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");
  const updated = await prisma.serialRegistry.update({
    where: { id: serial.id },
    data: { testedAt: /* @__PURE__ */ new Date() }
  });
  await audit(req.user.sub, "admin.serial.tested", {
    entity: "serial",
    entityId: serial.id,
    meta: { serialCode: code }
  });
  ok(res, { tested: true, serialCode: code, testedAt: updated.testedAt });
});
adminRouter.get("/warranty", async (_req, res) => {
  const claims = await prisma.warrantyClaim.findMany({
    include: { user: { select: { id: true, username: true, email: true } } },
    orderBy: { createdAt: "desc" }
  });
  const codes = [...new Set(claims.map((c) => c.serialCode))];
  const serials = await prisma.serialRegistry.findMany({
    where: { serialCode: { in: codes } },
    select: { serialCode: true, warrantyStatus: true, warrantyExpiresAt: true, product: { select: { name: true, modelCode: true } } }
  });
  ok(res, claims.map((c) => ({ ...c, serial: serials.find((s) => s.serialCode === c.serialCode) ?? null })));
});
adminRouter.patch("/warranty/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!["approved", "rejected", "resolved"].includes(status)) {
    throw new AppError("BAD_REQUEST", "Status approved | rejected | resolved hona chahiye");
  }
  const claim = await prisma.warrantyClaim.findUnique({ where: { id } });
  if (!claim) throw new AppError("NOT_FOUND", "Claim not found");
  const serial = await prisma.serialRegistry.findUnique({ where: { serialCode: claim.serialCode } });
  if (claim.status === "resolved") throw new AppError("BAD_REQUEST", "Resolved claim change nahi hoti");
  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.warrantyClaim.update({
      where: { id },
      data: { status }
    });
    if (status === "resolved" || status === "rejected") {
      await tx.serialRegistry.update({
        where: { serialCode: claim.serialCode },
        data: { warrantyStatus: "active" }
      });
    }
    return c;
  });
  await audit(req.user.sub, `admin.warranty.${status}`, {
    entity: "warranty_claim",
    entityId: id,
    meta: { serialCode: claim.serialCode }
  });
  ok(res, { id: updated.id, status: updated.status });
});
adminRouter.get("/contact", async (_req, res) => {
  const msgs = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, username: true, email: true, role: true } } }
  });
  ok(res, msgs);
});
adminRouter.patch("/contact/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!["new", "read", "done"].includes(status)) throw new AppError("BAD_REQUEST", "Status new | read | done");
  const updated = await prisma.contactMessage.update({ where: { id }, data: { status } });
  ok(res, updated);
});
adminRouter.delete("/contact/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.contactMessage.delete({ where: { id } });
  ok(res, { deleted: true });
});
var resetSchema = z12.object({
  mode: z12.enum(["data", "factory"]),
  confirm: z12.literal("RESET")
});
adminRouter.post("/reset", validateBody(resetSchema), async (req, res) => {
  const { mode } = req.body;
  const ALL_TABLES = [
    "api_keys",
    "app_meta",
    "assistant_chats",
    "assistant_messages",
    "audit_logs",
    "contact_messages",
    "device_access",
    "device_commands",
    "device_configurations",
    "device_logs",
    "device_usage",
    "devices",
    "esp_devices",
    "firmware_versions",
    "home_members",
    "homes",
    "invitations",
    "notifications",
    "order_items",
    "orders",
    "products",
    "refresh_tokens",
    "rooms",
    "schedules",
    "serial_registry",
    "support_chat_settings",
    "support_messages",
    "users",
    "warranty_claims"
  ];
  const KEEP_IN_DATA = /* @__PURE__ */ new Set(["products", "app_meta", "users", "firmware_versions"]);
  const tablesToWipe = mode === "factory" ? ALL_TABLES : ALL_TABLES.filter((t) => !KEEP_IN_DATA.has(t));
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=0");
    for (const t of tablesToWipe) {
      await tx.$executeRawUnsafe(`DELETE FROM \`${t}\``);
    }
    if (mode === "data") {
      await tx.$executeRawUnsafe("DELETE FROM `users` WHERE role <> 'system_admin'");
    }
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=1");
  });
  if (mode === "factory") {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=0");
      for (const t of ALL_TABLES) {
        await tx.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${t}\``);
      }
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=1");
    });
    setDbReady(false);
  } else {
    await audit(req.user.sub, "admin.reset", { entity: "platform", meta: { mode } });
  }
  ok(res, {
    reset: true,
    mode,
    message: mode === "factory" ? "Factory reset ho gaya \u2014 ab install wizard se fresh setup karo" : "Data reset ho gaya \u2014 admin + catalog rahe, baaki sab clear"
  });
});

// src/routes/shop.routes.ts
import { Router as Router12 } from "express";
init_prisma();
init_audit_service();

// src/services/payment.service.ts
import crypto6 from "node:crypto";
function razorpayConfigured() {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}
async function createRazorpayOrder(amountInr, receipt) {
  const auth = "Basic " + Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ amount: Math.round(amountInr * 100), currency: "INR", receipt })
  });
  if (!res.ok) throw new AppError("PAYMENT_ERROR", `Razorpay order create fail (${res.status})`);
  return res.json();
}
function verifyRazorpaySignature(orderId, paymentId, signature) {
  const expected = crypto6.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  return expected === signature;
}

// src/routes/shop.routes.ts
var shopRouter = Router12();
shopRouter.get("/products", async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { id: "asc" }
  });
  ok(res, products);
});
shopRouter.post("/orders", requireAuth, async (req, res) => {
  const { items, shipping, wifi, paymentMethod } = req.body ?? {};
  if (!Array.isArray(items) || !items.length) {
    throw new AppError("BAD_REQUEST", "Cart is empty");
  }
  if (!shipping?.name || !shipping?.phone || !shipping?.address) {
    throw new AppError("BAD_REQUEST", "Shipping name, phone and address are required");
  }
  const method = String(paymentMethod ?? "cod");
  if (!["cod", "upi", "manual"].includes(method)) {
    throw new AppError("BAD_REQUEST", "Invalid payment method");
  }
  const order = await createOrder({
    userId: req.user.sub,
    items: items.map((i) => ({
      productId: Number(i.productId),
      quantity: Number(i.quantity)
    })),
    shipping: {
      name: String(shipping.name).slice(0, 100),
      phone: String(shipping.phone).slice(0, 20),
      address: String(shipping.address).slice(0, 255)
    },
    wifi: wifi?.ssid || wifi?.password ? { ssid: String(wifi.ssid ?? ""), password: String(wifi.password ?? "") } : void 0,
    paymentMethod: method
  });
  await audit(req.user.sub, "shop.order.create", {
    entity: "order",
    entityId: order.id,
    meta: { orderNumber: order.orderNumber, total: Number(order.totalAmount) }
  });
  ok(res, order, 201);
});
shopRouter.get("/orders", requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.sub },
    include: { items: true },
    orderBy: { createdAt: "desc" }
  });
  ok(res, orders);
});
shopRouter.post("/orders/:id/cancel", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== req.user.sub) {
    throw new AppError("NOT_FOUND", "Order not found");
  }
  if (order.status !== "pending") {
    throw new AppError("BAD_REQUEST", "Only pending orders can be cancelled");
  }
  await prisma.$transaction([
    prisma.serialRegistry.updateMany({
      where: { orderId: id },
      data: { status: "available", orderId: null }
    }),
    prisma.order.update({ where: { id }, data: { status: "cancelled" } })
  ]);
  await audit(req.user.sub, "shop.order.cancel", { entity: "order", entityId: id });
  ok(res, { cancelled: true });
});
shopRouter.post("/orders/:id/pay", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== req.user.sub) {
    throw new AppError("NOT_FOUND", "Order not found");
  }
  if (order.status !== "pending") {
    throw new AppError("BAD_REQUEST", "Only pending orders can be paid");
  }
  if (order.paymentMethod === "cod") {
    throw new AppError("BAD_REQUEST", "COD order me online payment nahi hoti");
  }
  if (razorpayConfigured()) {
    const rp = await createRazorpayOrder(Number(order.totalAmount), `order_${order.id}`);
    await prisma.order.update({
      where: { id },
      data: { razorpayOrderId: String(rp.id) }
    });
    await audit(req.user.sub, "shop.payment.initiate", {
      entity: "order",
      entityId: id,
      meta: { razorpayOrderId: rp.id, total: Number(order.totalAmount) }
    });
    ok(res, { mode: "razorpay", razorpayOrderId: rp.id, amount: Number(order.totalAmount), keyId: process.env.RAZORPAY_KEY_ID ?? "" });
  } else {
    const upiIntent = `upi://pay?pa=switchnest@okaxis&pn=SwitchNest&am=${Number(order.totalAmount).toFixed(2)}&tn=Order%20${order.orderNumber}`;
    await audit(req.user.sub, "shop.payment.initiate", {
      entity: "order",
      entityId: id,
      meta: { mode: "demo", upiIntent, total: Number(order.totalAmount) }
    });
    ok(res, { mode: "demo", upiIntent, amount: Number(order.totalAmount), note: "Demo mode \u2014 UPI app se pay karke 'Paid' verify karo" });
  }
});
shopRouter.post("/orders/:id/pay/verify", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body ?? {};
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new AppError("BAD_REQUEST", "razorpayOrderId, razorpayPaymentId, razorpaySignature required");
  }
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== req.user.sub) {
    throw new AppError("NOT_FOUND", "Order not found");
  }
  if (order.razorpayOrderId !== razorpayOrderId) {
    throw new AppError("BAD_REQUEST", "Razorpay order mismatch");
  }
  if (!verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
    throw new AppError("PAYMENT_ERROR", "Signature verify fail");
  }
  await prisma.order.update({ where: { id }, data: { status: "paid", paidAt: /* @__PURE__ */ new Date(), paymentRef: razorpayPaymentId } });
  await audit(req.user.sub, "shop.payment.verified", { entity: "order", entityId: id, meta: { paymentId: razorpayPaymentId } });
  ok(res, { paid: true, status: "paid", paymentRef: razorpayPaymentId });
});
shopRouter.post("/orders/:id/pay/demo", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== req.user.sub) {
    throw new AppError("NOT_FOUND", "Order not found");
  }
  if (order.status !== "pending") {
    throw new AppError("BAD_REQUEST", "Only pending orders can be paid");
  }
  if (order.paymentMethod === "cod") {
    throw new AppError("BAD_REQUEST", "COD order me online payment nahi hoti");
  }
  const ref = `DEMO-${Date.now()}`;
  await prisma.order.update({ where: { id }, data: { status: "paid", paidAt: /* @__PURE__ */ new Date(), paymentRef: ref } });
  await audit(req.user.sub, "shop.payment.demo", { entity: "order", entityId: id, meta: { ref, total: Number(order.totalAmount) } });
  ok(res, { paid: true, status: "paid", paymentRef: ref });
});

// src/routes/claim.routes.ts
import { Router as Router13 } from "express";
init_prisma();
init_audit_service();
var claimRouter = Router13();
claimRouter.use(requireAuth);
var TYPE_BY_MODEL = {
  "2CH": "custom",
  "4CH": "custom",
  "5CH": "custom",
  "6CH": "custom",
  "8CH": "custom",
  "4CH-IR": "custom",
  "FAN-DIM": "dimmer",
  "DIM-3S": "dimmer",
  "DIM-4S": "dimmer"
};
async function claimableHomes(userId) {
  return prisma.homeMember.findMany({
    where: {
      userId,
      role: { in: ["owner", "admin"] },
      home: { status: "active" }
    },
    include: { home: { select: { id: true, name: true } } }
  });
}
claimRouter.get("/homes", async (req, res) => {
  const homes = await claimableHomes(req.user.sub);
  ok(res, homes.map((h) => h.home));
});
claimRouter.post("/", async (req, res) => {
  const serialCode = String(req.body?.serialCode ?? "").trim().toUpperCase();
  const homeId = Number(req.body?.homeId);
  if (!serialCode) throw new AppError("BAD_REQUEST", "Serial code is required");
  if (!Number.isInteger(homeId) || homeId < 1) {
    throw new AppError("BAD_REQUEST", "A valid home is required");
  }
  const serial = await prisma.serialRegistry.findUnique({
    where: { serialCode },
    include: { product: true }
  });
  if (!serial) throw new AppError("NOT_FOUND", "Unknown serial code \u2014 check the sticker on the box");
  if (serial.status === "claimed") {
    throw new AppError("CONFLICT", `This device was already activated by ${serial.userId ? "another user" : "someone"}`);
  }
  if (!["delivered", "shipped"].includes(serial.status)) {
    throw new AppError("CONFLICT", `This device is not yet ready to activate (status: ${serial.status})`);
  }
  const membership2 = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId: req.user.sub } }
  });
  if (!membership2 || !["owner", "admin"].includes(membership2.role)) {
    throw new AppError("FORBIDDEN", "You are not the owner or admin of that home");
  }
  const type = TYPE_BY_MODEL[serial.product.modelCode] ?? "custom";
  const deviceName = `${serial.product.name} \xB7 ${serial.serialCode}`;
  const device = await prisma.$transaction(async (tx) => {
    await tx.serialRegistry.update({
      where: { id: serial.id },
      data: {
        status: "claimed",
        userId: req.user.sub,
        homeId,
        claimedAt: /* @__PURE__ */ new Date(),
        warrantyExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3)
      }
    });
    return tx.device.create({
      data: {
        homeId,
        name: deviceName,
        type,
        status: "off",
        serialNumber: serial.serialCode,
        createdBy: req.user.sub
      }
    });
  });
  await audit(req.user.sub, "shop.device.claim", {
    entity: "device",
    entityId: device.id,
    meta: { serialCode, homeId, model: serial.product.modelCode }
  });
  ok(res, {
    claimed: true,
    device: { id: device.id, name: device.name, type },
    serialCode,
    homeId
  }, 201);
});

// src/routes/warranty.routes.ts
import { Router as Router14 } from "express";
init_prisma();
var warrantyRouter = Router14();
warrantyRouter.use(requireAuth);
warrantyRouter.get("/status", async (req, res) => {
  const code = String(req.query.serial ?? "").trim().toUpperCase();
  if (!code) throw new AppError("BAD_REQUEST", "serial query required");
  const serial = await prisma.serialRegistry.findUnique({
    where: { serialCode: code },
    include: { product: { select: { name: true, modelCode: true } } }
  });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");
  if (serial.userId !== req.user.sub) {
    throw new AppError("FORBIDDEN", "Ye device aapke account me nahi hai");
  }
  ok(res, {
    serialCode: serial.serialCode,
    productName: serial.product.name,
    modelCode: serial.product.modelCode,
    warrantyStatus: serial.warrantyStatus,
    warrantyExpiresAt: serial.warrantyExpiresAt,
    claimedAt: serial.claimedAt
  });
});
warrantyRouter.post("/", async (req, res) => {
  const serialCode = String(req.body?.serialCode ?? "").trim().toUpperCase();
  const reason = String(req.body?.reason ?? "").trim();
  const description = String(req.body?.description ?? "").trim() || void 0;
  if (!serialCode) throw new AppError("BAD_REQUEST", "Serial code is required");
  if (!reason) throw new AppError("BAD_REQUEST", "Reason is required");
  if (reason.length > 255) throw new AppError("BAD_REQUEST", "Reason 255 chars se kam rakho");
  const serial = await prisma.serialRegistry.findUnique({ where: { serialCode } });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");
  if (serial.status !== "claimed") {
    throw new AppError("CONFLICT", "Device pehle activate nahi hua \u2014 serial claim karo");
  }
  if (serial.userId !== req.user.sub) {
    throw new AppError("FORBIDDEN", "Ye device aapke account me nahi hai");
  }
  if (serial.warrantyStatus === "claimed") {
    throw new AppError("CONFLICT", "Is device ki ek claim pehle se active hai");
  }
  if (serial.warrantyExpiresAt && serial.warrantyExpiresAt < /* @__PURE__ */ new Date()) {
    throw new AppError("CONFLICT", "Warranty expire ho chuki hai (serial ke claim ke 1 saal baad)");
  }
  const openClaim = await prisma.warrantyClaim.findFirst({
    where: { serialCode, status: { in: ["submitted", "approved"] } }
  });
  if (openClaim) throw new AppError("CONFLICT", "Ek claim already submitted hai");
  const claim = await prisma.$transaction(async (tx) => {
    const created = await tx.warrantyClaim.create({
      data: { serialCode, userId: req.user.sub, reason, description }
    });
    await tx.serialRegistry.update({
      where: { id: serial.id },
      data: { warrantyStatus: "claimed" }
    });
    return created;
  });
  ok(res, {
    id: claim.id,
    serialCode,
    reason,
    description,
    status: claim.status,
    createdAt: claim.createdAt
  }, 201);
});
warrantyRouter.get("/mine", async (req, res) => {
  const [claims, serials] = await Promise.all([
    prisma.warrantyClaim.findMany({
      where: { userId: req.user.sub },
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.serialRegistry.findMany({
      where: { userId: req.user.sub },
      include: { product: { select: { name: true, modelCode: true } } },
      orderBy: { createdAt: "desc" }
    })
  ]);
  ok(res, { claims, serials });
});

// src/routes/public.routes.ts
init_prisma();
import { Router as Router15 } from "express";
init_audit_service();
var publicRouter = Router15();
publicRouter.get("/site-settings", async (_req, res) => {
  ok(res, await getPublicSiteSettings());
});
var CHIPS = [
  "Kis board ki zaroorat hai?",
  "Site kaise kaam karti hai?",
  "WiFi setup kaise hota hai?",
  "Dimmer chahiye",
  "Fan speed control",
  "IR remote se control",
  "Warranty kya milti hai?",
  "Payment ke options"
];
var FAQ = [
  {
    test: /what is switchnest|yeh (kya|site) hai|kya hai ye|about (switchnest|site|company)|introduce|platform (kya|about)/i,
    reply: "SwitchNest ek smart-home IoT platform hai \u2014 WiFi relay boards (2CH se 8CH), dimmers aur fan regulators bechte hain. Board kharido \u2192 serial code se activate karo \u2192 app se ghar ke lights/fans/appliances ko kisi bhi jagah se control karo. Naya firmware bhi WiFi se hi (OTA) update hota hai \u2014 kabhi USB nahi chahiye."
  },
  {
    test: /how (does )?(it|this|site) (work|kaam)|kaise kaam|kaise chalta|process|flow|kya kaam/i,
    reply: "Poora flow 4 step me: 1\uFE0F\u20E3 Shop se board order karo (WiFi name/password order pe bhi de sakte ho) 2\uFE0F\u20E3 Delivery pe box me unique serial code sticker milta hai 3\uFE0F\u20E3 Serial code se device activate karo \u2014 board aapke home se link 4\uFE0F\u20E3 App/dashboard se on-off control, timers, voice/AI assistant. Hardware factory me pre-tested aata hai aur OTA se updates milte rahte hain."
  },
  {
    test: /wifi|wireless|set up|setup|config|network|connect (karo|karna)|internet/i,
    reply: "WiFi setup 2 tarike se: (1) Order ke waqt WiFi name + password de do \u2014 board factory me hi pre-configured flash hoke aayega, (2) Ya phir board first-boot pe apna khud ka WiFi (SwitchNest-IoT) kholta hai \u2014 phone se connect karke WiFi + server details daal do. Board phir khud connect ho jata hai. WiFi change ho jaye to captive portal se fresh setup ho jata hai."
  },
  {
    test: /ota|update|firmware|upgrade|naya version|software/i,
    reply: "Haan \u2014 saare boards OTA (over-the-air) updates support karte hain. Naya firmware admin publish karta hai aur board khud WiFi se download + flash kar leta hai, bina USB ke. Update safe hai \u2014 dual-slot system, kuch gadbad ho to purana version wapas boot ho jata hai."
  },
  {
    test: /warranty|guarantee|return|refund|repair|service/i,
    reply: "Har board ke sath serial claim ke din se 1 saal ki warranty milti hai. Koi problem aaye to Warranty page se claim file karo \u2014 support team approve karke resolution deti hai. Serial number se har board track hota hai (kaun kharida, kab bheja, kya status)."
  },
  {
    test: /pay|payment|cod|upi|price|cost|kitne ka|rate|rs\.? ?[0-9]/i,
    reply: "Payment options: Cash on Delivery (COD) aur UPI \u2014 online payment bhi (Razorpay) aa raha hai. Prices shop page pe: 2CH \u20B9599 \xB7 4CH \u20B9799 \xB7 5CH \u20B9899 \xB7 6CH \u20B9999 \xB7 8CH \u20B91,199 \xB7 IR \u20B9999 \xB7 Fan Dimmer \u20B9899 \xB7 Dimmers \u20B9749-799. Ek baar order karke dekho \u2014 billing address + optional WiFi ke saath."
  },
  {
    test: /ship|deliver|delivery|kab milega|shipping|dispatch|transport/i,
    reply: "Order ke baad status track hota hai: pending \u2192 paid \u2192 shipped \u2192 delivered. Delivery hone pe box pe serial sticker hota hai. India me sab jagah shipping available hai. Shipping ke baad hi serial code assign hota hai (flasher box me serial + WiFi pre-flash karta hai)."
  },
  {
    test: /activate|serial|claim|code|sticker|box/i,
    reply: "Delivery pe box ke andar sticker me unique serial code (RS-XXXX-XXXXXX) + QR code hota hai. QR scan karo ya Activate page pe serial daalo \u2192 apna home choose karo \u2192 board aapke account me aa jata hai. Serial = aapka ownership proof \u2014 koi aur usse claim nahi kar sakta."
  },
  {
    test: /contact|phone|call|email|support|help|baat|number/i,
    reply: "Contact section me form bharke message bhej sakte ho \u2014 humara team reply karta hai. Email: support@switchnest.in \xB7 Phone/WhatsApp: +91 98765 43210 \xB7 Address: SwitchNest Labs, Noida, UP. Feedback bhi welcome hai!"
  },
  {
    test: /hello|hi|hey|namaste|namaskar|hii|hola|salaam/i,
    reply: "Namaste! \u{1F64F} Main SwitchNest ka assistant hoon. Batao aapko kya chahiye \u2014 kitne lights/fans control karne hain, dimmer chahiye, IR remote se control karna hai, ya site ke baare me kuch poochna hai?"
  }
];
function detectNeed(text, products) {
  const lower = text.toLowerCase();
  if (/(dimmer|brightness|light dim|roshni (kam|zyada)|dima|bright)/i.test(lower)) {
    const steps = /4|four|chaar/.test(lower) ? "DIM-4S" : "DIM-3S";
    const picks = products.filter((p) => p.modelCode === steps);
    return {
      reply: steps === "DIM-4S" ? "4-step touch dimmer best rahega \u2014 off \u2192 33% \u2192 66% \u2192 100%. Touch + app dono se control." : "3-step touch dimmer best rahega \u2014 off \u2192 50% \u2192 100%. Simple aur budget-friendly.",
      products: picks.map((p) => ({ ...p, price: p.price.toString(), reason: "Touch dimmer \u2014 brightness steps" }))
    };
  }
  if (/(fan|pankh).{0,15}(speed|regulator|dim)|(speed|regulator).{0,15}(fan|pankh)|fan dim|regulator/i.test(lower)) {
    const picks = products.filter((p) => p.modelCode === "FAN-DIM");
    return {
      reply: "Fan Speed Dimmer (WiFi fan regulator) \u2014 purane 5-step regulator ki jagah. App se fan speed control karo, voice se bhi.",
      products: picks.map((p) => ({ ...p, price: p.price.toString(), reason: "Fan speed regulator" }))
    };
  }
  if (/(ir|remote|ac |tv |television|air condition)/i.test(lower)) {
    const picks = products.filter((p) => p.modelCode === "4CH-IR");
    return {
      reply: "4CH IR WiFi Relay Module \u2014 4 relay + built-in IR receiver. AC/TV apne remote se bhi control hoga, app se bhi.",
      products: picks.map((p) => ({ ...p, price: p.price.toString(), reason: "IR remote + app control" }))
    };
  }
  const countMatch = lower.match(/(\d+)\s*(?:light|lights|fan|fans|switch|switches|room|channel|device|devices|bulb|bulbs|load|point|points)/) || lower.match(/(?:light|lights|fan|fans|switch|switches|room|channel|device|devices|bulb|bulbs|load|point|points)\s*(\d+)/) || lower.match(/\b(2|3|4|5|6|7|8)\b/);
  if (countMatch) {
    const n = parseInt(countMatch[1] ?? countMatch[0], 10);
    let model = "2CH";
    let note = "";
    if (n <= 2) {
      model = "2CH";
      note = "2 devices ke liye perfect.";
    } else if (n <= 4) {
      model = "4CH";
      note = "4 devices \u2014 ek room ke liye classic choice.";
    } else if (n <= 5) {
      model = "5CH";
      note = "4 devices + 1 spare.";
    } else if (n <= 6) {
      model = "6CH";
      note = "6 devices \u2014 medium home.";
    } else {
      model = "8CH";
      note = "8 devices \u2014 poore ghar ka control ek panel se.";
    }
    const picks = products.filter((p) => p.modelCode === model);
    return {
      reply: `Aapko lagbhag ${n} devices control karne hain \u2014 **${model} WiFi Relay Board** best rahega. ${note} Relay channels khud map kar sakte ho (kis channel pe kaunsa device).`,
      products: picks.map((p) => ({ ...p, price: p.price.toString(), reason: `${n} devices ke liye ${p.relayCount} channel board` }))
    };
  }
  return null;
}
publicRouter.post("/assistant", optionalAuth, async (req, res) => {
  const text = String(req.body?.message ?? "").trim();
  if (!text) return ok(res, { reply: "Kuch likho \u2014 e.g. '4 lights control karne hain' ya 'dimmer chahiye'.", chips: CHIPS });
  if (req.user?.role === "system_admin") {
    return ok(res, await adminAssistantReply(text));
  }
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, modelCode: true, relayCount: true, price: true },
    orderBy: { id: "asc" }
  });
  const need = detectNeed(text, products);
  if (need) return ok(res, { ...need, chips: CHIPS });
  for (const faq of FAQ) {
    if (faq.test.test(text)) {
      return ok(res, { reply: faq.reply, products: [], chips: faq.chips ?? CHIPS });
    }
  }
  const picks = products.slice(0, 6).map((p) => ({ ...p, price: p.price.toString(), reason: "Sabse popular boards" }));
  return ok(res, {
    reply: "Poora clear nahi hua \u{1F642} \u2014 yeh rahe hamare boards, ya mujhe batao: kitne lights/fans? dimmer chahiye? IR remote se control karna hai? Main sahi board suggest kar dunga.",
    products: picks,
    chips: CHIPS
  });
});
var ADMIN_CHIPS = [
  "Kitne users online hain?",
  "Overview stats kaise dekhein?",
  "User ko block/delete kaise karein?",
  "Support inbox kaise use karein?",
  "Firmware OTA kaise push karein?",
  "Audit logs kaise check karein?"
];
var ADMIN_FAQ = [
  {
    test: /overview|stats|statistics|dashboard|report|metrics|trend|kya chal raha/i,
    reply: "Admin panel ke **Overview** tab me platform ke saare stats milte hain \u2014 total users, active today, revenue, orders, homes, devices, ESP boards, API requests (24h), support messages, pending commands, API keys, audit events aur ESP logs. Neeche last 7 days ka signups/orders graph bhi hai. Koi bhi cheez turant dhundhni ho to top me **\u{1F198} Find anything** use karo."
  },
  {
    test: /user|member|customer|block|ban|delete user|role|kaun kaun/i,
    reply: "**Users** tab me har user dikhta hai \u2014 status (active/blocked) badal sakte ho, role (user/system_admin) assign kar sakte ho, delete bhi kar sakte ho. Kisi user ke orders, homes, devices aur ESP boards ka poora context **Support** inbox me user select karke **User Info** panel se milta hai."
  },
  {
    test: /support|inbox|chat|conversation|reply|message aaya/i,
    reply: "**Support** tab WhatsApp-style inbox hai: conversations list left me, chat beech me, aur right me **User Info** panel (orders/homes/devices/boards). Quick replies ready hain (WiFi/OTA/Warranty/Order/Offline), attachments bhej sakte ho, chat mute/pin/clear kar sakte ho. Naya user message aaye to notification + unread badge se pata chal jata hai."
  },
  {
    test: /ota|firmware|push update|flash|update push|version/i,
    reply: "**OTA / ESP** tab me firmware upload karke activate karte ho. Uske baad kisi ek board pe ya saare boards pe ek saath OTA push kar sakte ho. ESP boards rename karna, probe karna, aur online/offline status dekhna bhi yahin se hota hai."
  },
  {
    test: /api key|api-key|integration|third.party|device access/i,
    reply: "**API Keys** tab me device-access API keys banate aur delete karte ho \u2014 ESP32 ya third-party integrations ke liye. Har key ka record audit log me bhi track hota hai."
  },
  {
    test: /audit|log|track|history|activity|kisne kya/i,
    reply: "**Audit Log** tab me har important action track hota hai \u2014 kaun, kis entity pe, kya kiya, kab (user, entity type, meta, timestamp). Suspicious activity check karne ke liye perfect. ESP boards ki history alag se **OTA / ESP** tab me dikhti hai."
  },
  {
    test: /settings|site setting|brand|test email|theme|contact info/i,
    reply: "**Settings** tab me site-wide settings hain \u2014 site name, support email/phone/address/hours, theme/brand color. **Test email** bhejkar verify bhi kar sakte ho ki email system sahi chal raha hai."
  },
  {
    test: /search|find|dhundo|dhundho|lookup|khojo/i,
    reply: "Top me **\u{1F198} Find anything** button aur **Global search** dono hain \u2014 users, homes, devices, ESP boards, orders, serials \u2014 jo bhi daalo, turant result. Kisi user ka context chahiye to **Support** inbox kholo."
  },
  {
    test: /order|payment|revenue|sale|sell|shop|kitna bik/i,
    reply: "**Shop / Orders** tab me saare orders + payment status dikhte hain. **Overview** me revenue stats milte hain. Order cancel karna, payment verify karna \u2014 sab yahin se hota hai."
  },
  {
    test: /hello|hi|hey|namaste|namaskar|hii|hola|salaam/i,
    reply: "Namaste Admin! \u{1F6E1}\uFE0F Main SwitchNest ka admin assistant hoon. Admin panel ke har feature me guide kar sakta hoon \u2014 stats, users, homes, devices, OTA/firmware, API keys, audit logs, support inbox ya settings. Batao kya karna hai?"
  }
];
var DAY_MS3 = 864e5;
var FIVE_MIN_MS = 3e5;
async function adminLiveStats() {
  const dayAgo = new Date(Date.now() - DAY_MS3);
  const fiveMinAgo = new Date(Date.now() - FIVE_MIN_MS);
  const monthStart = /* @__PURE__ */ new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [
    users,
    activeToday,
    onlineNow,
    homes,
    devices,
    onlineDevices,
    espBoards,
    offlineBoards,
    orders,
    pendingOrders,
    revenueTotal,
    revenueMonth,
    unreadSupport,
    apiKeys
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { lastLoginAt: { gte: dayAgo } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: fiveMinAgo } } }),
    prisma.home.count(),
    prisma.device.count(),
    prisma.device.count({ where: { lastSeen: { gte: dayAgo } } }),
    prisma.espDevice.count(),
    prisma.espDevice.count({ where: { OR: [{ offline: true }, { lastSeen: { lt: fiveMinAgo } }] } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paidAt: { not: null } } }),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paidAt: { not: null }, createdAt: { gte: monthStart } } }),
    prisma.supportMessage.count({ where: { senderRole: "user", readByAdmin: false, deletedAt: null } }),
    prisma.apiKey.count()
  ]);
  const apiRequests = getRequestStats();
  return {
    users,
    activeToday,
    onlineNow,
    homes,
    devices,
    onlineDevices,
    espBoards,
    offlineBoards,
    orders,
    pendingOrders,
    revenueTotal: Number(revenueTotal._sum.totalAmount ?? 0),
    revenueMonth: Number(revenueMonth._sum.totalAmount ?? 0),
    unreadSupport,
    apiKeys,
    apiRequests
  };
}
var plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
var ADMIN_LIVE_INTENTS = [
  {
    test: /(kitne|kitna|how many|count).{0,15}(user|users|member|log|bande|account)|(user|users|member)s? (online|active)|online (user|users)|active user|kitne log/i,
    reply: (s) => `Abhi platform pe **${plural(s.onlineNow, "user")} online** hain (last 5 min me active). Aaj (24h) **${plural(s.activeToday, "active user")}** \u2014 total **${plural(s.users, "registered user")}**. Devices: **${plural(s.onlineDevices, "device")}/${s.devices} online**, ESP boards: **${s.espBoards - s.offlineBoards}/${s.espBoards} online**.`
  },
  {
    test: /(kitne|kitna|how many|count|total).{0,15}(order|sale|revenue|paisa|kamai)|revenue (kya|kitna|abhi)|kitna kamaya|total (revenue|orders)/i,
    reply: (s) => `Total revenue: **\u20B9${s.revenueTotal.toLocaleString("en-IN")}** (is mahine \u20B9${s.revenueMonth.toLocaleString("en-IN")}). Total orders: **${plural(s.orders, "order")}** \u2014 abhi **${plural(s.pendingOrders, "pending")}**.`
  },
  {
    test: /(kitne|kitna|how many|count).{0,15}(device|board|esp)|device(s)? (online|offline)|board(s)? (online|offline)|online (device|board)/i,
    reply: (s) => `Devices: **${plural(s.onlineDevices, "device")}/${s.devices} online** (24h me active). ESP boards: **${s.espBoards - s.offlineBoards}/${s.espBoards} online** \u2014 **${plural(s.offlineBoards, "board")} offline**. Homes: **${plural(s.homes, "home")}**, API keys: **${s.apiKeys}**.`
  },
  {
    test: /(kitne|kitna|unread).{0,15}(support )?(message|chat)|unread (messages?|chats?)|pending (support|message|chat)/i,
    reply: (s) => `Support me **${plural(s.unreadSupport, "unread message")}** hain abhi. Saari conversations **Support** tab me hain \u2014 unread badge se naye messages ka pata chal jata hai.`
  },
  {
    test: /api (request|hit|call)|request(s)? (kitne|count|kitte)|kitne (request|hit)|traffic|kitna traffic/i,
    reply: (s) => `API requests: **${plural(s.apiRequests.today, "request")}** aaj, **${plural(s.apiRequests.last24h, "request")}** last 24h \u2014 total **${plural(s.apiRequests.total, "request")}** all-time.`
  }
];
async function adminAssistantReply(text) {
  if (!text) {
    return { reply: "Kya help chahiye? e.g. 'Kitne users online hain?' ya 'Overview stats kaise dekhein?'", products: [], chips: ADMIN_CHIPS };
  }
  for (const intent of ADMIN_LIVE_INTENTS) {
    if (intent.test.test(text)) {
      const stats = await adminLiveStats();
      return { reply: intent.reply(stats), products: [], chips: ADMIN_CHIPS };
    }
  }
  for (const faq of ADMIN_FAQ) {
    if (faq.test.test(text)) {
      return { reply: faq.reply, products: [], chips: faq.chips ?? ADMIN_CHIPS };
    }
  }
  return {
    reply: "Yeh sawaal mera clear nahi hua \u{1F642} Main in cheezon me help kar sakta hoon \u2014 live stats (kitne users online, revenue, devices online), Overview, Users, Homes, Devices, OTA/firmware, API keys, Audit logs, Support inbox, Settings aur Global search. Koi ek batao \u2014 main jawab de dunga.",
    products: [],
    chips: ADMIN_CHIPS
  };
}
publicRouter.post("/assistant/admin", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") {
    throw new AppError("FORBIDDEN", "Admin access required", 403);
  }
  return ok(res, await adminAssistantReply(String(req.body?.message ?? "").trim()));
});
publicRouter.post("/contact", async (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 100);
  const email = String(req.body?.email ?? "").trim().slice(0, 120) || null;
  const phone = String(req.body?.phone ?? "").trim().slice(0, 20) || null;
  const subject = String(req.body?.subject ?? "Feedback").trim().slice(0, 150);
  const message = String(req.body?.message ?? "").trim();
  if (!name) return ok(res, { error: "Name required" }, 400);
  if (!message) return ok(res, { error: "Message required" }, 400);
  if (message.length > 4e3) return ok(res, { error: "Message 4000 chars se kam rakho" }, 400);
  const created = await prisma.contactMessage.create({
    data: { name, email, phone, subject, message }
  });
  ok(res, { id: created.id, status: created.status }, 201);
});
publicRouter.get("/support/my", requireAuth, async (req, res) => {
  const msgs = await prisma.contactMessage.findMany({
    where: { userId: req.user.sub },
    orderBy: { createdAt: "desc" },
    take: 30
  });
  ok(res, msgs);
});
publicRouter.post("/support", requireAuth, async (req, res) => {
  const subject = String(req.body?.subject ?? "Support").trim().slice(0, 150);
  const message = String(req.body?.message ?? "").trim();
  const phone = String(req.body?.phone ?? "").trim().slice(0, 20) || null;
  const orderNumber = String(req.body?.orderNumber ?? "").trim().slice(0, 50) || null;
  if (!message) return ok(res, { error: "Message required" }, 400);
  if (message.length > 4e3) return ok(res, { error: "Message 4000 chars se kam rakho" }, 400);
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, username: true, email: true }
  });
  const created = await prisma.contactMessage.create({
    data: {
      userId: user?.id ?? req.user.sub,
      name: user?.username ?? "User",
      email: user?.email ?? null,
      phone,
      subject: orderNumber ? `${subject} (Order ${orderNumber})` : subject,
      message
    }
  });
  await audit(req.user.sub, "user.support.contact", {
    entity: "contactMessage",
    entityId: created.id,
    meta: { subject }
  });
  ok(res, { id: created.id, status: created.status }, 201);
});

// src/routes/support.routes.ts
import { Router as Router16 } from "express";
import { z as z13 } from "zod";
import jwt4 from "jsonwebtoken";
init_prisma();

// src/lib/attachmentStore.ts
import * as fs4 from "fs";
import * as path5 from "path";
function extFor(type, name) {
  const fromName = name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  if (type.startsWith("image/png")) return "png";
  if (type.startsWith("image/jpeg")) return "jpg";
  if (type.startsWith("image/gif")) return "gif";
  if (type.startsWith("image/webp")) return "webp";
  if (type.startsWith("image/heic")) return "heic";
  if (type === "application/pdf") return "pdf";
  if (type === "text/plain") return "txt";
  return "bin";
}
function saveAttachment(base64, type, name) {
  const buf = Buffer.from(base64, "base64");
  if (buf.length === 0) throw new Error("Empty file");
  const filename = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}.${extFor(type, name)}`;
  fs4.mkdirSync(attachmentDir, { recursive: true });
  fs4.writeFileSync(path5.join(attachmentDir, filename), buf);
  return filename;
}
function readAttachmentFile(filename) {
  const safe = path5.basename(filename);
  if (safe !== filename) return null;
  try {
    return fs4.readFileSync(path5.join(attachmentDir, safe));
  } catch {
    return null;
  }
}
function deleteAttachmentFile(filename) {
  if (!filename) return;
  const safe = path5.basename(filename);
  if (safe !== filename) return;
  try {
    fs4.unlinkSync(path5.join(attachmentDir, safe));
  } catch {
  }
}

// src/routes/support.routes.ts
var supportRouter = Router16();
var MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
var ALLOWED_TYPES = /^(image\/(png|jpe?g|gif|webp|heic)|application\/pdf|text\/plain)$/;
var attachmentFields = {
  attachmentName: z13.string().trim().min(1).max(255).optional(),
  attachmentType: z13.string().trim().min(1).max(100).optional(),
  attachmentData: z13.string().min(1).optional()
};
function refineAttachment(d, ctx) {
  const hasAny = d.attachmentName != null || d.attachmentType != null || d.attachmentData != null;
  if (!hasAny) return;
  if (!d.attachmentName || !d.attachmentType || !d.attachmentData) {
    ctx.addIssue({ code: "custom", path: ["attachmentData"], message: "Attachment incomplete" });
    return;
  }
  if (!ALLOWED_TYPES.test(d.attachmentType)) {
    ctx.addIssue({ code: "custom", path: ["attachmentType"], message: "Unsupported file type" });
    return;
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(d.attachmentData)) {
    ctx.addIssue({ code: "custom", path: ["attachmentData"], message: "Invalid file data" });
    return;
  }
  if (d.attachmentData.length * 3 > MAX_ATTACHMENT_BYTES * 4 + 8) {
    ctx.addIssue({ code: "custom", path: ["attachmentData"], message: "File too large (max 2MB)" });
  }
}
function supportModel() {
  if (!prisma.supportMessage) {
    throw new AppError("INTERNAL", "Support module unavailable \u2014 Prisma client stale. Run: npx prisma generate in site/apps/api", 500);
  }
  return prisma.supportMessage;
}
var msgSelect = {
  id: true,
  userId: true,
  senderRole: true,
  senderName: true,
  message: true,
  attachmentName: true,
  attachmentType: true,
  attachmentData: true,
  attachmentPath: true,
  readByUser: true,
  readByAdmin: true,
  deletedAt: true,
  createdAt: true
};
async function firstAdminId() {
  const admin = await prisma.user.findFirst({
    where: { role: "system_admin" },
    select: { id: true },
    orderBy: { id: "asc" }
  });
  return admin?.id ?? null;
}
async function isMuted(viewerId, peerUserId) {
  if (!prisma.supportChatSettings) return false;
  const s = await prisma.supportChatSettings.findUnique({
    where: { userId_peerUserId: { userId: viewerId, peerUserId } },
    select: { mutedAt: true }
  }).catch(() => null);
  return !!s?.mutedAt;
}
supportRouter.get("/admin/messages", requireAuth, async (req, res) => {
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId) || userId <= 0) throw new AppError("VALIDATION_ERROR", "userId required", 400);
  const msgs = await supportModel().findMany({
    where: { userId, deletedAt: null },
    select: msgSelect,
    orderBy: { createdAt: "asc" },
    take: 200
  });
  const unread = await supportModel().count({ where: { userId, readByAdmin: false, deletedAt: null } });
  if (unread > 0) {
    await supportModel().updateMany({
      where: { userId, readByAdmin: false, deletedAt: null },
      data: { readByAdmin: true }
    });
  }
  ok(res, { userId, unread, messages: msgs });
});
var adminSendSchema = z13.object({
  userId: z13.number().int().positive(),
  message: z13.string().trim().max(4e3),
  ...attachmentFields
}).superRefine((d, ctx) => {
  if (!d.message && !d.attachmentData) {
    ctx.addIssue({ code: "custom", path: ["message"], message: "Message ya file required" });
  }
  refineAttachment(d, ctx);
});
supportRouter.post("/admin/messages", requireAuth, validateBody(adminSendSchema), async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const { userId, message } = req.body;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, email: true } });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
  const created = await supportModel().create({
    data: {
      userId,
      senderRole: "admin",
      senderName: req.user.username,
      message,
      attachmentName: req.body.attachmentName ?? null,
      attachmentType: req.body.attachmentType ?? null,
      // Naya: file disk pe (hardware/attachments), DB me sirf path. Legacy rows me blob (attachment_data) rehta hai.
      attachmentData: null,
      attachmentPath: req.body.attachmentData ? saveAttachment(req.body.attachmentData, req.body.attachmentType, req.body.attachmentName) : null,
      readByUser: false,
      readByAdmin: true
    }
  });
  if (!await isMuted(userId, req.user.sub)) {
    await createNotification(userId, {
      category: "support",
      type: "info",
      title: "\u{1F6E0}\uFE0F Support ne message bheja",
      body: JSON.stringify({ u: req.user.sub, t: message.slice(0, 200) })
    });
  }
  emitToUser(userId, "support:new", { senderRole: "admin", message: created });
  if (user.email) {
    void sendSupportReplyEmail({ to: user.email, userName: user.username, replyText: message });
  }
  ok(res, created, 201);
});
supportRouter.get("/messages", requireAuth, async (req, res) => {
  const userId = req.user.sub;
  const [messages, unreadCount2] = await Promise.all([
    supportModel().findMany({
      where: { userId, deletedAt: null },
      select: msgSelect,
      orderBy: { createdAt: "asc" },
      take: 200
    }),
    supportModel().count({ where: { userId, readByUser: false, deletedAt: null } })
  ]);
  if (unreadCount2 > 0) {
    await supportModel().updateMany({
      where: { userId, readByUser: false, deletedAt: null },
      data: { readByUser: true }
    });
  }
  ok(res, { unread: unreadCount2, messages });
});
var userSendSchema = z13.object({
  message: z13.string().trim().max(4e3),
  ...attachmentFields
}).superRefine((d, ctx) => {
  if (!d.message && !d.attachmentData) {
    ctx.addIssue({ code: "custom", path: ["message"], message: "Message ya file required" });
  }
  refineAttachment(d, ctx);
});
supportRouter.post("/messages", requireAuth, validateBody(userSendSchema), async (req, res) => {
  const userId = req.user.sub;
  const created = await supportModel().create({
    data: {
      userId,
      senderRole: "user",
      senderName: req.user.username,
      message: req.body.message,
      attachmentName: req.body.attachmentName ?? null,
      attachmentType: req.body.attachmentType ?? null,
      // Naya: file disk pe (hardware/attachments), DB me sirf path.
      attachmentData: null,
      attachmentPath: req.body.attachmentData ? saveAttachment(req.body.attachmentData, req.body.attachmentType, req.body.attachmentName) : null,
      readByUser: true,
      readByAdmin: false
    }
  });
  const admin = await prisma.user.findFirst({
    where: { role: "system_admin" },
    select: { id: true },
    orderBy: { id: "asc" }
  });
  if (admin) {
    if (!await isMuted(admin.id, req.user.sub)) {
      await createNotification(admin.id, {
        category: "support",
        type: "info",
        title: "\u{1F4E8} User ne support me reply kiya",
        body: JSON.stringify({ u: req.user.sub, t: (req.body.message || "").slice(0, 200) })
      });
    }
    emitToUser(admin.id, "support:new", { senderRole: "user", message: created });
  }
  ok(res, created, 201);
});
supportRouter.get("/attachment/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError("VALIDATION_ERROR", "Invalid attachment id", 400);
  const header = req.headers.authorization;
  const qToken = typeof req.query.token === "string" ? req.query.token : null;
  let payload = null;
  try {
    const raw = header?.startsWith("Bearer ") ? header.slice(7) : qToken;
    if (raw) payload = jwt4.verify(raw, env.JWT_ACCESS_SECRET);
  } catch {
  }
  if (!payload) throw new AppError("UNAUTHORIZED", "Missing bearer token", 401);
  const msg = await supportModel().findUnique({
    where: { id },
    select: { userId: true, attachmentPath: true, attachmentName: true, attachmentType: true, deletedAt: true }
  });
  if (!msg || msg.deletedAt || !msg.attachmentPath) throw new AppError("NOT_FOUND", "Attachment not found", 404);
  if (msg.userId !== payload.sub && payload.role !== "system_admin") {
    throw new AppError("FORBIDDEN", "Access denied", 403);
  }
  const buf = readAttachmentFile(msg.attachmentPath);
  if (!buf) throw new AppError("NOT_FOUND", "Attachment file missing", 404);
  const isImage = (msg.attachmentType ?? "").startsWith("image/");
  res.setHeader("Content-Type", msg.attachmentType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `${isImage ? "inline" : "attachment"}; filename="${encodeURIComponent(msg.attachmentName || "file")}"`
  );
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(buf);
});
supportRouter.get("/admin/unread-count", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  if (!prisma.supportMessage) return ok(res, { unread: 0 });
  const groups = await supportModel().groupBy({
    by: ["userId"],
    where: { readByAdmin: false, deletedAt: null },
    _count: { _all: true }
  });
  ok(res, { unread: groups.length });
});
supportRouter.get("/admin/conversations", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  if (!prisma.supportMessage) return ok(res, { conversations: [], totalUnread: 0 });
  const recent = await supportModel().findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      userId: true,
      senderRole: true,
      message: true,
      attachmentName: true,
      readByAdmin: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: 1e3
  });
  const byUser = /* @__PURE__ */ new Map();
  for (const m of recent) {
    const cur = byUser.get(m.userId);
    const preview = m.message?.trim() ? m.message : m.attachmentName ? `\u{1F4CE} ${m.attachmentName}` : "(attachment)";
    if (!cur) {
      byUser.set(m.userId, {
        lastPreview: preview,
        lastSenderRole: m.senderRole,
        lastAt: m.createdAt,
        unread: m.readByAdmin ? 0 : 1
      });
    } else if (!m.readByAdmin) {
      cur.unread += 1;
    }
  }
  const userIds = [...byUser.keys()];
  const users = userIds.length > 0 ? await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, email: true }
  }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const conversations = [...byUser.entries()].map(([userId, c]) => ({
    userId,
    username: userMap.get(userId)?.username ?? "Unknown",
    email: userMap.get(userId)?.email ?? null,
    lastPreview: c.lastPreview.slice(0, 120),
    lastSenderRole: c.lastSenderRole,
    lastAt: c.lastAt,
    unreadCount: c.unread
  })).sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
  const totalUnread = conversations.reduce((a, c) => a + c.unreadCount, 0);
  ok(res, { conversations, totalUnread });
});
supportRouter.post("/admin/read-all", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  if (!prisma.supportMessage) return ok(res, { unread: 0 });
  await supportModel().updateMany({
    where: { readByAdmin: false, deletedAt: null },
    data: { readByAdmin: true }
  });
  ok(res, { unread: 0 });
});
supportRouter.post("/admin/thread-read", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const userId = Number(req.body?.userId);
  const read = Boolean(req.body?.read);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError("VALIDATION_ERROR", "userId required", 400);
  }
  if (!prisma.supportMessage) return ok(res, { updated: 0 });
  const updated = await supportModel().updateMany({
    where: { userId, deletedAt: null, readByAdmin: read ? false : true },
    data: { readByAdmin: read }
  });
  ok(res, { updated: updated.count });
});
supportRouter.get("/admin/context", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError("VALIDATION_ERROR", "userId required", 400);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true
    }
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
  const [memberships, orders] = await Promise.all([
    prisma.homeMember.findMany({
      where: { userId },
      select: {
        role: true,
        home: {
          select: {
            id: true,
            name: true,
            status: true,
            owner: { select: { id: true, username: true } },
            _count: { select: { devices: true, members: true, rooms: true } }
          }
        }
      },
      orderBy: { joinedAt: "asc" }
    }),
    prisma.order.findMany({
      where: { userId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        shippingPhone: true,
        createdAt: true,
        _count: { select: { items: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 15
    })
  ]);
  const homeIds = memberships.map((m) => m.home.id);
  const [devices, esps] = homeIds.length > 0 ? await Promise.all([
    prisma.device.findMany({
      where: { homeId: { in: homeIds } },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        serialNumber: true,
        offline: true,
        lastSeen: true,
        room: { select: { name: true } },
        home: { select: { name: true } }
      },
      orderBy: { name: "asc" },
      take: 100
    }),
    prisma.espDevice.findMany({
      where: { homeId: { in: homeIds } },
      select: {
        id: true,
        name: true,
        macAddress: true,
        serialCode: true,
        modelCode: true,
        firmwareVersion: true,
        offline: true,
        ipAddress: true,
        lastSeen: true,
        home: { select: { name: true } }
      },
      orderBy: { id: "asc" },
      take: 50
    })
  ]) : [[], []];
  ok(res, {
    user,
    homes: memberships.map((m) => ({ ...m.home, memberRole: m.role })),
    devices,
    esps,
    orders
  });
});
supportRouter.get("/settings", requireAuth, async (req, res) => {
  if (!prisma.supportChatSettings) return ok(res, { settings: [] });
  const settings = await prisma.supportChatSettings.findMany({
    where: { userId: req.user.sub },
    select: { peerUserId: true, mutedAt: true, pinnedAt: true }
  });
  ok(res, { settings });
});
supportRouter.put("/settings/:peerUserId", requireAuth, async (req, res) => {
  if (!prisma.supportChatSettings) throw new AppError("INTERNAL", "Chat settings unavailable \u2014 prisma client stale", 500);
  let peerUserId = Number(req.params.peerUserId);
  if (req.user.role !== "system_admin") {
    peerUserId = await firstAdminId() ?? 0;
  }
  if (!Number.isInteger(peerUserId) || peerUserId <= 0) {
    throw new AppError("VALIDATION_ERROR", "peerUserId required", 400);
  }
  const { muted, pinned } = req.body;
  if (muted === void 0 && pinned === void 0) {
    throw new AppError("VALIDATION_ERROR", "muted ya pinned required", 400);
  }
  const data = {};
  if (typeof muted === "boolean") data.mutedAt = muted ? /* @__PURE__ */ new Date() : null;
  if (typeof pinned === "boolean") data.pinnedAt = pinned ? /* @__PURE__ */ new Date() : null;
  const setting = await prisma.supportChatSettings.upsert({
    where: { userId_peerUserId: { userId: req.user.sub, peerUserId } },
    create: {
      userId: req.user.sub,
      peerUserId,
      mutedAt: data.mutedAt ?? null,
      pinnedAt: data.pinnedAt ?? null
    },
    update: data
  });
  ok(res, setting);
});
supportRouter.delete("/messages/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const msg = await supportModel().findUnique({ where: { id } });
  if (!msg) throw new AppError("NOT_FOUND", "Message not found", 404);
  if (msg.userId !== req.user.sub || msg.senderRole !== "user") {
    throw new AppError("FORBIDDEN", "Sirf apna message delete kar sakte ho", 403);
  }
  await supportModel().update({ where: { id }, data: { deletedAt: /* @__PURE__ */ new Date() } });
  deleteAttachmentFile(msg.attachmentPath);
  ok(res, { deleted: true });
});
supportRouter.delete("/admin/messages/:id", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const id = Number(req.params.id);
  const msg = await supportModel().findUnique({ where: { id } });
  if (!msg) throw new AppError("NOT_FOUND", "Message not found", 404);
  await supportModel().update({ where: { id }, data: { deletedAt: /* @__PURE__ */ new Date() } });
  deleteAttachmentFile(msg.attachmentPath);
  ok(res, { deleted: true });
});
supportRouter.delete("/messages", requireAuth, async (req, res) => {
  const withFiles = await supportModel().findMany({
    where: { userId: req.user.sub, deletedAt: null },
    select: { attachmentPath: true }
  });
  const r = await supportModel().updateMany({
    where: { userId: req.user.sub, deletedAt: null },
    data: { deletedAt: /* @__PURE__ */ new Date() }
  });
  withFiles.forEach((m) => deleteAttachmentFile(m.attachmentPath));
  ok(res, { cleared: r.count });
});
supportRouter.delete("/admin/messages", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const userId = Number(req.query.peerUserId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError("VALIDATION_ERROR", "peerUserId required", 400);
  }
  const withFiles = await supportModel().findMany({
    where: { userId, deletedAt: null },
    select: { attachmentPath: true }
  });
  const r = await supportModel().updateMany({
    where: { userId, deletedAt: null },
    data: { deletedAt: /* @__PURE__ */ new Date() }
  });
  withFiles.forEach((m) => deleteAttachmentFile(m.attachmentPath));
  ok(res, { cleared: r.count });
});

// src/routes/index.ts
init_prisma();
var apiRouter = Router17();
apiRouter.use("/auth", authRouter);
apiRouter.use("/homes", homeRouter);
apiRouter.use("/homes", memberRouter);
apiRouter.use("/homes", deviceRouter);
apiRouter.use("/homes", roomRouter);
apiRouter.use("/homes", scheduleRouter);
apiRouter.use("/device", deviceApiRouter);
apiRouter.use("/api-keys", apiKeyRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/support", supportRouter);
apiRouter.use("/assistant", assistantRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/shop", shopRouter);
apiRouter.use("/claim", claimRouter);
apiRouter.use("/warranty", warrantyRouter);
apiRouter.use("/public", publicRouter);
apiRouter.get("/firmware/current", requireAuth, async (_req, res) => {
  const versions = await prisma.firmwareVersion.findMany({
    where: { isCurrent: true },
    select: { modelCode: true, version: true, releaseNotes: true },
    orderBy: { modelCode: "asc" }
  });
  ok(res, versions);
});

// src/routes/install.routes.ts
import { Router as Router18 } from "express";
import mysql from "mysql2/promise";
import fs5 from "node:fs";
import path6 from "node:path";
import bcrypt2 from "bcryptjs";
init_prisma();

// src/services/scheduler.service.ts
init_prisma();
init_audit_service();
var timer = null;
var running = false;
var CHECK_INTERVAL_MS = 1e4;
function startScheduler() {
  if (timer) return;
  timer = setInterval(runDueSchedules, CHECK_INTERVAL_MS);
  void runDueSchedules();
  console.log("[scheduler] started (every 10s)");
  fileLog("[scheduler] started (every 10s)");
}
async function runDueSchedules() {
  if (running) return;
  running = true;
  fileLog(`[scheduler] tick ${(/* @__PURE__ */ new Date()).toISOString()} start`);
  try {
    const now = /* @__PURE__ */ new Date();
    const due = await prisma.schedule.findMany({
      where: { enabled: true, nextRun: { lte: now } },
      include: { device: true },
      take: 100
    });
    for (const sched of due) {
      try {
        await fireSchedule(sched.id);
      } catch (err) {
        console.error(`[scheduler] failed to fire schedule ${sched.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] tick error:", err);
    fileLog(`[scheduler] tick ERROR: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    running = false;
    fileLog(`[scheduler] tick ${(/* @__PURE__ */ new Date()).toISOString()} done`);
  }
}
async function fireSchedule(scheduleId) {
  const sched = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { device: true }
  });
  if (!sched || !sched.enabled) return;
  const firedAt = /* @__PURE__ */ new Date();
  await prisma.$transaction([
    prisma.device.update({
      where: { id: sched.device.id },
      data: { status: sched.action }
    }),
    prisma.deviceCommand.create({
      data: {
        deviceId: sched.device.id,
        actorId: null,
        command: `set_status:${sched.action}`
      }
    }),
    prisma.deviceLog.create({
      data: {
        deviceId: sched.device.id,
        actorId: null,
        logType: "schedule",
        logMessage: `Scheduled turn ${sched.action} (schedule #${sched.id})`
      }
    })
  ]);
  const nextRun = computeNextRun({
    type: sched.type,
    runAt: sched.runAt,
    cron: sched.cron,
    from: firedAt
  });
  await prisma.schedule.update({
    where: { id: sched.id },
    data: {
      lastRun: firedAt,
      nextRun,
      enabled: sched.type === "once" ? false : sched.enabled
    }
  });
  await audit(null, "schedule.fire", {
    homeId: sched.device.homeId,
    entity: "schedule",
    entityId: sched.id,
    meta: { deviceId: sched.device.id, deviceName: sched.device.name, action: sched.action }
  });
  emitToHome(sched.device.homeId, "device:updated", {
    id: sched.device.id,
    status: sched.action,
    via: "schedule"
  });
  if (sched.createdBy) {
    await createNotification(sched.createdBy, {
      category: "schedule",
      type: "info",
      title: `\u23F0 Schedule fired: ${sched.device.name} ${sched.action.toUpperCase()}`,
      body: `Schedule #${sched.id} ne ${sched.device.name} ko ${sched.action} kiya.`
    });
  }
  console.log(
    `[scheduler] fired schedule #${sched.id}: ${sched.device.name} -> ${sched.action} (next: ${nextRun?.toISOString() ?? "never"})`
  );
}

// src/services/offline.service.ts
init_prisma();
var timer2 = null;
var OFFLINE_THRESHOLD_MS = 12e4;
var CHECK_INTERVAL_MS2 = 6e4;
function startOfflineWatcher() {
  if (timer2) return;
  timer2 = setInterval(checkOfflineDevices, CHECK_INTERVAL_MS2);
  void checkOfflineDevices();
  console.log("[offline] watcher started (every 60s)");
  fileLog("[offline] watcher started (every 60s)");
}
async function checkOfflineDevices() {
  fileLog(`[offline] tick ${(/* @__PURE__ */ new Date()).toISOString()} start`);
  try {
    await checkOfflineDevicesInner();
  } catch (err) {
    console.error("[offline] tick error:", err instanceof Error ? err.message : err);
    fileLog(`[offline] tick ERROR: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    fileLog(`[offline] tick ${(/* @__PURE__ */ new Date()).toISOString()} done`);
  }
}
async function checkOfflineDevicesInner() {
  const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MS);
  const staleBoards = await prisma.espDevice.findMany({
    where: { lastSeen: { lt: cutoff }, offline: false },
    include: { home: { include: { members: { where: { role: { in: ["owner", "admin"] } } } } } },
    take: 50
  });
  const anyStaleBoardIds = new Set(
    (await prisma.espDevice.findMany({ where: { lastSeen: { lt: cutoff } }, select: { id: true } })).map((b) => b.id)
  );
  for (const board of staleBoards) {
    await prisma.espDevice.update({ where: { id: board.id }, data: { offline: true } });
    emitToHome(board.homeId, "esp:updated", { id: board.id, offline: true });
    const boardName = board.name ?? board.serialCode ?? `ESP-${board.macAddress.slice(-6).toUpperCase()}`;
    for (const m of board.home.members) {
      await createNotification(m.userId, {
        category: "device",
        type: "warning",
        title: `\u{1F4E1} Board offline: ${boardName}`,
        body: `${boardName} ne 2+ min se sync nahi kiya \u2014 WiFi/power check karo.`
      });
    }
    console.log(`[offline] board ${boardName} (${board.id}) marked offline`);
  }
  const backBoards = await prisma.espDevice.findMany({
    where: { offline: true, lastSeen: { gte: cutoff } },
    include: { home: { include: { members: { where: { role: { in: ["owner", "admin"] } } } } } },
    take: 50
  });
  for (const board of backBoards) {
    await prisma.espDevice.update({ where: { id: board.id }, data: { offline: false } });
    emitToHome(board.homeId, "esp:updated", { id: board.id, offline: false });
    const boardName = board.name ?? board.serialCode ?? `ESP-${board.macAddress.slice(-6).toUpperCase()}`;
    for (const m of board.home.members) {
      await createNotification(m.userId, {
        category: "device",
        type: "info",
        title: `\u2705 Board online: ${boardName}`,
        body: `${boardName} wapas connected ho gaya.`
      });
    }
    console.log(`[offline] board ${boardName} (${board.id}) back online`);
  }
  const stale = await prisma.device.findMany({
    where: {
      lastSeen: { lt: cutoff },
      ...anyStaleBoardIds.size ? { OR: [{ espId: null }, { espId: { notIn: [...anyStaleBoardIds] } }] } : {}
    },
    include: { home: { include: { members: { where: { role: { in: ["owner", "admin"] } } } } } },
    take: 50
  });
  for (const device of stale) {
    const wasOnline = device.lastSeen !== null && !device.offline;
    if (!wasOnline) continue;
    await prisma.device.update({ where: { id: device.id }, data: { offline: true } });
    emitToHome(device.homeId, "device:updated", { id: device.id, offline: true });
    const targetIds = device.home.members.map((m) => m.userId);
    for (const userId of targetIds) {
      await createNotification(userId, {
        category: "device",
        type: "warning",
        title: `\u{1F4E1} ${device.name} offline`,
        body: `${device.name} ne 2+ min se sync nahi kiya. WiFi/device check karo.`
      });
    }
    console.log(`[offline] ${device.name} (${device.id}) marked offline`);
  }
  const backOnline = await prisma.device.findMany({
    where: { offline: true, lastSeen: { gte: cutoff } },
    include: { home: { include: { members: { where: { role: { in: ["owner", "admin"] } } } } } },
    take: 50
  });
  for (const device of backOnline) {
    await prisma.device.update({ where: { id: device.id }, data: { offline: false } });
    emitToHome(device.homeId, "device:updated", { id: device.id, offline: false });
    for (const userId of device.home.members.map((m) => m.userId)) {
      await createNotification(userId, {
        category: "device",
        type: "info",
        title: `\u2705 ${device.name} online`,
        body: `${device.name} wapas connected ho gaya.`
      });
    }
    console.log(`[offline] ${device.name} (${device.id}) back online`);
  }
}

// src/routes/install.routes.ts
var SCHEMA_SQL = path6.resolve(process.cwd(), "prisma/schema.sql");
var installRouter = Router18();
var DEFAULT_PRODUCTS = [
  { name: "2CH WiFi Relay Module", modelCode: "2CH", relayCount: 2, price: "599", description: "Two-channel WiFi relay board for lights and small appliances. 10A per channel, ESP32 based, works with the SwitchNest app and voice assistant.", features: { channels: 2, wifi: true, ota: true, voice: true } },
  { name: "4CH WiFi Relay Module", modelCode: "4CH", relayCount: 4, price: "799", description: "Four-channel WiFi relay board \u2014 the classic choice for room-wide control. 10A per channel with status LED and manual override switches.", features: { channels: 4, wifi: true, ota: true, voice: true } },
  { name: "5CH WiFi Relay Module", modelCode: "5CH", relayCount: 5, price: "899", description: "Five-channel relay board \u2014 perfect for combining 4 devices plus one spare. ESP32 with OTA updates and two-way sync.", features: { channels: 5, wifi: true, ota: true, voice: true } },
  { name: "6CH WiFi Relay Module", modelCode: "6CH", relayCount: 6, price: "999", description: "Six-channel WiFi relay board for medium-size homes. Control lights, fans and appliances from one compact board.", features: { channels: 6, wifi: true, ota: true, voice: true } },
  { name: "8CH WiFi Relay Module", modelCode: "8CH", relayCount: 8, price: "1199", description: "Eight-channel WiFi relay board \u2014 full-home control. Ideal for new construction wiring with all loads in one panel.", features: { channels: 8, wifi: true, ota: true, voice: true } },
  { name: "4CH IR WiFi Relay Module", modelCode: "4CH-IR", relayCount: 4, price: "999", description: "Four-channel relay board with built-in IR receiver \u2014 control with the app and any IR remote. Works with ACs, TVs and IR appliances.", features: { channels: 4, ir: true, wifi: true, ota: true, voice: true } },
  { name: "Fan Speed Dimmer (WiFi)", modelCode: "FAN-DIM", relayCount: 1, price: "899", description: "WiFi fan regulator with stepped speed control. Replace your old 5-step regulator and control the fan from the app or voice.", features: { fanDimmer: true, steps: 5, wifi: true, ota: true, voice: true } },
  { name: "3-State Touch Dimmer", modelCode: "DIM-3S", relayCount: 1, price: "749", description: "Touch dimmer with 3 brightness steps (off \u2192 50% \u2192 100%). WiFi + touch control, works with existing bulb holders.", features: { dimmer: true, steps: 3, touch: true, wifi: true, ota: true } },
  { name: "4-State Touch Dimmer", modelCode: "DIM-4S", relayCount: 1, price: "799", description: "Touch dimmer with 4 brightness steps (off \u2192 33% \u2192 66% \u2192 100%). WiFi + touch control, app dimming via steps.", features: { dimmer: true, steps: 4, touch: true, wifi: true, ota: true } }
];
function parseDatabaseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    pass: decodeURIComponent(u.password),
    name: decodeURIComponent(u.pathname.replace(/^\//, ""))
  };
}
function buildDatabaseUrl2(p) {
  return `mysql://${encodeURIComponent(p.user)}:${encodeURIComponent(p.pass)}@${p.host}:${p.port}/${encodeURIComponent(p.name)}`;
}
function escIdent(name) {
  return name.replace(/`/g, "``");
}
async function probeDb(parts) {
  let conn = null;
  try {
    conn = await mysql.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.pass,
      database: parts.name,
      connectTimeout: 5e3
    });
  } catch {
    return { reachable: false, tablesReady: false, installed: false };
  }
  try {
    const [rows] = await conn.query(
      "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
      [parts.name]
    );
    const hasUsers = Number(rows[0]?.c ?? 0) > 0;
    let installed = false;
    if (hasUsers) {
      try {
        const [meta] = await conn.query("SELECT value FROM app_meta WHERE `key` = 'installed' LIMIT 1");
        const flag = meta[0]?.value;
        if (flag !== void 0) {
          installed = flag === "1";
        } else {
          const [urows] = await conn.query("SELECT COUNT(*) AS c FROM users");
          installed = Number(urows[0]?.c ?? 0) > 0;
        }
      } catch {
        installed = true;
      }
    }
    return { reachable: true, tablesReady: hasUsers, installed };
  } catch {
    return { reachable: true, tablesReady: false, installed: false };
  } finally {
    await conn.end().catch(() => void 0);
  }
}
function escapeEnv(v) {
  return /[\s#"']/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v;
}
function persistDatabaseConfig(p) {
  const envPath = path6.resolve(process.cwd(), "../../.env");
  try {
    let content = "";
    if (fs5.existsSync(envPath)) content = fs5.readFileSync(envPath, "utf-8");
    const setKey = (key, value) => {
      const line = `${key}=${escapeEnv(value)}`;
      const re = new RegExp(`^${key}=.*$`, "m");
      if (re.test(content)) content = content.replace(re, line);
      else content = (content ? content.replace(/\s*$/, "\n") : "") + line + "\n";
    };
    setKey("DB_HOST", p.host);
    setKey("DB_PORT", String(p.port));
    setKey("DB_USER", p.user);
    setKey("DB_PASS", p.pass);
    setKey("DB_NAME", p.name);
    setKey("DATABASE_URL", `${buildDatabaseUrl2(p)}?connection_limit=2`);
    fs5.writeFileSync(envPath, content, "utf-8");
    return { path: envPath, ok: true };
  } catch (err) {
    logger.warn(
      "[install] .env write fail \u2014 restart pe purana config chalega:",
      err instanceof Error ? err.message : String(err)
    );
    return { path: envPath, ok: false };
  }
}
async function connectServer(parts) {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.pass,
      connectTimeout: 8e3
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError("DB_CONNECT_FAILED", `Database server se connect nahi ho paya: ${msg}`, 502);
  }
  try {
    const [rows] = await conn.query("SELECT VERSION() AS v");
    return { serverVersion: String(rows[0]?.v ?? "") };
  } finally {
    await conn.end().catch(() => void 0);
  }
}
async function createDatabase(parts) {
  const dbName = escIdent(parts.name);
  const version = await connectServer(parts);
  let conn;
  try {
    conn = await mysql.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.pass,
      connectTimeout: 8e3
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError("DB_CONNECT_FAILED", `Database connect failed: ${msg}`, 502);
  }
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conn.end().catch(() => void 0);
  }
  logger.info(`[install] database ready: ${parts.name} (server ${version.serverVersion})`);
}
async function applySchema(parts) {
  if (!fs5.existsSync(SCHEMA_SQL)) {
    throw new AppError("SCHEMA_MISSING", "prisma/schema.sql nahi mila \u2014 install package incomplete hai", 500);
  }
  const schemaSql = fs5.readFileSync(SCHEMA_SQL, "utf-8");
  let conn;
  try {
    conn = await mysql.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.pass,
      database: parts.name,
      multipleStatements: true,
      connectTimeout: 8e3
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
      `Tables create nahi hui: ${msg}. Database khali (fresh) hona chahiye \u2014 purana data ho to factory reset karo ya naya DB use karo.`,
      500
    );
  } finally {
    await conn.end().catch(() => void 0);
  }
}
async function completeInstall(parts, admin) {
  const nextUrl = buildDatabaseUrl2(parts);
  const prisma2 = await resetPrismaClient(nextUrl);
  const existing = await prisma2.user.findFirst({
    where: { OR: [{ username: admin.username }, { email: admin.email }] }
  });
  if (existing) {
    throw new AppError("ADMIN_EXISTS", "Username/email pehle se exist karta hai", 409);
  }
  const password = await bcrypt2.hash(admin.password, 10);
  const homeName = `${(admin.name || admin.username).trim()}${admin.name ? "" : "'s"} Home`;
  await prisma2.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { username: admin.username, email: admin.email, password, role: "system_admin" }
    });
    await tx.home.create({
      data: {
        name: homeName,
        ownerId: user.id,
        members: { create: { userId: user.id, role: "owner" } }
      }
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
          features: p.features
        },
        update: {}
      });
    }
    await tx.appMeta.upsert({
      where: { key: "installed" },
      create: { key: "installed", value: "1" },
      update: { value: "1" }
    });
  });
  setDbReady(true);
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
  const persisted = persistDatabaseConfig(parts);
  return {
    installed: true,
    database: parts.name,
    admin: admin.username,
    configPersisted: persisted.ok,
    configPath: persisted.path
  };
}
function dbFromBody(bodyDb) {
  const base = parseDatabaseUrl(env.DATABASE_URL);
  const parts = {
    host: (bodyDb?.host ?? base.host).trim(),
    port: Number(bodyDb?.port ?? base.port) || 3306,
    user: (bodyDb?.user ?? base.user).trim(),
    pass: bodyDb?.pass ?? base.pass,
    name: (bodyDb?.name ?? base.name).trim()
  };
  if (!parts.host || !parts.name || !parts.user) {
    throw new AppError("BAD_REQUEST", "DB host, user aur name required hain", 400);
  }
  return parts;
}
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
      name: parts.name
    },
    admin: {
      username: env.ADMIN_USERNAME,
      email: env.ADMIN_EMAIL,
      // password only hint — kya set hoga, value nahi
      passwordSet: Boolean(env.ADMIN_PASSWORD)
    }
  });
});
installRouter.post("/connect", async (req, res) => {
  const parts = dbFromBody(req.body?.db ?? {});
  const { serverVersion } = await connectServer(parts);
  await createDatabase(parts);
  const probe = await probeDb(parts);
  ok(res, {
    connected: true,
    serverVersion,
    database: parts.name,
    dbCreated: probe.reachable,
    tablesReady: probe.tablesReady
  });
});
installRouter.post("/schema", async (req, res) => {
  const parts = dbFromBody(req.body?.db ?? {});
  await createDatabase(parts);
  await applySchema(parts);
  const probe = await probeDb(parts);
  ok(res, {
    tablesReady: probe.tablesReady,
    installed: probe.installed,
    database: parts.name,
    message: "Saari tables ban gayi \u2014 ab admin account banao"
  });
});
installRouter.post("/admin", async (req, res) => {
  const parts = dbFromBody(req.body?.db ?? {});
  const bodyAdmin = req.body?.admin ?? {};
  const admin = {
    username: (bodyAdmin.username ?? env.ADMIN_USERNAME).trim(),
    name: bodyAdmin.name?.trim() || void 0,
    email: (bodyAdmin.email ?? env.ADMIN_EMAIL).trim().toLowerCase(),
    password: bodyAdmin.password ?? env.ADMIN_PASSWORD
  };
  if (!admin.username || !admin.email || !admin.password) {
    throw new AppError("BAD_REQUEST", "Admin username, email aur password required hain", 400);
  }
  const probe = await probeDb(parts);
  if (probe.installed) {
    throw new AppError("ALREADY_INSTALLED", "Database already installed and connected", 409);
  }
  if (!probe.tablesReady) {
    throw new AppError(
      "SCHEMA_PENDING",
      "Pehle database + tables step complete karo (users table nahi mili)",
      400
    );
  }
  const result = await completeInstall(parts, admin);
  ok(res, result);
});
installRouter.post("/", async (req, res) => {
  if (isDbReady()) {
    const parts2 = parseDatabaseUrl(env.DATABASE_URL);
    const probe = await probeDb(parts2);
    if (probe.installed) {
      throw new AppError("ALREADY_INSTALLED", "Database already installed and connected", 409);
    }
  }
  const parts = dbFromBody(req.body?.db ?? {});
  const bodyAdmin = req.body?.admin ?? {};
  const admin = {
    username: (bodyAdmin.username ?? env.ADMIN_USERNAME).trim(),
    name: bodyAdmin.name?.trim() || void 0,
    email: (bodyAdmin.email ?? env.ADMIN_EMAIL).trim().toLowerCase(),
    password: bodyAdmin.password ?? env.ADMIN_PASSWORD
  };
  if (!admin.username || !admin.email || !admin.password) {
    throw new AppError("BAD_REQUEST", "Admin username, email aur password required hain", 400);
  }
  await createDatabase(parts);
  await applySchema(parts);
  const result = await completeInstall(parts, admin);
  ok(res, result);
});

// src/app.ts
init_prisma();
async function schemaDiag() {
  try {
    const models = {
      deviceAccess: typeof prisma.deviceAccess === "object",
      deviceUsage: typeof prisma.deviceUsage === "object",
      homeMemberRestricted: typeof prisma.homeMember === "object",
      supportChatSettings: typeof prisma.supportChatSettings === "object"
    };
    const table = async (t) => {
      const r = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = ${t}
      `;
      return Number(r[0]?.c ?? 0) > 0;
    };
    return { models, tables: { device_access: await table("device_access"), device_usage: await table("device_usage") } };
  } catch {
    return { error: "diag failed" };
  }
}
function createApp() {
  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true
    })
  );
  app.use(express.json({ limit: "4mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    const start = Date.now();
    trackRequest();
    fileLog(`[req] ${(/* @__PURE__ */ new Date()).toISOString()} START ${req.method} ${req.originalUrl}`);
    res.on("finish", () => {
      fileLog(`[req] ${(/* @__PURE__ */ new Date()).toISOString()} END ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    res.on("close", () => {
      if (!res.writableEnded) {
        fileLog(`[req] ${(/* @__PURE__ */ new Date()).toISOString()} ABORT ${req.method} ${req.originalUrl} (${Date.now() - start}ms) - connection closed before response`);
      }
    });
    next();
  });
  app.get("/api/health", async (_req, res) => {
    res.json({
      success: true,
      data: { status: "ok", ts: (/* @__PURE__ */ new Date()).toISOString(), schema: await schemaDiag() }
    });
  });
  app.use("/api/install", installRouter);
  app.use("/api", (req, res, next) => {
    if (isDbReady()) return next();
    res.status(503).json({
      success: false,
      error: {
        code: "NOT_INSTALLED",
        message: "Database not installed yet \u2014 run installation first (GET/POST /api/install)"
      }
    });
  });
  app.use("/api", apiRouter);
  app.use("/firmware", express.static(firmwareDir));
  if (fs6.existsSync(path7.join(webDist, "index.html"))) {
    app.use(express.static(webDist));
    app.get(/^\/(?!api|firmware|socket\.io).*/, (_req, res) => {
      res.sendFile(path7.join(webDist, "index.html"));
    });
  }
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" }
    });
  });
  app.use(errorHandler);
  return app;
}

// src/index.ts
init_prisma();

// src/services/familySafety.service.ts
init_prisma();
var CHECK_INTERVAL_MS3 = 6e4;
var timer3 = null;
var running2 = false;
function startFamilySafety() {
  if (timer3) return;
  timer3 = setInterval(() => void runSafetyCheck(), CHECK_INTERVAL_MS3);
  fileLog("[family-safety] monitor started (60s)");
}
async function usageMinutesToday(deviceId, userId) {
  const start = /* @__PURE__ */ new Date();
  start.setHours(0, 0, 0, 0);
  const logs2 = await prisma.deviceLog.findMany({
    where: {
      deviceId,
      actorId: userId,
      logType: "status_change",
      createdAt: { gte: start }
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, logMessage: true }
  });
  let minutes = 0;
  let onAt = null;
  for (const l of logs2) {
    if (l.logMessage.includes("turned on")) {
      onAt = l.createdAt;
    } else if (l.logMessage.includes("turned off") && onAt) {
      minutes += Math.round((l.createdAt.getTime() - onAt.getTime()) / 6e4);
      onAt = null;
    }
  }
  if (onAt) {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { status: true }
    });
    if (device?.status === "on") {
      minutes += Math.round((Date.now() - onAt.getTime()) / 6e4);
    }
  }
  return minutes;
}
async function autoOffDevice(deviceId, homeId) {
  await prisma.$transaction([
    prisma.device.update({ where: { id: deviceId }, data: { status: "off" } }),
    prisma.deviceCommand.create({
      data: { deviceId, actorId: null, command: "set_status:off" }
    }),
    prisma.deviceLog.create({
      data: {
        deviceId,
        actorId: null,
        logType: "child_safety",
        logMessage: "Auto-off by child safety daily limit"
      }
    })
  ]);
  const updated = await prisma.device.findUnique({ where: { id: deviceId } });
  if (updated) emitToHome(homeId, "device:updated", updated);
}
async function runSafetyCheck() {
  if (running2) return;
  if (!prisma.deviceAccess || !prisma.deviceUsage) {
    fileLog("[family-safety] prisma models missing (stale client?) \u2014 run npx prisma generate, monitor skip");
    return;
  }
  running2 = true;
  try {
    const members = await prisma.homeMember.findMany({
      where: { restricted: true, dailyLimitMinutes: { not: null } },
      include: { home: { select: { ownerId: true, name: true } } }
    });
    if (members.length === 0) return;
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    for (const m of members) {
      const limit = m.dailyLimitMinutes;
      const grants = await prisma.deviceAccess.findMany({
        where: { homeId: m.homeId, userId: m.userId },
        select: { deviceId: true }
      });
      for (const acc of grants) {
        const usage = await usageMinutesToday(acc.deviceId, m.userId);
        await prisma.deviceUsage.upsert({
          where: {
            deviceId_userId_date: { deviceId: acc.deviceId, userId: m.userId, date: today }
          },
          create: {
            homeId: m.homeId,
            deviceId: acc.deviceId,
            userId: m.userId,
            date: today,
            onMinutes: usage
          },
          update: { onMinutes: usage }
        });
        if (usage < limit) continue;
        const device = await prisma.device.findUnique({
          where: { id: acc.deviceId },
          select: { name: true, status: true }
        });
        if (!device || device.status !== "on") continue;
        const already = await prisma.deviceLog.findFirst({
          where: { deviceId: acc.deviceId, logType: "child_safety", createdAt: { gte: today } }
        });
        await autoOffDevice(acc.deviceId, m.homeId);
        if (already) continue;
        const child = await prisma.user.findUnique({
          where: { id: m.userId },
          select: { username: true }
        });
        const who = child?.username ?? "Member";
        const msg = `${who} ne aaj "${device.name}" ${limit} min se zyada ON rakha \u2014 safety limit khatam, humne band kar diya.`;
        await createNotification(m.home.ownerId, {
          category: "device",
          type: "warning",
          title: `\u{1F476} Child safety: "${device.name}" band kiya`,
          body: msg
        });
        await createNotification(m.userId, {
          category: "device",
          type: "warning",
          title: `\u23F3 "${device.name}" ka time khatam`,
          body: `Aaj ka ${limit} min limit poora ho gaya \u2014 device band kar diya gaya.`
        });
        fileLog(`[family-safety] auto-off ${device.name} for user ${m.userId} (${usage}min >= ${limit}min)`);
      }
    }
  } catch (err) {
    fileLog(`[family-safety] ERROR: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    running2 = false;
  }
}

// src/index.ts
import { execFileSync } from "node:child_process";
async function runLightMigrations() {
  const migration = async (label, fn) => {
    try {
      await fn();
    } catch (err) {
      logger.warn(`Migration skip/fail (${label})`, err instanceof Error ? err.message : String(err));
    }
  };
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE esp_devices e
       JOIN (
         SELECT serial_code, MAX(id) AS keep_id
         FROM esp_devices
         WHERE serial_code IS NOT NULL
         GROUP BY serial_code
         HAVING COUNT(*) > 1
       ) d ON e.serial_code = d.serial_code AND e.id <> d.keep_id
       SET e.serial_code = NULL`
    );
    const idx = await prisma.$queryRaw`
      SELECT COUNT(*) AS c FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'esp_devices' AND index_name = 'esp_devices_serial_code_key'
    `;
    if (Number(idx[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `esp_devices` ADD UNIQUE INDEX `esp_devices_serial_code_key`(`serial_code`)"
      );
      logger.info("\u2705 Migration: esp_devices.serial_code unique index added");
    }
    const col = await prisma.$queryRaw`
      SELECT COUNT(*) AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'notifications' AND column_name = 'category'
    `;
    if (Number(col[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `notifications` ADD COLUMN `category` VARCHAR(20) NOT NULL DEFAULT 'system'"
      );
      logger.info("\u2705 Migration: notifications.category column added");
    }
    const fixed = await prisma.$executeRawUnsafe(`
      UPDATE notifications
      SET category = 'schedule'
      WHERE category = 'system' AND (title LIKE '\u23F0 Schedule fired:%' OR title LIKE '%Schedule fired:%')
    `);
    logger.info(`\u2705 Backfill: ${fixed} schedule notification(s) category \u2192 schedule`);
    const sm = await prisma.$queryRaw`
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
      logger.info("\u2705 Migration: support_messages table created");
    }
    const tp = await prisma.$queryRaw`
      SELECT COUNT(*) AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'theme_pref'
    `;
    if (Number(tp[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `users` ADD COLUMN `theme_pref` VARCHAR(16) NULL"
      );
      logger.info("\u2705 Migration: users.theme_pref column added");
    }
    const att = await prisma.$queryRaw`
      SELECT COUNT(*) AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'support_messages' AND column_name = 'attachment_name'
    `;
    if (Number(att[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `support_messages` ADD COLUMN `attachment_name` VARCHAR(255) NULL, ADD COLUMN `attachment_type` VARCHAR(100) NULL, ADD COLUMN `attachment_data` MEDIUMTEXT NULL"
      );
      logger.info("\u2705 Migration: support_messages.attachment_* columns added");
    }
    await migration("support_messages.deleted_at", async () => {
      const dl = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'support_messages' AND column_name = 'deleted_at'
      `;
      if (Number(dl[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `support_messages` ADD COLUMN `deleted_at` DATETIME(3) NULL"
        );
        logger.info("\u2705 Migration: support_messages.deleted_at added");
      }
    });
    await migration("support_messages.attachment_path", async () => {
      const ap = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'support_messages' AND column_name = 'attachment_path'
      `;
      if (Number(ap[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `support_messages` ADD COLUMN `attachment_path` VARCHAR(255) NULL"
        );
        logger.info("\u2705 Migration: support_messages.attachment_path added");
      }
    });
    await migration("support_chat_settings table", async () => {
      const cs = await prisma.$queryRaw`
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
        logger.info("\u2705 Migration: support_chat_settings table created");
      }
    });
    await migration("app_meta.value TEXT", async () => {
      const am = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'app_meta' AND column_name = 'value'
      `;
      if (Number(am[0]?.c ?? 0) > 0) {
        const typ = await prisma.$queryRaw`
          SELECT DATA_TYPE AS data_type FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'app_meta' AND column_name = 'value'
        `;
        if (typ[0]?.data_type === "varchar") {
          await prisma.$executeRawUnsafe(
            "ALTER TABLE `app_meta` MODIFY COLUMN `value` TEXT NOT NULL"
          );
          logger.info("\u2705 Migration: app_meta.value -> TEXT");
        }
      }
    });
    await migration("home_members restricted", async () => {
      const rm = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'home_members' AND column_name = 'restricted'
      `;
      if (Number(rm[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `home_members` ADD COLUMN `restricted` BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN `daily_limit_minutes` INT NULL"
        );
        logger.info("\u2705 Migration: home_members.restricted + daily_limit_minutes added");
      }
    });
    await migration("device_access table", async () => {
      const da = await prisma.$queryRaw`
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
        logger.info("\u2705 Migration: device_access table created");
      }
    });
    await migration("device_usage table", async () => {
      const du = await prisma.$queryRaw`
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
        logger.info("\u2705 Migration: device_usage table created");
      }
    });
  } catch (err) {
    logger.warn("Light migration (esp serial unique) skip/fail", err instanceof Error ? err.message : String(err));
  }
}
async function dbHasSchema() {
  try {
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*) AS c FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'users'
    `;
    return Number(rows[0]?.c ?? 0) > 0;
  } catch (err) {
    logger.warn("Schema probe failed", err instanceof Error ? err.message : String(err));
    return false;
  }
}
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
setInterval(() => {
  fileLog(
    `[hb] alive uptime=${Math.round(process.uptime())}s pid=${process.pid} rss=${Math.round(
      process.memoryUsage().rss / 1048576
    )}MB`
  );
}, 1e4);
process.on("beforeExit", (code) => {
  fileLog(`[hb] beforeExit code=${code} uptime=${Math.round(process.uptime())}s`);
});
process.on("exit", (code) => {
  fileLog(`[hb] exit code=${code} uptime=${Math.round(process.uptime())}s`);
});
var boot = (...args) => {
  const line = `[boot] ${args.join(" ")}`;
  process.stderr.write(line + "\n");
  fileLog(line);
};
async function main() {
  boot("node", process.version, "| cwd =", process.cwd());
  boot("PORT env =", JSON.stringify(process.env.PORT ?? "(not set)"), "-> API_PORT =", env.API_PORT);
  boot("log file =", logFilePath ?? "(disabled)");
  const app = createApp();
  boot("createApp done");
  const server = createServer(app);
  initSocket(server);
  boot("socket init done");
  const rawPort = process.env.PORT;
  const listenTarget = rawPort && !/^\d+$/.test(rawPort.trim()) ? rawPort.trim() : env.API_PORT;
  boot("listen target:", JSON.stringify(listenTarget));
  const onListening = () => {
    const addr = server.address();
    boot("LISTENING on", typeof addr === "object" && addr ? `${addr.address}:${addr.port}` : String(addr));
    logger.info(`\u{1F680} API listening on ${JSON.stringify(listenTarget)}`);
    logger.info(`   Health check: /api/health`);
    logger.info(`   Realtime (Socket.IO): ws://${env.API_HOST}:${env.API_PORT}`);
  };
  if (typeof listenTarget === "string") {
    server.listen(listenTarget, onListening);
  } else {
    server.listen(listenTarget, env.API_HOST, onListening);
    if (env.API_PORT !== 4e3) {
      const fallback = createServer(app);
      fallback.on("error", (err) => {
        boot("fallback 4000 listener error:", err instanceof Error ? err.message : String(err));
        logger.warn("Fallback 4000 listener failed", err instanceof Error ? err.message : String(err));
      });
      fallback.listen(4e3, env.API_HOST);
      boot("fallback listener requested on 4000");
    }
  }
  server.on("error", (err) => {
    const line = `[server] listen error: ${err instanceof Error ? err.stack || err.message : String(err)}`;
    process.stderr.write(line + "\n");
    fileLog(line);
  });
  boot("main() setup complete \u2014 background DB init starting");
  void initDatabase();
}
var HEAL_LAST_KEY = "prisma_selfheal_last";
async function selfHealPrismaClient() {
  const p = prisma;
  if (p.deviceAccess && p.deviceUsage && p.supportChatSettings) return;
  fileLog("[boot] prisma client stale (deviceAccess/deviceUsage/supportChatSettings missing) \u2014 self-heal try");
  const last = await prisma.appMeta.findUnique({ where: { key: HEAL_LAST_KEY } }).catch(() => null);
  if (last && Date.now() - new Date(last.value).getTime() < 10 * 60 * 1e3) {
    fileLog("[boot] self-heal 10 min pehle try hua \u2014 skip (degraded mode, koi loop nahi)");
    return;
  }
  let ok2 = false;
  for (const args of [
    ["npx.cmd", "--no-install", "prisma", "generate"],
    ["npx.cmd", "prisma", "generate"]
  ]) {
    try {
      execFileSync(args[0], args.slice(1), {
        cwd: process.cwd(),
        stdio: "pipe",
        timeout: 18e4,
        windowsHide: true
      });
      ok2 = true;
      break;
    } catch (err) {
      fileLog(`[boot] prisma generate try fail: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (!ok2) {
    fileLog("[boot] prisma generate FAILED \u2014 degraded mode (restrictions off, site chalega)");
    return;
  }
  await prisma.appMeta.upsert({
    where: { key: HEAL_LAST_KEY },
    create: { key: HEAL_LAST_KEY, value: (/* @__PURE__ */ new Date()).toISOString() },
    update: { value: (/* @__PURE__ */ new Date()).toISOString() }
  }).catch(() => void 0);
  fileLog("[boot] prisma generate OK \u2014 45s baad safe reboot (fresh client load)");
  setTimeout(() => process.exit(0), 45e3);
}
async function initDatabase() {
  let dbReady = false;
  boot("db probe: connecting...");
  try {
    await prisma.$connect();
    boot("db probe: connected");
    if (await dbHasSchema()) {
      dbReady = true;
      logger.info("\u2705 Database connected (schema ready)");
      await runLightMigrations();
      await selfHealPrismaClient();
    } else {
      logger.warn(
        "\u26A0\uFE0F Database reachable par installed nahi \u2014 setup mode. /api/install se installation karo."
      );
    }
  } catch (err) {
    boot("db probe: NOT reachable \u2014", err instanceof Error ? err.message : String(err));
    logger.warn(
      "\u26A0\uFE0F Database not reachable \u2014 setup mode. Visit /api/install/status and run installation."
    );
    logger.debug(err instanceof Error ? err.message : String(err));
  }
  boot("db probe: schema ready =", dbReady);
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
    try {
      await loadRequestTracker();
      startRequestFlush();
      boot("request tracker: loaded");
    } catch (err) {
      logger.warn("Request tracker start failed", err instanceof Error ? err.message : String(err));
    }
  }
}
main().catch((err) => {
  const line = `[fatal] main() failed: ${err instanceof Error ? err.stack || err.message : String(err)}`;
  process.stderr.write(line + "\n");
  fileLog(line);
  logger.error("Failed to start API", err instanceof Error ? err.stack : err);
});
