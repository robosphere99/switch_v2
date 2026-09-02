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
    const models = {
      deviceAccess: typeof (prisma as unknown as Record<string, unknown>).deviceAccess === "object",
      deviceUsage: typeof (prisma as unknown as Record<string, unknown>).deviceUsage === "object",
      homeMemberRestricted: typeof (prisma as unknown as Record<string, unknown>).homeMember === "object",
      supportChatSettings: typeof (prisma as unknown as Record<string, unknown>).supportChatSettings === "object",
    };
    const table = async (t: string) => {
      const r = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = ${t}
      `;
      return Number(r[0]?.c ?? 0) > 0;
    };
    return { models, tables: { device_access: await table("device_access"), device_usage: await table("device_usage") } };
  } catch {
    return { error: "diag failed" };
  }
}

export function createApp() {
  const app = express();

  // Health monitor ko apna public URL batao (admin/ESP requests ka Host header).
  app.use((req, _res, next) => {
    if (req.headers.host) setLastSeenHost(req.headers.host);
    next();
  });

  app.use(helmet());
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

  app.get("/api/health", async (_req, res) => {
    res.json({
      success: true,
      data: { status: "ok", ts: new Date().toISOString(), schema: await schemaDiag(), build: API_VERSION },
    });
  });
  app.get("/health", async (_req, res) => {
    res.json({
      success: true,
      data: { status: "ok", ts: new Date().toISOString(), schema: await schemaDiag(), build: API_VERSION },
    });
  });

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
  app.use("/", apiRouter);

  // Serve published ESP32 firmware at /firmware/firmware.bin (OTA downloads).
  app.use("/firmware", express.static(firmwareDir));

  // Serve User Uploads at /uploads (Avatars, pictures).
  app.use("/uploads", express.static(uploadsDir));

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
  } else if (fs.existsSync(webDistAssets)) {
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

  if (fs.existsSync(apiRootHtml)) {
    app.use(express.static(process.cwd()));
    app.get(/^\/(?!api|firmware|uploads|mobile-app|assets|socket\.io).*/, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(apiRootHtml);
    });
  } else if (fs.existsSync(webDistHtml)) {
    app.use(express.static(webDist));
    app.get(/^\/(?!api|firmware|uploads|mobile-app|assets|socket\.io).*/, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(webDistHtml);
    });
  }

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  app.use(errorHandler);

  return app;
}
