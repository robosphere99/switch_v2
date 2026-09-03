import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import fs from "node:fs";
import { corsOrigins } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { firmwareDir, webDist, mobileAppDir, uploadsDir } from "./lib/paths";
import { apiRouter } from "./routes";
import { installRouter } from "./routes/install.routes";
import { docsRouter } from "./routes/docs.routes";
import { publicRouter } from "./routes/public.routes";
import { isDbReady } from "./lib/dbState";
import { fileLog } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { trackRequest } from "./lib/requestTracker";
import { setLastSeenHost } from "./lib/healthMonitor";

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
        data: { status: "ok", ts: new Date().toISOString(), schema: diag, build: API_VERSION },
      });
    } catch (err) {
      // Health route should never crash or return 500
      res.json({
        success: true,
        data: {
          status: "degraded",
          ts: new Date().toISOString(),
          error: err instanceof Error ? err.message : "health check error",
          build: API_VERSION,
        },
      });
    }
  };

  app.get("/api/health", handleHealth);
  app.get("/health", handleHealth);

  const getVersion = (req: express.Request, res: express.Response) => {
    const requestHost = req.get('host') || '192.168.1.36:4000';
    const protocol = req.protocol || 'http';
    const latestVersion = "1.0.11";
    const minRequiredVersion = "1.0.0";

    res.json({
      success: true,
      data: {
        version: API_VERSION,
        mobileAppOptions: {
          minRequiredVersion,
          latestVersion,
          downloadUrl: `${protocol}://${requestHost}/mobile-app/SwitchNest_Latest.apk`,
          updateMessage: "ESP WebServer & Background Call Fixes",
          releaseNotes: "• Added In-App ESP WebServer\n• Fixed Call Ringing on Multiple Devices\n• Fixed ESP Hardware State Sync UI Glitch",
          isMandatory: true,
        },
        ts: new Date().toISOString()
      }
    });
  };

  app.get("/api/version", getVersion);
  app.get("/version", getVersion);

  // Install routes hamesha available — setup mode me bhi.
  app.use("/api/install", installRouter);
  app.use("/install", installRouter);

  // Public routes (site-settings, contact, etc.) hamesha available.
  app.use("/api/public", publicRouter);
  app.use("/public", publicRouter);

  // API docs hamesha available — setup mode me bhi (DB nahi chahiye).
  app.use("/api/docs", docsRouter);
  app.use("/docs", docsRouter);

  // Setup mode (DB install pending) — baaki saare routes 503.
  const checkDbSetup = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isDbReady()) return next();
    res.status(503).json({
      success: false,
      error: {
        code: "NOT_INSTALLED",
        message: "Database not installed yet — run installation first (GET/POST /api/install)",
      },
    });
  };

  app.use("/api", checkDbSetup);
  app.use("/api", apiRouter);

  // Serve published ESP32 firmware at /firmware/firmware.bin (OTA downloads).
  app.use("/firmware", express.static(firmwareDir));

  // Serve User Uploads at /uploads (Avatars, pictures).
  // Auto-create on startup so it exists on Plesk even without deploy.cmd.
  for (const sub of ["", "avatars", "product-media", "support", "firmware"]) {
    const dir = sub ? path.join(uploadsDir, sub) : uploadsDir;
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    }
  }
  app.use("/uploads", express.static(uploadsDir, {
    // Serve images with cache headers
    maxAge: "7d",
    // Don't fall through to 404 for missing files — return proper 404 JSON
    fallthrough: true,
  }));

  // Serve compiled Mobile APK releases.
  app.use("/mobile-app", express.static(mobileAppDir));

  // Production: built web app (Vite dist) ko bhi API hi serve karta hai —
  // Plesk pe ek hi Node.js app se sab chalta hai. sync-api.mjs index.html ko api folder me copy karta hai.
  const apiRootHtml = path.join(process.cwd(), "index.html");
  const apiAssetsDir = path.join(process.cwd(), "assets");
  const webDistHtml = path.join(webDist, "index.html");
  const webDistAssets = path.join(webDist, "assets");

  // Explicitly serve /assets with guaranteed JS/CSS MIME headers
  if (fs.existsSync(apiAssetsDir)) {
    app.use(
      "/assets",
      express.static(apiAssetsDir, {
        maxAge: "1y",
        immutable: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".js")) res.setHeader("Content-Type", "application/javascript");
          else if (filePath.endsWith(".css")) res.setHeader("Content-Type", "text/css");
        },
      }),
    );
  }
  if (fs.existsSync(webDistAssets)) {
    app.use(
      "/assets",
      express.static(webDistAssets, {
        maxAge: "1y",
        immutable: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".js")) res.setHeader("Content-Type", "application/javascript");
          else if (filePath.endsWith(".css")) res.setHeader("Content-Type", "text/css");
        },
      }),
    );
  }

  // Fallback for stale asset requests (e.g. browser requested old index-Bc2133nz.js when new build has index-Df8JkqRD.js)
  app.use("/assets", (req, res, next) => {
    if (req.path.endsWith(".js")) {
      const targetDir = fs.existsSync(apiAssetsDir) ? apiAssetsDir : fs.existsSync(webDistAssets) ? webDistAssets : null;
      if (targetDir) {
        try {
          const files = fs.readdirSync(targetDir);
          const latestJs = files.find((f) => f.startsWith("index-") && f.endsWith(".js"));
          if (latestJs) {
            res.setHeader("Content-Type", "application/javascript");
            return res.sendFile(path.join(targetDir, latestJs));
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
    if (fs.existsSync(apiRootHtml)) {
      res.sendFile(apiRootHtml);
    } else if (fs.existsSync(webDistHtml)) {
      res.sendFile(webDistHtml);
    }
  };

  if (fs.existsSync(apiRootHtml)) {
    app.use(express.static(process.cwd()));
  }
  if (fs.existsSync(webDistHtml)) {
    app.use(express.static(webDist));
  }

  app.get(["/", "/login", "/signup", "/install", "/activate", "/print-serials", "/print-bill", "/warranty", "/forgot-password", "/reset-password", "/support", "/verify-bill"], sendSpaHtml);
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
