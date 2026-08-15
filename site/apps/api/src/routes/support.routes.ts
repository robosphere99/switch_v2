import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { prisma } from "../lib/prisma";
import { AppError, ok } from "../lib/response";
import { createNotification } from "../services/notification.service";
import { emitToUser } from "../lib/socket";

export const supportRouter = Router();

const msgSelect = {
  id: true,
  userId: true,
  senderRole: true,
  senderName: true,
  message: true,
  readByUser: true,
  readByAdmin: true,
  createdAt: true,
} as const;

// ---------- Admin side ----------

/** Admin: kisi user ka poora support thread. */
supportRouter.get("/admin/messages", requireAuth, async (req, res) => {
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId) || userId <= 0) throw new AppError("VALIDATION_ERROR", "userId required", 400);
  const msgs = await prisma.supportMessage.findMany({
    where: { userId },
    select: msgSelect,
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const unread = await prisma.supportMessage.count({ where: { userId, readByAdmin: false } });
  ok(res, { userId, unread, messages: msgs });
});

const adminSendSchema = z.object({
  userId: z.number().int().positive(),
  message: z.string().trim().min(1).max(4000),
});

/** Admin: user ko support message bhejo → user ko notification + realtime. */
supportRouter.post("/admin/messages", requireAuth, validateBody(adminSendSchema), async (req, res) => {
  if (req.user!.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const { userId, message } = req.body;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);

  const created = await prisma.supportMessage.create({
    data: {
      userId,
      senderRole: "admin",
      senderName: req.user!.username,
      message,
      readByUser: false,
      readByAdmin: true,
    },
  });

  await createNotification(userId, {
    category: "support",
    type: "info",
    title: "🛠️ Support ne message bheja",
    body: message.slice(0, 200),
  });
  emitToUser(userId, "support:new", { senderRole: "admin", message: created });

  ok(res, created, 201);
});

// ---------- User side ----------

/** User: apna support thread (read karte hi mark karo). */
supportRouter.get("/messages", requireAuth, async (req, res) => {
  const userId = req.user!.sub;
  const [messages, unreadCount] = await Promise.all([
    prisma.supportMessage.findMany({
      where: { userId },
      select: msgSelect,
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.supportMessage.count({ where: { userId, readByUser: false } }),
  ]);
  if (unreadCount > 0) {
    await prisma.supportMessage.updateMany({
      where: { userId, readByUser: false },
      data: { readByUser: true },
    });
  }
  ok(res, { unread: unreadCount, messages });
});

/** User: support ko reply karo. */
const userSendSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

supportRouter.post("/messages", requireAuth, validateBody(userSendSchema), async (req, res) => {
  const userId = req.user!.sub;
  const created = await prisma.supportMessage.create({
    data: {
      userId,
      senderRole: "user",
      senderName: req.user!.username,
      message: req.body.message,
      readByUser: true,
      readByAdmin: false,
    },
  });
  ok(res, created, 201);
});

/** Admin: unread support messages count (admin badge). */
supportRouter.get("/admin/unread-count", requireAuth, async (req, res) => {
  if (req.user!.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const unread = await prisma.supportMessage.count({ where: { readByAdmin: false } });
  ok(res, { unread });
});
