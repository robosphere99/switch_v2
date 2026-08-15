import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateParams } from "../middleware/validate";
import { ok } from "../lib/response";
import * as notificationService from "../services/notification.service";

export const notificationRouter = Router();

notificationRouter.get("/", requireAuth, async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  const category = String(req.query.category ?? "all");
  const type = String(req.query.type ?? "all");
  const unread = req.query.unread === "1" || req.query.unread === "true";
  ok(
    res,
    await notificationService.listNotifications(req.user!.sub, { page, pageSize, category, type, unread }),
  );
});

notificationRouter.get("/unread-count", requireAuth, async (req, res) => {
  ok(res, await notificationService.unreadCount(req.user!.sub));
});

notificationRouter.post("/read-all", requireAuth, async (req, res) => {
  ok(res, await notificationService.markAllRead(req.user!.sub));
});

const idParams = z.object({ id: z.coerce.number().int().positive() });

notificationRouter.post("/:id/read", requireAuth, validateParams(idParams), async (req, res) => {
  ok(res, await notificationService.markRead(req.user!.sub, Number(req.params.id)));
});

notificationRouter.delete("/:id", requireAuth, validateParams(idParams), async (req, res) => {
  ok(res, await notificationService.remove(req.user!.sub, Number(req.params.id)));
});
