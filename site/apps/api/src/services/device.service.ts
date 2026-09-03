import type { DeviceStatus, DeviceType } from "@robosphere/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";
import { emitDeviceUpdated, emitToHome } from "../lib/socket";
import { audit } from "./audit.service";
import { createNotification } from "./notification.service";
import { sendPushToUser } from "./push.service";
import { resolveFirmware } from "./firmware.service";
import { mqttPushCommands, mqttPushLedState } from "./mqtt.service";

export async function listDevices(homeId: number, viewerId?: number) {
  const where: Prisma.DeviceWhereInput = { homeId };
  // Child/restricted member — sirf granted devices dikho
  // Defensive: stale prisma client pe filtering skip (log error, 500 nahi)
  if (viewerId && prisma.deviceAccess) {
    const membership = await prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId: viewerId } },
      select: { restricted: true },
    });
    if (membership?.restricted) {
      const granted = await prisma.deviceAccess.findMany({
        where: { homeId, userId: viewerId },
        select: { deviceId: true },
      });
      where.id = { in: granted.map((g) => g.deviceId) };
    }
  }
  return prisma.device.findMany({
    where,
    include: {
      esp: { select: { id: true, name: true, serialCode: true, modelCode: true, firmwareVersion: true, offline: true, lastSeen: true } },
      room: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDevice(input: {
  homeId: number;
  createdBy: number;
  name: string;
  type: DeviceType;
  roomId?: number;
  serialNumber?: string;
}) {
  if (input.roomId) {
    const room = await prisma.room.findFirst({
      where: { id: input.roomId, homeId: input.homeId },
    });
    if (!room) throw new AppError("ROOM_NOT_FOUND", "Room does not belong to this home", 400);
  }

  // Home ke andar device ka naam UNIQUE — search/tracking clean rahe.
  const dup = await prisma.device.findFirst({
    where: { homeId: input.homeId, name: input.name },
    select: { id: true },
  });
  if (dup) {
    throw new AppError("DUPLICATE_NAME", `Naam "${input.name}" already is home me hai — har device ka unique naam chahiye`, 409);
  }

  return prisma.device.create({
    data: {
      homeId: input.homeId,
      createdBy: input.createdBy,
      name: input.name,
      type: input.type,
      roomId: input.roomId,
      serialNumber: input.serialNumber,
    },
  });
}

/**
 * Set device status. Writes a device_commands entry (pending → consumed by the
 * device worker / ESP32) and a device_logs entry (who did what).
 */
export async function setDeviceStatus(input: {
  homeId: number;
  deviceId: number;
  actorId: number;
  status: DeviceStatus;
}) {
  const device = await prisma.device.findFirst({
    where: { id: input.deviceId, homeId: input.homeId },
  });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);

  // Child/restricted member — sirf granted devices control kar sakta hai
  // Defensive: stale prisma client ho to check skip (log karo, 500 nahi)
  const membership = prisma.deviceAccess
    ? await prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId: input.homeId, userId: input.actorId } },
      select: { restricted: true, dailyLimitMinutes: true },
    })
    : null;
  if (membership?.restricted && prisma.deviceAccess) {
    const granted = await prisma.deviceAccess.findUnique({
      where: { deviceId_userId: { deviceId: device.id, userId: input.actorId } },
    });
    if (!granted) {
      throw new AppError("FORBIDDEN", "Is device ka access nahi hai (child mode)", 403);
    }

    // Child Rate Limit Enforcement (Configurable toggles per minute per device)
    const limit = membership?.dailyLimitMinutes || 5;
    const ONE_MINUTE_AGO = new Date(Date.now() - 60 * 1000);
    const recentToggles = await prisma.deviceLog.count({
      where: {
        actorId: input.actorId,
        deviceId: device.id,
        logType: "status_change",
        createdAt: { gte: ONE_MINUTE_AGO },
      },
    });
    if (recentToggles >= limit) {
      throw new AppError("RATE_LIMIT_EXCEEDED", `Tumne is switch (${device.name}) ke sath bahut chedkhaani ki hai. 1 minute ruko! (Limit: ${limit}/min)`, 429);
    }
  }

  await prisma.$transaction([
    prisma.device.update({
      where: { id: device.id },
      data: { status: input.status },
    }),
    prisma.deviceCommand.create({
      data: {
        deviceId: device.id,
        actorId: input.actorId,
        command: `set_status:${input.status}`,
      },
    }),
    prisma.deviceLog.create({
      data: {
        deviceId: device.id,
        actorId: input.actorId,
        logType: "status_change",
        logMessage: `Device turned ${input.status}`,
      },
    }),
  ]);

  const updated = await prisma.device.findUnique({ where: { id: device.id } });
  if (updated) {
    await emitDeviceUpdated(input.homeId, updated.id);

    // MQTT instant-push: if device is linked to an ESP board, push via MQTT
    if (updated.espId) {
      const esp = await prisma.espDevice.findUnique({ where: { id: updated.espId }, select: { macAddress: true } });
      if (esp) mqttPushCommands(esp.macAddress);
    }

    // Phase 14: Real-time Push Alert Broadcast (Vibration/Sound Native Mobile Alerts)
    try {
      const members = await prisma.homeMember.findMany({
        where: { homeId: input.homeId, role: { in: ['admin', 'owner'] } }
      });
      const actor = await prisma.user.findUnique({ where: { id: input.actorId }, select: { username: true } });
      const actorName = actor?.username || "A member";

      for (const m of members) {
        sendPushToUser(
          m.userId,
          `${updated.name} turned ${input.status.toUpperCase()}`,
          `${actorName} just interacted with the ${updated.name}`,
          undefined,
          "device"
        );
      }
    } catch (e) {
      console.warn("[Push] Background dispatch failure:", e);
    }
  }
  return updated;
}

