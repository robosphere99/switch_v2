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
import path6 from "node:path";
import fs5 from "node:fs";

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
  WIFI_ENC_KEY: z.string().default("robosphere-dev-wifi-key-change-me"),
  // Payment gateway (optional) — nahi diya to demo/manual mode chalta hai
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  UPI_ID: z.string().optional().default("robosphere@upi"),
  // First-run admin (install route) — hosting pe yahan se set hota hai
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_EMAIL: z.string().default("admin@robosphere.local"),
  ADMIN_PASSWORD: z.string().default("admin123"),
  // Install ko lock karne ke liye (installed flag ke saath match karta hai)
  INSTALL_TOKEN: z.string().optional().default("")
});
var parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("\u274C Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
var env = parsed.data;
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
    path2.join(os.tmpdir(), "robosphere-logs")
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
var webDist = repoRoot ? path3.join(repoRoot, "site", "apps", "web", "dist") : path3.resolve(process.cwd(), "../../apps/web/dist");

// src/routes/index.ts
import { Router as Router16 } from "express";

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
  return { id: user.id, username: user.username, email: user.email, role: user.role };
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, email: user.email, role: user.role, jti: crypto.randomUUID() },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES }
  );
}
function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
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
  }
  const updated = await prisma.user.update({ where: { id: userId }, data });
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
    select: { id: true, username: true, email: true, role: true, createdAt: true }
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

// src/middleware/auth.ts
import jwt2 from "jsonwebtoken";
var requireAuth = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("UNAUTHORIZED", "Missing bearer token", 401));
  }
  try {
    const payload = jwt2.verify(header.slice(7), env.JWT_ACCESS_SECRET);
    req.user = payload;
    next();
  } catch {
    next(new AppError("UNAUTHORIZED", "Invalid or expired token", 401));
  }
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
  homeName: z2.string().min(1).max(100).optional()
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

// ../../packages/shared/src/index.ts
var HOME_MEMBER_ROLES = ["owner", "admin", "member", "viewer"];

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

// src/services/notification.service.ts
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

// src/services/notification.service.ts
async function createNotification(userId, input) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type: input.type ?? "info",
      title: input.title,
      body: input.body ?? null
    }
  });
  emitToUser(userId, "notification:new", notification);
  return notification;
}
async function listNotifications(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50
  });
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

