import express, { Router } from "express";
import { swaggerUiDir } from "../lib/paths";
import * as docsController from "../controllers/docs.controller";

export const docsRouter = Router();

/** Vendored Swagger UI assets — /api/docs/assets/* (CDN-free, offline + CSP-safe). */
docsRouter.use("/assets", express.static(swaggerUiDir));

docsRouter.get("/", docsController.getSwaggerUi);
docsRouter.get("/openapi.json", docsController.getOpenApiJson);

/** ESP32 integration guide — curl/python/node snippets + Arduino sketch. */
docsRouter.get("/esp32", docsController.getEsp32Guide);

/** Hindi (Devanagari) version of the ESP32 guide — Indian customers ke liye. */
docsRouter.get("/esp32/hi", docsController.getEsp32GuideHi);

/** Realtime events guide (Socket.IO) — web push model + ESP32 command flow. */
docsRouter.get("/realtime", docsController.getRealtimeGuide);

/** Offline-friendly: bina JS/CDN ke saare endpoints ki simple HTML list. */
docsRouter.get("/plain", docsController.getPlainList);
