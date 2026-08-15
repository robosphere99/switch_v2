import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { prisma } from "../lib/prisma";
import { AppError, ok } from "../lib/response";
import { createNotification } from "../services/notification.service";
import { emitToUser } from "../lib/socket";

export const supportRouter = Router();

/** Attachment validation — photo/invoice/screenshot, max ~2MB. */
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = /^(image\/(png|jpe?g|gif|webp|heic)|application\/pdf|text\/plain)$/;

const attachmentFields = {
  attachmentName: z.string().trim().min(1).max(255).optional(),
  attachmentType: z.string().trim().min(1).max(100).optional(),
  attachmentData: z.string().min(1).optional(),
};

function refineAttachment(
  d: { attachmentName?: string; attachmentType?: string; attachmentData?: string },
  ctx: z.RefinementCtx,
): void {
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

const msgSelect = {
  id: true,
  userId: true,
  senderRole: true,
  senderName: true,
  message: true,
  attachmentName: true,
  attachmentType: true,
  attachmentData: true,
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
  if (unread > 0) {
    await prisma.supportMessage.updateMany({
      where: { userId, readByAdmin: false },
      data: { readByAdmin: true },
    });
  }
  ok(res, { userId, unread, messages: msgs });
});

const adminSendSchema = z
  .object({
    userId: z.number().int().positive(),
    message: z.string().trim().max(4000),
    ...attachmentFields,
  })
  .superRefine((d, ctx) => {
    if (!d.message && !d.attachmentData) {
      ctx.addIssue({ code: "custom", path: ["message"], message: "Message ya file required" });
    }
    refineAttachment(d, ctx);
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
      attachmentName: req.body.attachmentName ?? null,
      attachmentType: req.body.attachmentType ?? null,
      attachmentData: req.body.attachmentData ?? null,
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
const userSendSchema = z
  .object({
    message: z.string().trim().max(4000),
    ...attachmentFields,
  })
  .superRefine((d, ctx) => {
    if (!d.message && !d.attachmentData) {
      ctx.addIssue({ code: "custom", path: ["message"], message: "Message ya file required" });
    }
    refineAttachment(d, ctx);
  });

supportRouter.post("/messages", requireAuth, validateBody(userSendSchema), async (req, res) => {
  const userId = req.user!.sub;
  const created = await prisma.supportMessage.create({
    data: {
      userId,
      senderRole: "user",
      senderName: req.user!.username,
      message: req.body.message,
      attachmentName: req.body.attachmentName ?? null,
      attachmentType: req.body.attachmentType ?? null,
      attachmentData: req.body.attachmentData ?? null,
      readByUser: true,
      readByAdmin: false,
    },
  });
  // Admin ko realtime + notification — taaki navbar badge turant update ho
  const admin = await prisma.user.findFirst({
    where: { role: "system_admin" },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (admin) {
    await createNotification(admin.id, {
      category: "support",
      type: "info",
      title: "📨 User ne support me reply kiya",
      body: (req.body.message || "").slice(0, 200),
    });
    emitToUser(admin.id, "support:new", { senderRole: "user", message: created });
  }
  ok(res, created, 201);
});

/** Admin: unread support messages count (admin badge). */
supportRouter.get("/admin/unread-count", requireAuth, async (req, res) => {
  if (req.user!.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  // Defensive: agar Prisma client purana generate hua ho (model missing) to crash mat karo.
  if (!prisma.supportMessage) return ok(res, { unread: 0 });
  const unread = await prisma.supportMessage.count({ where: { readByAdmin: false } });
  ok(res, { unread });
});
