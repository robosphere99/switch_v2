import type { Request, Response } from "express";
import { ok } from "../lib/response";
import * as notificationService from "../services/notification.service";

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  const category = String(req.query.category ?? "all");
  const type = String(req.query.type ?? "all");
  const unread = req.query.unread === "1" || req.query.unread === "true";

  const result = await notificationService.listNotifications(req.user!.sub, {
    page,
    pageSize,
    category,
    type,
    unread,
  });
  ok(res, result);
}

export async function unreadCount(req: Request, res: Response): Promise<void> {
  const count = await notificationService.unreadCount(req.user!.sub);
  ok(res, count);
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  const result = await notificationService.markAllRead(req.user!.sub);
  ok(res, result);
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const result = await notificationService.markRead(req.user!.sub, id);
  ok(res, result);
}

export async function removeAll(req: Request, res: Response): Promise<void> {
  const result = await notificationService.removeAll(req.user!.sub);
  ok(res, result);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const result = await notificationService.remove(req.user!.sub, id);
  ok(res, result);
}
