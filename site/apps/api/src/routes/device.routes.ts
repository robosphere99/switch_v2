import { Router } from "express";
import { z } from "zod";
import * as deviceController from "../controllers/device.controller";
import { ok } from "../lib/response";
import { requireAuth } from "../middleware/auth";
import { requireHomeMember } from "../middleware/requireRole";
import { validateBody, validateParams } from "../middleware/validate";
import { getUsageAnalytics } from "../services/analytics.service";

export const deviceRouter = Router();

const idParams = z.object({ homeId: z.coerce.number().int().positive() });
const deviceParams = z.object({
  homeId: z.coerce.number().int().positive(),
  deviceId: z.coerce.number().int().positive(),
});

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["bulb", "fan", "ac", "tv", "plug", "custom"]),
  roomId: z.coerce.number().int().positive().optional(),
  serialNumber: z.string().min(1).max(64).optional(),
});

const statusSchema = z.object({ status: z.enum(["on", "off"]) });
const bulkStatusSchema = z.object({
  deviceIds: z.array(z.number().int().positive()).min(1).max(50),
  status: z.enum(["on", "off"]),
});
const espNameSchema = z.object({ name: z.string().min(1).max(60) });
const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  roomId: z.coerce.number().int().positive().nullable().optional(),
});

deviceRouter.get(
  "/:homeId/devices",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("viewer"),
  deviceController.list,
);
deviceRouter.post(
  "/:homeId/devices",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("admin"),
  validateBody(createSchema),
  deviceController.create,
);
deviceRouter.post(
  "/:homeId/devices/bulk-status",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("member"),
  validateBody(bulkStatusSchema),
  deviceController.bulkSetStatus,
);
deviceRouter.patch(
  "/:homeId/devices/:deviceId",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("admin"),
  validateBody(updateSchema),
  deviceController.update,
);
deviceRouter.get(
  "/:homeId/devices/:deviceId/logs",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("viewer"),
  deviceController.logs,
);
deviceRouter.post(
  "/:homeId/devices/:deviceId/status",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("member"),
  validateBody(statusSchema),
  deviceController.setStatus,
);
deviceRouter.delete(
  "/:homeId/devices/:deviceId",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("admin"),
  deviceController.remove,
);

/** User apne home ke ESP board ka naam rename karo (unique naam rule). */
deviceRouter.post(
  "/:homeId/devices/:deviceId/ota",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("admin"),
  deviceController.requestOta,
);

deviceRouter.patch(
  "/:homeId/esp/:espId",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("admin"),
  validateBody(espNameSchema),
  deviceController.renameEsp,
);

/** Usage analytics — device_logs se (toggles/day, on-time per device, per member). */
deviceRouter.get(
  "/:homeId/analytics/usage",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("viewer"),
  async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
    ok(res, await getUsageAnalytics(Number(req.params.homeId), days));
  },
);
