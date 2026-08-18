import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { prisma } from "../lib/prisma";
import { getHealthMonitorState } from "../lib/healthMonitor";
import { getLeakMonitorState } from "../lib/leakMonitor";
import { AppError, ok } from "../lib/response";
import { audit } from "../services/audit.service";
import { createNotification, createNotificationWithEmail } from "../services/notification.service";
import { emitToHome } from "../lib/socket";
import { generateSerials, updateOrderStatus } from "../services/shop.service";
import { decryptSecret } from "../lib/crypto";
import { signBillToken } from "../lib/billVerify";
import { detectLanIp } from "../lib/lanIp";
import { resolveFirmware } from "../services/firmware.service";
import { firmwareDir } from "../lib/paths";
import { logFilePath } from "../lib/logger";
import { getRequestStats } from "../lib/requestTracker";
import { getSiteSettings, updateSiteSettings } from "../services/siteSettings.service";
import { setDbReady } from "../lib/dbState";
import { sendEmail } from "../lib/email.service";
import { chatCompletion, getAiConfig, aiConfigured } from "../lib/ai";

export const adminRouter = Router();

/** System admins only. */
function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "system_admin") {
    return next(new AppError("FORBIDDEN", "Admin access required", 403));
  }
  next();
}

adminRouter.use(requireAuth, requireAdmin);

// ---------- Stats ----------

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

adminRouter.get("/stats", async (_req, res) => {
  const dayAgo = new Date(Date.now() - DAY_MS);
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);
  const twoMin = new Date(Date.now() - 120_000);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    users,
    homes,
    devices,
    activeToday,
    onlineDevices,
    pendingCommands,
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
    ordersRecent,
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
    prisma.order.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true, totalAmount: true, paidAt: true } }),
  ]);

  // Last 7 din (aaj samet) — signup + revenue trend (Admin Overview chart ke liye)
  const usersByDay: Record<string, number> = {};
  for (const u of usersRecent) {
    const k = dayKey(u.createdAt);
    usersByDay[k] = (usersByDay[k] ?? 0) + 1;
  }
  const ordersByDay: Record<string, number> = {};
  const revenueByDay: Record<string, number> = {};
  for (const o of ordersRecent) {
    const k = dayKey(o.createdAt);
    ordersByDay[k] = (ordersByDay[k] ?? 0) + 1;
    if (o.paidAt) {
      const pk = dayKey(o.paidAt);
      revenueByDay[pk] = (revenueByDay[pk] ?? 0) + Number(o.totalAmount);
    }
  }

  ok(res, {
    users,
    homes,
    devices,
    activeToday,
    onlineDevices,
    pendingCommands,
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
    leak: getLeakMonitorState(),
    requests: getRequestStats(),
    usersByDay,
    ordersByDay,
    revenueByDay,
  });
});

// ---------- Site settings ----------

const settingsSchema = z
  .object({
    siteName: z.string().min(1).max(60).optional(),
    supportEmail: z.string().email().max(100).optional(),
    supportPhone: z.string().min(1).max(30).optional(),
    supportAddress: z.string().min(1).max(200).optional(),
    supportHours: z.string().min(1).max(100).optional(),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Hex color (#RRGGBB)").optional(),
    siteUrl: z.string().url().max(200).optional().or(z.literal("")),
    smtpHost: z.string().max(150).optional(),
    smtpPort: z.number().int().min(1).max(65535).optional(),
    smtpUser: z.string().max(150).optional(),
    smtpPass: z.string().max(200).optional(), // blank = purana rakho
    smtpFrom: z.string().email().max(150).optional().or(z.literal("")),
    smtpSecure: z.boolean().optional(),
    // AI assistant config (Phase 7) — UI se, env ke bajaye
    aiProvider: z.enum(["openai", "gemini", "ollama", ""]).optional(),
    aiApiKey: z.string().max(200).optional(), // blank = purana rakho
    aiBaseUrl: z.string().max(200).optional().or(z.literal("")),
    aiModel: z.string().max(100).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "At least one field to update" });

adminRouter.get("/settings", async (_req, res) => {
  const s = await getSiteSettings();
  // smtpPass / aiApiKey kabhi wapas nahi — sirf flags ki set hai ya nahi (UI placeholder)
  ok(res, {
    ...s,
    smtpPass: s.smtpPass ? "********" : "",
    smtpPassSet: !!s.smtpPass,
    aiApiKey: s.aiApiKey ? "********" : "",
    aiApiKeySet: !!s.aiApiKey,
  });
});

adminRouter.put("/settings", validateBody(settingsSchema), async (req, res) => {
  ok(res, await updateSiteSettings(req.body));
  void audit(req.user!.sub, "settings.update", { entity: "site", meta: { fields: Object.keys(req.body) } });
});

/** SMTP settings verify karo — admin ke email pe test mail bhejo. */
adminRouter.post("/settings/test-email", async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { email: true, username: true },
  });
  if (!me?.email) {
    throw new AppError("VALIDATION_ERROR", "Aapke account pe email set nahi hai — test bhejne ke liye email chahiye", 400);
  }
  const r = await sendEmail({
    to: me.email,
    subject: "🧪 SwitchNest test email",
    text: `Ye test email hai, ${me.username}. SMTP settings sahi kaam kar rahi hain. ✅`,
  });
  if (!r.ok) {
    if (r.skipped) {
      throw new AppError("CONFIG_ERROR", "SMTP configured nahi hai — Settings me host/user/pass daalo aur Save karo", 400);
    }
    throw new AppError("SMTP_ERROR", `Email fail: ${r.error ?? "unknown"}`, 500);
  }
  ok(res, { sent: true });
});

/** AI config verify — chhota completion call, error ko readable message me. */
adminRouter.post("/settings/ai-test", async (_req, res) => {
  if (!(await aiConfigured())) {
    throw new AppError("CONFIG_ERROR", "AI configured nahi hai — Settings me provider + model + API key daalo aur Save karo", 400);
  }
  const cfg = await getAiConfig();
  try {
    const reply = await chatCompletion({
      system: "Reply with exactly: AI_OK",
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 10,
      timeoutMs: 20_000,
    });
    ok(res, { ok: true, reply, provider: cfg.provider, model: cfg.model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError("AI_ERROR", `AI call fail: ${msg}`, 502);
  }
});

// ---------- Users ----------

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
      _count: { select: { ownedHomes: true, memberships: true } },
    },
    where: q
      ? {
          OR: [
            { username: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  ok(res, users);
});

adminRouter.patch("/users/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.sub) throw new AppError("BAD_REQUEST", "You cannot suspend your own account");
  const status = String(req.body.status ?? "");
  if (!["active", "suspended"].includes(status)) {
    throw new AppError("BAD_REQUEST", "Status must be active or suspended");
  }
  const user = await prisma.user.update({
    where: { id },
    data: { status: status as "active" | "suspended" },
  });
  await audit(req.user!.sub, `admin.user.${status}`, { entity: "user", entityId: id, meta: { username: user.username } });
  ok(res, user);
});

adminRouter.patch("/users/:id/role", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.sub) throw new AppError("BAD_REQUEST", "You cannot change your own role");
  const role = String(req.body.role ?? "");
  if (!["user", "system_admin"].includes(role)) {
    throw new AppError("BAD_REQUEST", "Role must be user or system_admin");
  }
  const user = await prisma.user.update({
    where: { id },
    data: { role: role as "user" | "system_admin" },
  });
  await audit(req.user!.sub, `admin.user.role`, { entity: "user", entityId: id, meta: { username: user.username, role } });
  ok(res, user);
});

adminRouter.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.sub) throw new AppError("BAD_REQUEST", "You cannot delete your own account");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  await audit(req.user!.sub, "admin.user.delete", { entity: "user", entityId: id, meta: { username: user.username, email: user.email } });
  await prisma.user.delete({ where: { id } });
  ok(res, { deleted: true });
});

// ---------- Homes ----------

adminRouter.get("/homes", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const homes = await prisma.home.findMany({
    include: {
      owner: { select: { id: true, username: true, email: true } },
      _count: { select: { devices: true, members: true, rooms: true } },
    },
    where: q ? { name: { contains: q } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
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
      _count: { select: { devices: true, members: true, invitations: true } },
    },
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
    data: { status: status as "active" | "suspended" },
  });
  await audit(req.user!.sub, `admin.home.${status}`, { homeId: id, entity: "home", entityId: id, meta: { name: home.name } });
  ok(res, home);
});

adminRouter.delete("/homes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const home = await prisma.home.findUnique({ where: { id } });
  if (!home) throw new AppError("NOT_FOUND", "Home not found");
  await audit(req.user!.sub, "admin.home.delete", { homeId: id, entity: "home", entityId: id, meta: { name: home.name } });
  await prisma.home.delete({ where: { id } });
  ok(res, { deleted: true });
});

// ---------- Devices ----------

adminRouter.get("/devices", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
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
            select: { keyPrefix: true, label: true, createdAt: true },
          },
        },
      },
      room: { select: { name: true } },
      _count: { select: { commands: true, logs: true } },
    },
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { serialNumber: { contains: q } },
            { ipAddress: { contains: q } },
            { home: { name: { contains: q } } },
            { home: { owner: { username: { contains: q } } } },
          ],
        }
      : undefined,
    orderBy: { id: "desc" },
    take: 200,
  });
  ok(
    res,
    devices.map((d) => ({
      ...d,
      online: d.lastSeen !== null && d.lastSeen.getTime() > dayAgo.getTime(),
    })),
  );
});

