import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";

export async function createRoom(homeId: number, name: string) {
  const existing = await prisma.room.findUnique({
    where: { homeId_name: { homeId, name } },
  });
  if (existing) throw new AppError("ROOM_EXISTS", "A room with this name already exists", 409);
  return prisma.room.create({ data: { homeId, name } });
}

export async function deleteRoom(homeId: number, roomId: number) {
  const room = await prisma.room.findFirst({ where: { id: roomId, homeId } });
  if (!room) throw new AppError("ROOM_NOT_FOUND", "Room not found in this home", 404);
  // Devices in the room get roomId = NULL (SetNull), they are not deleted.
  await prisma.room.delete({ where: { id: roomId } });
}
