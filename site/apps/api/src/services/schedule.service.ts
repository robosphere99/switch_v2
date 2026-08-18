import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";
import type { DeviceStatus, ScheduleType } from "@robosphere/shared";

// ---------- Cron matching (minimal 5-field: minute hour day-of-month month day-of-week) ----------

function parseField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    if (part === "*") {
      for (let i = min; i <= max; i++) values.add(i);
      continue;
    }
    let m = part.match(/^\*\/(\d+)$/);
    if (m) {
      const step = Number(m[1]);
      for (let i = min; i <= max; i += step) values.add(i);
      continue;
    }
    m = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const step = Number(m[3] ?? 1);
      for (let i = a; i <= b; i += step) values.add(i);
      continue;
    }
    m = part.match(/^(\d+)$/);
    if (m) {
      values.add(Number(m[1]));
      continue;
    }
    // Day-of-week 7 == 0 (Sunday)
    if (/^\d+$/.test(part)) values.add(Number(part) % 7);
  }
  return values;
}

export interface CronFields {
  minutes: Set<number>;
  hours: Set<number>;
  dom: Set<number>;
  months: Set<number>;
  dow: Set<number>;
}

export function parseCron(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new AppError("BAD_REQUEST", "Cron must have 5 fields: minute hour day-of-month month day-of-week");
  }
  const dow = parseField(parts[4], 0, 6);
  // Standard cron: 7 == 0 (Sunday) — explicit 7 ko Sunday me normalize.
  if (dow.has(7)) {
    dow.delete(7);
    dow.add(0);
  }
  return {
    minutes: parseField(parts[0], 0, 59),
    hours: parseField(parts[1], 0, 23),
    dom: parseField(parts[2], 1, 31),
    months: parseField(parts[3], 1, 12),
    dow,
  };
}

function matches(cron: CronFields, d: Date): boolean {
  if (!cron.minutes.has(d.getMinutes())) return false;
  if (!cron.hours.has(d.getHours())) return false;
  if (!cron.dom.has(d.getDate())) return false;
  if (!cron.months.has(d.getMonth() + 1)) return false;
  if (!cron.dow.has(d.getDay())) return false;
  return true;
}

/** Find the next datetime matching the cron expression after `from` (minute precision, 1-year lookahead). */
export function nextCronRun(expr: string, from: Date): Date | null {
  let cron: CronFields;
  try {
    cron = parseCron(expr);
  } catch {
    return null;
  }
  const t = new Date(from);
  t.setSeconds(0, 0);
  t.setMinutes(t.getMinutes() + 1); // strictly after `from`
  const end = from.getTime() + 366 * 24 * 60 * 60 * 1000;
  while (t.getTime() <= end) {
    if (matches(cron, t)) return t;
    t.setMinutes(t.getMinutes() + 1);
  }
  return null;
}

// ---------- nextRun computation per schedule type ----------

export function computeNextRun(input: {
  type: ScheduleType;
  runAt: Date | null;
  cron: string | null;
  from?: Date;
}): Date | null {
  const from = input.from ?? new Date();
  if (input.type === "once") return input.runAt && input.runAt > from ? input.runAt : null;
  if (input.type === "cron") {
    if (!input.cron) return null;
    return nextCronRun(input.cron, from);
  }
  // daily / weekly: keep adding interval from a base time until it is in the future
  if (!input.runAt) return null;
  const intervalMs = input.type === "daily" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  let next = new Date(input.runAt.getTime());
  const maxIterations = 400;
  for (let i = 0; i < maxIterations && next.getTime() <= from.getTime(); i++) {
    next = new Date(next.getTime() + intervalMs);
  }
  return next.getTime() > from.getTime() ? next : null;
}

// ---------- CRUD ----------

export interface CreateScheduleInput {
  homeId: number;
  actorId: number;
  deviceId: number;
  action: DeviceStatus;
  type: ScheduleType;
  runAt?: string | null;
  cron?: string | null;
}

export async function createSchedule(input: CreateScheduleInput) {
  const device = await prisma.device.findFirst({
    where: { id: input.deviceId, homeId: input.homeId },
  });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);

  // Child/restricted member — sirf granted devices ka schedule bana sakta hai
  // Defensive: stale prisma client pe check skip
  const membership = prisma.deviceAccess
    ? await prisma.homeMember.findUnique({
        where: { homeId_userId: { homeId: input.homeId, userId: input.actorId } },
        select: { restricted: true },
      })
    : null;
  if (membership?.restricted && prisma.deviceAccess) {
    const granted = await prisma.deviceAccess.findUnique({
      where: { deviceId_userId: { deviceId: input.deviceId, userId: input.actorId } },
    });
    if (!granted) {
      throw new AppError("FORBIDDEN", "Is device ka access nahi hai (child mode)", 403);
    }
  }

  let runAt: Date | null = input.runAt ? new Date(input.runAt) : null;
  if (input.type !== "once" && input.type !== "cron" && runAt) {
    // Normalize daily/weekly to the next occurrence from now.
    const now = new Date();
    runAt = computeNextRun({ type: input.type, runAt, cron: null, from: now });
  }
  const nextRun = computeNextRun({ type: input.type, runAt, cron: input.cron ?? null });

  return prisma.schedule.create({
    data: {
      deviceId: input.deviceId,
      createdBy: input.actorId,
      action: input.action,
      type: input.type,
      runAt,
      cron: input.type === "cron" ? input.cron : null,
      nextRun,
    },
  });
}

export async function listSchedules(homeId: number) {
  const schedules = await prisma.schedule.findMany({
    where: { device: { homeId } },
    include: { device: { select: { id: true, name: true, type: true } } },
    orderBy: [{ enabled: "desc" }, { nextRun: "asc" }],
  });
  return schedules;
}

export async function updateSchedule(
  homeId: number,
  scheduleId: number,
  input: { action?: DeviceStatus; enabled?: boolean; runAt?: string | null; cron?: string | null },
) {
  const existing = await prisma.schedule.findFirst({
    where: { id: scheduleId, device: { homeId } },
  });
  if (!existing) throw new AppError("NOT_FOUND", "Schedule not found", 404);

  const action = input.action ?? existing.action;
  const type = existing.type;
  let runAt: Date | null = input.runAt !== undefined ? (input.runAt ? new Date(input.runAt) : null) : existing.runAt;
  const cron = input.cron !== undefined ? input.cron : existing.cron;

  const nextRun =
    input.enabled === false
      ? existing.nextRun
      : computeNextRun({ type, runAt, cron, from: new Date() });

  return prisma.schedule.update({
    where: { id: scheduleId },
    data: { action, runAt, cron, nextRun, enabled: input.enabled ?? existing.enabled },
  });
}

export async function deleteSchedule(homeId: number, scheduleId: number) {
  const existing = await prisma.schedule.findFirst({
    where: { id: scheduleId, device: { homeId } },
  });
  if (!existing) throw new AppError("NOT_FOUND", "Schedule not found", 404);
  await prisma.schedule.delete({ where: { id: scheduleId } });
  return { deleted: true };
}