/** Global admin search — ek query se users/homes/devices/ESPs/orders/serials sab me ek saath. */
adminRouter.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return ok(res, { q, users: [], homes: [], devices: [], esps: [], orders: [], serials: [] });
  const qUp = q.toUpperCase();
  const [users, homes, devices, esps, orders, serials] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ username: { contains: q } }, { email: { contains: q } }] },
      select: { id: true, username: true, email: true, role: true, status: true, createdAt: true },
      orderBy: { id: "desc" },
      take: 5,
    }),
    prisma.home.findMany({
      where: { OR: [{ name: { contains: q } }, { owner: { username: { contains: q } } }] },
      select: {
        id: true,
        name: true,
        status: true,
        owner: { select: { username: true } },
        _count: { select: { devices: true, members: true } },
      },
      orderBy: { id: "desc" },
      take: 5,
    }),
    prisma.device.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { serialNumber: { contains: q } },
          { ipAddress: { contains: q } },
          { home: { name: { contains: q } } },
        ],
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        serialNumber: true,
        ipAddress: true,
        home: { select: { name: true } },
      },
      orderBy: { id: "desc" },
      take: 5,
    }),
    prisma.espDevice.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { serialCode: { contains: q } },
          { macAddress: { contains: q } },
          { ipAddress: { contains: q } },
          { ssid: { contains: q } },
          { modelCode: { contains: q } },
        ],
      },
      select: {
        id: true,
        name: true,
        serialCode: true,
        modelCode: true,
        ipAddress: true,
        offline: true,
        home: { select: { name: true } },
      },
      orderBy: { id: "desc" },
      take: 5,
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: qUp } },
          { shippingName: { contains: q } },
          { shippingPhone: { contains: q } },
          { user: { username: { contains: q } } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true,
        user: { select: { username: true } },
      },
      orderBy: { id: "desc" },
      take: 5,
    }),
    prisma.serialRegistry.findMany({
      where: { serialCode: { contains: qUp } },
      select: {
        id: true,
        serialCode: true,
        status: true,
        orderId: true,
        product: { select: { name: true } },
        user: { select: { username: true } },
      },
      orderBy: { id: "desc" },
      take: 5,
    }),
  ]);
  ok(res, { q, users, homes, devices, esps, orders, serials });
});

// ---------- API keys ----------

