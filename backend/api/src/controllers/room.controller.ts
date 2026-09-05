import type { Request, Response } from "express";
import { ok } from "../lib/response";
import * as roomService from "../services/room.service";

export async function listRooms(req: Request, res: Response): Promise<void> {
  const homeId = Number(req.params.homeId);
  const rooms = await roomService.listRooms(homeId);
  ok(res, rooms);
}

export async function createRoom(req: Request, res: Response): Promise<void> {
  const homeId = Number(req.params.homeId);
  const { name } = req.body;
  const room = await roomService.createRoom(homeId, name);
  ok(res, room, 201);
}

export async function deleteRoom(req: Request, res: Response): Promise<void> {
  const homeId = Number(req.params.homeId);
  const roomId = Number(req.params.roomId);
  await roomService.deleteRoom(homeId, roomId);
  ok(res, { message: "Room deleted" });
}
