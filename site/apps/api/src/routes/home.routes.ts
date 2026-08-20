import { Router } from "express";
import { z } from "zod";
import * as homeController from "../controllers/home.controller";
import * as deviceController from "../controllers/device.controller";
import { requireAuth } from "../middleware/auth";
import { requireHomeMember } from "../middleware/requireRole";
import { validateBody, validateParams } from "../middleware/validate";

export const homeRouter = Router();

const idParams = z.object({ homeId: z.coerce.number().int().positive() });

const createSchema = z.object({ name: z.string().min(1).max(100) });
const renameSchema = z.object({ name: z.string().min(1).max(100) });
const transferSchema = z.object({ newOwnerId: z.coerce.number().int().positive() });

homeRouter.post("/", requireAuth, validateBody(createSchema), homeController.create);
homeRouter.get("/", requireAuth, homeController.list);

homeRouter.get("/my-boards", requireAuth, deviceController.listMyBoards);

homeRouter.get(
  "/:homeId",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("viewer"),
  homeController.detail,
);
homeRouter.patch(
  "/:homeId",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("admin"),
  validateBody(renameSchema),
  homeController.rename,
);
homeRouter.delete(
  "/:homeId",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("owner"),
  homeController.remove,
);
homeRouter.post(
  "/:homeId/transfer",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("owner"),
  validateBody(transferSchema),
  homeController.transfer,
);

homeRouter.get(
  "/:homeId/activity",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("admin"),
  homeController.activity,
);
homeRouter.get(
  "/:homeId/members",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("member"),
  homeController.listMembers,
);
