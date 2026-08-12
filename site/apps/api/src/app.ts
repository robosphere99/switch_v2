import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { corsOrigins } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { apiRouter } from "./routes";

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
