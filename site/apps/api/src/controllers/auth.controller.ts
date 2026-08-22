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
  const { usernameEmail, password } = req.body;
  const deviceInfo = req.headers["user-agent"]?.substring(0, 255);
  const ipAddress = (req.ip || req.socket.remoteAddress)?.substring(0, 45);
  const result = await authService.login(usernameEmail, password, deviceInfo, ipAddress);
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

export async function updateTheme(req: Request, res: Response) {
  const user = await authService.updateThemePref(req.user!.sub, req.body.theme as string);
  ok(res, user);
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  const result = await authService.requestPasswordReset(email as string);
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
  ok(res, { message: "All sessions revoked successfully." });
}

export async function revokeSession(req: Request, res: Response) {
  await authService.revokeSession(req.user!.sub, Number(req.params.id));
  ok(res, { ok: true });
}
