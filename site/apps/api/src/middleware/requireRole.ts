import type { RequestHandler } from "express";
import { HOME_MEMBER_ROLES, type HomeMemberRole } from "@robosphere/shared";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";

const ROLE_INDEX = Object.fromEntries(HOME_MEMBER_ROLES.map((r: string, i: number) => [r, i])) as Record<
  HomeMemberRole,
  number
>;

/**
 * Requires the authenticated user to be a member of the home given in
 * `req.params.homeId` with a role at least as permissive as `minRole`.
 * Sets `req.homeMembership`.
 *
 * Role order (most → least permissive): owner < admin < member < viewer
 */
export function requireHomeMember(minRole: HomeMemberRole = "member"): RequestHandler {
  return async (req, _res, next) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return next(new AppError("UNAUTHORIZED", "Not authenticated", 401));

      const homeId = Number(req.params.homeId);
      if (!Number.isInteger(homeId)) return next(new AppError("BAD_REQUEST", "Invalid home id"));

      const membership = await prisma.homeMember.findUnique({
        where: { homeId_userId: { homeId, userId } },
      });

      if (!membership) {
        return next(new AppError("FORBIDDEN", "Not a member of this home", 403));
      }

      if (ROLE_INDEX[membership.role] > ROLE_INDEX[minRole]) {
        return next(new AppError("FORBIDDEN", "Insufficient role for this action", 403));
      }

      req.homeMembership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}
