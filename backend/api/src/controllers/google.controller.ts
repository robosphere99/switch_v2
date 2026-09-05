import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

/**
 * Google Home Smart Home fulfillment handler.
 * Handles SYNC, QUERY, EXECUTE, and DISCONNECT intents.
 */
export const fulfillment = async (req: Request, res: Response) => {
  const payload = req.body;
  const requestId = payload.requestId;
  const inputs = payload.inputs || [];

  if (inputs.length === 0) {
    return res.status(400).json({ error: "Missing inputs" });
  }

  const oauthToken = (req as any).oauthToken;
  const userId = oauthToken.userId;
  const homeId = oauthToken.homeId;

  try {
    const intent = inputs[0].intent;

    switch (intent) {
      case "action.devices.SYNC": {
        const allHomeDevices = await prisma.device.findMany({ where: { homeId } });

        const syncDevices = allHomeDevices.map((d) => ({
          id: String(d.id),
          type:
            d.type === "bulb"
              ? "action.devices.types.LIGHT"
              : d.type === "plug"
                ? "action.devices.types.OUTLET"
                : d.type === "ac"
                  ? "action.devices.types.AC"
                  : "action.devices.types.SWITCH",
          traits: ["action.devices.traits.OnOff"],
          name: {
            defaultNames: [d.name],
            name: d.name,
            nicknames: [d.name],
          },
          willReportState: false,
        }));

        return res.json({
          requestId,
          payload: {
            agentUserId: String(userId),
            devices: syncDevices,
          },
        });
      }

      case "action.devices.QUERY": {
        const payloadDevices = inputs[0].payload.devices || [];
        const deviceIds = payloadDevices.map((d: any) => parseInt(d.id, 10));

        const dbDevices = await prisma.device.findMany({
          where: { homeId, id: { in: deviceIds } },
        });

        const queryDevices: any = {};
        dbDevices.forEach((d) => {
          queryDevices[d.id] = {
            status: "SUCCESS",
            online: !d.offline,
            on: d.status === "on",
          };
        });

        return res.json({
          requestId,
          payload: { devices: queryDevices },
        });
      }

      case "action.devices.EXECUTE": {
        const commands = inputs[0].payload.commands || [];
        const executeResponses: any[] = [];

        for (const command of commands) {
          const deviceIds = command.devices.map((d: any) => parseInt(d.id, 10));
          const execution = command.execution[0];

          if (execution.command === "action.devices.commands.OnOff") {
            const turnOn = execution.params.on;

            for (const dId of deviceIds) {
              const device = await prisma.device.findFirst({
                where: { homeId, id: dId },
              });
              if (!device) {
                executeResponses.push({
                  ids: [String(dId)],
                  status: "ERROR",
                  errorCode: "deviceNotFound",
                });
                continue;
              }

              const newStatus = turnOn ? "on" : "off";
              await prisma.deviceCommand.create({
                data: {
                  deviceId: dId,
                  actorId: userId,
                  command: newStatus,
                  status: "pending",
                },
              });

              await prisma.device.update({
                where: { id: dId },
                data: { status: newStatus },
              });

              executeResponses.push({
                ids: [String(dId)],
                status: "SUCCESS",
                states: {
                  online: !device.offline,
                  on: turnOn,
                },
              });
            }
          }
        }

        return res.json({
          requestId,
          payload: { commands: executeResponses },
        });
      }

      case "action.devices.DISCONNECT": {
        await prisma.integrationConnection.updateMany({
          where: { userId, provider: "google" },
          data: { status: "revoked" },
        });
        return res.json({});
      }

      default:
        return res.status(400).json({ error: "Unsupported intent" });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
