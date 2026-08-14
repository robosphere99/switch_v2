import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ok } from "../lib/response";
import * as authService from "../services/auth.service";

export async function signup(req: Request, res: Response) {
  const { username, email, password, homeName } = req.body;
  const result = await authService.signup({ username, email, password, homeName });
  ok(res, result, 201);
}

export async function login(req: Request, res: Response) {
  const { usernameEmail, password } = req.body;
  const result = await authService.login(usernameEmail, password);
  ok(res, result);
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, username: true, email: true, role: true, createdAt: true },
  });
  ok(res, user);
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  const result = await authService.refresh(refreshToken);
  ok(res, result);
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (refreshToken) await authService.logout(refreshToken);
  ok(res, { message: "Logged out" });
}

export async function updateProfile(req: Request, res: Response) {
  const user = await authService.updateProfile(req.user!.sub, req.body);
  ok(res, user);
}