adminRouter.get("/api-keys", async (_req, res) => {
  const keys = await prisma.apiKey.findMany({
    include: {
      user: { select: { id: true, username: true, email: true } },
      home: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  ok(res, keys);
});

/** Flasher ke liye: user ke liye naya API key banao (userId/homeId pe bind).
 * GUI me order fetch pe key nahi mili (buyer ka home nahi) to yahi call hota hai. */
adminRouter.post("/api-keys", async (req, res) => {
  const userId = Number(req.body?.userId);
  if (!userId) throw new AppError("BAD_REQUEST", "userId required");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  let homeId = req.body?.homeId ? Number(req.body.homeId) : null;
  if (!homeId) {
    const home = await prisma.home.findFirst({ where: { ownerId: userId } });
    homeId = home?.id ?? null;
  }
  const label = String(req.body?.label ?? "factory").slice(0, 100);
  const crypto = await import("node:crypto");
  const plain = `rs_${crypto.randomBytes(9).toString("base64url").replace(/-/g, "").slice(0, 16)}`;
  const keyHash = crypto.createHash("sha256").update(plain).digest("hex");
  const keyPrefix = plain.slice(0, 8);
  await prisma.apiKey.create({ data: { userId, homeId, label, keyHash, keyPrefix } });
  await audit(req.user!.sub, "admin.apikey.create", {
    entity: "api_key",
    entityId: userId,
    meta: { label, prefix: keyPrefix, userId },
  });
  ok(res, { apiKey: plain, keyPrefix, userId, homeId });
});

adminRouter.delete("/api-keys/:id", async (req, res) => {
  const id = Number(req.params.id);
  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) throw new AppError("NOT_FOUND", "API key not found");
  await audit(req.user!.sub, "admin.apikey.revoke", { homeId: key.homeId, entity: "api_key", entityId: id, meta: { prefix: key.keyPrefix } });
  await prisma.apiKey.delete({ where: { id } });
  ok(res, { deleted: true });
});

// ---------- Audit log ----------

/** Customer support 'find by anything' — phone / order / serial / MAC / naam se turant context. */
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
      _count: { select: { ownedHomes: true, createdDevices: true, orders: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
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
      user: { select: { username: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
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
      home: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
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
      home: { select: { id: true, name: true, owner: { select: { id: true, username: true, email: true } } } },
    },
    orderBy: { id: "desc" },
    take: 10,
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
      home: { select: { id: true, name: true, owner: { select: { id: true, username: true, email: true } } } },
    },
    orderBy: { id: "desc" },
    take: 10,
  });

  const messages = await prisma.contactMessage.findMany({
    where: { OR: [{ phone: phone ? { contains: phone } : contains }, { email: contains }, { name: contains }] },
    select: { id: true, name: true, phone: true, email: true, subject: true, status: true, createdAt: true, userId: true },
    orderBy: { createdAt: "desc" },
    take: 10,
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
      user: { select: { id: true, username: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  ok(res, { q, users, orders, serials, boards, devices, messages, claims });
});

adminRouter.get("/audit", async (req, res) => {
  const action = String(req.query.action ?? "");
  const where = action ? { action } : undefined;
  const logs = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  ok(res, logs);
});

// ============================================================
// ---------- Diagnostics: app log (crash 503 ka asli reason yahan milega) ----------

/** Admin ko app.log ke aakhri N lines dikhao — crashguard / boot lines yahan hain. */
/** Diagnostics ka full text dump — export (.txt) ke liye. */
function buildDiagnosticsText(d: {
  process: { pid: number; uptimeSec: number; rssMB: number; heapMB: number; node: string; startedAt: string };
  parent: { pid: number; name: string; startTime: string; cmdline: string } | null;
  boot: string[];
  exits: string[];
  crashes: string[];
  serverErrors: string[];
  stats: { reqEnd: number; reqAbort: number; exitsInTail: number; bootsInTail: number };
  hbSummary: Array<{ pid: number; count: number; firstUptime: number; lastUptime: number; firstRss: number; lastRss: number; rssGrowthPerHour: number }>;
  hbSeries: Array<{ ts: string; pid: number; uptime: number; rss: number; heap: number | null }>;
  healthCheck: {
    lastCheck: { ts: string; ok: boolean; status: number | null; ms: number; err: string | null } | null;
    checksTotal: number;
    checksOk: number;
    successRate: number | null;
    activeIncident: { id: string; startedAt: string; lastStatus: number | null; lastErr: string | null } | null;
    incidents: Array<{
      ts: string;
      id: string;
      failCount?: number;
      lastStatus?: number | null;
      lastErr?: string | null;
      end?: { ts: string; durationSec: number; recoveredStatus?: number | null } | null;
    }>;
  };
  webconfig: { path: string | null; iisnode: string | null; httpErrors: string | null; appPoolRecycling: string | null } | null;
  appPool: string | null;
  wpEvents: string | null;
  error?: string;
  logPath: string | null;
  logBytes: number;
}): string {  const L: string[] = [];
  const sec = (t: string) => L.push(`\n${"=".repeat(70)}\n${t}\n${"=".repeat(70)}`);
  L.push(`SwitchNest Diagnostics Export`);
  L.push(`Exported: ${new Date().toISOString()}`);
  L.push(`Log file: ${d.logPath ?? "?"} (${d.logBytes ?? 0} bytes)`);
  if (d.error) L.push(`Parse error: ${d.error}`);

  sec("PROCESS");
  L.push(`PID:            ${d.process.pid}`);
  L.push(`Uptime:         ${Math.floor(d.process.uptimeSec / 60)}m ${d.process.uptimeSec % 60}s`);
  L.push(`RSS:            ${d.process.rssMB} MB`);
  L.push(`Heap:           ${d.process.heapMB} MB`);
  L.push(`Node:           ${d.process.node}`);
  L.push(`Started at:     ${d.process.startedAt}`);
  if (d.parent) {
    L.push(`Parent:         ${d.parent.name} (pid ${d.parent.pid})`);
    L.push(`Parent start:   ${d.parent.startTime}`);
    L.push(`Parent cmdline: ${d.parent.cmdline}`);
  }

  sec("STATS (log tail)");
  L.push(`Requests (END):   ${d.stats.reqEnd}`);
  L.push(`Requests (ABORT): ${d.stats.reqAbort}`);
  L.push(`Boots in tail:    ${d.stats.bootsInTail}`);
  L.push(`Exits in tail:    ${d.stats.exitsInTail}`);

  sec("HEALTH CHECKER");
  const hc = d.healthCheck;
  if (hc.lastCheck) {
    L.push(`Last check: ${hc.lastCheck.ts}  ${hc.lastCheck.ok ? "OK" : "FAIL"}  status=${hc.lastCheck.status ?? "-"}  ${hc.lastCheck.ms}ms  err=${hc.lastCheck.err ?? "-"}`);
  } else {
    L.push(`Last check: (none yet)`);
  }
  L.push(`Checks:     ${hc.checksOk}/${hc.checksTotal}  (success ${hc.successRate ?? "-"}%)`);
  if (hc.activeIncident) {
    L.push(`ACTIVE INCIDENT: ${hc.activeIncident.id}  since ${hc.activeIncident.startedAt}  last=${hc.activeIncident.lastStatus ?? hc.activeIncident.lastErr}`);
  }
  L.push(`Incidents:`);
  if (hc.incidents.length === 0) L.push(`  (none)`);
  for (const inc of hc.incidents) {
    L.push(
      `  ${inc.ts}  id=${inc.id}  ${inc.lastStatus ? `HTTP ${inc.lastStatus}` : inc.lastErr ?? "?"}` +
        (inc.end ? `  -> recovered ${inc.end.durationSec}s` : "  -> OPEN"),
    );
  }

  sec(`BOOT HISTORY (last ${d.boot.length})`);
  for (const b of d.boot) L.push(`  ${b}`);

  sec(`EXITS / RESTARTS (tail ${d.exits.length})`);
  if (d.exits.length === 0) L.push(`  (no exits recorded)`);
  for (const e of d.exits) L.push(`  ${e}`);

  sec(`CRASHES / FATAL (tail ${d.crashes.length})`);
  if (d.crashes.length === 0) L.push(`  (no crashguard/fatal lines)`);
  for (const c of d.crashes) L.push(`  ${c}`);

  sec(`SERVER ERRORS (tail ${d.serverErrors.length})`);
  if (d.serverErrors.length === 0) L.push(`  (none)`);
  for (const s of d.serverErrors) L.push(`  ${s}`);

  sec(`HEARTBEAT SUMMARY (per process, ${d.hbSummary.length})`);
  L.push(`  pid\thb\tfirstUptime\tlastUptime\tfirstRss\tlastRss\tgrowthMB/hr`);
  for (const h of d.hbSummary.slice(0, 60)) {
    L.push(`  ${h.pid}\t${h.count}\t${h.firstUptime}\t${h.lastUptime}\t${h.firstRss}\t${h.lastRss}\t${h.rssGrowthPerHour}`);
  }

  sec(`MEMORY TREND (24h, ${d.hbSeries.length} points — first/last 10)`);
  const sample = [...d.hbSeries.slice(0, 10), ...d.hbSeries.slice(-10)];
  L.push(`  ts\tpid\tuptime\trss\theap`);
  for (const p of sample) {
    L.push(`  ${p.ts}\t${p.pid}\t${p.uptime}\t${p.rss}\t${p.heap ?? "-"}`);
  }

  sec("WEB.CONFIG");
  if (d.webconfig) {
    L.push(`Path: ${d.webconfig.path}`);
    if (d.webconfig.iisnode) L.push(`iisnode: ${d.webconfig.iisnode}`);
    if (d.webconfig.httpErrors) L.push(`httpErrors: ${d.webconfig.httpErrors}`);
    if (d.webconfig.appPoolRecycling) L.push(`recycling: ${d.webconfig.appPoolRecycling}`);
  } else {
    L.push(`(not readable)`);
  }

  sec("APP POOL (appcmd)");
  L.push(d.appPool ? d.appPool.slice(0, 3000) : `(unavailable)`);

  if (d.wpEvents) {
    sec("WORKER PROCESS EVENTS (wevtutil)");
    L.push(d.wpEvents.slice(0, 2000));
  }

  L.push(`\n${"=".repeat(70)}`);
  return L.join("\n");
}

/**
 * Deploy info — admin panel me "last code update" + current commit.
 * deploy.cmd har deploy pe site/apps/logs/deploy.json likhta hai
 * (timestamp + commit + branch). Yahan marker + live git state
 * (agar production pe repo clone ho) + process uptime milta hai.
 */
/** GitHub Actions CI status — latest run for a commit. 5-min cache; GITHUB_TOKEN/GH_TOKEN env se. */
type CiStatus = {
  status: "pass" | "fail" | "pending" | "unknown";
  runId?: number;
  workflow?: string;
  createdAt?: string;
  updatedAt?: string;
  reason?: string;
};
const ciCache: { key: string; at: number; value: CiStatus } = { key: "", at: 0, value: { status: "unknown" } };
async function fetchCiStatus(sha?: string): Promise<CiStatus> {
  const cacheKey = sha ?? "latest-main";
  const now = Date.now();
  if (ciCache.key === cacheKey && now - ciCache.at < 300_000) return ciCache.value;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const q = sha ? `head_sha=${sha}` : "branch=main";
  const store = (v: CiStatus) => {
    ciCache.key = cacheKey;
    ciCache.at = now;
    ciCache.value = v;
    return v;
  };
  try {
    const res = await fetch(`https://api.github.com/repos/robosphere99/switch_v2/actions/runs?${q}&per_page=1`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "switchnest-admin",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return store(
        token
          ? { status: "unknown", reason: `GitHub API ${res.status}` }
          : { status: "unknown", reason: "private repo — GITHUB_TOKEN env me daalo" },
      );
    }
    if (!res.ok) return store({ status: "unknown", reason: `GitHub API ${res.status}` });
    const data = (await res.json()) as {
      workflow_runs?: Array<{ id: number; name?: string | null; status: string; conclusion: string | null; created_at: string; updated_at: string }>;
    };
    const run = data.workflow_runs?.[0];
    if (!run) return store({ status: "unknown", reason: "no workflow runs yet" });
    const conclusion = run.conclusion;
    return store({
      status:
        conclusion === "success"
          ? "pass"
          : conclusion === "failure" || conclusion === "cancelled" || conclusion === "timed_out" || conclusion === "action_required"
            ? "fail"
            : run.status === "completed"
              ? "unknown"
              : "pending",
      runId: run.id,
      workflow: run.name ?? undefined,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
    });
  } catch (e) {
    return { status: "unknown", reason: e instanceof Error ? e.message : "network error" };
  }
}

/** Latest main commit — marker/git dono missing ho to fallback (GitHub API).
 * Production pe .git nahi hota aur deploy.json wipe bhi ho sakta hai — isliye
 * API khud apne repo ka current main commit fetch karta hai (60s cache). */
const latestCache: { at: number; value: { commit: string; branch: string; ts: string } | null } = { at: 0, value: null };
async function fetchLatestMain() {
  const now = Date.now();
  if (now - latestCache.at < 60_000) return latestCache.value;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  try {
    const res = await fetch("https://api.github.com/repos/robosphere99/switch_v2/commits/main", {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "switchnest-admin",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return latestCache.value;
    const j = (await res.json()) as { sha?: string; commit?: { committer?: { date?: string } } };
    latestCache.value = { commit: j.sha || "", branch: "main", ts: j.commit?.committer?.date || "" };
    latestCache.at = now;
  } catch {
    /* best-effort — cache purana rehne do */
  }
  return latestCache.value;
}

/** Kya `ancestor` local git history me hai (head ka ancestor)? True = head aage/equal. */
function isAncestorOf(ancestor: string, head: string): boolean {
  try {
    execSync(`git merge-base --is-ancestor ${ancestor} ${head}`, {
      stdio: "ignore",
      windowsHide: true,
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

adminRouter.get("/lan-info", async (_req, res) => {
  // Flasher Guide page (web) ke liye — localhost mode me ESP server URL me
  // `<LAN-IP>` placeholder ki jagah asli IP dikhna chahiye. Server khud apna
  // LAN IP detect karta hai (wahi IP jo boards heartbeat pe use karenge).
  const lanIp = await detectLanIp();
  ok(res, { lanIp, espServerUrl: `http://${lanIp}:4000` });
});

adminRouter.get("/deploy-info", async (_req, res) => {
  let marker: { deployedAt?: string; commit?: string; branch?: string; source?: string } | null = null;
  const markerPath = path.resolve(process.cwd(), "../logs/deploy.json");
  try {
    if (fs.existsSync(markerPath)) {
      marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
    }
  } catch { /* marker corrupt/nahi — koi baat nahi */ }

  let git: { commit: string; branch: string } | null = null;
  try {
    const head = execSync("git rev-parse HEAD", { encoding: "utf8", windowsHide: true, timeout: 8000 }).trim();
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8", windowsHide: true, timeout: 8000 }).trim();
    if (head) git = { commit: head, branch };
  } catch { /* production pe .git nahi ho to — marker hi kaafi hai */ }

  // Build metadata — dist/build-commit.json (build time pe likha, git me committed).
  // Deployed commit ka SABSE reliable source: code hi batata hai kis commit se bana hai,
  // deploy.json (untracked, wipe ho sakta hai) ya GitHub API pe depend nahi karta.
  let build: { commit: string; builtAt: string } | null = null;
  try {
    const bp = path.resolve(process.cwd(), "dist/build-commit.json");
    if (fs.existsSync(bp)) {
      const bj = JSON.parse(fs.readFileSync(bp, "utf8"));
      if (bj?.commit) build = { commit: bj.commit, builtAt: bj.builtAt || "" };
    }
  } catch { /* build metadata nahi — marker/git/latest fallback */ }

  const ciSha = marker?.commit || git?.commit || build?.commit || undefined;
  const ci = await fetchCiStatus(ciSha);
  const latest = await fetchLatestMain();

  // Deploy sync health — main pe push hua par live site pe nahi pahuncha
  // (lost webhook delivery / failed deploy) to yahan detect hota hai.
  //   synced  : deployed commit == latest main commit
  //   pending : naya commit hai par deploy window me (push 5 min se kam purana)
  //   lagging : commit 5+ min purana hai aur abhi tak live nahi — action chahiye
  //   unknown : deployed/latest dono nahi pata (GitHub fetch fail / build metadata missing)
  // Note: build-commit.json hamesha PARENT commit embed karta hai (build commit
  // se pehle hota hai) — isliye marker (deploy-time SHA) ko priority, build sirf
  // last resort jab marker wipe ho jaye.
  // Deployed commit ka source: production me marker (deploy.json, deploy-time)
  // exact SHA deta hai. Dev machine pe marker nahi hota — running code git HEAD
  // hai (tsx src/ se), aur dist/build-commit.json purane build se stale rehta
  // hai — isliye git ko build se PEHLE rakho (stale build se jhuta "deploy
  // lagging" alarm aata tha localhost-first me).
  const deployedSource: "marker" | "git" | "build" | null = marker?.commit
    ? "marker"
    : git?.commit
      ? "git"
      : build?.commit
        ? "build"
        : null;
  const deployedCommit = marker?.commit || git?.commit || build?.commit || null;
  const deployedAt =
    deployedSource === "marker"
      ? marker?.deployedAt || null
      : deployedSource === "build"
        ? build?.builtAt || null
        : null;
  const latestCommit = latest?.commit || null;
  const latestTs = latest?.ts || null;
  // Marker source "build" = GitHub down tha deploy pe, commit parent hai —
  // usse sync compare KARNA galat ho sakta hai (jhuta lagging). Trusted
  // sirf github/git source (ya purane markers bina source ke).
  const markerTrusted = marker?.commit ? marker?.source !== "build" : true;
  let syncStatus: "synced" | "pending" | "lagging" | "local" | "unknown" = "unknown";
  let syncAgeMin: number | null = null;
  if (markerTrusted && deployedCommit && latestCommit && latestTs) {
    syncAgeMin = Math.round((Date.now() - new Date(latestTs).getTime()) / 60_000);
    if (deployedCommit === latestCommit) syncStatus = "synced";
    else if (syncAgeMin > 5) {
      // Lagging alarm SIRF production deploy ke liye meaningful hai (marker se
      // deployed). Dev/local pe deployed = git HEAD — GitHub main se AAGE hona
      // (unpushed commits) localhost-first me normal hai, alarm nahi. Direction
      // check: deployed main se aage hai to calm "local", peeche hai to "lagging".
      const aheadOfMain =
        deployedSource === "git" && git?.commit && latestCommit
          ? isAncestorOf(latestCommit, git.commit)
          : false;
      syncStatus = aheadOfMain ? "local" : "lagging";
    } else syncStatus = "pending";
  }
  ok(res, {
    marker,
    git,
    build,
    deployedAt,
    latest,
    sync: {
      status: syncStatus,
      deployedCommit,
      deployedSource,
      latestCommit,
      ageMin: syncAgeMin,
      since: latest?.ts || null,
    },
    ci,
    processUptimeSec: Math.round(process.uptime()),
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
  });
});

adminRouter.get("/diagnostics", async (_req, res) => {
  const TAIL_MAX = 5 * 1024 * 1024; // 5MB tail enough — poora file nahi padhte
  const result: {
    logPath: string | null;
    logBytes: number;
    error?: string;
    process: {
      pid: number;
      uptimeSec: number;
      rssMB: number;
      heapMB: number;
      node: string;
      startedAt: string;
    };
    parent: {
      pid: number;
      name: string;
      startTime: string;
      cmdline: string;
    } | null;
    boot: string[];
    exits: string[];
    crashes: string[];
    serverErrors: string[];
    stats: { reqEnd: number; reqAbort: number; exitsInTail: number; bootsInTail: number };
    hbSummary: Array<{ pid: number; count: number; firstUptime: number; lastUptime: number; firstRss: number; lastRss: number; rssGrowthPerHour: number }>;
    hbSeries: Array<{ ts: string; pid: number; uptime: number; rss: number; heap: number | null }>;
    healthCheck: {
      running: boolean;
      intervalSec: number;
      startedAt: string;
      lastCheck: { ts: string; ok: boolean; status: number | null; ms: number; err: string | null } | null;
      checksTotal: number;
      checksOk: number;
      successRate: number | null;
      activeIncident: { id: string; startedAt: string; lastStatus: number | null; lastErr: string | null } | null;
      checking: boolean;
      incidents: Array<{
        ts: string;
        type: string;
        id: string;
        failCount?: number;
        lastStatus?: number | null;
        lastErr?: string | null;
        end?: { ts: string; durationSec: number; recoveredStatus?: number | null } | null;
      }>;
    };
    leak: {
      running: boolean;
      startedAt: string;
      lastCheckedAt: string | null;
      leaking: boolean;
      detail: {
        pid: number;
        growthPct: number;
        spanH: number;
        rssFirst: number;
        rssLast: number;
        firstTs: string;
        lastTs: string;
      } | null;
      thresholdPct: number;
      windowH: number;
      incidents: Array<Record<string, unknown>>;
    };
    appPool: string | null;
    wpEvents: string | null;
    webconfig: {
      path: string | null;
      iisnode: string | null;
      httpErrors: string | null;
      appPoolRecycling: string | null;
      error?: string;
    } | null;
  } = {
    logPath: logFilePath ?? null,
    logBytes: 0,
    process: {
      pid: process.pid,
      uptimeSec: Math.round(process.uptime()),
      rssMB: Math.round(process.memoryUsage().rss / 1048576),
      heapMB: Math.round(process.memoryUsage().heapUsed / 1048576),
      node: process.version,
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    },
    parent: null,
    boot: [],
    exits: [],
    crashes: [],
    serverErrors: [],
    stats: { reqEnd: 0, reqAbort: 0, exitsInTail: 0, bootsInTail: 0 },
    hbSummary: [],
    hbSeries: [],
    healthCheck: {
      running: false,
      intervalSec: 30,
      startedAt: new Date().toISOString(),
      lastCheck: null,
      checksTotal: 0,
      checksOk: 0,
      successRate: null,
      activeIncident: null,
      checking: false,
      incidents: [],
    },
    leak: getLeakMonitorState(),
    webconfig: null,
    appPool: null,
    wpEvents: null,
  };

  if (logFilePath && fs.existsSync(logFilePath)) {
    try {
      const st = fs.statSync(logFilePath);
      result.logBytes = st.size;
      let raw = "";
      if (st.size > TAIL_MAX) {
        const fd = fs.openSync(logFilePath, "r");
        const buf = Buffer.alloc(TAIL_MAX);
        fs.readSync(fd, buf, 0, TAIL_MAX, st.size - TAIL_MAX);
        fs.closeSync(fd);
        raw = buf.toString("utf8");
      } else {
        raw = fs.readFileSync(logFilePath, "utf8");
      }
      const lines = raw.split(/\r?\n/).filter(Boolean);
      const pushCap = (arr: string[], l: string, cap: number) => {
        if (arr.length >= cap) return;
        arr.push(l);
      };
      for (const l of lines) {
        if (/^\[boot\]/.test(l)) {
          result.stats.bootsInTail += 1;
          pushCap(result.boot, l, 25);
        } else if (/\[hb\] (exit|beforeExit)/.test(l)) {
          result.stats.exitsInTail += 1;
          pushCap(result.exits, l, 25);
        } else if (/\[crashguard\]|\[fatal\]/.test(l)) {
          pushCap(result.crashes, l, 25);
        } else if (/^\[server\]/.test(l)) {
          pushCap(result.serverErrors, l, 10);
        } else if (/\[req\].*END/.test(l)) {
          result.stats.reqEnd += 1;
        } else if (/\[req\].*ABORT/.test(l)) {
          result.stats.reqAbort += 1;
        }
      }
      // Heartbeat RSS series — memory leak trend ke liye (har 10s [hb] line).
      const hbRe = /\[hb\] alive uptime=(\d+)s pid=(\d+) rss=(\d+)MB/;
      const hbMap = new Map<
        number,
        { pid: number; count: number; firstUptime: number; lastUptime: number; firstRss: number; lastRss: number }
      >();
      for (const l of lines) {
        const m = hbRe.exec(l);
        if (!m) continue;
        const pid = Number(m[2]);
        const uptime = Number(m[1]);
        const rss = Number(m[3]);
        const cur = hbMap.get(pid);
        if (!cur) {
          hbMap.set(pid, { pid, count: 1, firstUptime: uptime, lastUptime: uptime, firstRss: rss, lastRss: rss });
        } else {
          cur.count += 1;
          cur.lastUptime = uptime;
          cur.lastRss = rss;
        }
      }
      // Growth rate (MB/hour) — leak detect: consistent positive growth.
      result.hbSummary = [...hbMap.values()]
        .map((h) => ({
          ...h,
          rssGrowthPerHour:
            h.lastUptime > h.firstUptime
              ? Number((((h.lastRss - h.firstRss) / ((h.lastUptime - h.firstUptime) / 3600)) || 0).toFixed(1))
              : 0,
        }))
        .sort((a, b) => b.lastRss - a.lastRss);

      // Time-series (24h) — har 10s [hb] line → {ts, pid, rss, heap}.
      // Sirf REAL ts= wali lines — purana format (bina ts) ko now-uptime se
      // date karna chronological order ulta kar deta hai (RSS decline ko
      // growth dikhata tha). Legacy lines chart se bahar rakhi gayi hain.
      const hbSeriesRe = /\[hb\] alive ts=([\d:.TZ-]+) uptime=(\d+)s pid=(\d+) rss=(\d+)MB(?: heap=(\d+)MB)?/;
      const nowMs = Date.now();
      const dayAgo = nowMs - 24 * 3600 * 1000;
      const series: Array<{ ts: string; pid: number; uptime: number; rss: number; heap: number | null }> = [];
      for (const l of lines) {
        const m = hbSeriesRe.exec(l);
        if (!m) continue;
        const t = Date.parse(m[1]);
        if (Number.isNaN(t) || t < dayAgo) continue;
        series.push({
          ts: new Date(t).toISOString(),
          pid: Number(m[3]),
          uptime: Number(m[2]),
          rss: Number(m[4]),
          heap: m[5] ? Number(m[5]) : null,
        });
      }
      series.sort((a, b) => a.ts.localeCompare(b.ts));
      // Cap — zyada points ho to sample (har Nth). Chart pe ~700 points kaafi.
      const MAX_SERIES = 700;
      if (series.length > MAX_SERIES) {
        const step = Math.ceil(series.length / MAX_SERIES);
        result.hbSeries = series.filter((_, i) => i % step === 0);
      } else {
        result.hbSeries = series;
      }

    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }
  }


  result.healthCheck = getHealthMonitorState();
  result.leak = getLeakMonitorState();

  // web.config — iisnode settings (nodeProcessCountPerApplication, watchedFiles,
  // maxConcurrentRequestsPerProcess). Process har ~60s recycle ho raha hai bina
  // exit line ke — in settings se asli wajah samajh aayegi.
  for (const cand of [
    path.resolve(process.cwd(), "web.config"),
    path.resolve(process.cwd(), "../web.config"),
    path.resolve(process.cwd(), "../../web.config"),
  ]) {
    if (!fs.existsSync(cand)) continue;
    try {
      const content = fs.readFileSync(cand, "utf8");
      const grab = (re: RegExp) => {
        const m = re.exec(content);
        return m ? m[0].slice(0, 500) : null;
      };
      result.webconfig = {
        path: cand,
        iisnode: grab(/<iisnode\b[^>]*>/i),
        httpErrors: grab(/<httpErrors\b[^>]*>/i),
        appPoolRecycling: grab(/<recycling\b[\s\S]*?<\/recycling>/i)?.slice(0, 400) ?? null,
      };
      break;
    } catch (err) {
      result.webconfig = {
        path: cand,
        iisnode: null,
        httpErrors: null,
        appPoolRecycling: null,
        error: err instanceof Error ? err.message : String(err),
      };
      break;
    }
  }


  // App pool config — har 60s recycle ka reason yahan milta hai
  // (recycling.periodicRestart, cpu/memory limits, idle timeout).
  // App pool identity read-only appcmd access rakhta hai aksar.
  const windir = process.env.windir || "C:\\Windows";
  try {
    const out = execSync(
      `\"${windir}\\System32\\inetsrv\\appcmd.exe\" list apppool /config`,
      { encoding: "utf8", windowsHide: true, timeout: 15_000 },
    );
    result.appPool = out.slice(0, 5000);
  } catch (err) {
    result.appPool = `appcmd unavailable: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500);
  }
  // IIS worker process events (recycling reasons) — best effort, admin
  // chahiye hota hai, agar permission na ho to null rehta hai.
  try {
    const out = execSync(
      `\"${windir}\\System32\\wevtutil.exe\" qe Microsoft-Windows-IIS-W3SVC-WP/Operational /c:8 /rd:true /f:text`,
      { encoding: "utf8", windowsHide: true, timeout: 15_000 },
    );
    result.wpEvents = out.slice(0, 4000);
  } catch {
    /* no permission — skip */
  }

  // Parent process — w3wp (app-pool worker) stable hai ya khud recycle
  // ho raha hai? Agar w3wp bhi har minute naya hai to pool-level recycle
  // (Plesk config). Agar w3wp purana hai to iisnode node ko khud maarta hai.
  try {
    const wm = (cmd: string) => execSync(cmd, { encoding: "utf8", windowsHide: true, timeout: 10_000 });
    const out = wm(`wmic process where ProcessId=${process.pid} get ParentProcessId /value`);
    const m = /ParentProcessId=(\d+)/.exec(out);
    if (m) {
      const ppid = Number(m[1]);
      const p2 = wm(`wmic process where ProcessId=${ppid} get Name,CreationDate,CommandLine /value`);
      result.parent = {
        pid: ppid,
        name: /Name=(.*)/.exec(p2)?.[1] ?? "",
        startTime: /CreationDate=(.*)/.exec(p2)?.[1] ?? "",
        cmdline: (/CommandLine=(.*)/.exec(p2)?.[1] ?? "").slice(0, 300),
      };
    }
  } catch {
    /* wmic unavailable — parent unknown, koi baat nahi */
  }

  // Export — full dump as .txt (Content-Disposition attachment).
  if (String(_req.query.download) === "1") {
    const txt = buildDiagnosticsText(result);
    const fname = `switchnest-diagnostics-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    return res.send(txt);
  }

  ok(res, result);
});

adminRouter.get("/logs", async (_req, res) => {
  const n = Math.min(Number(_req.query.lines ?? 300) || 300, 1000);
  const result: {
    path: string | null;
    totalLines: number;
    lines: string[];
    crashes: Array<{ line: string; count: number }>;
    iisnodeLogs: Array<{ name: string; path: string; size: number; lines: string[] }>;
  } = { path: logFilePath ?? null, totalLines: 0, lines: [], crashes: [], iisnodeLogs: [] };

  if (logFilePath && fs.existsSync(logFilePath)) {
    const raw = fs.readFileSync(logFilePath, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean).slice(-n);
    result.lines = lines;
    result.totalLines = lines.length;
    // Crash/error lines — same error (timestamps/pids ko hatake) baar-baar na dikhe.
    // Har unique error ek baar, uske saath kitni baar repeat hua (count).
    const crashMap = new Map<string, { line: string; count: number }>();
    for (const l of lines) {
      if (!/crashguard|unhandled|error|fail|exception/i.test(l)) continue;
      const key = l
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, " ")
        .replace(/pid=\d+/g, "pid=N")
        .replace(/uptime=\d+s/g, "uptime=N")
        .replace(/rss=\d+MB/g, "rss=N")
        .replace(/\[(boot|req|hb|scheduler|offline)\]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (!key) continue;
      const cur = crashMap.get(key);
      if (cur) cur.count += 1;
      else crashMap.set(key, { line: l, count: 1 });
    }
    result.crashes = [...crashMap.values()];
  }

  // iisnode apne stdout/stderr yahan likhta hai — native crash dump (jo JS
  // crashguard pakad nahi sakta) inhi files me hota hai. web.config ka
  // logDirectory=../logs = site/apps/logs. Saath me site/logs bhi try.
  const dirs = new Set<string>();
  if (logFilePath) dirs.add(path.dirname(logFilePath));
  dirs.add(path.resolve(process.cwd(), "../logs"));
  dirs.add(path.resolve(process.cwd(), "../../logs"));
  for (const dir of dirs) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // permission/nahi mila — skip
    }
    for (const e of entries) {
      if (!e.isFile()) continue;
      const name = e.name;
      if (!/^stdout_/i.test(name) && !/^stderr_/i.test(name) && !/\.log$/i.test(name)) continue;
      const full = path.join(dir, name);
      try {
        const size = fs.statSync(full).size;
        const buf = fs.readFileSync(full, "utf8");
        const ls = buf.split(/\r?\n/).filter(Boolean).slice(-200);
        result.iisnodeLogs.push({ name, path: full, size, lines: ls });
      } catch {
        /* read nahi ho paya — skip */
      }
    }
  }
  ok(res, result);
});

// ESP / OTA — connected ESPs (IPs, firmware) + firmware publish + push
// ============================================================

// Published firmware lives in <repo>/hardware/firmware, served at /firmware.
// Plesk pe cwd site/apps hota hai — repo root wala path paths.ts se aata hai.
// Server (Plesk) pe write permission na ho to app ko crash mat hone do —
// upload waqt friendly error dikhega.
try {
  fs.mkdirSync(firmwareDir, { recursive: true });
} catch (err) {
  console.warn(`[firmware] cannot create ${firmwareDir}:`, err instanceof Error ? err.message : err);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, firmwareDir),
    filename: (_req, _file, cb) => cb(null, "firmware.bin"),
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB is plenty for ESP32 .bin
});

/** ESP boards — ek row per PHYSICAL board (MAC se), under me controlled devices. */
adminRouter.get("/esp", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const current = await prisma.firmwareVersion.findFirst({ where: { isCurrent: true } });
  const esps = await prisma.espDevice.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { serialCode: { contains: q } },
            { macAddress: { contains: q } },
            { ipAddress: { contains: q } },
            { ssid: { contains: q } },
            { modelCode: { contains: q } },
            { home: { OR: [{ name: { contains: q } }, { owner: { username: { contains: q } } }] } },
          ],
        }
      : undefined,
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
            select: { keyPrefix: true, label: true, createdAt: true },
          },
        },
      },
      devices: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          room: { select: { name: true } },
        },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { lastSeen: "desc" },
    take: 100,
  });
  // Devices jinhe abhi tak koi ESP report nahi kiya (legacy) — admin view se gayab na hon.
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
      home: { select: { name: true } },
    },
    orderBy: { id: "asc" },
    take: 100,
  });
  ok(res, { esps, unlinked, currentVersion: current?.version ?? null });
});

/**
 * Admin support: ESP ke home ke liye fresh API key issue karo.
 * Full key sirf isi response me milta hai (hash store hota hai) — admin
 * copy karke user ko de sakta hai (portal/flasher me paste karne ke liye).
 */
adminRouter.post("/esp/:id/key", async (req, res) => {
  const id = Number(req.params.id);
  const esp = await prisma.espDevice.findUnique({
    where: { id },
    include: { home: { select: { id: true, ownerId: true } } },
  });
  if (!esp?.home) throw new AppError("NOT_FOUND", "ESP ya home nahi mila");
  const crypto = await import("node:crypto");
  const plain = `rs_${crypto.randomBytes(9).toString("base64url").replace(/-/g, "").slice(0, 16)}`;
  const keyHash = crypto.createHash("sha256").update(plain).digest("hex");
  const keyPrefix = plain.slice(0, 8);
  await prisma.apiKey.create({
    data: {
      userId: esp.home.ownerId,
      homeId: esp.home.id,
      label: `admin-support-${Date.now()}`,
      keyHash,
      keyPrefix,
    },
  });
  await audit(req.user!.sub, "admin.esp.key.issue", {
    entity: "esp",
    entityId: id,
    meta: { homeId: esp.home.id },
  });
  ok(res, { apiKey: plain, keyPrefix });
});

/** Rename an ESP board (admin friendly name). */
adminRouter.patch("/esp/:id", async (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body?.name ?? "").trim().slice(0, 60);
  if (!name) throw new AppError("BAD_REQUEST", "Name required");
  // Tracking ke liye board ka naam UNIQUE hona chahiye — duplicate pe reject.
  const dup = await prisma.espDevice.findFirst({ where: { name, id: { not: id } }, select: { id: true } });
  if (dup) {
    throw new AppError("DUPLICATE_NAME", `Naam "${name}" already kisi aur board pe hai — har board ka unique naam chahiye`, 409);
  }
  const before = await prisma.espDevice.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Board nahi mila", 404);
  const esp = await prisma.espDevice.update({ where: { id }, data: { name } });
  await audit(req.user!.sub, "admin.esp.rename", {
    entity: "esp",
    entityId: id,
    meta: { from: before.name ?? null, to: name },
  });
  // Admin rename bhi user ko notify karta hai (support action).
  const home = await prisma.home.findUnique({
    where: { id: esp.homeId },
    include: { members: { where: { role: { in: ["owner", "admin"] } }, select: { userId: true } } },
  });
  if (home) {
    const oldName = before.name ?? before.serialCode ?? `ESP-${before.macAddress.slice(-6).toUpperCase()}`;
    for (const m of home.members) {
      await createNotification(m.userId, {
        category: "support",
        type: "info",
        title: `🛰️ Support ne board renamed kiya: ${oldName} → ${name}`,
        body: `Support team ne board ka naam "${oldName}" se "${name}" kar diya.`,
      });
    }
    emitToHome(esp.homeId, "esp:updated", { id, name });
  }
  ok(res, esp);
});

/** Board ki rename history (user + admin dono ke renames) — tracking/security. */
adminRouter.get("/esp/:id/history", async (req, res) => {
  const id = Number(req.params.id);
  const logs = await prisma.auditLog.findMany({
    where: {
      entity: "esp",
      entityId: id,
      action: { in: ["user.esp.rename", "admin.esp.rename"] },
    },
    include: { actor: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  ok(res, logs);
});

/** Firmware version history. */
adminRouter.get("/firmware", async (_req, res) => {
  const versions = await prisma.firmwareVersion.findMany({ orderBy: { createdAt: "desc" } });
  const current = versions.find((v) => v.isCurrent) ?? null;
  ok(res, { versions, current });
});

/** Upload a new firmware .bin + version + release notes -> publish as current.
 * model = "2CH" | "4CH" | "8CH" | "DIM-3S" | "DIM-4S" | "" (universal). */
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

  // multer filename fixed "firmware.bin" rakhta hai — model ho to rename karo
  if (modelCode && filename !== "firmware.bin") {
    const uploaded = path.join(firmwareDir, "firmware.bin");
    const target = path.join(firmwareDir, filename);
    if (fs.existsSync(uploaded) && uploaded !== target) {
      if (fs.existsSync(target)) fs.unlinkSync(target);
      fs.renameSync(uploaded, target);
    }
  }

  await prisma.$transaction([
    // Sirf isi model ke puraane current deactivate karo — doosre models ke current untouched
    prisma.firmwareVersion.updateMany({ where: { modelCode, isCurrent: true }, data: { isCurrent: false } }),
    prisma.firmwareVersion.upsert({
      where: { version_modelCode: { version, modelCode } },
      create: { version, modelCode, url, releaseNotes, isCurrent: true },
      update: { releaseNotes, isCurrent: true, url },
    }),
  ]);

  await audit(req.user!.sub, "admin.firmware.upload", {
    entity: "firmware",
    meta: { version, modelCode: modelCode || "universal", releaseNotes },
  });
  ok(res, { version, modelCode, releaseNotes, published: true, url });
});

/** Mark an existing firmware version as the current one (per model). */
adminRouter.post("/firmware/:id/activate", async (req, res) => {
  const id = Number(req.params.id);
  const fw = await prisma.firmwareVersion.findUnique({ where: { id } });
  if (!fw) throw new AppError("NOT_FOUND", "Firmware version not found", 404);

  await prisma.$transaction([
    prisma.firmwareVersion.updateMany({ where: { modelCode: fw.modelCode }, data: { isCurrent: false } }),
    prisma.firmwareVersion.update({ where: { id }, data: { isCurrent: true } }),
  ]);
  await audit(req.user!.sub, "admin.firmware.activate", {
    entity: "firmware",
    entityId: id,
    meta: { version: fw.version },
  });
  ok(res, { id, version: fw.version, isCurrent: true });
});

/** ---------- Device support (customer service) ---------- */

/** Admin se kisi bhi device ko turant control karo (ON/OFF) — support ke liye. */
adminRouter.post("/devices/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (status !== "on" && status !== "off") throw new AppError("VALIDATION_ERROR", "status must be 'on' or 'off'", 400);
  const device = await prisma.device.findUnique({
    where: { id },
    include: { home: { select: { ownerId: true } } },
  });
  if (!device) throw new AppError("NOT_FOUND", "Device not found", 404);
  await prisma.$transaction([
    prisma.device.update({ where: { id }, data: { status } }),
    prisma.deviceCommand.create({
      data: { deviceId: id, actorId: req.user!.sub, command: `set_status:${status}` },
    }),
    prisma.deviceLog.create({
      data: { deviceId: id, actorId: req.user!.sub, logType: "status_change", logMessage: `Admin turned device ${status}` },
    }),
  ]);
  await audit(req.user!.sub, "admin.device.control", {
    homeId: device.homeId,
    entity: "device",
    entityId: id,
    meta: { name: device.name, status },
  });
  await createNotification(device.home.ownerId, {
    category: "support",
    type: "info",
    title: `Support ne ${device.name} ${status === "on" ? "ON" : "OFF"} kiya`,
    body: `Admin ne aapke device "${device.name}" ko ${status === "on" ? "chalu (ON)" : "band (OFF)"} kiya. Agar yeh galat hai to turant support ko batayein.`,
  });
  ok(res, { id, status });
});

/** Device ka full support view — info + recent logs + pending commands + linked ESP board. */
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
            select: { keyPrefix: true, label: true, createdAt: true },
          },
        },
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
              lastSeen: true,
            },
            orderBy: { id: "asc" },
          },
        },
      },
      logs: { orderBy: { createdAt: "desc" }, take: 20 },
      commands: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!device) throw new AppError("NOT_FOUND", "Device not found", 404);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  ok(res, { ...device, online: device.lastSeen !== null && device.lastSeen.getTime() > dayAgo.getTime() });
});

/** Fix: stuck pending commands ko clear karo (device fir se responsive ho jayega). */
adminRouter.post("/devices/:id/clear-commands", async (req, res) => {
  const id = Number(req.params.id);
  const device = await prisma.device.findUnique({
    where: { id },
    include: { home: { select: { ownerId: true } } },
  });
  if (!device) throw new AppError("NOT_FOUND", "Device not found", 404);
  const cleared = await prisma.deviceCommand.updateMany({
    where: { deviceId: id, status: "pending" },
    data: { status: "failed", executedAt: new Date() },
  });
  await prisma.deviceLog.create({
    data: { deviceId: id, actorId: req.user!.sub, logType: "support", logMessage: `Admin cleared ${cleared.count} stuck command(s)` },
  });
  await audit(req.user!.sub, "admin.device.fix", {
    homeId: device.homeId,
    entity: "device",
    entityId: id,
    meta: { name: device.name, cleared: cleared.count },
  });
  if (cleared.count > 0) {
    await createNotification(device.home.ownerId, {
      category: "support",
      type: "warning",
      title: `Support ne "${device.name}" ke stuck commands clear kiye`,
      body: `${cleared.count} pending command(s) clear kiye gaye. Device ab dobara responsive hoga.`,
    });
  }
  ok(res, { cleared: cleared.count });
});

/** Push the current firmware to ONE device (updates on its next heartbeat).
 * Firmware resolution board ke model se hota hai (model-specific > universal). */
adminRouter.post("/devices/:id/push-ota", async (req, res) => {
  const id = Number(req.params.id);
  const device = await prisma.device.findUnique({
    where: { id },
    include: { home: { select: { ownerId: true } } },
  });
  if (!device) throw new AppError("NOT_FOUND", "Device not found", 404);

  const esp = device.espId
    ? await prisma.espDevice.findUnique({ where: { id: device.espId } })
    : null;
  const current = await resolveFirmware(esp?.modelCode);
  if (!current) {
    throw new AppError("NO_FIRMWARE", "No current firmware published yet — upload a .bin first", 400);
  }

  await prisma.device.update({
    where: { id },
    data: { otaPendingVersion: current.version, otaRequestedAt: new Date() },
  });
  let espId: number | null = null;
  if (device.espId) {
    espId = device.espId;
    await prisma.espDevice.update({
      where: { id: espId },
      data: { otaPendingVersion: current.version, otaRequestedAt: new Date() },
    });
  }
  await audit(req.user!.sub, "admin.ota.push", {
    homeId: device.homeId,
    entity: "device",
    entityId: id,
    meta: { version: current.version, model: esp?.modelCode ?? null },
  });
  await createNotification(device.home.ownerId, {
    category: "support",
    type: "info",
    title: `Support ne "${device.name}" ke liye firmware update push kiya`,
    body: `Naya firmware v${current.version} aapke device pe agle heartbeat pe install hoga.`,
  });
  ok(res, {
    deviceId: id,
    espId,
    version: current.version,
    model: current.modelCode || "universal",
    message: "OTA update pushed — the device will update on its next heartbeat",
  });
});

/** Push the current firmware to ALL devices (or one home with homeId). */
adminRouter.post("/devices/push-ota-all", async (req, res) => {
  const current = await prisma.firmwareVersion.findFirst({ where: { isCurrent: true } });
  if (!current) {
    throw new AppError("NO_FIRMWARE", "No current firmware published yet — upload a .bin first", 400);
  }
  const rawHome = Number(req.body.homeId ?? 0);
  const homeId = rawHome > 0 ? rawHome : undefined;

  const espResult = await prisma.espDevice.updateMany({
    where: homeId ? { homeId } : {},
    data: { otaPendingVersion: current.version, otaRequestedAt: new Date() },
  });
  // Bina ESP ke devices (legacy) — device-level pending set karo.
  const deviceResult = await prisma.device.updateMany({
    where: { ...(homeId ? { homeId } : {}), espId: null },
    data: { otaPendingVersion: current.version, otaRequestedAt: new Date() },
  });
  const count = espResult.count + deviceResult.count;
  await audit(req.user!.sub, "admin.ota.push_all", {
    homeId,
    entity: "device",
    meta: { version: current.version, count },
  });
  // Affected users ko batao (ek user ko ek hi notification, chahe kitne bhi devices ho).
  const homeIds = new Set<number>();
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
    [...ownerIds].map((ownerId) =>
      createNotification(ownerId, {
        category: "support",
        type: "info",
        title: "Support ne firmware update push kiya",
        body: `Aapke ${count} device(s) ke liye naya firmware v${current.version} available hai — agle heartbeat pe auto-install hoga.`,
      })
    )
  );
  ok(res, { count, version: current.version });
});

/** Quick reachability probe of an ESP board's web panel (HTTP GET with timeout). */
adminRouter.get("/esp/:id/probe", async (req, res) => {
  const id = Number(req.params.id);
  const esp = await prisma.espDevice.findUnique({ where: { id } });
  if (!esp) throw new AppError("NOT_FOUND", "ESP not found", 404);

  const ip = esp.ipAddress?.trim();
  if (!ip) {
    return ok(res, { reachable: false, reason: "no_ip" });
  }
  // Basic IP shape guard (IPv4 / IPv6 literal) — never probe arbitrary URLs.
  if (!/^[\d.a-fA-F:]+$/.test(ip)) {
    return ok(res, { reachable: false, reason: "invalid_ip" });
  }

  const url = `http://${ip}/`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "SwitchNest-Admin/1.0" },
    });
    return ok(res, { reachable: true, latencyMs: Date.now() - started, statusCode: r.status });
  } catch {
    return ok(res, { reachable: false, reason: "unreachable", latencyMs: Date.now() - started });
  } finally {
    clearTimeout(timer);
  }
});

// ---------- Shop: Products ----------

adminRouter.get("/products", async (_req, res) => {
  const products = await prisma.product.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { serials: true } } },
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
      description: description ? String(description) : undefined,
      features: features ? (typeof features === "string" ? JSON.parse(features) : features) : undefined,
      imageUrl: imageUrl ? String(imageUrl).slice(0, 255) : undefined,
    },
  });
  await audit(req.user!.sub, "admin.product.create", { entity: "product", entityId: product.id, meta: { modelCode } });
  ok(res, product, 201);
});

adminRouter.patch("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, price, description, features, imageUrl, active } = req.body ?? {};
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: name != null ? String(name).slice(0, 100) : undefined,
      price: price != null ? Number(price) : undefined,
      description: description != null ? String(description) : undefined,
      features: features ? (typeof features === "string" ? JSON.parse(features) : features) : undefined,
      imageUrl: imageUrl != null ? String(imageUrl).slice(0, 255) : undefined,
      active: active != null ? Boolean(active) : undefined,
    },
  });
  await audit(req.user!.sub, "admin.product.update", { entity: "product", entityId: id });
  ok(res, product);
});

