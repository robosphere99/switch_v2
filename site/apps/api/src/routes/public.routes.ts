import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import * as publicController from "../controllers/public.controller";

export const publicRouter = Router();

const assistantLimiter = rateLimit({
  name: "public:assistant",
  windowMs: 60_000,
  max: 20,
  message: "Bahut zyada messages — thodi der baad try karo",
});
const adminAssistantLimiter = rateLimit({
  name: "public:assistant-admin",
  windowMs: 60_000,
  max: 30,
  message: "Bahut zyada messages — thodi der baad try karo",
});
const contactLimiter = rateLimit({
  name: "public:contact",
  windowMs: 60 * 60_000,
  max: 5,
  message: "Bahut zyada contact messages — 1 ghanta baad try karo",
});
const supportFormLimiter = rateLimit({
  name: "public:support-form",
  windowMs: 60 * 60_000,
  max: 10,
  message: "Bahut zyada support messages — 1 ghanta baad try karo",
});
const siteSettingsLimiter = rateLimit({
  name: "public:site-settings",
  windowMs: 60_000,
  max: 120,
});
const mySupportLimiter = rateLimit({
  name: "public:my-support",
  windowMs: 60_000,
  max: 60,
});
const verifyBillLimiter = rateLimit({
  name: "public:verify-bill",
  windowMs: 60_000,
  max: 120,
  message: "Bahut zyada verify requests — thodi der baad try karo",
});

publicRouter.get("/lan-ip", publicController.getLanIp);
publicRouter.get("/apk", publicController.downloadApk);
publicRouter.get("/site-settings", siteSettingsLimiter, publicController.getSiteSettings);
publicRouter.get("/verify/bill/:token", verifyBillLimiter, publicController.verifyBill);

publicRouter.post("/assistant", assistantLimiter, optionalAuth, publicController.publicAssistant);
publicRouter.post("/assistant/admin", adminAssistantLimiter, requireAuth, publicController.adminAssistant);

publicRouter.post("/contact", contactLimiter, publicController.postContactForm);
publicRouter.get("/support/my", mySupportLimiter, requireAuth, publicController.getMySupport);
publicRouter.post("/support", supportFormLimiter, requireAuth, publicController.postSupportMessage);
