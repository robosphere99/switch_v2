import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { cloudinaryProductStorage } from "../lib/cloudinary";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import { prisma } from "../lib/prisma";
import { getHealthMonitorState } from "../lib/healthMonitor";
import { getLeakMonitorState } from "../lib/leakMonitor";
import { AppError, ok } from "../lib/response";
import { audit } from "../services/audit.service";
import { createNotification, createNotificationWithEmail } from "../services/notification.service";
import { emitToHome } from "../lib/socket";
import { generateSerials, updateOrderStatus } from "../services/shop.service";
import { decryptSecret } from "../lib/crypto";
import { signBillToken } from "../lib/billVerify";
import { detectLanIp } from "../lib/lanIp";
import { resolveFirmware } from "../services/firmware.service";
import { firmwareDir, mobileAppDir, webPublicMobileAppDir } from "../lib/paths";
import { logFilePath } from "../lib/logger";
import { getRequestStats } from "../lib/requestTracker";
import { getSiteSettings, updateSiteSettings } from "../services/siteSettings.service";
import { setDbReady } from "../lib/dbState";
import { sendEmail } from "../lib/email.service";
import { chatCompletion, getAiConfig, aiConfigured } from "../lib/ai";
import { requestPasswordReset } from "../services/auth.service";
import bcrypt from "bcryptjs";

import * as adminController from "../controllers/admin.controller";
import type { CiStatus } from "../controllers/admin.controller";

export const adminRouter = Router();

/** System admins only. */
function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "system_admin") {
    return next(new AppError("FORBIDDEN", "Admin access required", 403));
  }
  next();
}

adminRouter.use(requireAuth, requireAdmin);

const settingsSchema = z
  .object({
    siteName: z.string().min(1).max(60).optional(),
    supportEmail: z.string().email().max(100).optional(),
    supportPhone: z.string().min(1).max(30).optional(),
    supportAddress: z.string().min(1).max(200).optional(),
    supportHours: z.string().min(1).max(100).optional(),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Hex color (#RRGGBB)").optional(),
    siteUrl: z.string().url().max(200).optional().or(z.literal("")),
    smtpHost: z.string().max(150).optional(),
    smtpPort: z.number().int().min(1).max(65535).optional(),
    smtpUser: z.string().max(150).optional(),
    smtpPass: z.string().max(200).optional(),
    smtpFrom: z.string().email().max(150).optional().or(z.literal("")),
    smtpSecure: z.boolean().optional(),
    smtpPaused: z.boolean().optional(),
    aiProvider: z.enum(["openai", "gemini", "ollama", ""]).optional(),
    aiApiKey: z.string().max(200).optional(),
    aiBaseUrl: z.string().max(200).optional().or(z.literal("")),
    aiModel: z.string().max(100).optional(),
    supportTicketMediaRetentionDays: z.number().int().min(1).max(3650).optional(),
    chatHistoryRetentionDays: z.number().int().min(1).max(3650).optional(),
    deviceTelemetryRetentionDays: z.number().int().min(1).max(3650).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "At least one field to update" });

// ---------- Stats & Settings & Users ----------
adminRouter.get("/stats", adminController.getStats);
adminRouter.get("/settings", adminController.getSettings);
adminRouter.put("/settings", validateBody(settingsSchema), adminController.putSettings);
adminRouter.post("/settings/test-email", adminController.testSmtpEmail);
adminRouter.post("/settings/ai-test", adminController.testAiConnection);
adminRouter.get("/users", adminController.getUsers);
adminRouter.get("/users/:id", adminController.getUserById);

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().max(100),
  password: z.string().min(6).max(255),
  role: z.enum(["user", "system_admin"]).optional(),
});

/** Admin se naya user banao (temp password ke saath) — user management complete karne ke liye. */
adminRouter.post("/users", validateBody(createUserSchema), adminController.postUsers);

/** User ko password reset email bhejo (forgot-password jaisa hi flow — token + email). */
adminRouter.post("/users/:id/send-reset-email", adminController.postUsersIdSendResetEmail);

