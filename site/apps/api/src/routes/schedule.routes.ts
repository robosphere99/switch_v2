import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireHomeMember } from "../middleware/requireRole";
import { validateBody, validateParams } from "../middleware/validate";
import { ok } from "../lib/response";
import * as scheduleService from "../services/schedule.service";

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

// Create a schedule (admin/member of the home)
scheduleRouter.post(
  "/:homeId/schedules",
  requireAuth,
  validateParams(homeParams),
  requireHomeMember("member"),
  validateBody(createSchema),
  async (req, res) => {
    const { deviceId, action, type, runAt, cron } = req.body;
    const schedule = await scheduleService.createSchedule({
      homeId: Number(req.params.homeId),
      actorId: req.user!.sub,
      deviceId,
      action,
      type,
      runAt,
      cron: type === "cron" ? cron : null,
    });
    ok(res, schedule, 201);
  },
);

// List schedules of the home (any member)
scheduleRouter.get(
  "/:homeId/schedules",
  requireAuth,
  validateParams(homeParams),
  requireHomeMember("viewer"),
  async (req, res) => {
    ok(res, await scheduleService.listSchedules(Number(req.params.homeId)));
  },
);

// Update a schedule (enable/disable, change action or time)
scheduleRouter.patch(
  "/:homeId/schedules/:scheduleId",
  requireAuth,
  validateParams(scheduleParams),
  requireHomeMember("member"),
  validateBody(updateSchema),
  async (req, res) => {
    const updated = await scheduleService.updateSchedule(
      Number(req.params.homeId),
      Number(req.params.scheduleId),
      req.body,
    );
    ok(res, updated);
  },
);

// Delete a schedule
scheduleRouter.delete(
  "/:homeId/schedules/:scheduleId",
  requireAuth,
  validateParams(scheduleParams),
  requireHomeMember("member"),
  async (req, res) => {
    await scheduleService.deleteSchedule(Number(req.params.homeId), Number(req.params.scheduleId));
    ok(res, { message: "Schedule deleted" });
  },
);
