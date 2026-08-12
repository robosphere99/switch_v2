import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";

export async function createHome(userId: number, name: string) {
  return prisma.$transaction(async (tx) => {
    const home = await tx.home.create({
      data: {
        name,
        ownerId: userId,
        members: { create: { userId, role: "owner" } },
      },
    });
    return home;
  });
}

/** Homes the user is a member of, with the user's role in each. */
export async function listHomesForUser(userId: number) {
  return prisma.home.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { where: { userId }, select: { role: true } },
      _count: { select: { devices: true, members: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getHomeDetail(homeId: number) {
  return prisma.home.findUnique({
    where: { id: homeId },
    include: {
      rooms: { orderBy: { name: "asc" } },
      devices: { orderBy: { createdAt: "desc" } },
      members: { include: { user: { select: { id: true, username: true, email: true } } } },
      _count: { select: { devices: true, members: true } },
    },
  });
}

export async function renameHome(homeId: number, name: string) {
  return prisma.home.update({ where: { id: homeId }, data: { name } });
}

/** Transfer ownership to another member (owner only). */
export async function transferOwnership(homeId: number, newOwnerId: number) {
  const [home, target] = await Promise.all([
    prisma.home.findUnique({ where: { id: homeId } }),
    prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId: newOwnerId } },
    }),
  ]);

  if (!home) throw new AppError("HOME_NOT_FOUND", "Home not found", 404);
  if (!target) throw new AppError("NOT_A_MEMBER", "Target user is not a member of this home", 400);
  if (target.role === "owner") throw new AppError("ALREADY_OWNER", "Target is already the owner", 400);

  return prisma.$transaction([
    prisma.homeMember.update({
      where: { homeId_userId: { homeId, userId: newOwnerId } },
      data: { role: "owner" },
    }),
    prisma.homeMember.update({
      where: { homeId_userId: { homeId, userId: home.ownerId } },
      data: { role: "admin" },
    }),
    prisma.home.update({ where: { id: homeId }, data: { ownerId: newOwnerId } }),
  ]);
}

export async function deleteHome(homeId: number) {
  await prisma.home.delete({ where: { id: homeId } });
}
