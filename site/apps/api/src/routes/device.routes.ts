import { Router } from "express";
import { z } from "zod";
import * as deviceController from "../controllers/device.controller";
import { requireAuth } from "../middleware/auth";
import { requireHomeMember } from "../middleware/requireRole";
import { validateBody, validateParams } from "../middleware/validate";

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
