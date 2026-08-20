import { Router } from "express";
import { z } from "zod";
import { requireApiKey } from "../middleware/apiKey";
import { rateLimit } from "../middleware/rateLimit";
import { validateBody, validateQuery } from "../middleware/validate";
import { ok } from "../lib/response";
import * as deviceApi from "../services/deviceApi.service";

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

deviceApiRouter.get(
  "/read-all",
  readLimiter,
  validateQuery(keyQuery),
  requireApiKey,
  async (req, res) => {
    const mac = req.query.mac as string | undefined;
    if (mac) {
      // V2 Smart Cloud mapping response
      return ok(res, await deviceApi.readAll(req.apiKey!, mac));
    }
    // V1 legacy mapping response
    return ok(res, { devices: await deviceApi.readAll(req.apiKey!) });
  },
);

deviceApiRouter.post(
  "/update",
  mutateLimiter,
  requireApiKey,
  validateBody(updateSchema),
  async (req, res) => {
    // Forward the MAC and channel parameters to the service handler
    return ok(res, await deviceApi.updateFromDevice(req.apiKey!, req.body.device_id, req.body.status, req.body.mac, req.body.channel));
  }
);

deviceApiRouter.post(
  "/heartbeat",
  mutateLimiter,
  requireApiKey,
  validateBody(heartbeatSchema),
  async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    ok(
      res,
      await deviceApi.heartbeat(
        req.apiKey!,
        {
          device_id: req.body.device_id,
          ip: req.body.ip,
          fw_version: req.body.fw_version,
          mac: req.body.mac,
          ssid: req.body.ssid,
          serial: req.body.serial,
          model: req.body.model,
          states: req.body.states,
        },
        baseUrl,
      ),
    );
  },
);

const otaProgressSchema = z.object({
  api_key: z.string().optional(),
  device_id: z.coerce.number().int().positive(),
  progress: z.coerce.number().min(0).max(100),
  status: z.string().max(32).optional(),
});

deviceApiRouter.post(
  "/ota-progress",
  mutateLimiter,
  requireApiKey,
  validateBody(otaProgressSchema),
  async (req, res) =>
    ok(res, await deviceApi.reportOtaProgress(req.apiKey!, {
      device_id: req.body.device_id,
      progress: req.body.progress,
      status: req.body.status,
    })),
);

deviceApiRouter.get(
  "/commands",
  validateQuery(keyQuery),
  requireApiKey,
  async (req, res) => {
    const long = req.query.long === "1" || req.query.long === "true";
    const mac = req.query.mac as string | undefined;

    if (!long) {
      // Short poll
      return ok(res, { commands: await deviceApi.pendingCommands(req.apiKey!, mac) });
    }
    const holdSec = Math.min(25, Math.max(1, Number(req.query.hold) || 20));
    // Client disconnect pe abort
    const ac = new AbortController();
    res.on("close", () => ac.abort());
    const commands = await deviceApi.pendingCommandsLongPoll(
      req.apiKey!,
      holdSec * 1000,
      ac.signal,
      mac
    );
    if (!res.headersSent) ok(res, { commands });
  },
);

deviceApiRouter.post(
  "/commands/ack",
  mutateLimiter,
  requireApiKey,
  validateBody(ackSchema),
  async (req, res) =>
    ok(
      res,
      await deviceApi.ackCommand(
        req.apiKey!,
        req.body.command_id,
        req.body.device_id,
        req.body.status,
      ),
    ),
);
