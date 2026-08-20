import { Router } from "express";
import { z } from "zod";
import * as authController from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";

export const authRouter = Router();

// Brute-force / credential-stuffing se bachao — per IP fixed window.
const loginLimiter = rateLimit({
  name: "auth:login",
  windowMs: 15 * 60_000,
  max: 1000,
  message: "Bahut zyada login attempts — 15 min baad dobara try karo",
});
const signupLimiter = rateLimit({
  name: "auth:signup",
  windowMs: 15 * 60_000,
  max: 5,
  message: "Bahut zyada signup attempts — thodi der baad try karo",
});
const refreshLimiter = rateLimit({
  name: "auth:refresh",
  windowMs: 15 * 60_000,
  max: 30,
  message: "Bahut zyada refresh attempts — thodi der baad try karo",
});
const forgotLimiter = rateLimit({
  name: "auth:forgot",
  windowMs: 60 * 60_000,
  max: 5,
  message: "Bahut zyada reset requests — 1 ghanta baad try karo",
});
const resetLimiter = rateLimit({
  name: "auth:reset",
  windowMs: 15 * 60_000,
  max: 10,
  message: "Bahut zyada reset attempts — 15 min baad try karo",
});

const signupSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().max(100),
  password: z.string().min(6).max(255),
  homeName: z.string().max(100).optional(),
});

const loginSchema = z.object({
  usernameEmail: z.string().min(1).max(100),
  password: z.string().min(1).max(255),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

const pushTokenSchema = z.object({
  token: z.string().min(1),
  deviceModel: z.string().optional(),
  pushDeviceToggles: z.boolean().optional(),
  pushSystemAlerts: z.boolean().optional(),
});

const themeSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
});

const profileSchema = z
  .object({
    username: z.string().min(3).max(50).optional(),
    email: z.string().email().max(100).optional(),
    currentPassword: z.string().min(1).max(255).optional(),
    newPassword: z.string().min(6).max(255).optional(),
    pushDeviceToggles: z.boolean().optional(),
    pushSystemAlerts: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" });

const forgotPasswordSchema = z.object({
  email: z.string().email().max(100),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  newPassword: z.string().min(6).max(255),
});

authRouter.post("/signup", signupLimiter, validateBody(signupSchema), authController.signup);
authRouter.post("/login", loginLimiter, validateBody(loginSchema), authController.login);
authRouter.post("/refresh", refreshLimiter, validateBody(refreshSchema), authController.refresh);
authRouter.post("/logout", validateBody(logoutSchema), authController.logout);
authRouter.post("/forgot-password", forgotLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
authRouter.post("/reset-password", resetLimiter, validateBody(resetPasswordSchema), authController.resetPassword);
authRouter.get("/me", requireAuth, authController.me);
authRouter.patch("/me", requireAuth, validateBody(profileSchema), authController.updateProfile);
authRouter.put("/theme", requireAuth, validateBody(themeSchema), authController.updateTheme);

authRouter.get("/sessions", requireAuth, authController.listSessions);
authRouter.delete("/sessions/all", requireAuth, authController.revokeAllSessions);
authRouter.delete("/sessions/:id", requireAuth, authController.revokeSession);

authRouter.post("/push-token", requireAuth, validateBody(pushTokenSchema), async (req, res) => {
  // Save or sync the hardware push identifier in the Multi-Device registry
  const { token, deviceModel, pushDeviceToggles, pushSystemAlerts } = req.body;
  const { prisma } = await import("../lib/prisma");

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
});