/** Admin directly user ka password reset karo (bina email ke). */
const resetPasswordSchema = z.object({
  password: z.string().min(6).max(255),
});
adminRouter.post("/users/:id/reset-password", validateBody(resetPasswordSchema), adminController.postUsersIdResetPassword);

// ---------- Broadcast ----------

const broadcastLimiter = rateLimit({
  name: "admin:broadcast",
  windowMs: 60 * 60_000,
  max: 5,
  message: "Bahut zyada broadcasts — 1 ghanta baad try karo",
});

const broadcastSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  sendEmail: z.boolean().optional(),
});

/** In-app bulk broadcast — offer/announcement sab users ko (bell + realtime; email best-effort). */
adminRouter.post("/broadcast", broadcastLimiter, validateBody(broadcastSchema), adminController.postBroadcast);

adminRouter.patch("/users/:id/status", adminController.patchUsersIdStatus);

adminRouter.patch("/users/:id/role", adminController.patchUsersIdRole);

adminRouter.delete("/users/:id", adminController.deleteUsersId);

// ---------- Homes ----------

adminRouter.get("/homes", adminController.getHomes);

adminRouter.get("/homes/:id", adminController.getHomesId);

adminRouter.patch("/homes/:id/status", adminController.patchHomesIdStatus);

adminRouter.delete("/homes/:id", adminController.deleteHomesId);

// ---------- Devices ----------

adminRouter.get("/devices", adminController.getDevices);

/** Global admin search — ek query se users/homes/devices/ESPs/orders/serials sab me ek saath. */
adminRouter.get("/search", adminController.getSearch);

// ---------- API keys ----------

adminRouter.get("/api-keys", adminController.getApiKeys);

/** Flasher ke liye: user ke liye naya API key banao (userId/homeId pe bind).
 * GUI me order fetch pe key nahi mili (buyer ka home nahi) to yahi call hota hai. */
adminRouter.post("/api-keys", adminController.postApiKeys);

adminRouter.delete("/api-keys/:id", adminController.deleteApiKeysId);

// ---------- Audit log ----------

/** Customer support 'find by anything' — phone / order / serial / MAC / naam se turant context. */
adminRouter.get("/find", adminController.getFind);

adminRouter.get("/audit", adminController.getAudit);

// ============================================================
// ---------- Diagnostics: app log (crash 503 ka asli reason yahan milega) ----------
const ciCache: { key: string; at: number; value: CiStatus } = { key: "", at: 0, value: { status: "unknown" } };
/** Latest main commit — marker/git dono missing ho to fallback (GitHub API).
 * Production pe .git nahi hota aur deploy.json wipe bhi ho sakta hai — isliye
 * API khud apne repo ka current main commit fetch karta hai (60s cache). */
const latestCache: { at: number; value: { commit: string; branch: string; ts: string } | null } = { at: 0, value: null };
adminRouter.get("/lan-info", adminController.getLanInfo);

// ---------------------------------------------------------------------------
// URL reachability check — Guide page ke "Test connection" button ke liye.
// Board ko dikhne wala URL (ESP Server URL) isi se test hota hai: server us
// URL pe HTTP GET karta hai — koi bhi response = reachable (200/404/redirect
// sab server alive batate hain), timeout/refused = nahi. Private/LAN IPs
// allowed (localhost-first me boards LAN pe hote hain) — admin-only + rate
// limited isliye SSRF-ish abuse na ho.
// ---------------------------------------------------------------------------
const checkUrlLimiter = rateLimit({
  name: "admin:check-url",
  windowMs: 60_000,
  max: 30,
  message: "Bahut zyada URL checks — thodi der baad try karo",
});

const checkUrlSchema = z.object({ url: z.string().min(1).max(300) });

adminRouter.post("/check-url", checkUrlLimiter, validateBody(checkUrlSchema), adminController.postCheckUrl);

adminRouter.get("/deploy-info", adminController.getDeployInfo);

adminRouter.get("/diagnostics", adminController.getDiagnostics);

adminRouter.get("/logs", adminController.getLogs);

// ESP / OTA — connected ESPs (IPs, firmware) + firmware publish + push
// ============================================================

