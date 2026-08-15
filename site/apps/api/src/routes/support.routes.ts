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

/** Defensive: agar production pe Prisma client purana generate hua ho (model missing)
 *  to crash + IIS 500 page ki jagah clean error do. Root fix: npx prisma generate. */
function supportModel() {
  if (!prisma.supportMessage) {
    throw new AppError("INTERNAL", "Support module unavailable — Prisma client stale. Run: npx prisma generate in site/apps/api", 500);
  }
  return prisma.supportMessage;
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
  const msgs = await supportModel().findMany({
    where: { userId },
    select: msgSelect,
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const unread = await supportModel().count({ where: { userId, readByAdmin: false } });
  if (unread > 0) {
    await supportModel().updateMany({
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

  const created = await supportModel().create({
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

  // Body me JSON marker ({u: senderId, t: text}) — frontend isse user chat
  // kholne ke liye use karta hai. Display me sirf text dikhta hai.
  await createNotification(userId, {
    category: "support",
    type: "info",
    title: "🛠️ Support ne message bheja",
    body: JSON.stringify({ u: req.user!.sub, t: message.slice(0, 200) }),
  });
  emitToUser(userId, "support:new", { senderRole: "admin", message: created });

  ok(res, created, 201);
});

// ---------- User side ----------

/** User: apna support thread (read karte hi mark karo). */
supportRouter.get("/messages", requireAuth, async (req, res) => {
  const userId = req.user!.sub;
  const [messages, unreadCount] = await Promise.all([
    supportModel().findMany({
      where: { userId },
      select: msgSelect,
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    supportModel().count({ where: { userId, readByUser: false } }),
  ]);
  if (unreadCount > 0) {
    await supportModel().updateMany({
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
  const created = await supportModel().create({
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
    // JSON marker: u = reply karne wala user ka id — admin notification pe click
    // karne se usi user ka chat khul jayega (bell + /notifications dono me).
    await createNotification(admin.id, {
      category: "support",
      type: "info",
      title: "📨 User ne support me reply kiya",
      body: JSON.stringify({ u: req.user!.sub, t: (req.body.message || "").slice(0, 200) }),
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
  const unread = await supportModel().count({ where: { readByAdmin: false } });
  ok(res, { unread });
});

/** Admin: support conversations list (WhatsApp-style inbox) — ek row per user. */
supportRouter.get("/admin/conversations", requireAuth, async (req, res) => {
  if (req.user!.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  if (!prisma.supportMessage) return ok(res, { conversations: [], totalUnread: 0 });
  const recent = await supportModel().findMany({
    select: {
      id: true,
      userId: true,
      senderRole: true,
      message: true,
      attachmentName: true,
      readByAdmin: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  // Ek baar me aggregate — sabse recent message = preview, unread ka count per user.
  const byUser = new Map<number, { lastPreview: string; lastSenderRole: string; lastAt: Date; unread: number }>();
  for (const m of recent) {
    const cur = byUser.get(m.userId);
    const preview = m.message?.trim()
      ? m.message
      : m.attachmentName
        ? `📎 ${m.attachmentName}`
        : "(attachment)";
    if (!cur) {
      byUser.set(m.userId, {
        lastPreview: preview,
        lastSenderRole: m.senderRole,
        lastAt: m.createdAt,
        unread: m.readByAdmin ? 0 : 1,
      });
    } else if (!m.readByAdmin) {
      cur.unread += 1;
    }
  }
  const userIds = [...byUser.keys()];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, email: true },
        })
      : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const conversations = [...byUser.entries()]
    .map(([userId, c]) => ({
      userId,
      username: userMap.get(userId)?.username ?? "Unknown",
      email: userMap.get(userId)?.email ?? null,
      lastPreview: c.lastPreview.slice(0, 120),
      lastSenderRole: c.lastSenderRole,
      lastAt: c.lastAt,
      unreadCount: c.unread,
    }))
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
  const totalUnread = conversations.reduce((a, c) => a + c.unreadCount, 0);
  ok(res, { conversations, totalUnread });
});

/** Admin: saari support chats 'read' mark karo (badge hat jayega). */
supportRouter.post("/admin/read-all", requireAuth, async (req, res) => {
  if (req.user!.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  if (!prisma.supportMessage) return ok(res, { unread: 0 });
  await supportModel().updateMany({
    where: { readByAdmin: false },
    data: { readByAdmin: true },
  });
  ok(res, { unread: 0 });
});
