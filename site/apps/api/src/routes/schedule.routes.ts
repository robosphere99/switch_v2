import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireHomeMember } from "../middleware/requireRole";
import { validateBody, validateParams } from "../middleware/validate";
import * as scheduleController from "../controllers/schedule.controller";

export const scheduleRouter = Router();

const homeParams = z.object({ homeId: z.coerce.number().int().positive() });
const scheduleParams = z.object({
  homeId: z.coerce.number().int().positive(),
  scheduleId: z.coerce.number().int().positive(),
});

const createSchema = z.object({
  deviceId: z.number().int().positive(),
  action: z.enum(["on", "off"]),
  type: z.enum(["once", "daily", "weekly", "cron"]),
  runAt: z.string().datetime({ offset: true }).optional().nullable(),
  cron: z
    .string()
    .regex(/^(\S+\s){4}\S+$/, "Cron must have 5 fields: minute hour day-of-month month day-of-week")
    .optional()
    .nullable(),
});

const updateSchema = z
  .object({
    action: z.enum(["on", "off"]).optional(),
    enabled: z.boolean().optional(),
    runAt: z.string().datetime({ offset: true }).optional().nullable(),
    cron: z
      .string()
      .regex(/^(\S+\s){4}\S+$/, "Cron must have 5 fields")
      .optional()
      .nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, "At least one field to update is required");

scheduleRouter.post(
  "/:homeId/schedules",
  requireAuth,
  validateParams(homeParams),
  requireHomeMember("member"),
  validateBody(createSchema),
  scheduleController.createSchedule,
);

scheduleRouter.get(
  "/:homeId/schedules",
  requireAuth,
  validateParams(homeParams),
  requireHomeMember("viewer"),
  scheduleController.listSchedules,
);

scheduleRouter.patch(
  "/:homeId/schedules/:scheduleId",
  requireAuth,
  validateParams(scheduleParams),
  requireHomeMember("member"),
  validateBody(updateSchema),
  scheduleController.updateSchedule,
);

scheduleRouter.delete(
  "/:homeId/schedules/:scheduleId",
  requireAuth,
  validateParams(scheduleParams),
  requireHomeMember("member"),
  scheduleController.deleteSchedule,
);
