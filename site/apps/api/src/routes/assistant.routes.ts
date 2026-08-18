import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody, validateParams } from "../middleware/validate";
import { rateLimit } from "../middleware/rateLimit";
import { ok } from "../lib/response";
import { prisma } from "../lib/prisma";
import * as assistantService from "../services/assistant.service";

export const assistantRouter = Router();

// Assistant endpoints — LLM configured ho to har message ka cost hai,
// isliye message/confirm pe tight limits (per IP).
const chatCreateLimiter = rateLimit({
  name: "assistant:create",
  windowMs: 60 * 60_000,
  max: 30,
  message: "Bahut zyada chats — 1 ghanta baad try karo",
});
const messageLimiter = rateLimit({
  name: "assistant:message",
  windowMs: 60_000,
  max: 20,
  message: "Bahut fast messages — thodi der ruk kar bhejo",
});
const confirmLimiter = rateLimit({
  name: "assistant:confirm",
  windowMs: 60_000,
  max: 30,
  message: "Bahut zyada confirm requests — thodi der baad try karo",
});

const chatParams = z.object({ chatId: z.coerce.number().int().positive() });

const createSchema = z.object({
  homeId: z.number().int().positive(),
  title: z.string().max(100).optional(),
});

const messageSchema = z.object({ content: z.string().min(1).max(2000) });

const confirmSchema = z.object({ messageId: z.number().int().positive() });

/** Returns the membership of `userId` in `homeId`, or null. */
async function membership(userId: number, homeId: number) {
  return prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId } },
  });
}

// Create a chat for a home (any member of that home)
assistantRouter.post("/chats", chatCreateLimiter, requireAuth, validateBody(createSchema), async (req, res) => {
  const { homeId, title } = req.body;
  const member = await membership(req.user!.sub, homeId);
  if (!member) {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not a member of this home" } });
  }
  ok(res, await assistantService.createChat(req.user!.sub, homeId, title), 201);
});

// List my chats
assistantRouter.get("/chats", requireAuth, async (req, res) => {
  ok(res, await assistantService.listChats(req.user!.sub));
});

// Send a message (any member of the chat's home)
assistantRouter.post(
  "/chats/:chatId/messages",
  messageLimiter,
  requireAuth,
  validateParams(chatParams),
  validateBody(messageSchema),
  async (req, res) => {
    const result = await assistantService.sendMessage(req.user!.sub, Number(req.params.chatId), req.body.content);
    const member = await membership(req.user!.sub, result.chat.homeId);
    if (!member) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not a member of this home" } });
    }
    ok(res, result);
  },
);

// Confirm a proposal (member+ can execute)
assistantRouter.post(
  "/chats/:chatId/confirm",
  confirmLimiter,
  requireAuth,
  validateParams(chatParams),
  validateBody(confirmSchema),
  async (req, res) => {
    const chat = await assistantService.getChat(req.user!.sub, Number(req.params.chatId));
    if (!chat) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Chat not found" } });
    }
    const member = await membership(req.user!.sub, chat.homeId);
    if (!member) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not a member of this home" } });
    }
    ok(res, await assistantService.confirmProposal(req.user!.sub, Number(req.params.chatId), req.body.messageId));
  },
);

// Chat messages history
assistantRouter.get("/chats/:chatId/messages", requireAuth, validateParams(chatParams), async (req, res) => {
  const chat = await assistantService.getChat(req.user!.sub, Number(req.params.chatId));
  if (!chat) {
    return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Chat not found" } });
  }
  const messages = await assistantService.listMessages(chat.id);
  ok(
    res,
    messages.map((m) => {
      if (m.role !== "assistant") return m;
      const { text, proposal } = assistantService.decodeAssistantContent(m.content);
      return { ...m, content: text, proposal };
    }),
  );
});
