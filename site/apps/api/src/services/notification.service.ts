import { prisma } from "../lib/prisma";
import { emitToUser } from "../lib/socket";
import { sendNotificationEmail } from "../lib/email.service";
import type { Prisma } from "@prisma/client";
import {
  buildNotificationDraft,
  type NotificationCategory,
  type NotificationType,
} from "@robosphere/shared";
import { buildNotificationWhere, normalizeCategory } from "./notificationQuery";

export interface CreateNotificationInput {
  category?: NotificationCategory;
  type?: NotificationType;
  title: string;
  body?: string;
}

/**
 * Draft text body me hi bhejo — frontend aur backend ek hi source (shared builders).
 * Body ka shape: {"t": <display text>, "u": <userId>, "d": "<draft>"}
 * (support notifications me u hota hai; draft nahi bana to purana body as-is rehta hai).
 */
export function attachDraftToBody(body: string | null, title: string): string | null {
  const draft = buildNotificationDraft({ category: "", title, body });
  if (!draft) return body;
  let parsed: { u?: unknown; t?: unknown } = {};
  if (body) {
    try {
      const o = JSON.parse(body) as { u?: unknown; t?: unknown };
      if (o && typeof o === "object") parsed = o;
    } catch {
      /* plain text body */
    }
  }
  const t = typeof parsed.t === "string" ? parsed.t : body ?? "";
  return JSON.stringify({
    t,
    ...(typeof parsed.u === "number" ? { u: parsed.u } : {}),
    d: draft,
  });
}

/** Create a notification for a user and push it to their live socket. */
export async function createNotification(userId: number, input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      category: input.category ?? "system",
      type: input.type ?? "info",
      title: input.title,
      body: attachDraftToBody(input.body ?? null, input.title),
    },
  });
  emitToUser(userId, "notification:new", notification);

  import("./push.service").then(({ sendPushToUser }) => {
    let plaintext = input.body || "";
    try {
      const p = JSON.parse(plaintext);
      if (p.t) plaintext = p.t;
    } catch { /* parse ignore */ }
    let pushCat: "device" | "system" | "support" | "power" | "order" | "promo" | "security" = "system";
    const c = (input.category as string) ?? "system";
    if (c === "auth" || c === "security") pushCat = "security";
    else if (c === "shop" || c === "order") pushCat = "order";
    else if (c === "hardware" || c === "offline") pushCat = "power";
    else if (c === "support") pushCat = "support";
    else if (c === "promo") pushCat = "promo";
    else if (c === "device") pushCat = "device";
    
    sendPushToUser(userId, input.title, plaintext, undefined, pushCat);
  }).catch(console.error);

  return notification;
}

/**
 * In-app notification + best-effort EMAIL (Phase 6) — order, warranty, offline
 * alerts ke liye. Email kabhi fail nahi karta (SMTP na ho to silent skip).
 */
export async function createNotificationWithEmail(
  userId: number,
  input: CreateNotificationInput,
  opts: { emailSubject?: string; emailBody?: string; ctaUrl?: string; ctaLabel?: string } = {},
) {
  const notification = await createNotification(userId, input);
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true },
    });
    if (user?.email) {
      await sendNotificationEmail({
        to: user.email,
        userName: user.username,
        title: opts.emailSubject ?? input.title,
        body: opts.emailBody ?? input.body ?? input.title,
        ctaUrl: opts.ctaUrl,
        ctaLabel: opts.ctaLabel,
      });
    }
  } catch (err) {
    // Email failure se notification/order kabhi fail na ho.
    console.error(`[notify+email] email failed for user ${userId}:`, err instanceof Error ? err.message : err);
  }
  return notification;
}

export type ListNotificationsArgs = import("./notificationQuery").NotificationListArgs;

export interface NotificationPage {
  items: Array<{
    id: number;
    userId: number;
    category: string;
    type: string;
    title: string;
    body: string | null;
    readAt: Date | null;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listNotifications(userId: number, args: ListNotificationsArgs = {}): Promise<NotificationPage> {
  const page = Math.max(1, Math.floor(args.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(args.pageSize ?? 20)));
  const where = buildNotificationWhere(userId, args) as Prisma.NotificationWhereInput;

  const [raw, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);
  // Read-time normalization — badge/filter ke liye effective category.
  const items = raw.map((n) => ({ ...n, category: normalizeCategory(n.category, n.title) }));
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Ek notification delete karo (sirf apna). */
export async function remove(userId: number, notificationId: number) {
  await prisma.notification.deleteMany({ where: { id: notificationId, userId } });
  emitToUser(userId, "notification:deleted", { id: notificationId });
  return { ok: true };
}

export async function removeAll(userId: number) {
  await prisma.notification.deleteMany({ where: { userId } });
  emitToUser(userId, "notification:updated", { all: true });
  return { ok: true };
}

export async function unreadCount(userId: number) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: number, notificationId: number) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
  emitToUser(userId, "notification:updated", { id: notificationId });
  return { ok: true };
}

export async function markAllRead(userId: number) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  emitToUser(userId, "notification:updated", { all: true });
  return { ok: true };
}
