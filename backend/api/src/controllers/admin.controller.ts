import type { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
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
import { logFilePath } from "../lib/logger";
import { getRequestStats } from "../lib/requestTracker";
import { getSiteSettings, updateSiteSettings } from "../services/siteSettings.service";
import { setDbReady } from "../lib/dbState";
import { sendEmail } from "../lib/email.service";
import { chatCompletion, getAiConfig, aiConfigured } from "../lib/ai";
import { requestPasswordReset } from "../services/auth.service";
import { firmwareDir, mobileAppDir, webPublicMobileAppDir } from "../lib/paths";

export type CiStatus = {
  state?: "success" | "pending" | "failure" | "error";
  target_url?: string;
  description?: string;
  status: "pass" | "fail" | "pending" | "unknown";
  runId?: number;
  workflow?: string;
  createdAt?: string;
  updatedAt?: string;
  reason?: string;
};

let ciCache: { key: string; at: number; value: CiStatus } = { key: "", at: 0, value: { state: "pending", status: "unknown" } as any };
let latestCache: { at: number; value: { commit: string; branch: string; ts: string } | null } = { at: 0, value: null };

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function getStats(_req: Request, res: Response): Promise<void> {
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
    prisma.user.count().catch(() => 0),
    prisma.home.count().catch(() => 0),
    prisma.device.count().catch(() => 0),
    Promise.resolve(0),
    prisma.device.count({ where: { lastSeen: { gte: dayAgo } } }).catch(() => 0),
    prisma.deviceCommand.count({ where: { status: "pending" } }).catch(() => 0),
    prisma.apiKey.count().catch(() => 0),
    prisma.auditLog.count().catch(() => 0),
    prisma.espDevice.count().catch(() => 0),
    prisma.espDevice.count({ where: { OR: [{ offline: true }, { lastSeen: { lt: twoMin } }] } }).catch(() => 0),
    prisma.order.count().catch(() => 0),
    prisma.order.count({ where: { status: "pending" } }).catch(() => 0),
    prisma.order.count({ where: { createdAt: { gte: dayAgo } } }).catch(() => 0),
    prisma.order.count({ where: { createdAt: { gte: monthStart } } }).catch(() => 0),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paidAt: { not: null } } }).catch(() => ({ _sum: { totalAmount: 0 } })),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paidAt: { not: null }, createdAt: { gte: monthStart } } }).catch(() => ({ _sum: { totalAmount: 0 } })),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }).catch(() => 0),
    prisma.supportMessage.count().catch(() => 0),
    prisma.contactMessage.count().catch(() => 0),
    prisma.deviceLog.count({ where: { createdAt: { gte: dayAgo } } }).catch(() => 0),
    prisma.user.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true } }).catch(() => []),
    prisma.order.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true, totalAmount: true, paidAt: true } }).catch(() => []),
  ]);

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
}

export async function getSettings(_req: Request, res: Response): Promise<void> {
  const s = await getSiteSettings();
  
  // Merge from .env if DB is empty so UI shows what's actually being used
  const host = s.smtpHost || process.env.SMTP_HOST || "";
  const user = s.smtpUser || process.env.SMTP_USER || process.env.EMAIL_USER || "";
  const port = s.smtpPort || Number(process.env.SMTP_PORT) || 587;
  const secure = s.smtpSecure || process.env.SMTP_SECURE === "true";
  const passSet = !!s.smtpPass || !!process.env.SMTP_PASS || !!process.env.EMAIL_PASS;
  
  ok(res, {
    ...s,
    smtpHost: host,
    smtpUser: user,
    smtpPort: port,
    smtpSecure: secure,
    smtpPass: passSet ? "********" : "",
    smtpPassSet: passSet,
    aiApiKey: s.aiApiKey ? "********" : "",
    aiApiKeySet: !!s.aiApiKey,
  });
}

export async function putSettings(req: Request, res: Response): Promise<void> {
  const updated = await updateSiteSettings(req.body);
  void audit(req.user!.sub, "settings.update", { entity: "site", meta: { fields: Object.keys(req.body) } });
  ok(res, updated);
}