adminRouter.delete("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.product.delete({ where: { id } });
  await audit(req.user!.sub, "admin.product.delete", { entity: "product", entityId: id });
  ok(res, { deleted: true });
});

// ---------- Shop: Orders ----------

adminRouter.get("/orders", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const orders = await prisma.order.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      items: true,
      user: { select: { id: true, username: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  ok(res, orders);
});

/** Ek order ka pura detail (bill/print ke liye) — items + buyer + payment. */
adminRouter.get("/orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      user: { select: { id: true, username: true, email: true } },
    },
  });
  if (!order) throw new AppError("NOT_FOUND", "Order not found");
  // Bill QR ke liye HMAC-signed verify token — public verify page isi se khulta hai.
  ok(res, { ...order, verifyToken: signBillToken(order.id) });
});

adminRouter.patch("/orders/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  const order = await updateOrderStatus(id, status);
  await audit(req.user!.sub, `admin.order.${status}`, {
    entity: "order",
    entityId: id,
    meta: { orderNumber: order.orderNumber },
  });
  ok(res, order);
});

// ---------- Shop: Serial Registry ----------

adminRouter.get("/serials", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  const serials = await prisma.serialRegistry.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(productId ? { productId } : {}),
    },
    include: {
      product: { select: { id: true, name: true, modelCode: true } },
      user: { select: { id: true, username: true, email: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
    },
    orderBy: { id: "desc" },
    take: 500,
  });

  // Sticker/hotspot ke liye: har serial ka order ke andar device number
  // (orderIdx) aur order total serials (orderTotal) — `username_XXXXXX_2` jaisa
  // hotspot naam banane ke liye (order me multiple devices ho to).
  const orderIds = [...new Set(serials.map((s) => s.orderId).filter((x): x is number => Boolean(x)))];
  const perOrder: Record<number, string[]> = {};
  if (orderIds.length) {
    const byOrder = await prisma.serialRegistry.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true, serialCode: true, orderId: true },
      orderBy: { id: "asc" },
    });
    for (const s of byOrder) {
      if (!s.orderId) continue;
      (perOrder[s.orderId] ??= []).push(s.serialCode);
    }
  }
  const enriched = serials.map((s) => {
    const codes = s.orderId ? perOrder[s.orderId] : undefined;
    return {
      ...s,
      orderIdx: codes ? codes.indexOf(s.serialCode) + 1 : 0,
      orderTotal: codes?.length ?? 0,
    };
  });
  ok(res, enriched);
});

