import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { corsOrigins } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
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
  const firmwareDir = path.resolve(process.cwd(), "../../../hardware/firmware");
  app.use("/firmware", express.static(firmwareDir));

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  app.use(errorHandler);

  return app;
}
