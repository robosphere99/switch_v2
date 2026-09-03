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
  const avatarUrl = req.file.path; // Cloudinary secure URL
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
  const sessions = await authService.listSessions(req.user!.sub);
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
  console.log("[DEBUG-REVOKE] Entry hit. Body:", req.body, "Query:", req.query);
  const authReq = req as Request & { user?: any };
  let currentSessionId = authReq.user!.sid || Number(req.query.currentSessionId);
  console.log(`[DEBUG-REVOKE] Initial currentSessionId resolved to: ${currentSessionId} (from sid:${authReq.user!.sid} or query:${req.query.currentSessionId})`);

  if (!currentSessionId || isNaN(currentSessionId)) {
    console.log("[DEBUG-REVOKE] Proceeding to fallback logic because ID is missing or NaN.");
    const iatSeconds = authReq.user!.iat;
    if (iatSeconds) {
      console.log(`[DEBUG-REVOKE] Found iatSeconds in payload: ${iatSeconds}. Querying DB...`);
      const allSessions = await prisma.refreshToken.findMany({
        where: { userId: authReq.user!.sub, revokedAt: null }
      });
      console.log(`[DEBUG-REVOKE] Retrieved ${allSessions.length} active sessions from DB.`);

      const matchedSession = allSessions.find(s => Math.abs(Math.floor(s.createdAt.getTime() / 1000) - iatSeconds) <= 2);
      if (matchedSession) {
        currentSessionId = matchedSession.id;
        console.log(`[DEBUG-REVOKE] Match found! Overwriting currentSessionId to: ${currentSessionId}`);
      } else {
        console.log(`[DEBUG-REVOKE] No match found in DB for iat: ${iatSeconds}. Existing epochs: ${allSessions.map(s => Math.floor(s.createdAt.getTime() / 1000)).join(', ')}`);
      }
    }

    if (!currentSessionId) {
      console.log("[DEBUG-REVOKE] Aborting and returning 400. Still no currentSessionId.");
      return res.status(400).json({ success: false, error: { message: "Please log out and log back in to use this feature." } });
    }
  }

  console.log(`[DEBUG-REVOKE] Executing DB sweep. Calling authService.revokeOtherSessions for User: ${authReq.user!.sub}, Keeping ID: ${currentSessionId}`);
  const rev = await authService.revokeOtherSessions(authReq.user!.sub, currentSessionId);
  console.log(`[DEBUG-REVOKE] Service executed. Rows deleted: ${rev.count}. Returning 200 OK.`);
  ok(res, { message: `Successfully revoked ${rev.count} other session(s).`, currentSessionId });
}

export async function checkAvailability(req: Request, res: Response) {
  const { username, email } = req.query;
  const result = await authService.checkAvailability(username as string, email as string);
  ok(res, result);
}
