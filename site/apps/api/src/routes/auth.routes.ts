import { Router } from "express";
import { z } from "zod";
import * as authController from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { uploadsDir } from "../lib/paths";
import { prisma } from "../lib/prisma";

const avatarsDir = path.join(uploadsDir, "avatars");
try { fs.mkdirSync(avatarsDir, { recursive: true }); } catch(e) {}

/**
 * Deterministic avatar storage: {username}.{ext}
 * Old avatar archived into uploads/avatars/{username}/{username}_N.{ext}
 */
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, avatarsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    // username lookup happens before multer writes (req.user.sub is set by requireAuth)
    prisma.user
      .findUnique({ where: { id: req.user!.sub }, select: { username: true } })
      .then((u) => {
        if (!u) return cb(new Error("User not found"), "");
        const username = u.username;
        const canonicalName = `${username}${ext}`;

        // Archive any existing avatar with this username (any extension)
        try {
          const existing = fs.readdirSync(avatarsDir).filter(
            (f) => f.startsWith(`${username}.`) && !fs.statSync(path.join(avatarsDir, f)).isDirectory()
          );
          if (existing.length > 0) {
            const archiveDir = path.join(avatarsDir, username);
            fs.mkdirSync(archiveDir, { recursive: true });
            // Find next archive number
            const archived = fs.readdirSync(archiveDir);
            let maxNum = 0;
            for (const a of archived) {
              const match = a.match(new RegExp(`^${username}_(\\d+)`));
              if (match) maxNum = Math.max(maxNum, Number(match[1]));
            }
            for (const oldFile of existing) {
              maxNum++;
              const oldExt = path.extname(oldFile);
              fs.renameSync(
                path.join(avatarsDir, oldFile),
                path.join(archiveDir, `${username}_${maxNum}${oldExt}`)
              );
            }
          }
        } catch { /* first upload — no existing file */ }

        cb(null, canonicalName);
      })
      .catch((err) => cb(err, ""));
  },
});
const upload = multer({ storage });


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
  revokeOtherSessions: z.boolean().optional(),
});

const revokeUnauthSchema = z.object({
  usernameEmail: z.string().min(1).max(100),
  password: z.string().min(1).max(255),
  sessionId: z.number()
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional().nullable(),
  pushToken: z.string().min(1).optional().nullable(),
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
    avatarUrl: z.string().max(500).optional().nullable(),
    dob: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }).optional().nullable(),
    gender: z.string().max(20).optional().nullable(),
    phone: z.string().max(20).optional().nullable(),
    address: z.string().max(1000).optional().nullable(),
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
authRouter.post("/revoke-unauth", loginLimiter, validateBody(revokeUnauthSchema), authController.revokeUnauth);
authRouter.post("/refresh", refreshLimiter, validateBody(refreshSchema), authController.refresh);
authRouter.post("/logout", validateBody(logoutSchema), authController.logout);
authRouter.post("/forgot-password", forgotLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
authRouter.post("/reset-password", resetLimiter, validateBody(resetPasswordSchema), authController.resetPassword);
authRouter.get("/me", requireAuth, authController.me);
authRouter.patch("/me", requireAuth, validateBody(profileSchema), authController.updateProfile);
authRouter.post("/me/avatar", requireAuth, upload.single("avatar"), authController.uploadAvatar);
authRouter.put("/theme", requireAuth, validateBody(themeSchema), authController.updateTheme);

authRouter.get("/check", authController.checkAvailability);
authRouter.get("/sessions", requireAuth, authController.listSessions);
authRouter.delete("/sessions/other", requireAuth, authController.revokeOtherSessions);
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
