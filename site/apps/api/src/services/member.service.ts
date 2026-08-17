import crypto from "node:crypto";
import type { HomeMemberRole } from "@robosphere/shared";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";
import { leaveHomeRoom } from "../lib/socket";
import { createNotification } from "./notification.service";

function generateInviteCode(): string {
  // 8-char code from unambiguous alphabet (no 0/O/1/I).
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function listMembers(homeId: number, viewerRole?: HomeMemberRole) {
  const members = await prisma.homeMember.findMany({
    where: { homeId },
    include: { user: { select: { id: true, username: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });
  // Device grants sirf owner/admin ko dikhao (member/viewer ko nahi).
  // Defensive: agar server pe prisma client stale ho (model missing) to bina
  // grants ke degrade karo — 500 kabhi nahi.
  if ((viewerRole === "owner" || viewerRole === "admin") && prisma.deviceAccess) {
    const grants = await prisma.deviceAccess.findMany({
      where: { homeId },
      select: { userId: true, deviceId: true },
    });
    const byUser = new Map<number, { deviceId: number }[]>();
    for (const g of grants) {
      const arr = byUser.get(g.userId) ?? [];
      arr.push({ deviceId: g.deviceId });
      byUser.set(g.userId, arr);
    }
    return members.map((m) => ({ ...m, deviceAccess: byUser.get(m.userId) ?? [] }));
  }
  return members;
}

/** Create an invitation (email + invite code) for someone to join the home. */
export async function createInvitation(input: {
  homeId: number;
  email: string;
  role: HomeMemberRole;
  expiresInHours?: number;
}) {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    const already = await prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId: input.homeId, userId: existingUser.id } },
    });
    if (already) throw new AppError("ALREADY_MEMBER", "User is already a member of this home", 409);
  }

  const expiresInHours = input.expiresInHours ?? 48;
  let inviteCode = generateInviteCode();

  // Extremely unlikely collision; retry once to be safe.
  for (let attempt = 0; attempt < 3; attempt++) {
    const exists = await prisma.invitation.findUnique({ where: { inviteCode } });
    if (!exists) break;
    inviteCode = generateInviteCode();
  }

  return prisma.invitation.create({
    data: {
      homeId: input.homeId,
      email: input.email,
      inviteCode,
      role: input.role,
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
    },
  });
}

/** Join a home using an invite code. The joining user is the authenticated caller. */
export async function acceptInvitation(inviteCode: string, userId: number, userEmail: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { inviteCode: inviteCode.trim().toUpperCase() },
    include: { home: true },
  });

  if (!invitation || invitation.status !== "pending") {
    throw new AppError("INVALID_INVITE", "Invitation not found or no longer active", 404);
  }
  if (invitation.expiresAt < new Date()) {
    throw new AppError("INVITE_EXPIRED", "Invitation has expired", 410);
  }
  if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new AppError("INVITE_EMAIL_MISMATCH", "Invitation was sent to a different email", 403);
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.homeMember.findUnique({
      where: { homeId_userId: { homeId: invitation.homeId, userId } },
    });
    if (existing) throw new AppError("ALREADY_MEMBER", "You are already a member of this home", 409);

    await tx.homeMember.create({
      data: { homeId: invitation.homeId, userId, role: invitation.role },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });

    // Notify the home owner that a new member joined.
    await createNotification(invitation.home.ownerId, {
      category: "system",
      type: "info",
      title: `👤 New member joined ${invitation.home.name}`,
      body: `A user joined your home with the ${invitation.role} role.`,
    });

    return invitation.home;
  });
}

/** Pending invitations for a home (admin view). */
export async function listInvitations(homeId: number) {
  return prisma.invitation.findMany({
    where: { homeId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeInvitation(homeId: number, invitationId: number) {
  const invitation = await prisma.invitation.findFirst({ where: { id: invitationId, homeId } });
  if (!invitation) throw new AppError("INVITATION_NOT_FOUND", "Invitation not found", 404);
  return prisma.invitation.update({
    where: { id: invitationId },
    data: { status: "revoked" },
  });
}

export async function changeRole(homeId: number, userId: number, role: HomeMemberRole) {
  const member = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId } },
  });
  if (!member) throw new AppError("NOT_A_MEMBER", "User is not a member of this home", 404);

  if (member.role === "owner") {
    throw new AppError("CANNOT_DEMOTE_OWNER", "The owner's role cannot be changed", 400);
  }

  return prisma.homeMember.update({
    where: { homeId_userId: { homeId, userId } },
    data: { role },
  });
}

