import type { Request, Response } from "express";
import { ok } from "../lib/response";
import * as deviceService from "../services/device.service";

export async function list(req: Request, res: Response) {
  const devices = await deviceService.listDevices(
    Number(req.params.homeId),
    req.user?.sub,
  );
  ok(res, devices);
}

export async function create(req: Request, res: Response) {
  const device = await deviceService.createDevice({
    homeId: Number(req.params.homeId),
    createdBy: req.user!.sub,
    name: req.body.name,
    type: req.body.type,
    roomId: req.body.roomId,
    serialNumber: req.body.serialNumber,
  });
  ok(res, device, 201);
}

export async function setStatus(req: Request, res: Response) {
  const device = await deviceService.setDeviceStatus({
    homeId: Number(req.params.homeId),
    deviceId: Number(req.params.deviceId),
    actorId: req.user!.sub,
    status: req.body.status,
  });
  ok(res, device);
}

export async function bulkSetStatus(req: Request, res: Response) {
  const updated = await deviceService.bulkSetStatus({
    homeId: Number(req.params.homeId),
    actorId: req.user!.sub,
    deviceIds: req.body.deviceIds,
    status: req.body.status,
  });
  ok(res, updated);
}

export async function restart(req: Request, res: Response) {
  const device = await deviceService.sendDeviceCommand({
    homeId: Number(req.params.homeId),
    deviceId: Number(req.params.deviceId),
    actorId: req.user!.sub,
    command: "reboot",
    logType: "remote_restart",
    logMessage: "Remote restart requested",
  });
  ok(res, device);
}

export async function setWifi(req: Request, res: Response) {
  const ssid = String(req.body.ssid).trim();
  const pass = String(req.body.password ?? "");
  const device = await deviceService.sendDeviceCommand({
    homeId: Number(req.params.homeId),
    deviceId: Number(req.params.deviceId),
    actorId: req.user!.sub,
    command: `setwifi:${ssid}|${pass}`,
    logType: "remote_wifi",
    logMessage: `Remote WiFi set: ${ssid}`,
  });
  ok(res, device);
}

export async function setLed(req: Request, res: Response) {
  const enabled = req.body.enabled === true;
  const device = await deviceService.sendDeviceCommand({
    homeId: Number(req.params.homeId),
    deviceId: Number(req.params.deviceId),
    actorId: req.user!.sub,
    command: `led:${enabled ? "on" : "off"}`,
    logType: "remote_led",
    logMessage: `Status LED ${enabled ? "enabled" : "disabled"}`,
  });
  ok(res, device);
}

export async function update(req: Request, res: Response) {
  const device = await deviceService.updateDevice(
    Number(req.params.homeId),
    Number(req.params.deviceId),
    { name: req.body.name, roomId: req.body.roomId },
  );
  ok(res, device);
}

export async function logs(req: Request, res: Response) {
  const logs = await deviceService.getDeviceLogs(
    Number(req.params.homeId),
    Number(req.params.deviceId),
    Number(req.query.limit ?? 50),
  );
  ok(res, logs);
}

export async function remove(req: Request, res: Response) {
  await deviceService.deleteDevice(Number(req.params.homeId), Number(req.params.deviceId));
  ok(res, { message: "Device deleted" });
}

/** User apne home ke ESP board ka naam badal sakta hai (unique naam rule ke saath). */
export async function renameEsp(req: Request, res: Response) {
  const board = await deviceService.renameEsp(
    Number(req.params.homeId),
    Number(req.params.espId),
    String(req.body?.name ?? "").trim().slice(0, 60),
    req.user!.sub,
  );
  ok(res, board);
}

/** User ke saare boards (saare homes me) — My Boards page ke liye. */
export async function listMyBoards(req: Request, res: Response) {
  const data = await deviceService.listMyBoards(req.user!.sub);
  ok(res, data);
}

/** User board pe firmware OTA push kare. */
export async function requestOta(req: Request, res: Response) {
  const data = await deviceService.requestOta(
    Number(req.params.homeId),
    Number(req.params.deviceId),
    req.user!.sub,
  );
  ok(res, data);
}

/** Current published firmware versions — update badge ke liye. */
export async function listCurrentFirmware(_req: Request, res: Response) {
  const versions = await deviceService.listCurrentFirmware();
  ok(res, versions);
}
