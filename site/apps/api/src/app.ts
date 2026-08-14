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

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  // ESP32 posts form-encoded data (application/x-www-form-urlencoded).
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok", ts: new Date().toISOString() } });
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
