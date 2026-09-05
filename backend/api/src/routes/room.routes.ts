import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireHomeMember } from "../middleware/requireRole";
import { validateBody, validateParams } from "../middleware/validate";
import * as roomController from "../controllers/room.controller";

export const roomRouter = Router();

const idParams = z.object({ homeId: z.coerce.number().int().positive() });
const roomParams = z.object({
  homeId: z.coerce.number().int().positive(),
  roomId: z.coerce.number().int().positive(),
});

const createSchema = z.object({ name: z.string().min(1).max(100) });

roomRouter.get(
  "/:homeId/rooms",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("viewer"),
  roomController.listRooms,
);

roomRouter.post(
  "/:homeId/rooms",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("admin"),
  validateBody(createSchema),
  roomController.createRoom,
);

roomRouter.delete(
  "/:homeId/rooms/:roomId",
  requireAuth,
  validateParams(roomParams),
  requireHomeMember("admin"),
  roomController.deleteRoom,
);