// src/services/member.service.ts
function generateInviteCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto2.randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
async function listMembers(homeId) {
  return prisma.homeMember.findMany({
    where: { homeId },
    include: { user: { select: { id: true, username: true, email: true } } },
    orderBy: { joinedAt: "asc" }
  });
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

// src/controllers/member.controller.ts
async function list2(req, res) {
  const members = await listMembers(Number(req.params.homeId));
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
async function remove2(req, res) {
  await removeMember(Number(req.params.homeId), Number(req.params.userId));
  ok(res, { message: "Member removed" });
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
memberRouter.get(
  "/:homeId/members",
  requireAuth,
  validateParams(idParams2),
  requireHomeMember("viewer"),
  list2
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
  remove2
);
memberRouter.post("/invitations/accept", requireAuth, validateBody(acceptSchema), accept);

// src/routes/device.routes.ts
import { Router as Router4 } from "express";
import { z as z5 } from "zod";

// src/services/device.service.ts
init_prisma();
async function listDevices(homeId) {
  return prisma.device.findMany({
    where: { homeId },
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

// src/controllers/device.controller.ts
async function list3(req, res) {
  const devices = await listDevices(Number(req.params.homeId));
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

// src/routes/device.routes.ts
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
var updateSchema = z5.object({
  name: z5.string().min(1).max(100).optional(),
  roomId: z5.coerce.number().int().positive().nullable().optional()
});
deviceRouter.get(
  "/:homeId/devices",
  requireAuth,
  validateParams(idParams3),
  requireHomeMember("viewer"),
  list3
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
  if (macKey) {
    esp = await prisma.espDevice.upsert({
      where: { macAddress: macKey },
      create: {
        homeId,
        macAddress: macKey,
        name: ssid ? `${ssid} \xB7 ${serial || macKey.replace(/:/g, "").slice(-6).toUpperCase()}` : `ESP-${macKey.replace(/:/g, "").slice(-6).toUpperCase()}`,
        ssid,
        serialCode: serial,
        modelCode: model,
        ipAddress: ip,
        firmwareVersion: fw,
        lastSeen: /* @__PURE__ */ new Date(),
        offline: false
      },
      update: {
        homeId,
        ssid: ssid ?? void 0,
        serialCode: serial ?? void 0,
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
  const running2 = fw ?? updated.firmwareVersion ?? device.firmwareVersion;
  const pendingNow = esp ? esp.otaPendingVersion : updated.otaPendingVersion ?? device.otaPendingVersion;
  let ota = null;
  if (pendingNow && current && running2 !== current.version) {
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
  const homeId = homeScope(key);
  const commands = await prisma.deviceCommand.findMany({
    where: { device: { homeId }, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 20
  });
  await prisma.device.updateMany({ where: { homeId }, data: { lastSeen: /* @__PURE__ */ new Date() } }).catch(() => void 0);
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
var keyQuery = z6.object({ api_key: z6.string().min(1) });
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
  async (req, res) => ok(res, { commands: await pendingCommands(req.apiKey) })
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
  ok(res, await listNotifications(req.user.sub));
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

// src/routes/assistant.routes.ts
import { Router as Router10 } from "express";
import { z as z11 } from "zod";
init_prisma();

// src/services/assistant.service.ts
init_prisma();

// src/services/audit.service.ts
init_prisma();
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

// src/services/assistant.service.ts
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
import multer from "multer";
import path4 from "node:path";
import fs3 from "node:fs";
init_prisma();

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
  let total = 0;
  for (const it of input.items) {
    const prod = productMap.get(it.productId);
    if (!prod) throw new AppError("NOT_FOUND", `Product ${it.productId} not found`);
    if (!Number.isInteger(it.quantity) || it.quantity < 1) {
      throw new AppError("BAD_REQUEST", `Invalid quantity for ${prod.name}`);
    }
    total += Number(prod.price) * it.quantity;
  }
  const wifiPasswordEnc = input.wifi?.password ? encryptSecret(input.wifi.password) : null;
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: makeOrderNumber(),
        userId: input.userId,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentMethod === "cod" ? "pending" : "unpaid",
        totalAmount: total,
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
var adminRouter = Router11();
function requireAdmin(req, _res, next) {
  if (req.user?.role !== "system_admin") {
    return next(new AppError("FORBIDDEN", "Admin access required", 403));
  }
  next();
}
adminRouter.use(requireAuth, requireAdmin);
adminRouter.get("/stats", async (_req, res) => {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const [users, homes, devices, activeToday, onlineDevices, pendingCommands2, apiKeys, auditCount] = await Promise.all([
    prisma.user.count(),
    prisma.home.count(),
    prisma.device.count(),
    prisma.user.count({ where: { lastLoginAt: { gte: dayAgo } } }),
    prisma.device.count({ where: { lastSeen: { gte: dayAgo } } }),
    prisma.deviceCommand.count({ where: { status: "pending" } }),
    prisma.apiKey.count(),
    prisma.auditLog.count()
  ]);
  ok(res, { users, homes, devices, activeToday, onlineDevices, pendingCommands: pendingCommands2, apiKeys, auditCount });
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
    where: q ? { name: { contains: q } } : void 0,
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
    result.crashes = lines.filter((l) => /crashguard|unhandled|error|fail|exception/i.test(l)).slice(-40);
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
adminRouter.get("/esp", async (_req, res) => {
  const current = await prisma.firmwareVersion.findFirst({ where: { isCurrent: true } });
  const esps = await prisma.espDevice.findMany({
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
  const esp = await prisma.espDevice.update({ where: { id }, data: { name } });
  await audit(req.user.sub, "admin.esp.rename", {
    entity: "esp",
    entityId: id,
    meta: { name }
  });
  ok(res, esp);
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
  const timer3 = setTimeout(() => controller.abort(), 3e3);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "RoboSphere-Admin/1.0" }
    });
    return ok(res, { reachable: true, latencyMs: Date.now() - started, statusCode: r.status });
  } catch {
    return ok(res, { reachable: false, reason: "unreachable", latencyMs: Date.now() - started });
  } finally {
    clearTimeout(timer3);
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

// src/routes/shop.routes.ts
import { Router as Router12 } from "express";
init_prisma();

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
    const upiIntent = `upi://pay?pa=robosphere@okaxis&pn=RoboSphere&am=${Number(order.totalAmount).toFixed(2)}&tn=Order%20${order.orderNumber}`;
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
var publicRouter = Router15();
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
    test: /what is robosphere|yeh (kya|site) hai|kya hai ye|about (robosphere|site|company)|introduce|platform (kya|about)/i,
    reply: "RoboSphere ek smart-home IoT platform hai \u2014 WiFi relay boards (2CH se 8CH), dimmers aur fan regulators bechte hain. Board kharido \u2192 serial code se activate karo \u2192 app se ghar ke lights/fans/appliances ko kisi bhi jagah se control karo. Naya firmware bhi WiFi se hi (OTA) update hota hai \u2014 kabhi USB nahi chahiye."
  },
  {
    test: /how (does )?(it|this|site) (work|kaam)|kaise kaam|kaise chalta|process|flow|kya kaam/i,
    reply: "Poora flow 4 step me: 1\uFE0F\u20E3 Shop se board order karo (WiFi name/password order pe bhi de sakte ho) 2\uFE0F\u20E3 Delivery pe box me unique serial code sticker milta hai 3\uFE0F\u20E3 Serial code se device activate karo \u2014 board aapke home se link 4\uFE0F\u20E3 App/dashboard se on-off control, timers, voice/AI assistant. Hardware factory me pre-tested aata hai aur OTA se updates milte rahte hain."
  },
  {
    test: /wifi|wireless|set up|setup|config|network|connect (karo|karna)|internet/i,
    reply: "WiFi setup 2 tarike se: (1) Order ke waqt WiFi name + password de do \u2014 board factory me hi pre-configured flash hoke aayega, (2) Ya phir board first-boot pe apna khud ka WiFi (Robosphere-IoT) kholta hai \u2014 phone se connect karke WiFi + server details daal do. Board phir khud connect ho jata hai. WiFi change ho jaye to captive portal se fresh setup ho jata hai."
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
    reply: "Contact section me form bharke message bhej sakte ho \u2014 humara team reply karta hai. Email: support@robosphere.in \xB7 Phone/WhatsApp: +91 98765 43210 \xB7 Address: RoboSphere Labs, Noida, UP. Feedback bhi welcome hai!"
  },
  {
    test: /hello|hi|hey|namaste|namaskar|hii|hola|salaam/i,
    reply: "Namaste! \u{1F64F} Main RoboSphere ka assistant hoon. Batao aapko kya chahiye \u2014 kitne lights/fans control karne hain, dimmer chahiye, IR remote se control karna hai, ya site ke baare me kuch poochna hai?"
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
publicRouter.post("/assistant", async (req, res) => {
  const text = String(req.body?.message ?? "").trim();
  if (!text) return ok(res, { reply: "Kuch likho \u2014 e.g. '4 lights control karne hain' ya 'dimmer chahiye'.", chips: CHIPS });
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

// src/routes/index.ts
var apiRouter = Router16();
apiRouter.use("/auth", authRouter);
apiRouter.use("/homes", homeRouter);
apiRouter.use("/homes", memberRouter);
apiRouter.use("/homes", deviceRouter);
apiRouter.use("/homes", roomRouter);
apiRouter.use("/homes", scheduleRouter);
apiRouter.use("/device", deviceApiRouter);
apiRouter.use("/api-keys", apiKeyRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/assistant", assistantRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/shop", shopRouter);
apiRouter.use("/claim", claimRouter);
apiRouter.use("/warranty", warrantyRouter);
apiRouter.use("/public", publicRouter);

// src/routes/install.routes.ts
import { Router as Router17 } from "express";
import mysql from "mysql2/promise";
import fs4 from "node:fs";
import path5 from "node:path";
import bcrypt2 from "bcryptjs";
init_prisma();

// src/lib/dbState.ts
var ready = true;
function setDbReady(value) {
  ready = value;
}
function isDbReady() {
  return ready;
}

// src/services/scheduler.service.ts
init_prisma();
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
  const stale = await prisma.device.findMany({
    where: { lastSeen: { lt: cutoff } },
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
        type: "info",
        title: `\u2705 ${device.name} online`,
        body: `${device.name} wapas connected ho gaya.`
      });
    }
    console.log(`[offline] ${device.name} (${device.id}) back online`);
  }
}

// src/routes/install.routes.ts
var SCHEMA_SQL = path5.resolve(process.cwd(), "prisma/schema.sql");
var installRouter = Router17();
var DEFAULT_PRODUCTS = [
  { name: "2CH WiFi Relay Module", modelCode: "2CH", relayCount: 2, price: "599", description: "Two-channel WiFi relay board for lights and small appliances. 10A per channel, ESP32 based, works with the RoboSphere app and voice assistant.", features: { channels: 2, wifi: true, ota: true, voice: true } },
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
    let installed = hasUsers;
    if (hasUsers) {
      try {
        const [meta] = await conn.query("SELECT value FROM app_meta WHERE `key` = 'installed' LIMIT 1");
        const flag = meta[0]?.value;
        if (flag !== void 0) installed = flag === "1";
      } catch {
      }
    }
    return { reachable: true, tablesReady: hasUsers, installed };
  } catch {
    return { reachable: true, tablesReady: false, installed: false };
  } finally {
    await conn.end().catch(() => void 0);
  }
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
installRouter.post("/", async (req, res) => {
  if (isDbReady()) {
    throw new AppError("ALREADY_INSTALLED", "Database already installed and connected", 409);
  }
  const bodyDb = req.body?.db ?? {};
  const bodyAdmin = req.body?.admin ?? {};
  const base = parseDatabaseUrl(env.DATABASE_URL);
  const parts = {
    host: (bodyDb.host ?? base.host).trim(),
    port: Number(bodyDb.port ?? base.port) || 3306,
    user: (bodyDb.user ?? base.user).trim(),
    pass: bodyDb.pass ?? base.pass,
    name: (bodyDb.name ?? base.name).trim()
  };
  if (!parts.host || !parts.name || !parts.user) {
    throw new AppError("BAD_REQUEST", "DB host, user aur name required hain", 400);
  }
  const admin = {
    username: (bodyAdmin.username ?? env.ADMIN_USERNAME).trim(),
    email: (bodyAdmin.email ?? env.ADMIN_EMAIL).trim().toLowerCase(),
    password: bodyAdmin.password ?? env.ADMIN_PASSWORD
  };
  if (!admin.username || !admin.email || !admin.password) {
    throw new AppError("BAD_REQUEST", "Admin username, email aur password required hain", 400);
  }
  const dbName = escIdent(parts.name);
  let server;
  try {
    server = await mysql.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.pass,
      connectTimeout: 8e3
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError(
      "DB_CONNECT_FAILED",
      `Database server se connect nahi ho paya: ${msg}`,
      502
    );
  }
  try {
    await server.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await server.end().catch(() => void 0);
  }
  if (!fs4.existsSync(SCHEMA_SQL)) {
    throw new AppError(
      "SCHEMA_MISSING",
      "prisma/schema.sql nahi mila \u2014 install package incomplete hai",
      500
    );
  }
  const schemaSql = fs4.readFileSync(SCHEMA_SQL, "utf-8");
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
    throw new AppError("SCHEMA_FAILED", `Tables create nahi hui: ${msg}`, 500);
  } finally {
    await conn.end().catch(() => void 0);
  }
  const nextUrl = buildDatabaseUrl2(parts);
  const prisma2 = await resetPrismaClient(nextUrl);
  const existing = await prisma2.user.findFirst({
    where: { OR: [{ username: admin.username }, { email: admin.email }] }
  });
  if (existing) {
    throw new AppError("ADMIN_EXISTS", "Usernam/email pehle se exist karta hai", 409);
  }
  const password = await bcrypt2.hash(admin.password, 10);
  await prisma2.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { username: admin.username, email: admin.email, password, role: "system_admin" }
    });
    await tx.home.create({
      data: {
        name: `${admin.username}'s Home`,
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
  ok(res, {
    installed: true,
    database: parts.name,
    admin: admin.username,
    message: "RoboSphere installed \u2014 site ab normal chal raha hai"
  });
});

// src/app.ts
function createApp() {
  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    const start = Date.now();
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
  app.get("/api/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok", ts: (/* @__PURE__ */ new Date()).toISOString() } });
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
  if (fs5.existsSync(path6.join(webDist, "index.html"))) {
    app.use(express.static(webDist));
    app.get(/^\/(?!api|firmware|socket\.io).*/, (_req, res) => {
      res.sendFile(path6.join(webDist, "index.html"));
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
async function initDatabase() {
  let dbReady = false;
  boot("db probe: connecting...");
  try {
    await prisma.$connect();
    boot("db probe: connected");
    if (await dbHasSchema()) {
      dbReady = true;
      logger.info("\u2705 Database connected (schema ready)");
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
  const line = `[fatal] main() failed: ${err instanceof Error ? err.stack || err.message : String(err)}`;
  process.stderr.write(line + "\n");
  fileLog(line);
  logger.error("Failed to start API", err instanceof Error ? err.stack : err);
});
