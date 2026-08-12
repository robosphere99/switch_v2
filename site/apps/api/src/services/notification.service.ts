import { prisma } from "../lib/prisma";
import { emitToUser } from "../lib/socket";
import type { NotificationType } from "@robosphere/shared";

export interface CreateNotificationInput {
  type?: NotificationType;
  title: string;
  body?: string;
}

/** Create a notification for a user and push it to their live socket. */
export async function createNotification(userId: number, input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type: input.type ?? "info",
      title: input.title,
      body: input.body ?? null,
    },
  });
  emitToUser(userId, "notification:new", notification);
  return notification;
}

export async function listNotifications(userId: number) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
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
