import crypto from "node:crypto";
import type { HomeMemberRole } from "@robosphere/shared";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/response";
import { createNotification } from "./notification.service";

function generateInviteCode(): string {
  // 8-char code from unambiguous alphabet (no 0/O/1/I).
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function listMembers(homeId: number) {
  return prisma.homeMember.findMany({
    where: { homeId },
    include: { user: { select: { id: true, username: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });
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
}
