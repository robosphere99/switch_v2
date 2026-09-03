import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import multer from "multer";
import path from "path";
import fs from "fs";
import { attachmentDir } from "../lib/paths";
import * as supportController from "../controllers/support.controller";

export const supportRouter = Router();

try {
  if (!fs.existsSync(attachmentDir)) {
    fs.mkdirSync(attachmentDir, { recursive: true });
  }
} catch (e) {}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, attachmentDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

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

// Admin side
supportRouter.get("/admin/users", requireAuth, supportController.searchAdminUsers);
supportRouter.get("/admin/messages", requireAuth, supportController.getAdminThread);
supportRouter.post("/admin/messages", requireAuth, adminSendLimiter, validateBody(adminSendSchema), supportController.sendAdminMessage);
supportRouter.post("/admin/messages/media", requireAuth, adminSendLimiter, upload.single("file"), supportController.adminMediaMessage);
supportRouter.get("/admin/unread-count", requireAuth, supportController.getAdminUnreadCount);
supportRouter.get("/admin/conversations", requireAuth, supportController.getAdminConversations);
supportRouter.post("/admin/read-all", requireAuth, supportController.adminReadAll);
supportRouter.post("/admin/thread-read", requireAuth, supportController.adminThreadRead);
supportRouter.get("/admin/context", requireAuth, supportController.getAdminContext);
supportRouter.delete("/admin/messages/:id", requireAuth, supportController.deleteAdminMessage);
supportRouter.delete("/admin/messages", requireAuth, supportController.clearAdminThread);

// User side
supportRouter.get("/messages", requireAuth, supportController.getUserThread);
supportRouter.post("/messages", requireAuth, userSendLimiter, validateBody(userSendSchema), supportController.sendUserMessage);
supportRouter.post("/messages/media", requireAuth, userSendLimiter, upload.single("file"), supportController.userMediaMessage);
supportRouter.get("/attachment/:id", supportController.getAttachmentFile);
supportRouter.get("/settings", requireAuth, supportController.getChatSettings);
supportRouter.put("/settings/:peerUserId", requireAuth, supportController.updateChatSettings);
supportRouter.delete("/messages/:id", requireAuth, supportController.deleteUserMessage);
supportRouter.delete("/messages", requireAuth, supportController.clearUserThread);
