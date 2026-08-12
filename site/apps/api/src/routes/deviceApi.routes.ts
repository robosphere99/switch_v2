import { Router } from "express";
import { z } from "zod";
import { requireApiKey } from "../middleware/apiKey";
import { validateBody, validateQuery } from "../middleware/validate";
import { ok } from "../lib/response";
import * as deviceApi from "../services/deviceApi.service";

/**
 * Device-facing API (ESP32 / clients) — authenticated with a home-scoped
 * API key instead of a JWT. Mirrors the old PHP v1 paths so hardware
 * integration stays simple.
 */
export const deviceApiRouter = Router();

const keyQuery = z.object({ api_key: z.string().min(1) });

const updateSchema = z.object({
  api_key: z.string().optional(),
  device_id: z.coerce.number().int().positive(),
  status: z.enum(["on", "off"]),
});

const ackSchema = z.object({
  api_key: z.string().optional(),
  command_id: z.coerce.number().int().positive(),
  device_id: z.coerce.number().int().positive(),
  status: z.enum(["executed", "failed"]),
});

// Heartbeat: ESP reports its IP + firmware version + actual relay states,
// and receives an OTA instruction when the admin pushed an update to it.
const heartbeatSchema = z.object({
  api_key: z.string().optional(),
  device_id: z.coerce.number().int().positive(),
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
  validateQuery(keyQuery),
  requireApiKey,
  async (req, res) => ok(res, { devices: await deviceApi.readAll(req.apiKey!) }),
);

deviceApiRouter.post(
  "/update",
  requireApiKey,
  validateBody(updateSchema),
  async (req, res) =>
    ok(res, await deviceApi.updateFromDevice(req.apiKey!, req.body.device_id, req.body.status)),
);

deviceApiRouter.post(
  "/heartbeat",
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
  async (req, res) => ok(res, { commands: await deviceApi.pendingCommands(req.apiKey!) }),
);

deviceApiRouter.post(
  "/commands/ack",
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
