import type { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
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
import { sendEmail } from "../lib/email.service";
import { chatCompletion, getAiConfig, aiConfigured } from "../lib/ai";
import { requestPasswordReset } from "../services/auth.service";

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
  ok(res, {
    ...s,
    smtpPass: s.smtpPass ? "********" : "",
    smtpPassSet: !!s.smtpPass,
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