export async function testSmtpEmail(req: Request, res: Response): Promise<void> {
  const me = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { email: true, username: true },
  });
  
  const customTo = typeof req.body?.to === "string" ? req.body.to.trim() : null;
  const toEmail = customTo || me?.email;

  if (!toEmail) {
    throw new AppError("VALIDATION_ERROR", "Aapke account pe email set nahi hai aur test email bhi provide nahi kiya gaya.", 400);
  }
  const r = await sendEmail({
    to: toEmail,
    subject: "🧪 SwitchNest test email",
    text: `Ye test email hai, SMTP settings sahi kaam kar rahi hain. ✅`,
  });
  if (!r.ok) {
    if (r.skipped) {
      throw new AppError("CONFIG_ERROR", "SMTP configured nahi hai — Settings me host/user/pass daalo aur Save karo", 400);
    }
    throw new AppError("SMTP_ERROR", `Email fail: ${r.error ?? "unknown"}`, 500);
  }
  ok(res, { sent: true });
}

export async function testAiConnection(_req: Request, res: Response): Promise<void> {
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
}

export async function getUsers(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? "").trim();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          ownedHomes: true,
          memberships: true,
          orders: true,
          apiKeys: true,
          createdDevices: true,
          claimedSerials: true,
          warrantyClaims: true,
        },
      },
    },
    where: q
      ? {
          OR: [{ username: { contains: q } }, { email: { contains: q } }],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const userIds = users.map((u) => u.id);
  const memberships = await prisma.homeMember.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, homeId: true },
  });
  const espCounts = await prisma.espDevice.groupBy({
    by: ["homeId"],
    where: { homeId: { in: memberships.map((m) => m.homeId) } },
    _count: { _all: true },
  });
  const espByHome = new Map(espCounts.map((e) => [e.homeId, e._count._all]));
  const boardsByUser = new Map<number, number>();
  for (const m of memberships) {
    boardsByUser.set(m.userId, (boardsByUser.get(m.userId) ?? 0) + (espByHome.get(m.homeId) ?? 0));
  }
  const usageRows = await prisma.deviceUsage.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds } },
    _sum: { onMinutes: true },
  });
  const usageByUser = new Map(usageRows.map((r) => [r.userId, r._sum.onMinutes ?? 0]));

  ok(
    res,
    users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      _count: u._count,
      boards: boardsByUser.get(u.id) ?? 0,
      usageMinutes: usageByUser.get(u.id) ?? 0,
    }))
  );
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          ownedHomes: true,
          orders: true,
          apiKeys: true,
          createdDevices: true,
          claimedSerials: true,
          warrantyClaims: true,
          contactMessages: true,
        },
      },
      memberships: {
        select: {
          home: { select: { id: true, name: true } },
          role: true,
        },
        orderBy: { role: "asc" },
      },
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      apiKeys: {
        select: {
          id: true,
          keyPrefix: true,
          label: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
          lastUsedAt: true,
          home: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);

  const espCounts = await prisma.espDevice.groupBy({
    by: ["homeId"],
    where: { homeId: { in: user.memberships.map((m) => m.home.id) } },
    _count: { _all: true },
  });
  const boards = espCounts.reduce((n, e) => n + e._count._all, 0);
  const usageAgg = await prisma.deviceUsage.aggregate({
    where: { userId: user.id },
    _sum: { onMinutes: true },
  });

  ok(res, {
    ...user,
    boards,
    usageMinutes: usageAgg._sum.onMinutes ?? 0,
  });
}

export const postUsers = async (req: Request, res: Response) => {
  const { username, email, password, role } = req.body;
  const existingUsername = await prisma.user.findFirst({ where: { username }, select: { id: true } });
  if (existingUsername) throw new AppError("USER_EXISTS", `Username '${username}' is already taken. Please use another username.`, 409);

  const existingEmail = await prisma.user.findFirst({ where: { email }, select: { id: true, username: true } });
  if (existingEmail) throw new AppError("USER_EXISTS", `Email '${email}' is already registered (account: '${existingEmail.username}').`, 409);
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashed,
      role: role ?? "user",
      status: "active",
      pushDeviceToggles: true,
      pushSystemAlerts: true,
      tokenVersion: 0,
    },
    select: { id: true, username: true, email: true, role: true, status: true, createdAt: true },
  });
  await audit(req.user!.sub, "admin.user.create", {
    entity: "user",
    entityId: user.id,
    meta: { username: user.username, email: user.email, role: user.role },
  });
  ok(res, user, 201);
};

export const postUsersIdSendResetEmail = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, email: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
  await requestPasswordReset(user.email);
  await audit(req.user!.sub, "admin.user.sendResetEmail", {
    entity: "user",
    entityId: id,
    meta: { username: user.username, email: user.email },
  });
  ok(res, { sent: true, message: `Password reset email bheja (${user.email})` });
};