/**
 * Bulk status — ek saath kai devices (room all-off / all-lights-off).
 * Har device pe wahi checks (home scoping + restricted member) — ek
 * transaction me sab command + log. Web UI room/home bulk actions ke liye.
 */
/**
 * Remote device command — site se ESP ko bhejo (restart / WiFi / LED).
 * Home scoping + restricted-member check (setStatus jaisa), command queue me
 * entry + log.
 */
export async function sendDeviceCommand(input: {
  homeId: number;
  actorId: number;
  deviceId: number;
  command: string;
  logType: string;
  logMessage: string;
}) {
  const device = await prisma.device.findFirst({
    where: { id: input.deviceId, homeId: input.homeId },
  });
  if (!device) {
    throw new AppError("DEVICE_NOT_FOUND", "Device nahi mila is home me", 404);
  }

  // Restricted member (child mode) — same gate as setStatus
  const membership = prisma.deviceAccess
    ? await prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId: input.homeId, userId: input.actorId } },
      select: { restricted: true },
    })
    : null;
  if (membership?.restricted && prisma.deviceAccess) {
    const granted = await prisma.deviceAccess.findUnique({
      where: { deviceId_userId: { deviceId: device.id, userId: input.actorId } },
    });
    if (!granted) {
      throw new AppError("FORBIDDEN", "Is device ka access nahi hai (child mode)", 403);
    }
  }

  await prisma.$transaction([
    prisma.deviceCommand.create({
      data: { deviceId: device.id, actorId: input.actorId, command: input.command },
    }),
    prisma.deviceLog.create({
      data: { deviceId: device.id, actorId: input.actorId, logType: input.logType, logMessage: input.logMessage },
    }),
  ]);

  const updated = await prisma.device.findUnique({ where: { id: device.id } });
  if (updated) {
    await emitDeviceUpdated(input.homeId, updated.id);

    try {
      const members = await prisma.homeMember.findMany({
        where: { homeId: input.homeId, role: { in: ['admin', 'owner'] } }
      });
      const actor = await prisma.user.findUnique({ where: { id: input.actorId }, select: { username: true } });

      for (const m of members) {
        sendPushToUser(
          m.userId,
          `System Command: ${input.command}`,
          `${actor?.username || "A member"} dispatched a remote hardware command.`,
          undefined,
          "device"
        );
      }
    } catch (e) {
      console.warn("[Push] Remote Command Background dispatch failure:", e);
    }
  }
  return updated;
}

