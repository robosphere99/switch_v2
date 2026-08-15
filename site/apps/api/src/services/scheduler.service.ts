import { prisma } from "../lib/prisma";
import { computeNextRun } from "./schedule.service";
import { audit } from "./audit.service";
import { emitToHome } from "../lib/socket";
import { createNotification } from "./notification.service";
import { fileLog } from "../lib/logger";

let timer: NodeJS.Timeout | null = null;
let running = false;

const CHECK_INTERVAL_MS = 10_000; // every 10s

/** Start the background scheduler. Idempotent. */
export function startScheduler(): void {
  if (timer) return;
  timer = setInterval(runDueSchedules, CHECK_INTERVAL_MS);
  // Kick off once immediately so newly created schedules fire fast in tests.
  void runDueSchedules();
  console.log("[scheduler] started (every 10s)");
  fileLog("[scheduler] started (every 10s)");
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function runDueSchedules(): Promise<void> {
  if (running) return;
  running = true;
  fileLog(`[scheduler] tick ${new Date().toISOString()} start`);
  try {
    const now = new Date();
    const due = await prisma.schedule.findMany({
      where: { enabled: true, nextRun: { lte: now } },
      include: { device: true },
      take: 100,
    });

    for (const sched of due) {
      try {
        await fireSchedule(sched.id);
      } catch (err) {
        console.error(`[scheduler] failed to fire schedule ${sched.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] tick error:", err);
    fileLog(`[scheduler] tick ERROR: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    running = false;
    fileLog(`[scheduler] tick ${new Date().toISOString()} done`);
  }
}

async function fireSchedule(scheduleId: number): Promise<void> {
  const sched = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { device: true },
  });
  if (!sched || !sched.enabled) return;

  const firedAt = new Date();

  // Apply the action: set device status + create command + log, atomically.
  await prisma.$transaction([
    prisma.device.update({
      where: { id: sched.device.id },
      data: { status: sched.action },
    }),
    prisma.deviceCommand.create({
      data: {
        deviceId: sched.device.id,
        actorId: null,
        command: `set_status:${sched.action}`,
      },
    }),
    prisma.deviceLog.create({
      data: {
        deviceId: sched.device.id,
        actorId: null,
        logType: "schedule",
        logMessage: `Scheduled turn ${sched.action} (schedule #${sched.id})`,
      },
    }),
  ]);

  // Compute the next run (once schedules become disabled).
  const nextRun = computeNextRun({
    type: sched.type,
    runAt: sched.runAt,
    cron: sched.cron,
    from: firedAt,
  });

  await prisma.schedule.update({
    where: { id: sched.id },
    data: {
      lastRun: firedAt,
      nextRun,
      enabled: sched.type === "once" ? false : sched.enabled,
    },
  });

  await audit(null, "schedule.fire", {
    homeId: sched.device.homeId,
    entity: "schedule",
    entityId: sched.id,
    meta: { deviceId: sched.device.id, deviceName: sched.device.name, action: sched.action },
  });

  emitToHome(sched.device.homeId, "device:updated", {
    id: sched.device.id,
    status: sched.action,
    via: "schedule",
  });

  if (sched.createdBy) {
    await createNotification(sched.createdBy, {
      type: "info",
      title: `⏰ Schedule fired: ${sched.device.name} ${sched.action.toUpperCase()}`,
      body: `Schedule #${sched.id} ne ${sched.device.name} ko ${sched.action} kiya.`,
    });
  }

  console.log(
    `[scheduler] fired schedule #${sched.id}: ${sched.device.name} -> ${sched.action} (next: ${nextRun?.toISOString() ?? "never"})`,
  );
}
