import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import fs from "node:fs";
import { corsOrigins } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import {
  firmwareDir,
  webDist,
  mobileAppDir,
  webPublicMobileAppDir,
  uploadsDir,
  apiRoot,
  getMobileAppCandidateDirs,
  getSpaIndexHtmlPath,
  getCandidateAssetDirs,
} from "./lib/paths";
import { apiRouter } from "./routes";
import { installRouter } from "./routes/install.routes";
import { docsRouter } from "./routes/docs.routes";
import { publicRouter } from "./routes/public.routes";
import { mqttRouter } from "./routes/mqtt.routes";
import { isDbReady } from "./lib/dbState";
import { fileLog } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { trackRequest } from "./lib/requestTracker";
import { setLastSeenHost } from "./lib/healthMonitor";
import { getSiteSettings } from "./services/siteSettings.service";

/** Public API version — ops/diagnostics ke liye (health ke build field se sync). */
const API_VERSION = "2.2.0";

/** Health diagnostics — models/tables present hain ya nahi (deploy issue pehchanna). */
async function schemaDiag() {
  try {
    const p = prisma as unknown as Record<string, unknown> | null;
    const models = {
      deviceAccess: Boolean(p && typeof p.deviceAccess === "object"),
      deviceUsage: Boolean(p && typeof p.deviceUsage === "object"),
      homeMemberRestricted: Boolean(p && typeof p.homeMember === "object"),
      supportChatSettings: Boolean(p && typeof p.supportChatSettings === "object"),
    };
    const table = async (t: string) => {
      try {
        const r = await prisma.$queryRaw<{ c: bigint }[]>`
          SELECT COUNT(*) AS c FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name = ${t}
        `;
        return Number(r[0]?.c ?? 0) > 0;
      } catch {
        return false;
      }
    };
    return {
      models,
      tables: {
        device_access: await table("device_access"),
        device_usage: await table("device_usage"),
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "diag failed" };
  }
}

export function createApp() {
  const app = express();

  // Health monitor ko apna public URL batao (admin/ESP requests ka Host header).
  app.use((req, _res, next) => {
    if (req.headers.host) setLastSeenHost(req.headers.host);
    next();
  });

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );

  // Razorpay webhooks require raw body for HMAC verification
  app.use("/api/webhooks/razorpay", express.raw({ type: "application/json" }));

  app.use(express.json({ limit: "4mb" }));
  // ESP32 posts form-encoded data (application/x-www-form-urlencoded).
  app.use(express.urlencoded({ extended: true }));

  // Production crash diagnosis: har request log file me (start + end).
  // Koi request process ko maare to last logged line hi culprit hai.
  app.use((req, res, next) => {
    const start = Date.now();
    // Site usage / traffic monitoring — har API request count hota hai
    trackRequest();
    fileLog(`[req] ${new Date().toISOString()} START ${req.method} ${req.originalUrl}`);
    res.on("finish", () => {
      fileLog(`[req] ${new Date().toISOString()} END ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    res.on("close", () => {
      if (!res.writableEnded) {
        fileLog(`[req] ${new Date().toISOString()} ABORT ${req.method} ${req.originalUrl} (${Date.now() - start}ms) - connection closed before response`);
      }
    });
    next();
  });

  const handleHealth = async (_req: express.Request, res: express.Response) => {
    try {
      const diag = await schemaDiag();
      res.json({
        success: true,
        data: {
          status: "ok",
          ts: new Date().toISOString(),
          schema: diag,
          build: API_VERSION,
        },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: {
          code: "HEALTH_CHECK_FAILED",
          message: err instanceof Error ? err.message : "Health check error",
        },
      });
    }
  };

  // Health check: probe + manual check. DB disconnect ho tab bhi 200 (schema status ke saath).
  app.get("/health", handleHealth);
  app.get("/api/health", handleHealth);

  // Install / setup check
  app.get("/api/setup-status", async (_req, res) => {
    res.json({
      success: true,
      data: {
        isInstalled: true,
        dbReady: isDbReady(),
        message: isDbReady()
          ? "SwitchNest is operational"
          : "Database initialization in progress",
      },
    });
  });

  const getVersion = async (req: express.Request, res: express.Response) => {
    const requestHost = req.get('host') || '192.168.1.36:4000';
    const protocol = req.protocol || 'http';
    const settings = await getSiteSettings();

    res.json({
      success: true,
      data: {
        version: API_VERSION,
        mobileAppOptions: {
          minRequiredVersion: settings.mobileAppMinVersion || "1.0.0",
          latestVersion: settings.mobileAppVersion || "1.0.11",
          downloadUrl: `${protocol}://${requestHost}/mobile-app/SwitchNest_Latest.apk`,
          updateMessage: settings.mobileAppUpdateMessage || "New Mobile App Release Available!",
          releaseNotes: settings.mobileAppReleaseNotes || "New features and bug fixes",
          isMandatory: settings.mobileAppIsMandatory === true,
        },
        ts: new Date().toISOString()
      }
    });
  };

  app.get("/api/version", getVersion);
  app.get("/version", getVersion);

  app.use("/install", installRouter);

  // Public routes (site-settings, contact, etc.) hamesha available.
  app.use("/api/public", publicRouter);
  app.use("/public", publicRouter);

  // API docs hamesha available — setup mode me bhi (DB nahi chahiye).
  app.use("/api/docs", docsRouter);
  app.use("/docs", docsRouter);

  // EMQX Webhook APIs
  app.use("/api/mqtt", mqttRouter);

  // Main API Router
  app.use("/api", apiRouter);

  // Serve published ESP32 firmware at /firmware/firmware.bin (OTA downloads).
  app.use("/firmware", express.static(firmwareDir));

  // Serve User Uploads at /uploads (Avatars, pictures).
  app.use("/uploads", express.static(uploadsDir));

  // Serve compiled Mobile APK releases across all candidate directories.
  const apkCandidateDirs = getMobileAppCandidateDirs();
  for (const dir of apkCandidateDirs) {
    if (dir && fs.existsSync(dir)) {
      app.use("/mobile-app", express.static(dir));
    }
  }

  // Explicit route handler for /mobile-app/:filename to guarantee APK downloads
  app.get("/mobile-app/:filename", (req, res, next) => {
    const filename = path.basename(req.params.filename);
    for (const dir of apkCandidateDirs) {
      if (dir && fs.existsSync(dir)) {
        const targetPath = path.join(dir, filename);
        if (fs.existsSync(targetPath)) {
          return res.sendFile(targetPath);
        }
      }
    }
    next();
  });

  // Production: built web app (Vite dist) serving
  const assetDirs = getCandidateAssetDirs();
  for (const dir of assetDirs) {
    app.use(
      "/assets",
      express.static(dir, {
        maxAge: "1y",
        immutable: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".js")) res.setHeader("Content-Type", "application/javascript");
          else if (filePath.endsWith(".css")) res.setHeader("Content-Type", "text/css");
        },
      }),
    );
  }

  // Fallback for stale asset requests
  app.use("/assets", (req, res, next) => {
    if (req.path.endsWith(".js")) {
      for (const dir of assetDirs) {
        try {
          const files = fs.readdirSync(dir);
          const latestJs = files.find((f) => f.startsWith("index-") && f.endsWith(".js"));
          if (latestJs) {
            res.setHeader("Content-Type", "application/javascript");
            return res.sendFile(path.join(dir, latestJs));
          }
        } catch {
          /* ignore */
        }
      }
    }
    next();
  });

  const sendSpaHtml = (_req: express.Request, res: express.Response) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const htmlPath = getSpaIndexHtmlPath();
    if (htmlPath) {
      return res.sendFile(htmlPath);
    }
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>SwitchNest</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#090d16;color:#f3f4f6;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;padding:2rem;background:#111827;border-radius:12px;border:1px solid #1f2937;max-width:480px;">
    <h1 style="font-size:1.5rem;color:#60a5fa;margin-bottom:0.5rem;">SwitchNest Platform</h1>
    <p style="color:#9ca3af;font-size:0.95rem;">Backend is online & operational (v${API_VERSION}).</p>
    <p style="color:#6b7280;font-size:0.85rem;margin-top:1rem;">Initializing user interface assets...</p>
  </div>
</body>
</html>`);
  };

  for (const dir of [apiRoot, process.cwd(), webDist]) {
    if (dir && fs.existsSync(dir)) {
      app.use(express.static(dir));
    }
  }

  app.get(
    [
      "/",
      "/login",
      "/signup",
      "/install",
      "/activate",
      "/print-serials",
      "/print-bill",
      "/warranty",
      "/forgot-password",
      "/reset-password",
      "/support",
      "/verify-bill",
    ],
    sendSpaHtml,
  );
  app.use(["/install", "/dashboard", "/admin", "/shop"], sendSpaHtml);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  app.use(errorHandler);

  return app;
}