export const postUsersIdResetPassword = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, email: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
  const hashed = await bcrypt.hash(req.body.password, 10);
  await prisma.user.update({ where: { id }, data: { password: hashed } });
  await audit(req.user!.sub, "admin.user.resetPassword", {
    entity: "user",
    entityId: id,
    meta: { username: user.username, email: user.email },
  });
  ok(res, { reset: true, message: `Password reset ho gaya (${user.username})` });
};

export const postBroadcast = async (req: Request, res: Response) => {
  const { title, body, sendEmail } = req.body;
  const targets = await prisma.user.findMany({
    where: { role: "user", status: "active" },
    select: { id: true },
  });
  let emailed = 0;
  for (const t of targets) {
    if (sendEmail) {
      await createNotificationWithEmail(
        t.id,
        { category: "system", type: "info", title, body },
        { emailSubject: title, emailBody: body },
      );
      emailed++;
    } else {
      await createNotification(t.id, { category: "system", type: "info", title, body });
    }
  }
  await audit(req.user!.sub, "admin.broadcast", {
    entity: "site",
    meta: { title, targets: targets.length, emailed },
  });
  ok(res, { sent: targets.length, emailed });
};

export const patchUsersIdStatus = async (req: Request, res: Response) => {
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
};

export const patchUsersIdRole = async (req: Request, res: Response) => {
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
};

export const deleteUsersId = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (id === req.user!.sub) throw new AppError("BAD_REQUEST", "You cannot delete your own account");
  const user = await prisma.user.findUnique({ where: { id }, include: { ownedHomes: true } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  
  try {
    for (const home of user.ownedHomes) {
      await prisma.deviceLog.deleteMany({ where: { device: { homeId: home.id } } });
      await prisma.deviceCommand.deleteMany({ where: { device: { homeId: home.id } } });
      await prisma.deviceAccess.deleteMany({ where: { device: { homeId: home.id } } });
      await prisma.deviceUsage.deleteMany({ where: { device: { homeId: home.id } } });
      await prisma.device.deleteMany({ where: { homeId: home.id } });
      await prisma.room.deleteMany({ where: { homeId: home.id } });
      await prisma.homeMember.deleteMany({ where: { homeId: home.id } });
      await prisma.auditLog.deleteMany({ where: { homeId: home.id } });
      await prisma.home.delete({ where: { id: home.id } });
    }
    
    await prisma.homeMember.deleteMany({ where: { userId: id } });
    await prisma.refreshToken.deleteMany({ where: { userId: id } });
    await prisma.auditLog.deleteMany({ where: { actorId: id } });
    await prisma.apiKey.deleteMany({ where: { userId: id } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: id } });
    await prisma.pushSubscription.deleteMany({ where: { userId: id } });
    await prisma.assistantChat.deleteMany({ where: { userId: id } });
    await prisma.assistantMessage.deleteMany({ where: { chat: { userId: id } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: id } } });
    await prisma.order.deleteMany({ where: { userId: id } });
    
    await prisma.user.delete({ where: { id } });
    await audit(req.user!.sub, "admin.user.delete", { entity: "user", entityId: id, meta: { username: user.username, email: user.email } });
    ok(res, { deleted: true });
  } catch (err: any) {
    throw new AppError("INTERNAL_ERROR", "User delete failed: " + err.message);
  }
};

export const getHomes = async (req: Request, res: Response) => {
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
};

export const getHomesId = async (req: Request, res: Response) => {
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
};

export const patchHomesIdStatus = async (req: Request, res: Response) => {
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
};

export const deleteHomesId = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const home = await prisma.home.findUnique({ where: { id } });
  if (!home) throw new AppError("NOT_FOUND", "Home not found");
  await audit(req.user!.sub, "admin.home.delete", { homeId: id, entity: "home", entityId: id, meta: { name: home.name } });
  await prisma.home.delete({ where: { id } });
  ok(res, { deleted: true });
};

export const getDevices = async (req: Request, res: Response) => {
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
};

export const getSearch = async (req: Request, res: Response) => {
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
};