/** Serial detail — kisne claim kiya, kaun sa order, home, warranty (admin click pe). */
adminRouter.get("/serials/:code", async (req, res) => {
  const code = String(req.params.code ?? "").trim().toUpperCase();
  const serial = await prisma.serialRegistry.findUnique({
    where: { serialCode: code },
    include: {
      product: { select: { id: true, name: true, modelCode: true } },
      user: { select: { id: true, username: true, email: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      home: { select: { id: true, name: true } },
    },
  });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");
  ok(res, serial);
});

adminRouter.post("/serials/generate", async (req, res) => {
  const productId = Number(req.body?.productId);
  const count = Number(req.body?.count ?? 10);
  const codes = await generateSerials(productId, count);
  await audit(req.user!.sub, "admin.serial.generate", {
    entity: "product",
    entityId: productId,
    meta: { count, codes: codes.slice(0, 5) },
  });
  ok(res, { generated: codes.length, codes }, 201);
});

// ---------- Manufacturing: Order Provision + Serial Test ----------

/**
 * Flasher: order ke liye ek naya serial banao aur order se link karo.
 * Har board (quantity × item) ko apna unique serial chahiye — har call ek
 * naya serial banata hai (registry me create + orderId set). Item ka
 * serialCode pehla serial dikhata hai (ship/claim flow ke liye).
 * Jab order ki total quantity ke serial ban chuke ho, "DONE" signal deta hai
 * taaki flasher Next Board pe aage badhe.
 */
adminRouter.post("/orders/:id/serials/generate", async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) throw new AppError("NOT_FOUND", "Order not found", 404);

  const item = order.items[0];
  if (!item) throw new AppError("BAD_REQUEST", "Order me koi item nahi", 400);

  // Is order se already linked serials ki count — total quantity ke against.
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
    if (!dup) { code = candidate; break; }
  }
  if (!code) throw new AppError("CONFLICT", "Serial generate nahi ho paya — try again", 409);

  await prisma.serialRegistry.create({
    data: { serialCode: code, productId: item.productId, orderId: order.id, status: "reserved" },
  });
  // Item ka serialCode sirf tab set karo jab khali ho (pehla serial hi rehta hai)
  if (!item.serialCode) {
    await prisma.orderItem.update({ where: { id: item.id }, data: { serialCode: code } });
  }
  await audit(req.user!.sub, "admin.serial.generate.order", {
    entity: "order",
    entityId: order.id,
    meta: { serialCode: code, orderNumber: order.orderNumber },
  });
  ok(res, { done: false, serialCode: code, modelCode }, 201);
});

