import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import fs from "node:fs";
import { corsOrigins } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { firmwareDir, webDist } from "./lib/paths";
import { apiRouter } from "./routes";
import { installRouter } from "./routes/install.routes";
import { isDbReady } from "./lib/dbState";
import { fileLog } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { trackRequest } from "./lib/requestTracker";

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

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );
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
      data: { status: "ok", ts: new Date().toISOString(), schema: await schemaDiag() },
    });
  });

  // Install routes hamesha available — setup mode me bhi.
  app.use("/api/install", installRouter);

  // Setup mode (DB install pending) — baaki saare routes 503.
  app.use("/api", (req, res, next) => {
    if (isDbReady()) return next();
    res.status(503).json({
      success: false,
      error: {
        code: "NOT_INSTALLED",
        message: "Database not installed yet — run installation first (GET/POST /api/install)",
      },
    });
  });

  app.use("/api", apiRouter);

  // Serve published ESP32 firmware at /firmware/firmware.bin (OTA downloads).
  // Folder: <repo>/hardware/firmware — written by the admin firmware upload.
  app.use("/firmware", express.static(firmwareDir));

  // Production: built web app (Vite dist) ko bhi API hi serve karta hai —
  // Plesk pe ek hi Node.js app se sab chalta hai (dev me Vite proxy hota hai).
  if (fs.existsSync(path.join(webDist, "index.html"))) {
    app.use(express.static(webDist));
    // SPA fallback — API/firmware/socket paths JSON 404 dete hain.
    app.get(/^\/(?!api|firmware|socket\.io).*/, (_req, res) => {
      res.sendFile(path.join(webDist, "index.html"));
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
