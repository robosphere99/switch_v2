import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateBody, validateParams } from "../middleware/validate";
import { rateLimit } from "../middleware/rateLimit";
import * as assistantController from "../controllers/assistant.controller";

export const assistantRouter = Router();

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

const messageSchema = z.object({ content: z.string().min(1).max(2000), replyToMessageId: z.number().int().positive().optional() });
const confirmSchema = z.object({ messageId: z.number().int().positive() });

assistantRouter.post("/chats", chatCreateLimiter, requireAuth, validateBody(createSchema), assistantController.createChat);
assistantRouter.get("/chats", requireAuth, assistantController.listChats);

assistantRouter.post(
  "/chats/:chatId/messages",
  messageLimiter,
  requireAuth,
  validateParams(chatParams),
  validateBody(messageSchema),
  assistantController.sendMessage,
);

assistantRouter.post(
  "/chats/:chatId/confirm",
  confirmLimiter,
  requireAuth,
  validateParams(chatParams),
  validateBody(confirmSchema),
  assistantController.confirmProposal,
);

assistantRouter.get("/chats/:chatId/messages", requireAuth, validateParams(chatParams), assistantController.listMessages);