// Published firmware lives in <repo>/hardware/firmware, served at /firmware.
// Plesk pe cwd site/apps hota hai — repo root wala path paths.ts se aata hai.
// Server (Plesk) pe write permission na ho to app ko crash mat hone do —
// upload waqt friendly error dikhega.
try {
  fs.mkdirSync(firmwareDir, { recursive: true });
} catch (err) {
  console.warn(`[firmware] cannot create ${firmwareDir}:`, err instanceof Error ? err.message : err);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, firmwareDir),
    filename: (_req, _file, cb) => cb(null, "firmware.bin"),
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB is plenty for ESP32 .bin
});

/** ESP boards — ek row per PHYSICAL board (MAC se), under me controlled devices. */
adminRouter.get("/esp", adminController.getEsp);

/**
 * Admin support: ESP ke home ke liye fresh API key issue karo.
 * Full key sirf isi response me milta hai (hash store hota hai) — admin
 * copy karke user ko de sakta hai (portal/flasher me paste karne ke liye).
 */
adminRouter.post("/esp/:id/key", adminController.postEspIdKey);

/** Rename an ESP board (admin friendly name). */
/**
 * Board cleanup (support ke liye): stale/offline boards + naam-serial mismatch detect.
 * Naam-serial mismatch = naam auto-pattern (`serial · ssid`) jaisa dikhta hai par
 * current serial/ssid se match nahi karta — matlab purana/stale naam (custom
 * rename hua naam isse flag nahi hota). Support ek click me sahi naam laga sakta hai.
 */
adminRouter.get("/esp/issues", adminController.getEspIssues);

adminRouter.patch("/esp/:id", adminController.patchEspId);

/** Board ki rename history (user + admin dono ke renames) — tracking/security. */
adminRouter.get("/esp/:id/history", adminController.getEspIdHistory);

/** Firmware version history. */
adminRouter.get("/firmware", adminController.getFirmware);

/** Upload a new firmware .bin + version + release notes -> publish as current.
 * model = "2CH" | "4CH" | "8CH" | "DIM-3S" | "DIM-4S" | "" (universal). */
adminRouter.post("/firmware", upload.single("firmware"), adminController.postFirmware);

/** Mark an existing firmware version as the current one (per model). */
adminRouter.post("/firmware/:id/activate", adminController.postFirmwareIdActivate);

/** ---------- Device support (customer service) ---------- */

/** Admin se kisi bhi device ko turant control karo (ON/OFF) — support ke liye. */
adminRouter.post("/devices/:id/status", adminController.postDevicesIdStatus);

/** Device ka full support view — info + recent logs + pending commands + linked ESP board. */
adminRouter.get("/devices/:id/support", adminController.getDevicesIdSupport);
/** Rotate console password for an ESP board (sends MQTT payload and updates DB). */
adminRouter.post("/esp/:id/rotate-console-password", adminController.postEspIdRotateConsolePassword);

/** Fix: stuck pending commands ko clear karo (device fir se responsive ho jayega). */
adminRouter.post("/devices/:id/clear-commands", adminController.postDevicesIdClearCommands);

/** Push the current firmware to ONE device (updates on its next heartbeat).
 * Firmware resolution board ke model se hota hai (model-specific > universal). */
adminRouter.post("/devices/:id/push-ota", adminController.postDevicesIdPushOta);

/** Push the current firmware to ALL devices (or one home with homeId). */
adminRouter.post("/devices/push-ota-all", adminController.postDevicesPushOtaAll);

/** Quick reachability probe of an ESP board's web panel (HTTP GET with timeout). */
adminRouter.get("/esp/:id/probe", adminController.getEspIdProbe);

// ---------- Shop: Products ----------

adminRouter.get("/products", adminController.getProducts);

adminRouter.post("/products", adminController.postProducts);

adminRouter.patch("/products/:id", adminController.patchProductsId);

adminRouter.delete("/products/:id", adminController.deleteProductsId);

// Product media upload (photos, PDFs, datasheets, diagrams)
const productMediaUpload = multer({ storage: cloudinaryProductStorage });

adminRouter.post("/products/:id/media", productMediaUpload.single("file"), adminController.postProductsIdMedia);


adminRouter.delete("/products/media/:mediaId", adminController.deleteProductsMediaMediaId);

// ---------- Shop: Orders ----------