export async function bulkSetStatus(input: {
  homeId: number;
  actorId: number;
  deviceIds: number[];
  status: DeviceStatus;
}) {
  const ids = [...new Set(input.deviceIds)];
  let devices = await prisma.device.findMany({
    where: { id: { in: ids }, homeId: input.homeId },
  });
  if (devices.length === 0) {
    throw new AppError("DEVICE_NOT_FOUND", "Koi device nahi mila is home me", 404);
  }

  // Restricted member (child mode) — sirf granted devices control kar sakta hai.
  const membership = prisma.deviceAccess
    ? await prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId: input.homeId, userId: input.actorId } },
      select: { restricted: true, dailyLimitMinutes: true },
    })
    : null;
  if (membership?.restricted && prisma.deviceAccess) {
    const granted = await prisma.deviceAccess.findMany({
      where: { userId: input.actorId, deviceId: { in: devices.map((d) => d.id) } },
      select: { deviceId: true },
    });
    const grantedSet = new Set(granted.map((g) => g.deviceId));
    const allowed = devices.filter((d) => grantedSet.has(d.id));
    if (allowed.length === 0) {
      throw new AppError("FORBIDDEN", "In devices ka access nahi hai (child mode)", 403);
    }
    devices = allowed;

    // Child Rate Limit Enforcement (Configurable toggles per minute per device)
    const limit = membership?.dailyLimitMinutes || 5;
    const ONE_MINUTE_AGO = new Date(Date.now() - 60 * 1000);
    const recentToggles = await prisma.deviceLog.groupBy({
      by: ['deviceId'],
      where: {
        actorId: input.actorId,
        deviceId: { in: devices.map(d => d.id) },
        logType: "status_change",
        createdAt: { gte: ONE_MINUTE_AGO },
      },
      _count: { deviceId: true }
    });
    // Add the ongoing bulk action (1 toggle per device) to the past count.
    const maxToggles = Math.max(...recentToggles.map(t => t._count.deviceId), 0);
    if (maxToggles + 1 > limit) {
      throw new AppError("RATE_LIMIT_EXCEEDED", `Tumne group me kisi switch ko ek minute me limit (${limit}) ke paar daba diya hai, thodi der wait karo!`, 429);
    }
  }

  await prisma.$transaction([
    prisma.device.updateMany({
      where: { id: { in: devices.map((d) => d.id) } },
      data: { status: input.status },
    }),
    ...devices.map((d) =>
      prisma.deviceCommand.create({
        data: { deviceId: d.id, actorId: input.actorId, command: `set_status:${input.status}` },
      }),
    ),
    ...devices.map((d) =>
      prisma.deviceLog.create({
        data: {
          deviceId: d.id,
          actorId: input.actorId,
          logType: "status_change",
          logMessage: `Device turned ${input.status}`,
        },
      }),
    ),
  ]);

  const updated = await prisma.device.findMany({
    where: { id: { in: devices.map((d) => d.id) }, homeId: input.homeId },
  });
  for (const d of updated) await emitDeviceUpdated(input.homeId, d.id);

  try {
    const members = await prisma.homeMember.findMany({
      where: { homeId: input.homeId, role: { in: ['admin', 'owner'] } }
    });
    const actor = await prisma.user.findUnique({ where: { id: input.actorId }, select: { username: true } });

    for (const m of members) {
      sendPushToUser(
        m.userId,
        `Room Actuation: ${input.status.toUpperCase()}`,
        `${actor?.username || "A member"} toggled grouped components.`,
        undefined,
        "device"
      );
    }
  } catch (e) {
    console.warn("[Push] Bulk Group Background dispatch failure:", e);
  }

  return updated;
}

/** Update device name, move it to a room, or assign it to a Board Channel. */
export async function updateDevice(
  homeId: number,
  deviceId: number,
  patch: { name?: string; roomId?: number | null; espId?: number | null; channel?: number | null },
) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, homeId } });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);

  if (patch.roomId !== undefined && patch.roomId !== null) {
    const room = await prisma.room.findFirst({ where: { id: patch.roomId, homeId } });
    if (!room) throw new AppError("ROOM_NOT_FOUND", "Room does not belong to this home", 400);
  }

  // Rename pe unique check — is home me kisi aur device ka naam same na ho.
  if (patch.name !== undefined) {
    const dup = await prisma.device.findFirst({
      where: { homeId, name: patch.name, id: { not: deviceId } },
      select: { id: true },
    });
    if (dup) {
      throw new AppError("DUPLICATE_NAME", `Naam "${patch.name}" already is home me kisi aur device pe hai — unique naam chahiye`, 409);
    }
  }

  return prisma.device.update({
    where: { id: deviceId },
    data: { name: patch.name, roomId: patch.roomId, espId: patch.espId, channel: patch.channel },
  });
}

