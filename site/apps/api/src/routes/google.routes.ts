import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js"; // or implement a specific oauth bearer token middleware

export const googleRouter = Router();

// Middleware to extract and verify OAuth Access Token for Google requests
const requireGoogleAuth = async (req: Request, res: Response, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing Bearer token" });
    }
    const token = authHeader.substring(7);

    const oauthToken = await prisma.oAuthToken.findUnique({
        where: { accessToken: token },
    });

    if (!oauthToken || oauthToken.expiresAt < new Date()) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Find the integration connection
    const conn = await prisma.integrationConnection.findFirst({
        where: { userId: oauthToken.userId, homeId: oauthToken.homeId, provider: "google", status: "active" }
    });

    if (!conn) {
        return res.status(401).json({ error: "Google integration revoked" });
    }

    // Attach the token context to request
    (req as any).oauthToken = oauthToken;
    next();
};

googleRouter.post("/fulfillment", requireGoogleAuth, async (req: Request, res: Response) => {
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
                const devices = await prisma.device.findMany({
                    where: { homeId, access: { some: { userId } } } // using device_access or simple home check
                });
                // We will just map all devices the home has for this MVP
                const allHomeDevices = await prisma.device.findMany({ where: { homeId } });

                const syncDevices = allHomeDevices.map(d => ({
                    id: String(d.id),
                    type: d.type === "bulb" ? "action.devices.types.LIGHT" :
                        d.type === "plug" ? "action.devices.types.OUTLET" :
                            d.type === "ac" ? "action.devices.types.AC" :
                                "action.devices.types.SWITCH",
                    traits: [
                        "action.devices.traits.OnOff"
                    ],
                    name: {
                        defaultNames: [d.name],
                        name: d.name,
                        nicknames: [d.name]
                    },
                    willReportState: false, // For now, basic implementation
                }));

                return res.json({
                    requestId,
                    payload: {
                        agentUserId: String(userId),
                        devices: syncDevices,
                    }
                });
            }

            case "action.devices.QUERY": {
                const payloadDevices = inputs[0].payload.devices || [];
                const deviceIds = payloadDevices.map((d: any) => parseInt(d.id, 10));

                const dbDevices = await prisma.device.findMany({
                    where: { homeId, id: { in: deviceIds } }
                });

                const queryDevices: any = {};
                dbDevices.forEach(d => {
                    queryDevices[d.id] = {
                        status: "SUCCESS",
                        online: !d.offline,
                        on: d.status === "on",
                    };
                });

                return res.json({
                    requestId,
                    payload: {
                        devices: queryDevices
                    }
                });
            }

            case "action.devices.EXECUTE": {
                const commands = inputs[0].payload.commands || [];
                const executeResponses: any[] = [];

                for (const command of commands) {
                    const deviceIds = command.devices.map((d: any) => parseInt(d.id, 10));
                    const execution = command.execution[0]; // { command: 'action.devices.commands.OnOff', params: { on: true } }

                    if (execution.command === "action.devices.commands.OnOff") {
                        const turnOn = execution.params.on;

                        for (const dId of deviceIds) {
                            const device = await prisma.device.findFirst({ where: { homeId, id: dId } });
                            if (!device) {
                                executeResponses.push({
                                    ids: [String(dId)],
                                    status: "ERROR",
                                    errorCode: "deviceNotFound",
                                });
                                continue;
                            }

                            // Create command in existing device command queue
                            const newStatus = turnOn ? "on" : "off";
                            await prisma.deviceCommand.create({
                                data: {
                                    deviceId: dId,
                                    actorId: userId,
                                    command: newStatus,
                                    status: "pending"
                                }
                            });

                            // Optimistically update device state as per existing architecture
                            await prisma.device.update({
                                where: { id: dId },
                                data: { status: newStatus }
                            });

                            executeResponses.push({
                                ids: [String(dId)],
                                status: "SUCCESS",
                                states: {
                                    online: !device.offline,
                                    on: turnOn
                                }
                            });
                        }
                    }
                }

                return res.json({
                    requestId,
                    payload: {
                        commands: executeResponses
                    }
                });
            }

            case "action.devices.DISCONNECT": {
                // Disconnect integration
                await prisma.integrationConnection.updateMany({
                    where: { userId, provider: "google" },
                    data: { status: "revoked" }
                });
                return res.json({});
            }

            default:
                return res.status(400).json({ error: "Unsupported intent" });
        }
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});