adminRouter.get("/orders", adminController.getOrders);

/** Ek order ka pura detail (bill/print ke liye) — items + buyer + payment. */
adminRouter.get("/orders/:id", adminController.getOrdersId);

adminRouter.patch("/orders/:id/status", adminController.patchOrdersIdStatus);

adminRouter.patch("/orders/:id/payment-status", adminController.patchOrdersIdPaymentStatus);

// ---------- Shop: Serial Registry ----------

adminRouter.get("/serials", adminController.getSerials);

/** Serial detail — kisne claim kiya, kaun sa order, home, warranty (admin click pe). */
adminRouter.get("/serials/:code", adminController.getSerialsCode);

adminRouter.post("/serials/generate", adminController.postSerialsGenerate);

/** Delete serial — sirf available (unclaimed) serials delete kar sakte ho. */
adminRouter.delete("/serials/:code", adminController.deleteSerialsCode);

/** Bulk delete serials — sirf available (unclaimed) serials delete ho sakte hain. */
adminRouter.delete("/serials", adminController.deleteSerials);

// ---------- Manufacturing: Order Provision + Serial Test ----------

/**
 * Flasher: order ke liye ek naya serial banao aur order se link karo.
 * Har board (quantity × item) ko apna unique serial chahiye — har call ek
 * naya serial banata hai (registry me create + orderId set). Item ka
 * serialCode pehla serial dikhata hai (ship/claim flow ke liye).
 * Jab order ki total quantity ke serial ban chuke ho, "DONE" signal deta hai
 * taaki flasher Next Board pe aage badhe.
 */
adminRouter.post("/orders/:id/serials/generate", adminController.postOrdersIdSerialsGenerate);

/** Flasher GUI ke liye: order ki items + serials + WiFi (decrypted) — admin only. */
adminRouter.get("/orders/:id/provision", adminController.getOrdersIdProvision);

/** Flasher: serial ko factory-tested mark karo (relay self-test pass hone ke baad). */
adminRouter.post("/serials/:code/mark-tested", adminController.postSerialsCodeMarkTested);

// ---------- Warranty (admin) ----------

adminRouter.get("/warranty", adminController.getWarranty);

/** Claim status update: approved / rejected / resolved. */
adminRouter.patch("/warranty/:id/status", adminController.patchWarrantyIdStatus);

// ---------- Contact / Feedback (public form se) ----------

adminRouter.get("/contact", adminController.getContact);

adminRouter.patch("/contact/:id/status", adminController.patchContactIdStatus);

adminRouter.delete("/contact/:id", adminController.deleteContactId);

// ---------- Danger zone: Site reset ----------

const resetSchema = z.object({
  mode: z.enum(["data", "factory"]),
  confirm: z.literal("RESET"),
});

/**
 * Admin power: poora test/data saaf karo.
 *  - mode "data"    — saare users/devices/orders/notifications/support clear;
 *                    system_admin account + product catalog + firmware versions rahenge.
 *  - mode "factory" — SAB kuch (admin bhi) clear → app setup mode (install wizard).
 * Confirm ke liye body me "RESET" type karna zaroori hai.
 */
adminRouter.post("/reset", validateBody(resetSchema), adminController.postReset);

// ─── APK Release Upload Endpoint ───────────────────────────────────────────
const apkDir = webPublicMobileAppDir;
try {
  fs.mkdirSync(apkDir, { recursive: true });
} catch (e) {}

const apkUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, apkDir),
    filename: (_req, file, cb) => {
      cb(null, `upload_${Date.now()}_${file.originalname}`);
    },
  }),
  limits: { fileSize: 300 * 1024 * 1024 }, // 300 MB limit for APK files
});

adminRouter.get("/apk/status", adminController.getApkStatus);

adminRouter.post("/apk/upload", apkUpload.single("apkFile"), adminController.postApkUpload);

// ---------- Shop: Coupons ----------
adminRouter.get("/coupons", adminController.getCoupons);

adminRouter.post("/coupons", adminController.postCoupons);

adminRouter.patch("/coupons/:id", adminController.patchCouponsId);

adminRouter.delete("/coupons/:id", adminController.deleteCouponsId);