export async function setEspLed(args: {
  homeId: number;
  espId: number;
  actorId: number;
  enabled: boolean;
}) {
  const { homeId, espId, actorId, enabled } = args;

  const esp = await prisma.espDevice.update({
    where: { id: espId, homeId },
    data: { ledEnabled: enabled },
  });

  await prisma.auditLog.create({
    data: {
      homeId,
      actorId,
      action: "esp_led",
      entity: "esp",
      entityId: espId,
      meta: { title: `Status LED ${enabled ? "enabled" : "disabled"}` },
    },
  });

  // Push immediate update to ESP, Web, and Mobile
  emitToHome(homeId, "esp:updated", { id: esp.id, ledEnabled: esp.ledEnabled });
  if (esp.macAddress) {
    mqttPushLedState(esp.macAddress, esp.ledEnabled);
  }

  return esp;
}

/** Recent activity log for a device (who toggled what, when). */
export async function getDeviceLogs(homeId: number, deviceId: number, limit = 50) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, homeId } });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);

  return prisma.deviceLog.findMany({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { id: true, username: true } } },
  });
}

export async function deleteDevice(homeId: number, deviceId: number) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, homeId } });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  await prisma.device.delete({ where: { id: deviceId } });
}


/** User apne home ke ESP board ka naam rename karo — unique naam rule (admin jaisa). */
export async function renameEsp(homeId: number, espId: number, name: string, actorId: number) {
  if (!name) throw new AppError("BAD_REQUEST", "Board ka naam required hai", 400);
  if (name.length > 60) throw new AppError("BAD_REQUEST", "Naam 60 chars se chhota rakho", 400);
  const esp = await prisma.espDevice.findFirst({ where: { id: espId, homeId } });
  if (!esp) throw new AppError("NOT_FOUND", "Board is home me nahi mila", 404);
  const dup = await prisma.espDevice.findFirst({ where: { name, id: { not: espId } }, select: { id: true } });
  if (dup) {
    throw new AppError("DUPLICATE_NAME", `Naam "${name}" already kisi aur board pe hai — unique naam chahiye`, 409);
  }
  const updated = await prisma.espDevice.update({ where: { id: espId }, data: { name } });
  await audit(actorId, "user.esp.rename", {
    homeId,
    entity: "esp",
    entityId: espId,
    meta: { from: esp.name ?? null, to: name },
  });

  // Board rename → home ke members ko notification (realtime bhi).
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { username: true } });
  const home = await prisma.home.findUnique({
    where: { id: homeId },
    include: { members: { where: { role: { in: ["owner", "admin"] } }, select: { userId: true } } },
  });
  if (home) {
    const oldName = esp.name ?? esp.serialCode ?? `ESP-${esp.macAddress.slice(-6).toUpperCase()}`;
    for (const m of home.members) {
      await createNotification(m.userId, {
        category: "device",
        type: "info",
        title: `🛰️ Board renamed: ${oldName} → ${name}`,
        body: `${actor?.username ?? "Kisi ne"} ne board ka naam "${oldName}" se "${name}" kar diya.`,
      });
    }
    emitToHome(homeId, "esp:updated", { id: espId, name });
  }
  return updated;
}

/**
 * Saare boards jinke user (kisi bhi home me) member hai — ek saath, devices ke saath.
 * "My Boards" page ke liye: har board ki full info (firmware, IP, MAC, SSID) + devices.
 */
