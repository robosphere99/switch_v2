import { Request, Response } from "express";
import { ok } from "../lib/response";
import * as deviceApi from "../services/deviceApi.service";

export const readAll = async (req: Request, res: Response) => {
  const mac = req.query.mac as string | undefined;
  if (mac) {
    // V2 Smart Cloud mapping response
    return ok(res, await deviceApi.readAll(req.apiKey!, mac));
  }
  // V1 legacy mapping response
  return ok(res, { devices: await deviceApi.readAll(req.apiKey!) });
};

export const updateDevice = async (req: Request, res: Response) => {
  // Forward the MAC and channel parameters to the service handler
  return ok(res, await deviceApi.updateFromDevice(req.apiKey!, req.body.device_id, req.body.status, req.body.mac, req.body.channel));
};

export const heartbeat = async (req: Request, res: Response) => {
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
};

export const reportOtaProgress = async (req: Request, res: Response) => {
  ok(res, await deviceApi.reportOtaProgress(req.apiKey!, {
    device_id: req.body.device_id,
    progress: req.body.progress,
    status: req.body.status,
  }));
};

export const getCommands = async (req: Request, res: Response) => {
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
};

export const ackCommand = async (req: Request, res: Response) => {
  ok(
    res,
    await deviceApi.ackCommand(
      req.apiKey!,
      req.body.command_id,
      req.body.device_id,
      req.body.status,
    ),
  );
};