/** Flasher GUI ke liye: order ki items + serials + WiFi (decrypted) — admin only. */
adminRouter.get("/orders/:id/provision", async (req, res) => {
  const include = {
    items: true,
    user: { select: { id: true, username: true, email: true } },
  };
  const raw = String(req.params.id).trim();
  // Numeric ID ho to direct, warna order NUMBER se (flasher me order number
  // ya uska suffix paste karne par bhi kaam kare).
  let order = /^\d+$/.test(raw)
    ? await prisma.order.findUnique({ where: { id: Number(raw) }, include })
    : null;
  if (!order && raw) {
    const matches = await prisma.order.findMany({
      where: { orderNumber: { contains: raw.toUpperCase() } },
      orderBy: { id: "desc" },
      take: 1,
      include,
    });
    order = matches[0] ?? null;
  }
  if (!order) throw new AppError("NOT_FOUND", "Order not found");

  // Paid-gate: sirf verified-payment orders hi flasher me fetch ho sakte hain.
  // Pending/cancelled order ka board factory me flash nahi hota — pehle payment verify karo.
  if (order.status === "pending" || order.status === "cancelled") {
    throw new AppError(
      "BAD_REQUEST",
      "Payment verify nahi hua — pehle admin Orders me order ko 'Mark Paid' karo, phir fetch karo",
    );
  }

  const items = await Promise.all(
    order.items.map(async (it) => {
      // Model hamesha product se (serial se nahi) — taaki serial generate
      // hone se pehle bhi flasher ko sahi model mile (2CH/4CH/8CH/DIM...).
      const prod = await prisma.product.findUnique({
        where: { id: it.productId },
        select: { modelCode: true },
      });
      return {
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        price: Number(it.price),
        quantity: it.quantity,
        serialCode: it.serialCode,
        modelCode: prod?.modelCode ?? null,
      };
    }),
  );

  let wifiPassword = null;
  if (order.wifiPasswordEnc) {
    try {
      wifiPassword = decryptSecret(order.wifiPasswordEnc);
    } catch {
      wifiPassword = null;
    }
  }

  // Buyer ke home ka API key — board ko isi se server se baat karni hai.
  // Har provision pe ek fresh key issue karte hain (label = factory/order).
  const crypto = await import("node:crypto");
  const plain = `rs_${crypto.randomBytes(9).toString("base64url").replace(/-/g, "").slice(0, 16)}`;
  const keyHash = crypto.createHash("sha256").update(plain).digest("hex");
  const keyPrefix = plain.slice(0, 8);
  const home = await prisma.home.findFirst({ where: { ownerId: order.userId } });
  if (home) {
    await prisma.apiKey.create({
      data: {
        userId: order.userId,
        homeId: home.id,
        label: `factory-order-${order.orderNumber}`,
        keyHash,
        keyPrefix,
      },
    });
  }
  const apiKeyPlain = home ? plain : null;

  ok(res, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    wifiSsid: order.wifiSsid,
    wifiPassword,
    apiKey: apiKeyPlain,
    user: order.user,
    items,
  });
});

