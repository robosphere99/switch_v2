import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import jwt from "jsonwebtoken";
import { emitToUser, io } from "../lib/socket";
import { sendPushToUser } from "../services/push.service";
import crypto from "crypto";

// For Jitsi Meet JWT authentication (JaaS)
// Based on: https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe-jwt
function generateJitsiJwt(roomId: string, user: { id: number, name: string, email: string, avatarUrl?: string }, isModerator: boolean = false) {
  const appId = process.env.JITSI_APP_ID;
  const privateKey = process.env.JITSI_PRIVATE_KEY;
  const kid = process.env.JITSI_API_KEY || process.env.JITSI_KID;

  if (!appId || !privateKey || !kid) {
    // Return null if JaaS config is missing (will fallback to open public meet if client allows)
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7200; // 2 hours

  const payload = {
    aud: "jitsi",
    iss: "chat",
    sub: appId,
    room: "*",
    nbf: now - 10,
    exp: exp,
    context: {
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatarUrl || "",
        moderator: isModerator
      },
      features: {
        livestreaming: false,
        recording: false
      }
    }
  };

  try {
    return jwt.sign(payload, privateKey, { algorithm: "RS256", keyid: kid });
  } catch (err) {
    console.error("Failed to sign Jitsi JWT", err);
    return null;
  }
}

export async function initiateCall(req: Request, res: Response): Promise<void> {
  const adminId = req.user!.sub;
  const { targetUserId, callType } = req.body;

  if (!targetUserId || !callType) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const parsedTargetId = parseInt(targetUserId, 10);

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({ where: { id: parsedTargetId } });
  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
  if (!adminUser) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }

  // Generate secure room ID
  const rawRoomId = `switchnest-support-${crypto.randomBytes(16).toString("hex")}`;
  const appId = process.env.JITSI_APP_ID;
  const roomId = appId ? `${appId}/${rawRoomId}` : rawRoomId;

  const call = await prisma.supportCall.create({
    data: {
      callerId: adminId,
      receiverId: parsedTargetId,
      type: callType,
      status: "ringing",
      roomId
    }
  });

  const jitsiToken = generateJitsiJwt(roomId, {
    id: adminUser.id,
    name: adminUser.username,
    email: adminUser.email,
    avatarUrl: adminUser.avatarUrl || undefined
  }, true);

  // Emit ringing to receiver via Socket.IO
  const payload = {
    callId: call.id,
    callType,
    roomId,
    callerName: adminUser.username
  };

  // Using the existing WebRTC signal event pattern
  emitToUser(parsedTargetId, "webrtc:signal", {
    senderId: adminId,
    type: "call-request",
    payload
  });

  // Check if user is online in socket rooms
  const roomName = `user:${parsedTargetId}`;
  const room = io?.sockets.adapter.rooms.get(roomName);

  if (!room || room.size === 0) {
    // User is offline, send push notification
    sendPushToUser(
      parsedTargetId,
      "Incoming Support Call",
      "Admin is calling you for support. Tap to answer.",
      { type: "webrtc-call", callType, callId: call.id },
      "support"
    ).catch(console.error);
  }

  res.json({
    callId: call.id,
    roomId,
    jitsiToken,
    domain: process.env.JITSI_DOMAIN || "meet.jit.si"
  });
}

export async function acceptCall(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const callId = parseInt(req.params.id, 10);

  const call = await prisma.supportCall.findUnique({ where: { id: callId } });
  if (!call || call.receiverId !== userId) {
    res.status(404).json({ error: "Call not found or unauthorized" });
    return;
  }

  if (call.status !== "ringing") {
    res.status(400).json({ error: `Call is already ${call.status}` });
    return;
  }

  const updatedCall = await prisma.supportCall.update({
    where: { id: callId },
    data: { status: "accepted", answeredAt: new Date() }
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  const jitsiToken = generateJitsiJwt(call.roomId, {
    id: user!.id,
    name: user!.username,
    email: user!.email,
    avatarUrl: user!.avatarUrl || undefined
  }, false);

  // Notify admin that the call was accepted
  emitToUser(call.callerId, "webrtc:signal", {
    senderId: userId,
    type: "call-accept",
    payload: { callId }
  });

  // Stop ringing for other devices of the same user
  emitToUser(userId, "webrtc:signal", {
    senderId: userId,
    type: "call-end",
    payload: { reason: "handled-elsewhere" }
  });

  res.json({
    callId: updatedCall.id,
    roomId: call.roomId,
    jitsiToken,
    domain: process.env.JITSI_DOMAIN || "meet.jit.si"
  });
}

export async function rejectCall(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const callId = parseInt(req.params.id, 10);

  const call = await prisma.supportCall.findUnique({ where: { id: callId } });
  if (!call || call.receiverId !== userId) {
    res.status(404).json({ error: "Call not found or unauthorized" });
    return;
  }

  if (call.status !== "ringing") {
    res.status(400).json({ error: `Call is already ${call.status}` });
    return;
  }

  await prisma.supportCall.update({
    where: { id: callId },
    data: { status: "rejected", endedAt: new Date() }
  });

  // Notify admin
  emitToUser(call.callerId, "webrtc:signal", {
    senderId: userId,
    type: "call-reject",
    payload: { callId }
  });

  res.json({ success: true });
}

export async function endCall(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const callId = parseInt(req.params.id, 10);

  const call = await prisma.supportCall.findUnique({ where: { id: callId } });
  if (!call) {
    res.status(404).json({ error: "Call not found" });
    return;
  }

  if (call.callerId !== userId && call.receiverId !== userId && req.user!.role !== "system_admin") {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  if (call.status === "ended" || call.status === "rejected" || call.status === "missed") {
    res.json({ success: true }); // Already ended
    return;
  }

  // If ringing and ended by caller, it's missed or cancelled
  const newStatus = call.status === "ringing" ? "missed" : "ended";

  await prisma.supportCall.update({
    where: { id: callId },
    data: { status: newStatus, endedAt: new Date() }
  });

  // Notify the other party
  const targetId = call.callerId === userId ? call.receiverId : call.callerId;
  emitToUser(targetId, "webrtc:signal", {
    senderId: userId,
    type: "call-end",
    payload: { callId }
  });

  res.json({ success: true });
}

export async function getCallHistory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  // If admin, they can see all their calls. User sees their received calls.
  // We'll just fetch calls where the user is involved.
  const calls = await prisma.supportCall.findMany({
    where: {
      OR: [
        { callerId: userId },
        { receiverId: userId }
      ]
    },
    orderBy: { startedAt: "desc" },
    take: 50,
    include: {
      caller: { select: { id: true, username: true, email: true, avatarUrl: true } },
      receiver: { select: { id: true, username: true, email: true, avatarUrl: true } }
    }
  });

  res.json(calls);
}
