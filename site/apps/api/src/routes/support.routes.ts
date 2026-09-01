import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import { prisma } from "../lib/prisma";
import { AppError, ok } from "../lib/response";
import { createNotification } from "../services/notification.service";
import { emitToUser } from "../lib/socket";
import { saveAttachment, readAttachmentFile, deleteAttachmentFile } from "../lib/attachmentStore";
import { sendSupportReplyEmail } from "../lib/email.service";
import { env } from "../config/env";
import type { AccessTokenPayload } from "@robosphere/shared";
import multer from "multer";
import path from "path";
import fs from "fs";
import { attachmentDir } from "../lib/paths";

export const supportRouter = Router();

try {
  if (!fs.existsSync(attachmentDir)) {
    fs.mkdirSync(attachmentDir, { recursive: true });
  }
} catch (e) {}

const storage = multer.diskStorage({
  destination: attachmentDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}${ext}`);
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Support chat spam / flood se bachao — message send per IP.
const userSendLimiter = rateLimit({
  name: "support:user-send",
  windowMs: 60_000,
  max: 10,
  message: "Bahut fast messages bhej rahe ho — thodi der ruk kar bhejo",
});
const adminSendLimiter = rateLimit({
  name: "support:admin-send",
  windowMs: 60_000,
  max: 30,
  message: "Bahut fast messages bhej rahe ho — thodi der ruk kar bhejo",
});

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
  attachmentPath: true,
  readByUser: true,
  readByAdmin: true,
  deletedAt: true,
  createdAt: true,
} as const;

/** Kisi conversation ka mute/pin set karo (apne view ke liye). */
async function firstAdminId(): Promise<number | null> {
  const admin = await prisma.user.findFirst({
    where: { role: "system_admin" },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return admin?.id ?? null;
}

/** Muted hai? (notification suppress ke liye) — stale client pe false. */
async function isMuted(viewerId: number, peerUserId: number): Promise<boolean> {
  if (!prisma.supportChatSettings) return false;
  const s = await prisma.supportChatSettings
    .findUnique({
      where: { userId_peerUserId: { userId: viewerId, peerUserId } },
      select: { mutedAt: true },
    })
    .catch(() => null);
  return !!s?.mutedAt;
}

// ---------- Admin side ----------

/**
 * Admin: kisi bhi user ko dhoondo — naya chat shuru karne ke liye (user ne
 * pehle support me message nahi kiya ho to bhi). Username/email se search,
 * saath me thread info (kitne messages hain, aakhri kab).
 */
supportRouter.get("/admin/users", requireAuth, async (req, res) => {
  if (req.user!.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const q = String(req.query.q ?? "").trim().toLowerCase();
  if (q.length < 2) return ok(res, { users: [] });
  const users = await prisma.user.findMany({
    where: {
      OR: [{ username: { contains: q } }, { email: { contains: q } }],
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,

    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  const info = await supportModel().groupBy({
    by: ["userId"],
    where: { userId: { in: users.map((u) => u.id) }, deletedAt: null },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const infoMap = new Map(info.map((m) => [m.userId, { count: m._count._all, lastAt: m._max.createdAt }]));
  ok(
    res,
    users.map((u) => ({
      ...u,
      messageCount: infoMap.get(u.id)?.count ?? 0,
      lastMessageAt: infoMap.get(u.id)?.lastAt ?? null,
    })),
  );
});

/** Admin: kisi user ka poora support thread. */
supportRouter.get("/admin/messages", requireAuth, async (req, res) => {
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId) || userId <= 0) throw new AppError("VALIDATION_ERROR", "userId required", 400);
  const msgs = await supportModel().findMany({
    where: { userId, deletedAt: null },
    select: msgSelect,
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const unread = await supportModel().count({ where: { userId, readByAdmin: false, deletedAt: null } });
  if (unread > 0) {
    await supportModel().updateMany({
      where: { userId, readByAdmin: false, deletedAt: null },
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
supportRouter.post("/admin/messages", requireAuth, adminSendLimiter, validateBody(adminSendSchema), async (req, res) => {
  if (req.user!.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const { userId, message } = req.body;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, email: true } });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);

  const created = await supportModel().create({
    data: {
      userId,
      senderRole: "admin",
      senderName: req.user!.username,
      message,
      attachmentName: req.body.attachmentName ?? null,
      attachmentType: req.body.attachmentType ?? null,
      // Naya: file disk pe (hardware/attachments), DB me sirf path. Legacy rows me blob (attachment_data) rehta hai.
      attachmentData: null,
      attachmentPath: req.body.attachmentData
        ? saveAttachment(req.body.attachmentData, req.body.attachmentType, req.body.attachmentName)
        : null,
      readByUser: false,
      readByAdmin: true,
    },
  });

  // Body me JSON marker ({u: senderId, t: text}) — frontend isse user chat
  // kholne ke liye use karta hai. Display me sirf text dikhta hai.
  // Muted conversation → notification suppress (sirf bell; unread badge rehta hai).
  if (!(await isMuted(userId, req.user!.sub))) {
    await createNotification(userId, {
      category: "support",
      type: "info",
      title: "🛠️ Support ne message bheja",
      body: JSON.stringify({ u: req.user!.sub, t: message.slice(0, 200) }),
    });
  }
  // Sender (Admin) aur Recipient (User) dono ko emit karo taaki dono ke multi-session sync ho
  emitToUser(userId, "support:new", { senderRole: "admin", message: created });
  emitToUser(req.user!.sub, "support:new", { senderRole: "admin", message: created });

  // Email notification — user ko jab admin reply kare (SMTP configured ho to; nahi to skip)
  if (user.email) {
    void sendSupportReplyEmail({ to: user.email, userName: user.username, replyText: message });
  }

  ok(res, created, 201);
});

// ---------- User side ----------

/** User: apna support thread (read karte hi mark karo). */
supportRouter.get("/messages", requireAuth, async (req, res) => {
  const userId = req.user!.sub;
  const [messages, unreadCount] = await Promise.all([
    supportModel().findMany({
      where: { userId, deletedAt: null },
      select: msgSelect,
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    supportModel().count({ where: { userId, readByUser: false, deletedAt: null } }),
  ]);
  if (unreadCount > 0) {
    await supportModel().updateMany({
      where: { userId, readByUser: false, deletedAt: null },
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

supportRouter.post("/messages", requireAuth, userSendLimiter, validateBody(userSendSchema), async (req, res) => {
  const userId = req.user!.sub;
  const created = await supportModel().create({
    data: {
      userId,
      senderRole: "user",
      senderName: req.user!.username,
      message: req.body.message,
      attachmentName: req.body.attachmentName ?? null,
      attachmentType: req.body.attachmentType ?? null,
      // Naya: file disk pe (hardware/attachments), DB me sirf path.
      attachmentData: null,
      attachmentPath: req.body.attachmentData
        ? saveAttachment(req.body.attachmentData, req.body.attachmentType, req.body.attachmentName)
        : null,
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
    // Admin ne us user ka chat mute kiya ho to notification suppress.
    if (!(await isMuted(admin.id, req.user!.sub))) {
      await createNotification(admin.id, {
        category: "support",
        type: "info",
        title: "📨 User ne support me reply kiya",
        body: JSON.stringify({ u: req.user!.sub, t: (req.body.message || "").slice(0, 200) }),
      });
    }
    emitToUser(admin.id, "support:new", { senderRole: "user", message: created });
  }

  // Sender (User) ko bhi emit karo taaki uske web/mobile dono devices sync ho jayen
  emitToUser(userId, "support:new", { senderRole: "user", message: created });

  ok(res, created, 201);
});

// New media upload endpoint for USER
supportRouter.post("/messages/media", requireAuth, userSendLimiter, upload.single('file'), async (req, res) => {
  const userId = req.user!.sub;
  const message = req.body.message || '';

  if (!req.file && !message) {
    throw new AppError("VALIDATION_ERROR", "Message or file required", 400);
  }

  const created = await supportModel().create({
    data: {
      userId,
      senderRole: "user",
      senderName: req.user!.username,
      message: message,
      attachmentName: req.file?.originalname ?? null,
      attachmentType: req.file?.mimetype ?? null,
      attachmentData: null,
      attachmentPath: req.file?.filename ?? null, 
      readByUser: true,
      readByAdmin: false,
    },
  });

  const admin = await prisma.user.findFirst({
    where: { role: "system_admin" },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (admin) {
    if (!(await isMuted(admin.id, req.user!.sub))) {
      await createNotification(admin.id, {
        category: "support",
        type: "info",
        title: "📲 User ne support me media bheja",
        body: JSON.stringify({ u: req.user!.sub, t: "Media file uploaded" }),
      });
    }
    emitToUser(admin.id, "support:new", { senderRole: "user", message: created });
  }
  emitToUser(userId, "support:new", { senderRole: "user", message: created });

  ok(res, created, 201);
});

// New media upload endpoint for ADMIN
supportRouter.post("/admin/messages/media", requireAuth, adminSendLimiter, upload.single('file'), async (req, res) => {
  if (req.user!.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const userId = Number(req.body.userId);
  const message = req.body.message || '';

  if (!Number.isInteger(userId) || userId <= 0) throw new AppError("VALIDATION_ERROR", "Valid userId required", 400);
  if (!req.file && !message) throw new AppError("VALIDATION_ERROR", "Message or file required", 400);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, email: true } });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);

  const created = await supportModel().create({
    data: {
      userId,
      senderRole: "admin",
      senderName: req.user!.username,
      message: message,
      attachmentName: req.file?.originalname ?? null,
      attachmentType: req.file?.mimetype ?? null,
      attachmentData: null,
      attachmentPath: req.file?.filename ?? null,
      readByUser: false,
      readByAdmin: true,
    },
  });

  if (!(await isMuted(userId, req.user!.sub))) {
    await createNotification(userId, {
      category: "support",
      type: "info",
      title: "🎧 Support ne media bheja",
      body: JSON.stringify({ u: req.user!.sub, t: "Media file sent" }),
    });
  }

  emitToUser(userId, "support:new", { senderRole: "admin", message: created });
  emitToUser(req.user!.sub, "support:new", { senderRole: "admin", message: created });

  ok(res, created, 201);
});

/** Attachment file serve (disk se) — Authorization header ya ?token= (img src ke liye) dono accept.
 *  Owner user ya admin hi dekh sakta hai. Legacy rows (blob in DB) yahan nahi aate — wo data-URL se render hote hain. */
supportRouter.get("/attachment/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError("VALIDATION_ERROR", "Invalid attachment id", 400);

  const header = req.headers.authorization;
  const qToken = typeof req.query.token === "string" ? req.query.token : null;
  let payload: AccessTokenPayload | null = null;
  try {
    const raw = header?.startsWith("Bearer ") ? header.slice(7) : qToken;
    if (raw) payload = jwt.verify(raw, env.JWT_ACCESS_SECRET) as unknown as AccessTokenPayload;
  } catch {
    /* invalid token → 401 neeche */
  }
  if (!payload) throw new AppError("UNAUTHORIZED", "Missing bearer token", 401);

  const msg = await supportModel().findUnique({
    where: { id },
    select: { userId: true, attachmentPath: true, attachmentName: true, attachmentType: true, deletedAt: true },
  });
  if (!msg || msg.deletedAt || !msg.attachmentPath) throw new AppError("NOT_FOUND", "Attachment not found", 404);
  if (msg.userId !== payload.sub && payload.role !== "system_admin") {
    throw new AppError("FORBIDDEN", "Access denied", 403);
  }

  const buf = readAttachmentFile(msg.attachmentPath);
  if (!buf) throw new AppError("NOT_FOUND", "Attachment file missing", 404);
  const isImage = (msg.attachmentType ?? "").startsWith("image/");
  res.setHeader("Content-Type", msg.attachmentType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `${isImage ? "inline" : "attachment"}; filename="${encodeURIComponent(msg.attachmentName || "file")}"`,
  );
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(buf);
});

/**
 * Admin navbar badge — WhatsApp-style: unread CONVERSATIONS count (messages count nahi).
 * Ek user ne 5 messages bheje to badge "1" dikhega, "5" nahi. Deleted (soft) messages
 * count nahi hote — warna badge kabhi hat hi na (user delete kare to bhi badha rahta tha).
 */
supportRouter.get("/admin/unread-count", requireAuth, async (req, res) => {
  if (req.user!.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  // Defensive: agar Prisma client purana generate hua ho (model missing) to crash mat karo.
  if (!prisma.supportMessage) return ok(res, { unread: 0 });
  const groups = await supportModel().groupBy({
    by: ["userId"],
    where: { readByAdmin: false, deletedAt: null },
    _count: { _all: true },
  });
  ok(res, { unread: groups.length });
});

/** Admin: support conversations list (WhatsApp-style inbox) — ek row per user. */
supportRouter.get("/admin/conversations", requireAuth, async (req, res) => {
  if (req.user!.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  if (!prisma.supportMessage) return ok(res, { conversations: [], totalUnread: 0 });
  // Sirf live (non-deleted) messages — deleted wale na list me dikhen, na unread count me.
  const recent = await supportModel().findMany({
    where: { deletedAt: null },
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
  // Ek baar me aggregate — sabse recent live message = preview, unread ka count per user.
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
    where: { readByAdmin: false, deletedAt: null },
    data: { readByAdmin: true },
  });
  ok(res, { unread: 0 });
});

/** Admin: kisi EK user ki chat read/unread mark karo (context-menu se). */
supportRouter.post("/admin/thread-read", requireAuth, async (req, res) => {
  if (req.user!.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const userId = Number(req.body?.userId);
  const read = Boolean(req.body?.read);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError("VALIDATION_ERROR", "userId required", 400);
  }
  if (!prisma.supportMessage) return ok(res, { updated: 0 });
  const updated = await supportModel().updateMany({
    where: { userId, deletedAt: null, readByAdmin: read ? false : true },
    data: { readByAdmin: read },
  });
  ok(res, { updated: updated.count });
});

/** Admin: support inbox me user ka context — orders, homes, devices, ESP boards. */
supportRouter.get("/admin/context", requireAuth, async (req, res) => {
  if (req.user!.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError("VALIDATION_ERROR", "userId required", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,

    },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);

  const [memberships, orders] = await Promise.all([
    prisma.homeMember.findMany({
      where: { userId },
      select: {
        role: true,
        home: {
          select: {
            id: true,
            name: true,
            status: true,
            owner: { select: { id: true, username: true } },
            _count: { select: { devices: true, members: true, rooms: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.order.findMany({
      where: { userId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        shippingPhone: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const homeIds = memberships.map((m) => m.home.id);
  const [devices, esps] =
    homeIds.length > 0
      ? await Promise.all([
        prisma.device.findMany({
          where: { homeId: { in: homeIds } },
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            serialNumber: true,
            offline: true,
            lastSeen: true,
            room: { select: { name: true } },
            home: { select: { name: true } },
          },
          orderBy: { name: "asc" },
          take: 100,
        }),
        prisma.espDevice.findMany({
          where: { homeId: { in: homeIds } },
          select: {
            id: true,
            name: true,
            macAddress: true,
            serialCode: true,
            modelCode: true,
            firmwareVersion: true,
            offline: true,
            ipAddress: true,
            lastSeen: true,
            home: { select: { name: true } },
          },
          orderBy: { id: "asc" },
          take: 50,
        }),
      ])
      : [[], []];

  ok(res, {
    user,
    homes: memberships.map((m) => ({ ...m.home, memberRole: m.role })),
    devices,
    esps,
    orders,
  });
});

// ---------- Chat settings (mute / pin) + delete / clear ----------

/** Meri chat settings — admin ko saare users ke, user ko apna support-team peer. */
supportRouter.get("/settings", requireAuth, async (req, res) => {
  if (!prisma.supportChatSettings) return ok(res, { settings: [] });
  const settings = await prisma.supportChatSettings.findMany({
    where: { userId: req.user!.sub },
    select: { peerUserId: true, mutedAt: true, pinnedAt: true },
  });
  ok(res, { settings });
});

/** Conversation mute/pin toggle (apne view ke liye). */
supportRouter.put("/settings/:peerUserId", requireAuth, async (req, res) => {
  if (!prisma.supportChatSettings) throw new AppError("INTERNAL", "Chat settings unavailable — prisma client stale", 500);
  // User (non-admin) ka peer hamesha support team hota hai — param ignore karo.
  let peerUserId = Number(req.params.peerUserId);
  if (req.user!.role !== "system_admin") {
    peerUserId = (await firstAdminId()) ?? 0;
  }
  if (!Number.isInteger(peerUserId) || peerUserId <= 0) {
    throw new AppError("VALIDATION_ERROR", "peerUserId required", 400);
  }
  const { muted, pinned } = req.body as { muted?: boolean; pinned?: boolean };
  if (muted === undefined && pinned === undefined) {
    throw new AppError("VALIDATION_ERROR", "muted ya pinned required", 400);
  }
  const data: { mutedAt?: Date | null; pinnedAt?: Date | null } = {};
  if (typeof muted === "boolean") data.mutedAt = muted ? new Date() : null;
  if (typeof pinned === "boolean") data.pinnedAt = pinned ? new Date() : null;

  const setting = await prisma.supportChatSettings.upsert({
    where: { userId_peerUserId: { userId: req.user!.sub, peerUserId } },
    create: {
      userId: req.user!.sub,
      peerUserId,
      mutedAt: data.mutedAt ?? null,
      pinnedAt: data.pinnedAt ?? null,
    },
    update: data,
  });
  ok(res, setting);
});

/** User: apna message delete (soft — WhatsApp-style, dono side se gayab). */
supportRouter.delete("/messages/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const msg = await supportModel().findUnique({ where: { id } });
  if (!msg) throw new AppError("NOT_FOUND", "Message not found", 404);
  if (msg.userId !== req.user!.sub || msg.senderRole !== "user") {
    throw new AppError("FORBIDDEN", "Sirf apna message delete kar sakte ho", 403);
  }
  await supportModel().update({ where: { id }, data: { deletedAt: new Date() } });
  deleteAttachmentFile(msg.attachmentPath); // attachment file bhi disk se (soft-delete pe cleanup)
  ok(res, { deleted: true });
});

/** Admin: koi bhi message delete (moderation). */
supportRouter.delete("/admin/messages/:id", requireAuth, async (req, res) => {
  if (req.user!.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const id = Number(req.params.id);
  const msg = await supportModel().findUnique({ where: { id } });
  if (!msg) throw new AppError("NOT_FOUND", "Message not found", 404);
  await supportModel().update({ where: { id }, data: { deletedAt: new Date() } });
  deleteAttachmentFile(msg.attachmentPath);
  ok(res, { deleted: true });
});

/** User: apna poora support thread clear (soft). */
supportRouter.delete("/messages", requireAuth, async (req, res) => {
  const withFiles = await supportModel().findMany({
    where: { userId: req.user!.sub, deletedAt: null },
    select: { attachmentPath: true },
  });
  const r = await supportModel().updateMany({
    where: { userId: req.user!.sub, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  withFiles.forEach((m) => deleteAttachmentFile(m.attachmentPath));
  ok(res, { cleared: r.count });
});

/** Admin: kisi user ka poora thread clear. */
supportRouter.delete("/admin/messages", requireAuth, async (req, res) => {
  if (req.user!.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const userId = Number(req.query.peerUserId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError("VALIDATION_ERROR", "peerUserId required", 400);
  }
  const withFiles = await supportModel().findMany({
    where: { userId, deletedAt: null },
    select: { attachmentPath: true },
  });
  const r = await supportModel().updateMany({
    where: { userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  withFiles.forEach((m) => deleteAttachmentFile(m.attachmentPath));
  ok(res, { cleared: r.count });
});