/** Flasher: serial ko factory-tested mark karo (relay self-test pass hone ke baad). */
adminRouter.post("/serials/:code/mark-tested", async (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const serial = await prisma.serialRegistry.findUnique({ where: { serialCode: code } });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");
  const updated = await prisma.serialRegistry.update({
    where: { id: serial.id },
    data: { testedAt: new Date() },
  });
  await audit(req.user!.sub, "admin.serial.tested", {
    entity: "serial",
    entityId: serial.id,
    meta: { serialCode: code },
  });

  // Serial order se linked hai to user ko notify — "tested, ab pack hone chala".
  if (serial.orderId) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: serial.orderId },
        select: { userId: true, orderNumber: true },
      });
      if (order) {
        await createNotification(order.userId, {
          category: "system",
          type: "info",
          title: "✅ Factory test pass",
          body: `Aapka board (${code}) factory relay self-test pass kar chuka hai — ab pack hone chala gaya. Order ${order.orderNumber}.`,
        });
      }
    } catch (err) {
      console.error("[admin] tested notification failed", err);
    }
  }

  ok(res, { tested: true, serialCode: code, testedAt: updated.testedAt });
});

// ---------- Warranty (admin) ----------

adminRouter.get("/warranty", async (_req, res) => {
  const claims = await prisma.warrantyClaim.findMany({
    include: { user: { select: { id: true, username: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  const codes = [...new Set(claims.map((c) => c.serialCode))];
  const serials = await prisma.serialRegistry.findMany({
    where: { serialCode: { in: codes } },
    select: { serialCode: true, warrantyStatus: true, warrantyExpiresAt: true, product: { select: { name: true, modelCode: true } } },
  });
  ok(res, claims.map((c) => ({ ...c, serial: serials.find((s) => s.serialCode === c.serialCode) ?? null })));
});

/** Claim status update: approved / rejected / resolved. */
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
      data: { status: status as "approved" | "rejected" | "resolved" },
    });
    if (status === "resolved" || status === "rejected") {
      await tx.serialRegistry.update({
        where: { serialCode: claim.serialCode },
        data: { warrantyStatus: "active" },
      });
    }
    return c;
  });

  await audit(req.user!.sub, `admin.warranty.${status}`, {
    entity: "warranty_claim",
    entityId: id,
    meta: { serialCode: claim.serialCode },
  });

  // User ko status change ki notification + EMAIL (Phase 6).
  const statusMsg: Record<string, string> = {
    approved: `Aapki warranty claim (${claim.serialCode}) APPROVED ho gayi — replacement/repair ke liye support se baat karo.`,
    rejected: `Aapki warranty claim (${claim.serialCode}) REJECT ho gayi. Reason ke liye support se baat karo.`,
    resolved: `Aapki warranty claim (${claim.serialCode}) RESOLVED ho gayi — issue sort ho gaya.`,
  };
  try {
    await createNotificationWithEmail(
      claim.userId,
      {
        category: "system",
        type: status === "rejected" ? "warning" : "info",
        title: `🛡️ Warranty ${status}: ${claim.serialCode}`,
        body: statusMsg[status] ?? `Claim status update: ${status}`,
      },
      {
        emailSubject: `🛡️ Warranty claim ${status} — ${claim.serialCode}`,
        ctaUrl: "/warranty",
        ctaLabel: "Warranty dekho",
      },
    );
  } catch (err) {
    console.error("[admin] warranty email failed", err);
  }
  ok(res, { id: updated.id, status: updated.status });
});