export const getApiKeys = async (_req: Request, res: Response) => {
  try {
    const keys = await prisma.apiKey.findMany({
      include: {
        user: { select: { id: true, username: true, email: true } },
        home: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    ok(res, keys);
  } catch (err: any) {
    console.error(`[admin] api-keys query failed:`, err?.message ?? err);
    ok(res, []);
  }
};

export const postApiKeys = async (req: Request, res: Response) => {
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
};

export const deleteApiKeysId = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) throw new AppError("NOT_FOUND", "API key not found");
  await audit(req.user!.sub, "admin.apikey.revoke", { homeId: key.homeId, entity: "api_key", entityId: id, meta: { prefix: key.keyPrefix } });
  await prisma.apiKey.delete({ where: { id } });
  ok(res, { deleted: true });
};

export const getFind = async (req: Request, res: Response) => {
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
};

export const getAudit = async (req: Request, res: Response) => {
  const action = String(req.query.action ?? "");
  const where = action ? { action } : undefined;
  const logs = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  ok(res, logs);
};

export const getLanInfo = async (_req: Request, res: Response) => {
  // Flasher Guide page (web) ke liye — localhost mode me ESP server URL me
  // `<LAN-IP>` placeholder ki jagah asli IP dikhna chahiye. Server khud apna
  // LAN IP detect karta hai (wahi IP jo boards heartbeat pe use karenge).
  const lanIp = await detectLanIp();
  ok(res, { lanIp, espServerUrl: `http://${lanIp}:4000` });
};

export const postCheckUrl = async (req: Request, res: Response) => {
  const raw = String((req.body as { url?: unknown }).url ?? "").trim();
  if (!/^https?:\/\//i.test(raw)) {
    throw new AppError("VALIDATION_ERROR", "URL http:// ya https:// se shuru hona chahiye", 400);
  }
  const started = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(raw, { signal: ctrl.signal });
    clearTimeout(timer);
    ok(res, { ok: true, status: r.status, ms: Date.now() - started });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    const msg = aborted
      ? "Timeout — 6s me koi response nahi (URL galat ya server down?)"
      : err instanceof Error
        ? err.message
        : String(err);
    ok(res, { ok: false, error: msg, ms: Date.now() - started });
  }
};

export const getDeployInfo = async (_req: Request, res: Response) => {
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
};

export const getDiagnostics = async (_req: Request, res: Response) => {
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
};

export const getLogs = async (_req: Request, res: Response) => {
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
};

export const getEsp = async (req: Request, res: Response) => {
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
};

export const postEspIdKey = async (req: Request, res: Response) => {
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
};

export const getEspIssues = async (req: Request, res: Response) => {
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
      home: {
        select: {
          id: true,
          name: true,
          owner: { select: { username: true } },
        },
      },
    },
    orderBy: { lastSeen: "asc" },
    take: 500,
  });
  const now = Date.now();
  const DAY = 86_400_000;
  const issues = esps.map((e) => {
    const expectedName = e.serialCode && e.ssid ? `${e.serialCode} · ${e.ssid}` : null;
    const nameMismatch =
      !!e.name && !!expectedName && e.name !== expectedName && e.name.includes(" · ");
    const lastSeenMs = e.lastSeen ? e.lastSeen.getTime() : null;
    const staleDays = lastSeenMs ? Math.floor((now - lastSeenMs) / DAY) : null;
    const stale = e.offline && (lastSeenMs === null || now - lastSeenMs > DAY);
    return {
      id: e.id,
      homeId: e.homeId,
      macAddress: e.macAddress,
      name: e.name,
      expectedName,
      nameMismatch,
      ssid: e.ssid,
      serialCode: e.serialCode,
      modelCode: e.modelCode,
      ipAddress: e.ipAddress,
      firmwareVersion: e.firmwareVersion,
      lastSeen: e.lastSeen,
      offline: e.offline,
      stale,
      staleDays,
      home: e.home ? { id: e.home.id, name: e.home.name, owner: e.home.owner?.username ?? null } : null,
    };
  });
  // Sirf asli issues — mismatch ya stale. Online + sahi naam wale boards yahan nahi aate.
  const filtered = issues.filter((i) => i.nameMismatch || i.stale);
  // Pehle mismatch wale, phir sabse purane stale boards
  filtered.sort((a, b) => {
    if (a.nameMismatch !== b.nameMismatch) return a.nameMismatch ? -1 : 1;
    return (a.staleDays ?? 0) - (b.staleDays ?? 0);
  });
  ok(res, {
    issues: filtered,
    mismatchCount: filtered.filter((i) => i.nameMismatch).length,
    staleCount: filtered.filter((i) => i.stale).length,
  });
};

export const patchEspId = async (req: Request, res: Response) => {
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
};

export const getEspIdHistory = async (req: Request, res: Response) => {
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
};

export const getFirmware = async (_req: Request, res: Response) => {
  const versions = await prisma.firmwareVersion.findMany({ orderBy: { createdAt: "desc" } });
  const current = versions.find((v) => v.isCurrent) ?? null;
  ok(res, { versions, current });
};

export const postFirmware = async (req: Request, res: Response) => {
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
};

