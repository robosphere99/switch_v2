import type { DeviceStatus, DeviceType } from "@robosphere/shared";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";
import { emitToHome } from "../lib/socket";
import { audit } from "./audit.service";
import { createNotification } from "./notification.service";

export async function listDevices(homeId: number) {
  return prisma.device.findMany({
    where: { homeId },
    include: {
      esp: { select: { id: true, name: true, serialCode: true, modelCode: true, offline: true, lastSeen: true } },
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
  if (updated) emitToHome(input.homeId, "device:updated", updated);
  return updated;
}

/** Update device name and/or move it to a room. */
export async function updateDevice(
  homeId: number,
  deviceId: number,
  patch: { name?: string; roomId?: number | null },
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
    data: { name: patch.name, roomId: patch.roomId },
  });
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
    where: { members: { some: { userId } } },
    select: {
      id: true,
      name: true,
      members: { where: { userId }, select: { role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const homeIds = homes.map((h) => h.id);
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
        },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });

  const byHome = new Map<number, typeof boards>();
  for (const b of boards) {
    const arr = byHome.get(b.homeId) ?? [];
    arr.push(b);
    byHome.set(b.homeId, arr);
  }

  return homes.map((h) => ({
    homeId: h.id,
    homeName: h.name,
    role: h.members[0]?.role ?? "member",
    boards: byHome.get(h.id) ?? [],
  }));
}
