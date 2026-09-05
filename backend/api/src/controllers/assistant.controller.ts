import type { Request, Response } from "express";
import { ok } from "../lib/response";
import { prisma } from "../lib/prisma";
import * as assistantService from "../services/assistant.service";

async function membership(userId: number, homeId: number) {
  return prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId } },
  });
}

export async function createChat(req: Request, res: Response): Promise<void> {
  const { homeId, title } = req.body;
  const member = await membership(req.user!.sub, homeId);
  if (!member) {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not a member of this home" } });
    return;
  }
  const chat = await assistantService.createChat(req.user!.sub, homeId, title);
  ok(res, chat, 201);
}

export async function listChats(req: Request, res: Response): Promise<void> {
  const chats = await assistantService.listChats(req.user!.sub);
  ok(res, chats);
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const result = await assistantService.sendMessage(
    req.user!.sub,
    Number(req.params.chatId),
    req.body.content,
    req.body.replyToMessageId
  );
  const member = await membership(req.user!.sub, result.chat.homeId);
  if (!member) {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not a member of this home" } });
    return;
  }
  ok(res, result);
}

export async function confirmProposal(req: Request, res: Response): Promise<void> {
  const chat = await assistantService.getChat(req.user!.sub, Number(req.params.chatId));
  if (!chat) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Chat not found" } });
    return;
  }
  const member = await membership(req.user!.sub, chat.homeId);
  if (!member) {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not a member of this home" } });
    return;
  }
  const result = await assistantService.confirmProposal(req.user!.sub, Number(req.params.chatId), req.body.messageId);
  ok(res, result);
}

export async function listMessages(req: Request, res: Response): Promise<void> {
  const chat = await assistantService.getChat(req.user!.sub, Number(req.params.chatId));
  if (!chat) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Chat not found" } });
    return;
  }
  const messages = await assistantService.listMessages(chat.id);
  ok(
    res,
    messages.map((m) => {
      if (m.role !== "assistant") return m;
      const { text, proposal } = assistantService.decodeAssistantContent(m.content);
      return { ...m, content: text, proposal };
    })
  );
}