export const postFirmwareIdActivate = async (req: Request, res: Response) => {
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
};

export const postDevicesIdStatus = async (req: Request, res: Response) => {
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
};

export const getDevicesIdSupport = async (req: Request, res: Response) => {
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
};

export const postEspIdRotateConsolePassword = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const crypto = await import("node:crypto");
  const newPass = crypto.randomBytes(4).toString("hex");

  const esp = await prisma.espDevice.findUnique({ where: { id } });
  if (!esp) throw new AppError("NOT_FOUND", "ESP not found", 404);

  await prisma.espDevice.update({
    where: { id },
    data: { consolePassword: newPass },
  });

  // Dynamic import since it's used only here to avoid circular dep issues
  const { mqttPushRotatePassword } = await import("../services/mqtt.service");
  mqttPushRotatePassword(esp.macAddress, newPass);

  await audit(req.user!.sub, "admin.esp.rotate_password", {
    entity: "esp",
    entityId: id,
    meta: { macAddress: esp.macAddress, newPass },
  });

  ok(res, { id, newPass });
};

export const postDevicesIdClearCommands = async (req: Request, res: Response) => {
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
};

export const postDevicesIdPushOta = async (req: Request, res: Response) => {
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
};

export const postDevicesPushOtaAll = async (req: Request, res: Response) => {
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
};

export const getEspIdProbe = async (req: Request, res: Response) => {
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
};

export const getProducts = async (_req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { serials: true } }, media: { orderBy: { id: "asc" } } },
    });
    ok(res, products);
  } catch (err) {
    const products = await prisma.product.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { serials: true } } },
    });
    ok(res, products.map((p) => ({ ...p, media: [] })));
  }
};

export const postProducts = async (req: Request, res: Response) => {
  const { name, modelCode, relayCount, price, description, features, imageUrl, stockCount, upcoming } = req.body ?? {};
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
      stockCount: stockCount != null ? Number(stockCount) : 0,
      upcoming: upcoming != null ? Boolean(upcoming) : false,
    },
  });
  await audit(req.user!.sub, "admin.product.create", { entity: "product", entityId: product.id, meta: { modelCode } });
  ok(res, product, 201);
};

export const patchProductsId = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, price, description, features, imageUrl, active, stockCount, upcoming } = req.body ?? {};
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: name != null ? String(name).slice(0, 100) : undefined,
      price: price != null ? Number(price) : undefined,
      description: description != null ? String(description) : undefined,
      features: features ? (typeof features === "string" ? JSON.parse(features) : features) : undefined,
      imageUrl: imageUrl != null ? String(imageUrl).slice(0, 255) : undefined,
      stockCount: stockCount != null ? Number(stockCount) : undefined,
      active: active != null ? Boolean(active) : undefined,
      upcoming: upcoming != null ? Boolean(upcoming) : undefined,
    },
  });
  await audit(req.user!.sub, "admin.product.update", { entity: "product", entityId: id });
  ok(res, product);
};

export const deleteProductsId = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await prisma.product.delete({ where: { id } });
  await audit(req.user!.sub, "admin.product.delete", { entity: "product", entityId: id });
  ok(res, { deleted: true });
};

export const postProductsIdMedia = async (req: Request, res: Response) => {
  const productId = Number(req.params.id);
  if (!req.file) throw new AppError("BAD_REQUEST", "No file uploaded");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError("NOT_FOUND", "Product not found");
  const fileUrl = req.file.path; // Cloudinary secure URL
  const ext = path.extname(req.file.originalname).toLowerCase();
  const type = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext) ? "image"
    : [".mp4", ".webm", ".mov"].includes(ext) ? "video"
    : "document";
  const media = await prisma.productMedia.create({
    data: { productId, url: fileUrl, type },
  });
  await audit(req.user!.sub, "admin.product.media.add", { entity: "product", entityId: productId, meta: { mediaId: media.id } });
  ok(res, media, 201);
};

export const deleteProductsMediaMediaId = async (req: Request, res: Response) => {
  const mediaId = Number(req.params.mediaId);
  const media = await prisma.productMedia.findUnique({ where: { id: mediaId } });
  if (!media) throw new AppError("NOT_FOUND", "Media not found");
  const filePath = path.join(process.cwd(), media.url.replace(/^\/+/, ""));
  try { fs.unlinkSync(filePath); } catch { /* file may not exist */ }
  await prisma.productMedia.delete({ where: { id: mediaId } });
  await audit(req.user!.sub, "admin.product.media.delete", { entity: "product", entityId: media.productId ?? undefined, meta: { mediaId } });
  ok(res, { deleted: true });
};

