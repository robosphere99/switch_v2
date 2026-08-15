import { prisma } from "../lib/prisma";
import { emitToUser } from "../lib/socket";
import type { Prisma } from "@prisma/client";
import type { NotificationCategory, NotificationType } from "@robosphere/shared";

export interface CreateNotificationInput {
  category?: NotificationCategory;
  type?: NotificationType;
  title: string;
  body?: string;
}

/** Create a notification for a user and push it to their live socket. */
export async function createNotification(userId: number, input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      category: input.category ?? "system",
      type: input.type ?? "info",
      title: input.title,
      body: input.body ?? null,
    },
  });
  emitToUser(userId, "notification:new", notification);
  return notification;
}

/**
 * Purani schedule notifications (category fix se pehle) DB me 'system' me hain.
 * Backfill boot pe unhe 'schedule' kar deta hai, par agar koi reh jaye (kisi bhi
 * wajah se) toh yahan READ TIME pe normalize karo — badge + filter dono sahi dikhenge,
 * DB state se independent.
 */
const SCHEDULE_TITLE_RE = /Schedule fired/i;

export function normalizeCategory(category: string, title: string): string {
  if (category === "system" && SCHEDULE_TITLE_RE.test(title ?? "")) return "schedule";
  return category;
}

export interface ListNotificationsArgs {
  page?: number;
  pageSize?: number;
  category?: string;
  type?: string;
  unread?: boolean;
}

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
  const where: Prisma.NotificationWhereInput = { userId };
  if (args.category && args.category !== "all") {
    if (args.category === "schedule") {
      // Normalized rows bhi Schedule filter me dikho: category=schedule ya
      // (category=system + schedule title).
      where.OR = [{ category: "schedule" }, { category: "system", title: { contains: "Schedule fired" } }];
    } else if (args.category === "system") {
      // System filter me normalized schedule rows na dikho.
      where.OR = [{ category: "system", NOT: { title: { contains: "Schedule fired" } } }];
    } else {
      where.category = args.category;
    }
  }
  if (args.type && args.type !== "all") where.type = args.type as NotificationType;
  if (args.unread) where.readAt = null;

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
  return { ok: true };
}

export async function markAllRead(userId: number) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
}
