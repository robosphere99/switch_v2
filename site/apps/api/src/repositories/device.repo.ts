import { prisma } from "../lib/prisma";
import type { DeviceStatus } from "@robosphere/shared";

/**
 * Repository layer: every DB access should live here (or in a domain-specific
 * repo) so services never touch Prisma directly. Keeps queries testable.
 */
export const deviceRepo = {
  findInHome(homeId: number, deviceId: number) {
    return prisma.device.findFirst({ where: { id: deviceId, homeId } });
  },

  listByHome(homeId: number) {
    return prisma.device.findMany({ where: { homeId }, orderBy: { createdAt: "desc" } });
  },

  updateStatus(deviceId: number, status: DeviceStatus) {
    return prisma.device.update({ where: { id: deviceId }, data: { status } });
  },
};