export const getOrders = async (req: Request, res: Response) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const orders = await prisma.order.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      items: true,
      serials: { select: { serialCode: true, testedAt: true } },
      user: { select: { id: true, username: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  ok(res, orders);
};

export const getOrdersId = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      serials: { select: { serialCode: true, testedAt: true } },
      user: { select: { id: true, username: true, email: true } },
    },
  });
  if (!order) throw new AppError("NOT_FOUND", "Order not found");
  // Bill QR ke liye HMAC-signed verify token — public verify page isi se khulta hai.
  ok(res, { ...order, verifyToken: signBillToken(order.id) });
};

export const patchOrdersIdStatus = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  const order = await updateOrderStatus(id, status);
  await audit(req.user!.sub, `admin.order.${status}`, {
    entity: "order",
    entityId: id,
    meta: { orderNumber: order.orderNumber },
  });
  ok(res, order);
};

export const patchOrdersIdPaymentStatus = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const paymentStatus = String(req.body?.paymentStatus ?? "");
  const order = await prisma.order.update({
    where: { id },
    data: {
      paymentStatus,
      paidAt: paymentStatus === "paid" ? new Date() : null
    }
  });
  await audit(req.user!.sub, `admin.order.payment.${paymentStatus}`, {
    entity: "order",
    entityId: id,
    meta: { orderNumber: order.orderNumber },
  });
  ok(res, order);
};

export const getSerials = async (req: Request, res: Response) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  const orderId = req.query.orderId ? Number(req.query.orderId) : undefined;
  const serials = await prisma.serialRegistry.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(productId ? { productId } : {}),
      ...(orderId ? { orderId } : {}),
    },
    select: {
      id: true,
      serialCode: true,
      productId: true,
      orderId: true,
      userId: true,
      homeId: true,
      status: true,
      createdAt: true,
      claimedAt: true,
      testedAt: true,
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
};

export const getSerialsCode = async (req: Request, res: Response) => {
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
};

export const postSerialsGenerate = async (req: Request, res: Response) => {
  const productId = Number(req.body?.productId);
  const count = Number(req.body?.count ?? 10);
  const codes = await generateSerials(productId, count);
  await audit(req.user!.sub, "admin.serial.generate", {
    entity: "product",
    entityId: productId,
    meta: { count, codes: codes.slice(0, 5) },
  });
  ok(res, { generated: codes.length, codes }, 201);
};

export const deleteSerialsCode = async (req: Request, res: Response) => {
  const code = String(req.params.code ?? "").trim().toUpperCase();
  const serial = await prisma.serialRegistry.findUnique({ where: { serialCode: code } });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");
  if (serial.status !== "available") {
    throw new AppError("BAD_REQUEST", "Sirf available serials delete ho sakte hain");
  }
  await prisma.serialRegistry.delete({ where: { id: serial.id } });
  await audit(req.user!.sub, "admin.serial.delete", {
    entity: "serial",
    entityId: serial.id,
    meta: { serialCode: code },
  });
  ok(res, { deleted: true });
};

export const deleteSerials = async (req: Request, res: Response) => {
  const codes = req.body?.codes;
  if (!Array.isArray(codes) || codes.length === 0) {
    throw new AppError("BAD_REQUEST", "codes array required");
  }
  if (codes.length > 500) {
    throw new AppError("BAD_REQUEST", "Ek baar me max 500 serials delete kar sakte ho");
  }
  const upperCodes = codes.map((c: string) => String(c).trim().toUpperCase());
  const serials = await prisma.serialRegistry.findMany({
    where: { serialCode: { in: upperCodes } },
  });
  const available = serials.filter((s) => s.status === "available");
  const skipped = upperCodes.length - available.length;
  if (available.length === 0) {
    throw new AppError("BAD_REQUEST", "Koi available serial nahi mila delete karne ke liye");
  }
  await prisma.serialRegistry.deleteMany({
    where: { id: { in: available.map((s) => s.id) } },
  });
  await audit(req.user!.sub, "admin.serial.bulk_delete", {
    entity: "serial",
    meta: { count: available.length, skipped, codes: upperCodes.slice(0, 10) },
  });
  ok(res, { deleted: available.length, skipped });
};

export const postOrdersIdSerialsGenerate = async (req: Request, res: Response) => {
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
};

export const getOrdersIdProvision = async (req: Request, res: Response) => {
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
};