// ---------- Contact / Feedback (public form se) ----------

adminRouter.get("/contact", async (_req, res) => {
  const msgs = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, username: true, email: true, role: true } } },
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

// ---------- Danger zone: Site reset ----------

const resetSchema = z.object({
  mode: z.enum(["data", "factory"]),
  confirm: z.literal("RESET"),
});

/**
 * Admin power: poora test/data saaf karo.
 *  - mode "data"    — saare users/devices/orders/notifications/support clear;
 *                    system_admin account + product catalog + firmware versions rahenge.
 *  - mode "factory" — SAB kuch (admin bhi) clear → app setup mode (install wizard).
 * Confirm ke liye body me "RESET" type karna zaroori hai.
 */
adminRouter.post("/reset", validateBody(resetSchema), async (req, res) => {
  const { mode } = req.body as { mode: "data" | "factory" };

  const ALL_TABLES = [
    "api_keys", "app_meta", "assistant_chats", "assistant_messages", "audit_logs",
    "contact_messages", "device_access", "device_commands", "device_configurations",
    "device_logs", "device_usage", "devices", "esp_devices", "firmware_versions",
    "home_members", "homes", "invitations", "notifications", "order_items", "orders",
    "products", "refresh_tokens", "rooms", "schedules", "serial_registry",
    "support_chat_settings", "support_messages", "users", "warranty_claims",
  ];
  // "data" mode me yeh tables waise ki waise rehti hain (admin login + catalog + firmware).
  const KEEP_IN_DATA = new Set(["products", "app_meta", "users", "firmware_versions"]);

  const tablesToWipe =
    mode === "factory" ? ALL_TABLES : ALL_TABLES.filter((t) => !KEEP_IN_DATA.has(t));

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=0");
    for (const t of tablesToWipe) {
      await tx.$executeRawUnsafe(`DELETE FROM \`${t}\``);
    }
    if (mode === "data") {
      // Admin(s) + catalog rehte hain; baaki saare users clear.
      await tx.$executeRawUnsafe("DELETE FROM `users` WHERE role <> 'system_admin'");
    }
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=1");
  });

  if (mode === "factory") {
    // Tables bhi drop — install wizard ke liye bilkul clean slate.
    // (Warna schema.sql ka CREATE TABLE 'users' already exists dega.)
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=0");
      for (const t of ALL_TABLES) {
        await tx.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${t}\``);
      }
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=1");
    });
    // Admin bhi gaya → in-memory flag bhi reset, taaki install wizard turant dikhe.
    setDbReady(false);
  } else {
    await audit(req.user!.sub, "admin.reset", { entity: "platform", meta: { mode } });
  }

  ok(res, {
    reset: true,
    mode,
    message:
      mode === "factory"
        ? "Factory reset ho gaya — ab install wizard se fresh setup karo"
        : "Data reset ho gaya — admin + catalog rahe, baaki sab clear",
  });
});
