import type { ApiKey, DeviceStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";
import { emitDeviceUpdated, emitToHome } from "../lib/socket";

/** The home a device API key is scoped to. */
function homeScope(key: ApiKey): number {
  if (!key.homeId) {
    throw new AppError("KEY_NOT_SCOPED", "API key is not scoped to a home", 400);
  }
  return key.homeId;
}

/** All devices of the key's home. Also marks them "alive" (lastSeen). */
export async function readAll(key: ApiKey, mac?: string) {
  const homeId = homeScope(key);

  if (mac) {
    const macKey = mac.replace(/[^0-9A-Fa-f:]/g, "").toLowerCase();
    const esp = await prisma.espDevice.findFirst({
      where: { homeId, macAddress: macKey }
    });
    if (!esp) return { states: [], led: 1 };

    // Cloud Mapping payload
    const devices = await prisma.device.findMany({
      where: { homeId, espId: esp.id },
      select: { channel: true, status: true }
    });

    const relayCount = esp.modelCode === "sn-r2" ? 2 : esp.modelCode === "sn-r1" ? 1 : 4;
    const states = new Array(relayCount).fill(0);
    const led = esp.ledEnabled ? 1 : 0;

    for (const d of devices) {
      if (d.channel != null && d.channel >= 1 && d.channel <= relayCount) {
        states[d.channel - 1] = d.status === "on" ? 1 : 0;
      }
    }

    await prisma.espDevice.update({
      where: { id: esp.id },
      data: { lastSeen: new Date(), offline: false }
    }).catch(() => null);

    return { states, led };
  }

  // Legacy sync
  const devices = await prisma.device.findMany({
    where: { homeId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true, offline: true }
  });
  // Mark alive + clear offline flags (device is polling us right now).
  const result = await prisma.device
    .updateMany({ where: { homeId }, data: { lastSeen: new Date(), offline: false } })
    .catch(() => null);
  if (result?.count) {
    const offlineDevices = devices.filter((d) => d.offline);
    for (const d of offlineDevices) {
      await emitDeviceUpdated(homeId, d.id);
    }
  }
  // Strip the 'offline' field to minimize JSON payload strictly for ESP
  return devices.map(d => ({ id: d.id, name: d.name, status: d.status }));
}

/**
 * Physical switch → server. Sets the status WITHOUT enqueueing a command
 * (the state is coming FROM the device, not from the web app).
 */
export async function updateFromDevice(key: ApiKey, deviceId: number | undefined, status: DeviceStatus, mac?: string, channel?: number) {
  const homeId = homeScope(key);

  let targetDeviceId = deviceId;
  if (mac && channel != null) {
    const esp = await prisma.espDevice.findFirst({ where: { homeId, macAddress: mac } });
    if (esp) {
      const dev = await prisma.device.findFirst({ where: { espId: esp.id, channel, homeId } });
      if (dev) targetDeviceId = dev.id;
    }
  }

  if (!targetDeviceId) {
    throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  }

  const device = await prisma.device.findFirst({ where: { id: targetDeviceId, homeId } });
  if (!device) {
    throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  }

  await prisma.$transaction([
    prisma.device.update({
      where: { id: targetDeviceId },
      data: { status, lastSeen: new Date(), offline: false },
    }),
    prisma.deviceLog.create({
      data: {
        deviceId: targetDeviceId,
        actorId: null,
        logType: "status_change",
        logMessage: `Device switched ${status} (physical switch)`,
      },
    }),
  ]);

  const updated = await prisma.device.findUnique({ where: { id: targetDeviceId } });
  if (updated) await emitDeviceUpdated(homeId, updated.id);
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
  await emitDeviceUpdated(homeId, updated.id);
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

  let device = undefined;
  if (input.device_id) {
    device = await prisma.device.findFirst({
      where: { id: input.device_id, homeId },
    });
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
  // Serial code sirf EK physical board se bind ho sakta hai (tracking/security).
  // Agar yeh serial kisi AUR board pe already hai, to is board pe attach mat karo —
  // board apna kaam phir bhi karega, par serial wahi rahega jis board ko mila.
  let attachSerial = serial;
  if (macKey && serial) {
    // ---- Web Activation Stub Absorption ----
    // Jab user website pe serial daalta hai, ek PENDING- MAC wala stub banta hai.
    // Jab board asli me online aata hai, ye block us stub ko asli MAC se swap karke bridge banata hai.
    const pendingStub = await prisma.espDevice.findUnique({
      where: { macAddress: `PENDING-${serial}` },
    });
    if (pendingStub) {
      const existingMac = await prisma.espDevice.findUnique({ where: { macAddress: macKey } });
      if (!existingMac) {
        await prisma.espDevice.update({
          where: { id: pendingStub.id },
          data: { macAddress: macKey }
        });
      } else {
        // Agar MAC already exist karta hai, usko stub delete karna padega 
        // phir niche ka upsert baaki fields natively push kar dega.
        await prisma.espDevice.delete({ where: { id: pendingStub.id } });
      }
    }

    const other = await prisma.espDevice.findFirst({
      where: { serialCode: serial, macAddress: { not: macKey } },
      select: { id: true },
    });
    if (other) attachSerial = undefined;
  }
  const macTail = macKey.replace(/:/g, "").slice(-6).toUpperCase();
  if (macKey) {
    // Purana row check — serial badla (factory/remote setserial) to naam bhi
    // refresh karna hoga, warna stale naam (purane serial/SSID wala) card pe
    // dikhta rehta hai. User-renamed boards sirf serial change pe overwrite
    // hote hain — baaki heartbeats par naam chuhta nahi.
    const existing = await prisma.espDevice.findFirst({
      where: { macAddress: macKey },
      select: { id: true, serialCode: true },
    });
    esp = await prisma.espDevice.upsert({
      where: { macAddress: macKey },
      create: {
        homeId,
        macAddress: macKey,
        // Unique + searchable naam: serial (product code) pehle, SSID baad me.
        // Serial na ho to MAC-tail se unique `ESP-XXXXXX` fallback.
        name: attachSerial
          ? `${attachSerial} · ${ssid ?? "SwitchNest"}`
          : ssid
            ? `${ssid} · ESP-${macTail}`
            : `ESP-${macTail}`,
        ssid,
        serialCode: attachSerial,
        modelCode: model,
        ipAddress: ip,
        firmwareVersion: fw,
        lastSeen: new Date(),
        offline: false,
      },
      update: {
        homeId,
        ssid: ssid ?? undefined,
        serialCode: attachSerial ?? undefined,
        modelCode: model ?? undefined,
        ipAddress: ip ?? undefined,
        firmwareVersion: fw ?? undefined,
        lastSeen: new Date(),
        offline: false,
        ...(attachSerial && existing?.serialCode && attachSerial !== existing.serialCode
          ? { name: `${attachSerial} · ${ssid ?? "SwitchNest"}` }
          : {}),
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
  const pendingVer = esp ? esp.otaPendingVersion : (device?.otaPendingVersion ?? null);
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

  let updatedDevice = device;
  if (device) {
    updatedDevice = await prisma.device.update({ where: { id: device.id }, data });
    if (device.offline) {
      await emitDeviceUpdated(homeId, updatedDevice.id);
    }
  }

  let synced = 0;
  let statesParsed = false;
  // If no specific device.id exists (because we just sent mac), start an empty array
  const controlledIds: number[] = device ? [device.id] : [];

  if (input.states && input.states.trim()) {
    try {
      const parsed: unknown = JSON.parse(input.states);
      if (Array.isArray(parsed)) {
        statesParsed = true;
        // V2 Array Format: [1, 0, 1, 0]
        if (parsed.length > 0 && typeof parsed[0] === "number") {
          if (esp) {
            const mappedDevices = await prisma.device.findMany({ where: { espId: esp.id, homeId } });
            for (let i = 0; i < parsed.length; i++) {
              const channelNum = i + 1;
              const target = mappedDevices.find(d => d.channel === channelNum);
              if (target) {
                const targetStatus = parsed[i] ? "on" : "off";
                const res = await prisma.device.updateMany({
                  where: { id: target.id, homeId },
                  data: { status: targetStatus, lastSeen: new Date(), offline: false },
                });
                if (res.count > 0) {
                  synced++;
                  controlledIds.push(target.id);
                  await emitDeviceUpdated(homeId, target.id);
                }
              }
            }
          }
        } else {
          // V1 Objects Format: [{"id": 1, "status": "on"}]
          let states = parsed as Array<{ id: number; status: DeviceStatus; value?: string }>;
          for (const st of states) {
            if (!st || typeof st.id !== "number" || (st.status !== "on" && st.status !== "off")) continue;
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
              await emitDeviceUpdated(homeId, st.id);
            }
          }
        }
      }
    } catch {
      // bad JSON
    }
  }

  // Sab controlled devices ko is ESP board se link karo.
  if (esp) {
    await prisma.device.updateMany({
      where: { homeId, id: { in: [...new Set(controlledIds)] } },
      data: { espId: esp.id },
    });

    // Stale links cleanup — purane devices jo ab is board ke mapping me NAHI hain
    // (home badla / re-provision kiya) unka espId hata do. States successful parse
    // hua ho tabhi — warna ek bad heartbeat saare links na uda de.
    if (statesParsed) {
      await prisma.device.updateMany({
        where: { espId: esp.id, id: { notIn: [...new Set(controlledIds)] } },
        data: { espId: null },
      });
    }
  }

  // OTA: pending push sirf tab jab ESP already current version pe na ho.
  // Board ke model ke hisaab se firmware resolve hota hai (model-specific > universal).
  const { resolveFirmware } = await import("./firmware.service");
  const current = await resolveFirmware(esp?.modelCode);
  const running = fw ?? updatedDevice?.firmwareVersion;
  const pendingNow = esp ? esp.otaPendingVersion : (device?.otaPendingVersion);
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
    device: updatedDevice,
    esp: esp
      ? { id: esp.id, macAddress: esp.macAddress, name: esp.name, ssid: esp.ssid, serialCode: esp.serialCode, modelCode: esp.modelCode, ipAddress: esp.ipAddress, firmwareVersion: esp.firmwareVersion }
      : null,
    synced,
    ota,
  };
}

/** Pending commands for the key's home — polled by the ESP32. */
export async function pendingCommands(key: ApiKey, mac?: string) {
  const commands = await findPendingCommands(key, mac);
  await markHomeAlive(key);
  return commands;
}

async function findPendingCommands(key: ApiKey, mac?: string) {
  const homeId = homeScope(key);

  if (mac) {
    const esp = await prisma.espDevice.findFirst({ where: { homeId, macAddress: mac } });
    if (!esp) return [];

    // Find mapped devices to compute channel mapping for commands
    const devices = await prisma.device.findMany({ where: { espId: esp.id, homeId } });
    const deviceIds = devices.map(d => d.id);

    const cmds = await prisma.deviceCommand.findMany({
      where: { deviceId: { in: deviceIds }, status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { id: true, deviceId: true, command: true },
    });

    // Emit V2 commands with channel instead of deviceId
    return cmds.map(c => {
      const dev = devices.find(d => d.id === c.deviceId);
      return { id: c.id, channel: dev?.channel, command: c.command };
    });
  }

  return prisma.deviceCommand.findMany({
    where: { device: { homeId }, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { id: true, deviceId: true, command: true }
  });
}

async function markHomeAlive(key: ApiKey) {
  const homeId = homeScope(key);
  await prisma.device
    .updateMany({ where: { homeId }, data: { lastSeen: new Date() } })
    .catch(() => undefined);
}

/**
 * Long-poll: command aate hi turant return (ESP32 near-instant relay toggle),
 * warna `holdMs` tak halke interval pe DB check karta hai. lastSeen sirf ek
 * baar (response ke waqt) update hota hai — har check pe nahi.
 */
export async function pendingCommandsLongPoll(
  key: ApiKey,
  holdMs: number,
  signal?: AbortSignal,
  mac?: string
) {
  const deadline = Date.now() + holdMs;
  let commands = await findPendingCommands(key, mac);
  while (commands.length === 0 && Date.now() < deadline) {
    if (signal?.aborted) break;
    await new Promise((r) => setTimeout(r, 300));
    commands = await findPendingCommands(key, mac);
  }
  await markHomeAlive(key);
  return commands;
}

/** Mark a command executed/failed (the ESP32 confirms it applied the state). */
export async function ackCommand(
  key: ApiKey,
  commandId: number,
  deviceId: number | undefined,
  status: "executed" | "failed",
) {
  const homeId = homeScope(key);

  const command = await prisma.deviceCommand.findFirst({
    where: { id: commandId },
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