export const postSerialsCodeMarkTested = async (req: Request, res: Response) => {
  const code = String(req.params.code).trim().toUpperCase();
  const { consolePassword } = req.body ?? {};

  const serial = await prisma.serialRegistry.findUnique({ where: { serialCode: code } });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");

  const updated = await prisma.serialRegistry.update({
    where: { id: serial.id },
    data: {
      testedAt: new Date(),
      consolePassword: consolePassword ? String(consolePassword) : undefined
    },
  });
  await audit(req.user!.sub, "admin.serial.tested", {
    entity: "serial",
    entityId: serial.id,
    meta: { serialCode: code, hasConsolePassword: !!consolePassword },
  });

  // Serial order se linked hai to user ko notify — "tested, ab pack hone chala".
  if (serial.orderId) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: serial.orderId },
        include: { items: true, serials: { select: { testedAt: true } } },
      });
      if (order && order.status === "processing") { // Only process if currently in 'processing/testing' phase
        // Notification
        await createNotification(order.userId, {
          category: "system",
          type: "info",
          title: "✅ Factory test pass",
          body: `Aapka board (${code}) factory relay self-test pass kar chuka hai. Order ${order.orderNumber}.`,
        });

        // Pack auto-cascade validation
        const qtyRequired = order.items.reduce((sum, item) => sum + item.quantity, 0);
        const testedCount = order.serials.filter(s => s.testedAt !== null).length;

        // If we have met or exceeded the quantity with valid tests, mark packed.
        if (testedCount >= qtyRequired) {
          // Inside shop.service this emits the final summary PACKED notification.
          await updateOrderStatus(order.id, "packed");
        }
      }
    } catch (err) {
      console.error("[admin] tested notification/cascade failed", err);
    }
  }

  ok(res, { tested: true, serialCode: code, testedAt: updated.testedAt });
};

export const getWarranty = async (_req: Request, res: Response) => {
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
};

export const patchWarrantyIdStatus = async (req: Request, res: Response) => {
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
};

export const getContact = async (_req: Request, res: Response) => {
  const msgs = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, username: true, email: true, role: true } } },
  });
  ok(res, msgs);
};

export const patchContactIdStatus = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!["new", "read", "done"].includes(status)) throw new AppError("BAD_REQUEST", "Status new | read | done");
  const updated = await prisma.contactMessage.update({ where: { id }, data: { status } });
  ok(res, updated);
};

export const deleteContactId = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await prisma.contactMessage.delete({ where: { id } });
  ok(res, { deleted: true });
};

export const postReset = async (req: Request, res: Response) => {
  const { mode } = req.body as { mode: "data" | "factory" };

  const ALL_TABLES = [
    "api_keys", "app_meta", "assistant_chats", "assistant_messages", "audit_logs",
    "contact_messages", "coupons", "device_access", "device_commands", "device_configurations",
    "device_logs", "device_usage", "devices", "esp_devices", "firmware_versions",
    "home_members", "homes", "invitations", "notifications", "order_items", "orders",
    "products", "refresh_tokens", "rooms", "schedules", "serial_registry",
    "support_calls", "support_chat_settings", "support_messages", "users", "warranty_claims",
  ];
  // "data" mode me yeh tables waise ki waise rehti hain (admin login + catalog + firmware).
  const KEEP_IN_DATA = new Set(["products", "app_meta", "users", "firmware_versions", "coupons"]);

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
};

export const getApkStatus = async (_req: Request, res: Response) => {
  try {
    const settings = await getSiteSettings();
    
    // Check candidate APK file paths
    const candidatePaths = [
      path.join(webPublicMobileAppDir, "SwitchNest_Latest.apk"),
      path.join(mobileAppDir, "SwitchNest_Latest.apk"),
    ];

    let fileInfo = { exists: false, sizeMb: "0", modifiedAt: null as string | null };

    for (const targetPath of candidatePaths) {
      if (fs.existsSync(targetPath)) {
        const stats = fs.statSync(targetPath);
        fileInfo = {
          exists: true,
          sizeMb: (stats.size / (1024 * 1024)).toFixed(1),
          modifiedAt: stats.mtime.toISOString(),
        };
        break;
      }
    }

    ok(res, {
      version: settings.mobileAppVersion || "1.0.11",
      minVersion: settings.mobileAppMinVersion || "1.0.0",
      releaseNotes: settings.mobileAppReleaseNotes || "",
      updateMessage: settings.mobileAppUpdateMessage || "",
      isMandatory: settings.mobileAppIsMandatory === true,
      fileInfo,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message || "Failed to fetch APK status" } });
  }
};

