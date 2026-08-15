import type { Request, Response } from "express";
import { ok } from "../lib/response";
import * as memberService from "../services/member.service";

export async function list(req: Request, res: Response) {
  const members = await memberService.listMembers(
    Number(req.params.homeId),
    req.homeMembership?.role,
  );
  ok(res, members);
}

export async function invite(req: Request, res: Response) {
  const invitation = await memberService.createInvitation({
    homeId: Number(req.params.homeId),
    email: req.body.email,
    role: req.body.role,
  });
  ok(res, invitation, 201);
}

/** Public join endpoint — accepts a valid invite code for the authenticated user. */
export async function accept(req: Request, res: Response) {
  const home = await memberService.acceptInvitation(
    req.body.inviteCode,
    req.user!.sub,
    req.user!.email,
  );
  ok(res, home);
}

export async function listInvitations(req: Request, res: Response) {
  const invitations = await memberService.listInvitations(Number(req.params.homeId));
  ok(res, invitations);
}

export async function revokeInvitation(req: Request, res: Response) {
  const invitation = await memberService.revokeInvitation(
    Number(req.params.homeId),
    Number(req.params.invitationId),
  );
  ok(res, invitation);
}

export async function changeRole(req: Request, res: Response) {
  const member = await memberService.changeRole(
    Number(req.params.homeId),
    Number(req.params.userId),
    req.body.role,
  );
  ok(res, member);
}

export async function remove(req: Request, res: Response) {
  await memberService.removeMember(Number(req.params.homeId), Number(req.params.userId));
  ok(res, { message: "Member removed" });
}

/** Child mode + daily limit set karo. */
export async function updateSafety(req: Request, res: Response) {
  const member = await memberService.updateMemberSafety({
    homeId: Number(req.params.homeId),
    actorId: req.user!.sub,
    actorRole: req.homeMembership!.role,
    targetUserId: Number(req.params.userId),
    restricted: req.body.restricted,
    dailyLimitMinutes: req.body.dailyLimitMinutes,
  });
  ok(res, member);
}

/** Restricted member ke device grants replace karo. */
export async function updateAccess(req: Request, res: Response) {
  const result = await memberService.setDeviceAccess({
    homeId: Number(req.params.homeId),
    actorId: req.user!.sub,
    actorRole: req.homeMembership!.role,
    targetUserId: Number(req.params.userId),
    deviceIds: req.body.deviceIds,
  });
  ok(res, result);
}