export async function removeMember(homeId: number, userId: number) {
  const member = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId } },
  });
  if (!member) throw new AppError("NOT_A_MEMBER", "User is not a member of this home", 404);
  if (member.role === "owner") {
    throw new AppError("CANNOT_REMOVE_OWNER", "The owner cannot be removed", 400);
  }

  await prisma.homeMember.delete({ where: { homeId_userId: { homeId, userId } } });

  // Removed member ke sockets ko home room se nikaalo + access-revoked bhejo
  // — warna removed user ko devices/live updates dikhte rehte hain.
  await leaveHomeRoom(userId, homeId);
}

// ---------- Child safety / device-level access ----------

/**
 * Child mode (restricted) + daily limit set karo. Sirf owner/admin.
 * Restricted = sirf granted devices control kar sakta hai; limit cross pe auto-off + parents ko notification.
 */
export async function updateMemberSafety(input: {
  homeId: number;
  actorId: number;
  actorRole: HomeMemberRole;
  targetUserId: number;
  restricted?: boolean;
  dailyLimitMinutes?: number | null;
}) {
  if (input.actorRole !== "owner" && input.actorRole !== "admin") {
    throw new AppError("FORBIDDEN", "Only owner/admin can manage member safety", 403);
  }
  const member = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId: input.homeId, userId: input.targetUserId } },
  });
  if (!member) throw new AppError("NOT_A_MEMBER", "User is not a member of this home", 404);
  if (member.role === "owner") throw new AppError("BAD_REQUEST", "Owner ko child mode me nahi rakha ja sakta", 400);

  const data: { restricted?: boolean; dailyLimitMinutes?: number | null } = {};
  if (input.restricted !== undefined) data.restricted = input.restricted;
  if (input.dailyLimitMinutes !== undefined) {
    const mins = Number(input.dailyLimitMinutes);
    data.dailyLimitMinutes = Number.isFinite(mins) && mins > 0 ? Math.floor(mins) : null;
  }
  // Child mode off → limit bhi clear
  if (data.restricted === false) data.dailyLimitMinutes = null;

  const updated = await prisma.homeMember.update({
    where: { homeId_userId: { homeId: input.homeId, userId: input.targetUserId } },
    data,
    include: { user: { select: { id: true, username: true } } },
  });

  const { audit } = await import("./audit.service");
  await audit(input.actorId, "member.safety", {
    homeId: input.homeId,
    entity: "homeMember",
    entityId: member.id,
    meta: { targetUserId: input.targetUserId, ...data },
  });
  return updated;
}

/** Restricted member ko kaunse devices ka control dena hai — grants replace karo. */
export async function setDeviceAccess(input: {
  homeId: number;
  actorId: number;
  actorRole: HomeMemberRole;
  targetUserId: number;
  deviceIds: number[];
}) {
  if (input.actorRole !== "owner" && input.actorRole !== "admin") {
    throw new AppError("FORBIDDEN", "Only owner/admin can manage device access", 403);
  }
  const member = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId: input.homeId, userId: input.targetUserId } },
  });
  if (!member) throw new AppError("NOT_A_MEMBER", "User is not a member of this home", 404);
  if (member.role === "owner") throw new AppError("BAD_REQUEST", "Owner pe device access set nahi kar sakte", 400);

  const ids = [...new Set(input.deviceIds)];
  if (ids.length > 0) {
    const devices = await prisma.device.findMany({
      where: { id: { in: ids }, homeId: input.homeId },
      select: { id: true },
    });
    if (devices.length !== ids.length) {
      throw new AppError("BAD_REQUEST", "Kuch devices is home ke nahi hain", 400);
    }
  }

  await prisma.$transaction([
    prisma.deviceAccess.deleteMany({ where: { homeId: input.homeId, userId: input.targetUserId } }),
    ...(ids.length > 0
      ? [
          prisma.deviceAccess.createMany({
            data: ids.map((deviceId) => ({
              homeId: input.homeId,
              deviceId,
              userId: input.targetUserId,
            })),
          }),
        ]
      : []),
  ]);

  const { audit } = await import("./audit.service");
  await audit(input.actorId, "member.access", {
    homeId: input.homeId,
    entity: "homeMember",
    entityId: member.id,
    meta: { targetUserId: input.targetUserId, deviceIds: ids },
  });
  return { deviceIds: ids };
}
