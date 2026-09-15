import path from "node:path";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ok } from "../lib/response";
import * as authService from "../services/auth.service";

export async function signup(req: Request, res: Response) {
  const { username, email, password, homeName } = req.body;
  const deviceInfo = req.headers["user-agent"]?.substring(0, 255);
  const ipAddress = (req.ip || req.socket.remoteAddress)?.substring(0, 45);
  const result = await authService.signup({ username, email, password, homeName }, deviceInfo, ipAddress);
  ok(res, result, 201);
}

export async function login(req: Request, res: Response) {
  const { usernameEmail, password, revokeOtherSessions } = req.body;
  const deviceInfo = req.headers["user-agent"]?.substring(0, 255);
  const ipAddress = (req.ip || req.socket.remoteAddress)?.substring(0, 45);
  const result = await authService.login(usernameEmail, password, deviceInfo, ipAddress, revokeOtherSessions);
  ok(res, result);
}

export async function me(req: Request, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, username: true, email: true, role: true, themePref: true, createdAt: true, pushDeviceToggles: true, pushSystemAlerts: true, avatarUrl: true, dob: true, gender: true, phone: true, address: true },
    });
    ok(res, user);
  } catch (err) {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, username: true, email: true, role: true, themePref: true, createdAt: true, avatarUrl: true, dob: true, gender: true, phone: true, address: true },
    });
    ok(res, { ...user, pushDeviceToggles: true, pushSystemAlerts: true });
  }
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  const deviceInfo = req.headers["user-agent"]?.substring(0, 255);
  const ipAddress = (req.ip || req.socket.remoteAddress)?.substring(0, 45);
  const result = await authService.refresh(refreshToken, deviceInfo, ipAddress);
  ok(res, result);
}

export async function logout(req: Request, res: Response) {
  const { refreshToken, pushToken } = req.body;
  if (refreshToken || pushToken) {
    await authService.logout(refreshToken, pushToken);
  }
  ok(res, { message: "Logged out" });
}

export async function updateProfile(req: Request, res: Response) {
  const user = await authService.updateProfile(req.user!.sub, req.body);
  ok(res, user);
}

export async function uploadAvatar(req: Request, res: Response) {
  if (!req.file) {
    res.status(400).json({ success: false, error: { code: "NO_FILE", message: "No avatar image provided." } });
    return;
  }
  const filename = path.basename(req.file.filename || req.file.path);
  const avatarUrl = `/uploads/avatars/${filename}`;
  const user = await authService.updateProfile(req.user!.sub, { avatarUrl });
  ok(res, user);
}

export async function updateTheme(req: Request, res: Response) {
  const user = await authService.updateThemePref(req.user!.sub, req.body.theme as string);
  ok(res, user);
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  const origin = req.headers.origin as string | undefined;
  const result = await authService.requestPasswordReset(email as string, origin);
  ok(res, result);
}

export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = req.body;
  await authService.resetPassword(token as string, newPassword as string);
  ok(res, { message: "Password reset ho gaya — naye password se login karo" });
}

export async function listSessions(req: Request, res: Response) {
  const userId = req.user!.sub;
  const currentSid = req.user!.sid;
  const rawUA = req.headers["user-agent"]?.substring(0, 255) || "Web Browser";
  const rawIp = (req.ip || req.socket.remoteAddress)?.substring(0, 45) || "127.0.0.1";
  const ip = rawIp.replace(/^::ffff:/, "");

  let sessions = await authService.listSessions(userId);

  // Auto-heal: Ensure current session is tracked in DB
  const currentMatch = currentSid ? sessions.find((s) => s.id === currentSid) : undefined;

  if (currentMatch) {
    // Touch lastActive in background
    prisma.refreshToken
      .update({
        where: { id: currentMatch.id },
        data: { lastActive: new Date(), ipAddress: ip },
      })
      .catch(() => {});
  } else if (sessions.length === 0 || !currentSid) {
    try {
      const crypto = await import("node:crypto");
      const syntheticHash = crypto
        .createHash("sha256")
        .update(`sess_${userId}_${Date.now()}_${Math.random()}`)
        .digest("hex");
      const newSession = await prisma.refreshToken.create({
        data: {
          userId,
          tokenHash: syntheticHash,
          deviceInfo: rawUA,
          ipAddress: ip,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          lastActive: new Date(),
        },
        select: { id: true, deviceInfo: true, ipAddress: true, lastActive: true, createdAt: true },
      });
      sessions = [newSession, ...sessions.filter((s) => s.id !== newSession.id)];
    } catch (_err) {
      // Ignore DB write error
    }
  }

  ok(res, sessions);
}

export async function revokeAllSessions(req: Request, res: Response) {
  await authService.revokeAllSessions(req.user!.sub);
  ok(res, { message: "All sessions revoked." });
}

export async function revokeSession(req: Request, res: Response) {
  await authService.revokeSession(req.user!.sub, Number(req.params.id));
  ok(res, { message: "Session revoked." });
}

export async function revokeUnauth(req: Request, res: Response) {
  const { usernameEmail, password, sessionId } = req.body;
  const sessions = await authService.revokeUnauthSession(usernameEmail, password, sessionId);
  ok(res, sessions);
}

export async function revokeOtherSessions(req: Request, res: Response) {
  const authReq = req as Request & { user?: any };
  const userId = authReq.user!.sub;
  let currentSessionId = authReq.user!.sid || Number(req.query.currentSessionId);

  if (!currentSessionId || isNaN(currentSessionId)) {
    const latest = await prisma.refreshToken.findFirst({
      where: { userId, revokedAt: null },
      orderBy: { lastActive: "desc" },
    });
    if (latest) {
      currentSessionId = latest.id;
    }
  }

  if (!currentSessionId) {
    return ok(res, { message: "No other active sessions to revoke.", count: 0 });
  }

  const rev = await authService.revokeOtherSessions(userId, currentSessionId);
  ok(res, { message: `Successfully revoked ${rev.count} other session(s).`, currentSessionId });
}

export async function checkAvailability(req: Request, res: Response) {
  const { username, email } = req.query;
  const result = await authService.checkAvailability(username as string, email as string);
  ok(res, result);
}

export async function upsertPushToken(req: Request, res: Response) {
  const { token, deviceModel, pushDeviceToggles, pushSystemAlerts } = req.body;

  const fallbackDT = pushDeviceToggles !== undefined ? pushDeviceToggles : true;
  const fallbackSA = pushSystemAlerts !== undefined ? pushSystemAlerts : true;

  await prisma.pushSubscription.upsert({
    where: { token },
    update: {
      userId: req.user!.sub,
      deviceModel: deviceModel || undefined,
      pushDeviceToggles: fallbackDT,
      pushSystemAlerts: fallbackSA
    },
    create: {
      userId: req.user!.sub,
      token,
      deviceModel,
      pushDeviceToggles: fallbackDT,
      pushSystemAlerts: fallbackSA
    }
  });

  res.json({ success: true, message: "Push token securely vaulted in multi-device registry" });
}
