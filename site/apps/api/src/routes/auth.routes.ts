import { Router } from "express";
import { z } from "zod";
import * as authController from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const authRouter = Router();

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

const themeSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
});

const profileSchema = z
  .object({
    username: z.string().min(3).max(50).optional(),
    email: z.string().email().max(100).optional(),
    currentPassword: z.string().min(1).max(255).optional(),
    newPassword: z.string().min(6).max(255).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" });

authRouter.post("/signup", validateBody(signupSchema), authController.signup);
authRouter.post("/login", validateBody(loginSchema), authController.login);
authRouter.post("/refresh", validateBody(refreshSchema), authController.refresh);
authRouter.post("/logout", validateBody(logoutSchema), authController.logout);
authRouter.get("/me", requireAuth, authController.me);
authRouter.patch("/me", requireAuth, validateBody(profileSchema), authController.updateProfile);
authRouter.put("/theme", requireAuth, validateBody(themeSchema), authController.updateTheme);
