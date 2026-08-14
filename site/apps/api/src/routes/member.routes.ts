import { Router } from "express";
import { z } from "zod";
import * as memberController from "../controllers/member.controller";
import { requireAuth } from "../middleware/auth";
import { requireHomeMember } from "../middleware/requireRole";
import { validateBody, validateParams } from "../middleware/validate";

export const memberRouter = Router();

const idParams = z.object({ homeId: z.coerce.number().int().positive() });
const memberParams = z.object({
  homeId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
});

const inviteSchema = z.object({
  email: z.string().email().max(100),
  role: z.enum(["admin", "member", "viewer"]), // cannot invite as owner
});

const acceptSchema = z.object({ inviteCode: z.string().min(6).max(12) });

const roleSchema = z.object({ role: z.enum(["admin", "member", "viewer"]) });

memberRouter.get(
  "/:homeId/members",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("viewer"),
  memberController.list,
);
memberRouter.get(
  "/:homeId/invitations",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("admin"),
  memberController.listInvitations,
);
memberRouter.delete(
  "/:homeId/invitations/:invitationId",
  requireAuth,
  validateParams(
    z.object({
      homeId: z.coerce.number().int().positive(),
      invitationId: z.coerce.number().int().positive(),
    }),
  ),
  requireHomeMember("admin"),
  memberController.revokeInvitation,
);
memberRouter.post(
  "/:homeId/invitations",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("admin"),
  validateBody(inviteSchema),
  memberController.invite,
);
memberRouter.patch(
  "/:homeId/members/:userId/role",
  requireAuth,
  validateParams(memberParams),
  requireHomeMember("admin"),
  validateBody(roleSchema),
  memberController.changeRole,
);
memberRouter.delete(
  "/:homeId/members/:userId",
  requireAuth,
  validateParams(memberParams),
  requireHomeMember("admin"),
  memberController.remove,
);

// Public join endpoint (auth required, but no home membership needed).
memberRouter.post("/invitations/accept", requireAuth, validateBody(acceptSchema), memberController.accept);
