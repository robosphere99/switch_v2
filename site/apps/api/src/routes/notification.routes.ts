import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateParams } from "../middleware/validate";
import * as notificationController from "../controllers/notification.controller";

export const notificationRouter = Router();

notificationRouter.get("/", requireAuth, notificationController.listNotifications);
notificationRouter.get("/unread-count", requireAuth, notificationController.unreadCount);
notificationRouter.post("/read-all", requireAuth, notificationController.markAllRead);

const idParams = z.object({ id: z.coerce.number().int().positive() });

notificationRouter.post("/:id/read", requireAuth, validateParams(idParams), notificationController.markRead);
notificationRouter.delete("/delete-all", requireAuth, notificationController.removeAll);
notificationRouter.delete("/:id", requireAuth, validateParams(idParams), notificationController.remove);
