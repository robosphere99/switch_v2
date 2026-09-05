import { Router } from "express";
import { z } from "zod";
import { requireApiKey } from "../middleware/apiKey";
import { rateLimit } from "../middleware/rateLimit";
import { validateBody, validateQuery } from "../middleware/validate";
import * as deviceApiController from "../controllers/deviceApi.controller";

/**
 * Device-facing API (ESP32 / clients) — authenticated with a home-scoped
 * API key instead of a JWT. Mirrors the old PHP v1 paths so hardware
 * integration stays simple.
 */
export const deviceApiRouter = Router();

// ESP32 polling endpoints — leak hua api_key se flood na ho. Limits kaafi
// generous: boards har 5-10s poll karte hain (max ~12/min), 1200/min per
// IP ek bade ghar ke saare boards ko bhi cover karta hai.
const readLimiter = rateLimit({
  name: "device:read",
  windowMs: 60_000,
  max: 1200,
  message: "Too many device API requests",
});
const mutateLimiter = rateLimit({
  name: "device:mutate",
  windowMs: 60_000,
  max: 600,
  message: "Too many device API requests",
});

const keyQuery = z.object({
  api_key: z.string().min(1),
  // Long-poll mode (ESP32 v2 firmware): `long=1&hold=20` — server response ko
  // hold karta hai jab tak command na aaye (max hold seconds). Old firmware
  // bina long=1 ke same instant behaviour paata hai.
  long: z.string().optional(),
  hold: z.string().optional(),
  mac: z.string().optional(),
});

const updateSchema = z.object({
  api_key: z.string().optional(),
  device_id: z.coerce.number().int().positive().optional(),
  status: z.enum(["on", "off"]),
  mac: z.string().optional(),
  channel: z.coerce.number().int().positive().optional(),
});

const ackSchema = z.object({
  api_key: z.string().optional(),
  command_id: z.coerce.number().int().positive(),
  device_id: z.coerce.number().int().positive().optional(),
  status: z.enum(["executed", "failed"]),
});

// Heartbeat: ESP reports its IP + firmware version + actual relay states,
// and receives an OTA instruction when the admin pushed an update to it.
const heartbeatSchema = z.object({
  api_key: z.string().optional(),
  device_id: z.coerce.number().int().positive().optional(),
  ip: z.string().optional(),
  fw_version: z.string().optional(),
  mac: z.string().optional(),
  ssid: z.string().optional(),
  serial: z.string().optional(),
  model: z.string().optional(),
  states: z.string().optional(),
});

const otaProgressSchema = z.object({
  api_key: z.string().optional(),
  device_id: z.coerce.number().int().positive(),
  progress: z.coerce.number().min(0).max(100),
  status: z.string().max(32).optional(),
});

deviceApiRouter.get(
  "/read-all",
  readLimiter,
  validateQuery(keyQuery),
  requireApiKey,
  deviceApiController.readAll,
);

deviceApiRouter.post(
  "/update",
  mutateLimiter,
  requireApiKey,
  validateBody(updateSchema),
  deviceApiController.updateDevice
);

deviceApiRouter.post(
  "/heartbeat",
  mutateLimiter,
  requireApiKey,
  validateBody(heartbeatSchema),
  deviceApiController.heartbeat
);

deviceApiRouter.post(
  "/ota-progress",
  mutateLimiter,
  requireApiKey,
  validateBody(otaProgressSchema),
  deviceApiController.reportOtaProgress
);

deviceApiRouter.get(
  "/commands",
  validateQuery(keyQuery),
  requireApiKey,
  deviceApiController.getCommands
);

deviceApiRouter.post(
  "/commands/ack",
  mutateLimiter,
  requireApiKey,
  validateBody(ackSchema),
  deviceApiController.ackCommand
);
