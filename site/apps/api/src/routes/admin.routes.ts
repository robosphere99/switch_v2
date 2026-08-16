import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { prisma } from "../lib/prisma";
import { AppError, ok } from "../lib/response";
import { audit } from "../services/audit.service";
import { createNotification } from "../services/notification.service";
import { emitToHome } from "../lib/socket";
import { generateSerials, updateOrderStatus } from "../services/shop.service";
import { decryptSecret } from "../lib/crypto";
import { resolveFirmware } from "../services/firmware.service";
import { firmwareDir } from "../lib/paths";
import { logFilePath } from "../lib/logger";
import { getRequestStats } from "../lib/requestTracker";
import { getSiteSettings, updateSiteSettings } from "../services/siteSettings.service";
import { setDbReady } from "../lib/dbState";
import { sendEmail } from "../lib/email.service";

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
  })
  .refine((d) => Object.keys(d).length > 0, { message: "At least one field to update" });

adminRouter.get("/settings", async (_req, res) => {
  const s = await getSiteSettings();
  // smtpPass kabhi wapas nahi — sirf flag ki set hai ya nahi (UI placeholder ke liye)
  ok(res, { ...s, smtpPass: s.smtpPass ? "********" : "", smtpPassSet: !!s.smtpPass });
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
    include: { product: { select: { id: true, name: true, modelCode: true } } },
    orderBy: { id: "desc" },
    take: 500,
  });
  ok(res, serials);
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