export async function listMyBoards(userId: number) {
  const homes = await prisma.home.findMany({
    where: { members: { some: { userId, role: { in: ["owner", "admin"] } } } },
    select: {
      id: true,
      name: true,
      members: { where: { userId }, select: { role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const homeIds = homes.map((h) => h.id);

  // Har home ka pehla (active) API key — board detail panel me dikhega.
  const homeApiKeys = await prisma.apiKey.findMany({
    where: { homeId: { in: homeIds }, revokedAt: null },
    select: { homeId: true, keyPrefix: true, expiresAt: true },
    orderBy: [{ homeId: "asc" }, { createdAt: "desc" }],
  });
  const apiKeyByHome = new Map<number, { keyPrefix: string; expiresAt: Date | null }>();
  for (const k of homeApiKeys) {
    if (k.homeId && !apiKeyByHome.has(k.homeId)) apiKeyByHome.set(k.homeId, k);
  }

  const boards = await prisma.espDevice.findMany({
    where: { homeId: { in: homeIds } },
    include: {
      devices: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          offline: true,
          lastSeen: true,
          channel: true,
        },
        orderBy: { channel: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });

  const unassignedDevices = await prisma.device.findMany({
    where: { homeId: { in: homeIds }, espId: null },
    select: {
      id: true,
      homeId: true,
      name: true,
      type: true,
      status: true,
      offline: true,
      lastSeen: true,
      channel: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const withHistory = boards.map((b) => ({
    ...b,
    history: [],
  }));

  const byHome = new Map<number, typeof withHistory>();
  for (const b of withHistory) {
    const arr = byHome.get(b.homeId) ?? [];
    arr.push(b);
    byHome.set(b.homeId, arr);
  }

  return homes.map((h) => {
    const role = h.members[0]?.role ?? "member";
    const canManage = role === "owner" || role === "admin";

    return {
      homeId: h.id,
      homeName: h.name,
      role: role,
      apiKey: canManage ? (apiKeyByHome.get(h.id) ?? null) : null,
      boards: canManage ? (byHome.get(h.id) ?? []).map((b) => ({
        ...b,
        hotspotName: b.serialCode ? `SwitchNest-${b.serialCode}` : null,
        hotspotPassword: b.serialCode ?? null,
      })) : [],
      unassignedDevices: canManage ? unassignedDevices.filter(d => d.homeId === h.id) : [],
    };
  });
}

/** User apne board pe firmware update push kare (OTA). */
export async function requestOta(homeId: number, deviceId: number, actorId: number) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, homeId } });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device is home me nahi mila", 404);

  const esp = device.espId ? await prisma.espDevice.findUnique({ where: { id: device.espId } }) : null;
  const current = await resolveFirmware(esp?.modelCode);
  if (!current) {
    throw new AppError("NO_FIRMWARE", "Abhi koi current firmware published nahi hai", 400);
  }

  await prisma.device.update({
    where: { id: deviceId },
    data: { otaPendingVersion: current.version, otaRequestedAt: new Date() },
  });
  let espId: number | null = null;
  if (esp) {
    espId = esp.id;
    await prisma.espDevice.update({
      where: { id: esp.id },
      data: { otaPendingVersion: current.version, otaRequestedAt: new Date() },
    });
  }

  await audit(actorId, "user.ota.push", {
    homeId,
    entity: "device",
    entityId: deviceId,
    meta: { version: current.version, model: esp?.modelCode ?? null },
  });

  // Home ke owner/admin ko pata chale (jisne kiya usse bhi — confirmation).
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { username: true } });
  const home = await prisma.home.findUnique({
    where: { id: homeId },
    include: { members: { where: { role: { in: ["owner", "admin"] } }, select: { userId: true } } },
  });
  if (home) {
    for (const m of home.members) {
      await createNotification(m.userId, {
        category: "device",
        type: "info",
        title: `📲 "${device.name}" pe firmware update push kiya`,
        body: `${actor?.username ?? "Kisi ne"} ne board ke liye v${current.version} request kiya — agle heartbeat pe install hoga.`,
      });
    }
  }
  await emitDeviceUpdated(homeId, deviceId);

  return {
    deviceId,
    espId,
    version: current.version,
    model: current.modelCode || "universal",
    message: "OTA update pushed — device agle heartbeat pe update ho jayega",
  };
}

/** Saare current published firmware versions (modelCode -> version) — "update available" badge ke liye. */
export async function listCurrentFirmware() {
  return prisma.firmwareVersion.findMany({
    where: { isCurrent: true },
    select: { modelCode: true, version: true, releaseNotes: true },
    orderBy: { modelCode: "asc" },
  });
}
