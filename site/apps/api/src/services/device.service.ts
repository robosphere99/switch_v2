import type { DeviceStatus, DeviceType } from "@robosphere/shared";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";
import { emitToHome } from "../lib/socket";

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
