import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireHomeMember } from "../middleware/requireRole";
import { validateBody, validateParams } from "../middleware/validate";
import { ok } from "../lib/response";
import * as roomService from "../services/room.service";

export const roomRouter = Router();

const idParams = z.object({ homeId: z.coerce.number().int().positive() });
const roomParams = z.object({
  homeId: z.coerce.number().int().positive(),
  roomId: z.coerce.number().int().positive(),
});

const createSchema = z.object({ name: z.string().min(1).max(100) });

roomRouter.post(
  "/:homeId/rooms",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("admin"),
  validateBody(createSchema),
  async (req, res) => ok(res, await roomService.createRoom(Number(req.params.homeId), req.body.name), 201),
);

roomRouter.delete(
  "/:homeId/rooms/:roomId",
  requireAuth,
  validateParams(roomParams),
  requireHomeMember("admin"),
  async (req, res) => {
    await roomService.deleteRoom(Number(req.params.homeId), Number(req.params.roomId));
    ok(res, { message: "Room deleted" });
  },
);
