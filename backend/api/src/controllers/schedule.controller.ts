import type { Request, Response } from "express";
import { ok } from "../lib/response";
import * as scheduleService from "../services/schedule.service";

export async function createSchedule(req: Request, res: Response): Promise<void> {
  const { deviceId, action, type, runAt, cron } = req.body;
  const homeId = Number(req.params.homeId);
  const actorId = req.user!.sub;

  const schedule = await scheduleService.createSchedule({
    homeId,
    actorId,
    deviceId,
    action,
    type,
    runAt,
    cron: type === "cron" ? cron : null,
  });

  ok(res, schedule, 201);
}

export async function listSchedules(req: Request, res: Response): Promise<void> {
  const homeId = Number(req.params.homeId);
  const schedules = await scheduleService.listSchedules(homeId);
  ok(res, schedules);
}

export async function updateSchedule(req: Request, res: Response): Promise<void> {
  const homeId = Number(req.params.homeId);
  const scheduleId = Number(req.params.scheduleId);
  const actorId = req.user!.sub;

  const updated = await scheduleService.updateSchedule(homeId, scheduleId, actorId, req.body);
  ok(res, updated);
}

export async function deleteSchedule(req: Request, res: Response): Promise<void> {
  const homeId = Number(req.params.homeId);
  const scheduleId = Number(req.params.scheduleId);
  const actorId = req.user!.sub;

  await scheduleService.deleteSchedule(homeId, scheduleId, actorId);
  ok(res, { message: "Schedule deleted" });
}