export const postApkUpload = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: "No APK file provided in request." } });
    }

    const { version, releaseNotes, updateMessage, isMandatory, minVersion } = req.body;
    const cleanVersion = (version || "1.0.11").trim();

    const uploadedPath = req.file.path;
    const latestApkPath = path.join(webPublicMobileAppDir, "SwitchNest_Latest.apk");
    const versionedApkPath = path.join(webPublicMobileAppDir, `SwitchNest_v${cleanVersion}.apk`);

    // Copy to web public mobile-app directory
    fs.copyFileSync(uploadedPath, latestApkPath);
    fs.copyFileSync(uploadedPath, versionedApkPath);

    // Also copy to root mobile-app directory if exists
    if (fs.existsSync(mobileAppDir)) {
      try {
        fs.copyFileSync(uploadedPath, path.join(mobileAppDir, "SwitchNest_Latest.apk"));
        fs.copyFileSync(uploadedPath, path.join(mobileAppDir, `SwitchNest_v${cleanVersion}.apk`));
      } catch (e) {
        console.warn("[apk-upload] mobileAppDir copy warning:", e);
      }
    }

    try { fs.unlinkSync(uploadedPath); } catch {}

    // Update Site Settings with new mobile app version info
    const updatedSettings = await updateSiteSettings({
      mobileAppVersion: cleanVersion,
      mobileAppMinVersion: minVersion || "1.0.0",
      mobileAppReleaseNotes: releaseNotes || "",
      mobileAppUpdateMessage: updateMessage || `New SwitchNest v${cleanVersion} is ready!`,
      mobileAppIsMandatory: isMandatory === "true" || isMandatory === true,
    });

    const stats = fs.statSync(latestApkPath);

    await audit(req.user!.sub, "admin.apk_upload", {
      entity: "mobile_app",
      meta: { version: cleanVersion, sizeMb: (stats.size / (1024 * 1024)).toFixed(1) }
    });

    ok(res, {
      message: `Successfully published Mobile APK v${cleanVersion}`,
      version: updatedSettings.mobileAppVersion,
      sizeMb: (stats.size / (1024 * 1024)).toFixed(1),
      modifiedAt: stats.mtime.toISOString(),
    });
  } catch (e: any) {
    console.error("[apk-upload] Error processing APK upload:", e);
    res.status(500).json({ success: false, error: { message: e.message || "Failed to upload APK file" } });
  }
};

export const getCoupons = async (req: Request, res: Response) => {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  ok(res, coupons);
};

export const postCoupons = async (req: Request, res: Response) => {
  const { code, discountType, discountValue, minOrderAmount, maxDiscount, usageLimit, expiresAt, active } = req.body ?? {};
  if (!code || !discountValue) throw new AppError("BAD_REQUEST", "code and discountValue are required");
  const coupon = await prisma.coupon.create({
    data: {
      code: String(code).trim().toUpperCase(),
      discountType: discountType === "fixed" ? "fixed" : "percentage",
      discountValue: Number(discountValue),
      minOrderAmount: minOrderAmount ? Number(minOrderAmount) : null,
      maxDiscount: maxDiscount ? Number(maxDiscount) : null,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      active: active != null ? Boolean(active) : true,
    },
  });
  await audit(req.user!.sub, "admin.coupon.create", { entity: "coupon", entityId: coupon.id, meta: { code } });
  ok(res, coupon, 201);
};

export const patchCouponsId = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { active, code, discountType, discountValue, minOrderAmount, maxDiscount, usageLimit } = req.body ?? {};
  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      active: active != null ? Boolean(active) : undefined,
      code: typeof code === "string" ? code : undefined,
      discountType: typeof discountType === "string" ? discountType : undefined,
      discountValue: discountValue !== undefined ? String(discountValue) : undefined,
      minOrderAmount: minOrderAmount !== undefined ? (minOrderAmount ? String(minOrderAmount) : null) : undefined,
      maxDiscount: maxDiscount !== undefined ? (maxDiscount ? String(maxDiscount) : null) : undefined,
      usageLimit: usageLimit !== undefined ? (usageLimit ? Number(usageLimit) : null) : undefined,
    },
  });
  await audit(req.user!.sub, "admin.coupon.update", { entity: "coupon", entityId: id });
  ok(res, coupon);
};

export const deleteCouponsId = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await prisma.coupon.delete({ where: { id } });
  await audit(req.user!.sub, "admin.coupon.delete", { entity: "coupon", entityId: id });
  ok(res, { deleted: true });
};

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
    }): string {
    const L: string[] = [];
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

