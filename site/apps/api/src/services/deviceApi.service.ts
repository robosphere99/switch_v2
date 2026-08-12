import type { ApiKey, DeviceStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";
import { emitToHome } from "../lib/socket";

/** The home a device API key is scoped to. */
function homeScope(key: ApiKey): number {
  if (!key.homeId) {
    throw new AppError("KEY_NOT_SCOPED", "API key is not scoped to a home", 400);
  }
  return key.homeId;
}

/** All devices of the key's home. Also marks them "alive" (lastSeen). */
export async function readAll(key: ApiKey) {
  const homeId = homeScope(key);
  const devices = await prisma.device.findMany({
    where: { homeId },
    orderBy: { createdAt: "desc" },
  });
  // Mark alive + clear offline flags (device is polling us right now).
  const result = await prisma.device
    .updateMany({ where: { homeId }, data: { lastSeen: new Date(), offline: false } })
    .catch(() => null);
  if (result?.count) {
    const offlineDevices = devices.filter((d) => d.offline);
    for (const d of offlineDevices) {
      emitToHome(homeId, "device:updated", { id: d.id, offline: false, lastSeen: new Date().toISOString() });
    }
  }
  return devices;
}

/**
 * Physical switch → server. Sets the status WITHOUT enqueueing a command
 * (the state is coming FROM the device, not from the web app).
 */
export async function updateFromDevice(key: ApiKey, deviceId: number, status: DeviceStatus) {
  const homeId = homeScope(key);

  const device = await prisma.device.findFirst({ where: { id: deviceId, homeId } });
  if (!device) {
    throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  }

  await prisma.$transaction([
    prisma.device.update({
      where: { id: deviceId },
      data: { status, lastSeen: new Date(), offline: false },
    }),
    prisma.deviceLog.create({
      data: {
        deviceId,
        actorId: null,
        logType: "status_change",
        logMessage: `Device switched ${status} (physical switch)`,
      },
    }),
  ]);

  const updated = await prisma.device.findUnique({ where: { id: deviceId } });
  if (updated) emitToHome(homeId, "device:updated", updated);
  return updated;
}

/** ESP OTA progress report (called from Update.onProgress during download/flash). */
export async function reportOtaProgress(
  key: ApiKey,
  input: { device_id: number; progress: number; status?: string },
) {
  const homeId = homeScope(key);
  const device = await prisma.device.findFirst({
    where: { id: input.device_id, homeId },
  });
  if (!device) {
    throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  }
  const progress = Math.max(0, Math.min(100, Math.round(input.progress)));
  const status = input.status ?? null;
  if (device.espId) {
    const esp = await prisma.espDevice.update({
      where: { id: device.espId },
      data: { otaProgress: progress, otaStatus: status, lastSeen: new Date(), offline: false },
    });
    emitToHome(homeId, "esp:updated", esp);
  }
  const updated = await prisma.device.update({
    where: { id: device.id },
    data: { otaProgress: progress, otaStatus: status, lastSeen: new Date(), offline: false },
  });
  emitToHome(homeId, "device:updated", updated);
  return { progress, status };
}

export interface HeartbeatInput {
  device_id: number;
  ip?: string;
  fw_version?: string;
  mac?: string;
  ssid?: string;
  serial?: string;
  model?: string;
  states?: string;
}

/**
 * ESP heartbeat. The ESP reports itself (IP, firmware version) plus the
 * ACTUAL state of each relay it controls (2-way sync: toggles done on the
 * ESP side — web panel or physical switch — mirror into the DB). If the
 * admin pushed an OTA update for this device, the response includes an
 * `ota` instruction with the firmware .bin URL.
 */
export async function heartbeat(
  key: ApiKey,
  input: HeartbeatInput,
  baseUrl: string,
) {
  const homeId = homeScope(key);

  const device = await prisma.device.findFirst({
    where: { id: input.device_id, homeId },
  });
  if (!device) {
    throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  }

  const fw = input.fw_version?.trim() || undefined;
  const ip = input.ip?.trim() || undefined;
  const mac = input.mac?.trim() || undefined;
  const ssid = input.ssid?.trim() || undefined;
  const serial = input.serial?.trim().toUpperCase() || undefined;
  const model = input.model?.trim().toUpperCase() || undefined;

  // ---- ESP board identity: ek row per PHYSICAL board (MAC se) ----
  // ESP har heartbeat pe apna MAC + WiFi naam (SSID) bhejta hai — yahan
  // board create/update hota hai aur uske under saare mapped devices link.
  let esp: { id: number; macAddress: string; name: string | null; ssid: string | null; serialCode: string | null; modelCode: string | null; ipAddress: string | null; firmwareVersion: string | null; otaPendingVersion: string | null } | null = null;
  const macKey = mac ? mac.replace(/[^0-9A-Fa-f:]/g, "").toLowerCase() : "";
  if (macKey) {
    esp = await prisma.espDevice.upsert({
      where: { macAddress: macKey },
      create: {
        homeId,
        macAddress: macKey,
        name: ssid || `ESP-${macKey.replace(/:/g, "").slice(-6).toUpperCase()}`,
        ssid,
        serialCode: serial,
        modelCode: model,
        ipAddress: ip,
        firmwareVersion: fw,
        lastSeen: new Date(),
        offline: false,
      },
      update: {
        homeId,
        ssid: ssid ?? undefined,
        serialCode: serial ?? undefined,
        modelCode: model ?? undefined,
        ipAddress: ip ?? undefined,
        firmwareVersion: fw ?? undefined,
        lastSeen: new Date(),
        offline: false,
      },
    });
    emitToHome(homeId, "esp:updated", esp);
  }

  const data: Prisma.DeviceUpdateInput = {
    lastSeen: new Date(),
    offline: false,
  };
  if (ip) data.ipAddress = ip;
  if (fw) data.firmwareVersion = fw;
  if (esp) data.esp = { connect: { id: esp.id } };

  // ESP confirmed it now runs the pushed version -> clear pending push + progress.
  const pendingVer = esp ? esp.otaPendingVersion : (device.otaPendingVersion ?? null);
  if (fw && pendingVer && fw === pendingVer) {
    if (esp) {
      await prisma.espDevice.update({
        where: { id: esp.id },
        data: { otaPendingVersion: null, otaRequestedAt: null, otaProgress: null, otaStatus: null },
      });
    }
    data.otaPendingVersion = null;
    data.otaRequestedAt = null;
    data.otaProgress = null;
    data.otaStatus = null;
  }

  const updated = await prisma.device.update({ where: { id: device.id }, data });
  if (device.offline) {
    emitToHome(homeId, "device:updated", updated);
  }

  // Relay state sync — the ESP's physical relays are the source of truth.
  // Saare states wale device ids bhi is ESP ke under link ho jaate hain.
  let synced = 0;
  const controlledIds: number[] = [device.id];
  if (input.states && input.states.trim()) {
    let states: Array<{ id: number; status: DeviceStatus; value?: string }> = [];
    try {
      const parsed: unknown = JSON.parse(input.states);
      if (Array.isArray(parsed)) states = parsed as Array<{ id: number; status: DeviceStatus; value?: string }>;
    } catch {
      states = [];
    }
    for (const st of states) {
      if (!st || typeof st.id !== "number" || (st.status !== "on" && st.status !== "off")) {
        continue;
      }
      // dimmer value (33/66/100...) customValue me store — dashboard dikha sakta hai
      const value = typeof st.value === "string" && /^\d+$/.test(st.value) ? st.value : undefined;
      const res = await prisma.device.updateMany({
        where: { id: st.id, homeId },
        data: {
          status: st.status,
          ...(value ? { customValue: value } : {}),
          lastSeen: new Date(),
          offline: false,
        },
      });
      if (res.count > 0) {
        synced++;
        controlledIds.push(st.id);
        emitToHome(homeId, "device:updated", { id: st.id, status: st.status });
      }
    }
  }

  // Sab controlled devices ko is ESP board se link karo.
  if (esp) {
    await prisma.device.updateMany({
      where: { homeId, id: { in: [...new Set(controlledIds)] } },
      data: { espId: esp.id },
    });
  }

  // OTA: pending push sirf tab jab ESP already current version pe na ho.
  // Board ke model ke hisaab se firmware resolve hota hai (model-specific > universal).
  const { resolveFirmware } = await import("./firmware.service");
  const current = await resolveFirmware(esp?.modelCode);
  const running = fw ?? updated.firmwareVersion ?? device.firmwareVersion;
  const pendingNow = esp ? esp.otaPendingVersion : (updated.otaPendingVersion ?? device.otaPendingVersion);
  let ota: { version: string; url: string; releaseNotes: string | null; required: true } | null = null;
  if (pendingNow && current && running !== current.version) {
    ota = {
      version: current.version,
      url: baseUrl + current.url,
      releaseNotes: current.releaseNotes,
      required: true,
    };
  }

  return {
    device: updated,
    esp: esp
      ? { id: esp.id, macAddress: esp.macAddress, name: esp.name, ssid: esp.ssid, serialCode: esp.serialCode, modelCode: esp.modelCode, ipAddress: esp.ipAddress, firmwareVersion: esp.firmwareVersion }
      : null,
    synced,
    ota,
  };
}

/** Pending commands for the key's home — polled by the ESP32. */
export async function pendingCommands(key: ApiKey) {
  const homeId = homeScope(key);
  const commands = await prisma.deviceCommand.findMany({
    where: { device: { homeId }, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  await prisma.device
    .updateMany({ where: { homeId }, data: { lastSeen: new Date() } })
    .catch(() => undefined);
  return commands;
}

/** Mark a command executed/failed (the ESP32 confirms it applied the state). */
export async function ackCommand(
  key: ApiKey,
  commandId: number,
  deviceId: number,
  status: "executed" | "failed",
) {
  const homeId = homeScope(key);

  const command = await prisma.deviceCommand.findFirst({
    where: { id: commandId, deviceId },
    include: { device: true },
  });
  if (!command) {
    throw new AppError("COMMAND_NOT_FOUND", "Command not found", 404);
  }
  if (command.device.homeId !== homeId) {
    throw new AppError("FORBIDDEN", "Command does not belong to this home", 403);
  }
  if (command.status !== "pending") {
    // Already processed — idempotent no-op.
    return command;
  }

  const updated = await prisma.deviceCommand.update({
    where: { id: commandId },
    data: { status, executedAt: new Date() },
  });
  emitToHome(homeId, "command:updated", { id: commandId, status, executedAt: updated.executedAt });
  return updated;
}
