import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export const alexaRouter = Router();

// Middleware to extract and verify OAuth Access Token for Alexa requests
const requireAlexaAuth = async (req: Request, res: Response, next: any) => {
    // Alexa passes token within the payload: req.body.directive.endpoint.scope.token or req.body.directive.payload.scope.token
    const directive = req.body.directive;
    let token = null;

    if (directive?.endpoint?.scope?.token) token = directive.endpoint.scope.token;
    else if (directive?.payload?.scope?.token) token = directive.payload.scope.token;
    else if (directive?.payload?.grantee?.token) token = directive.payload.grantee.token;

    if (!token) {
        return res.status(401).json({ error: "Missing token in directive" });
    }

    const oauthToken = await prisma.oAuthToken.findUnique({
        where: { accessToken: token },
    });

    if (!oauthToken || oauthToken.expiresAt < new Date()) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }

    const conn = await prisma.integrationConnection.findFirst({
        where: { userId: oauthToken.userId, homeId: oauthToken.homeId, provider: "alexa", status: "active" }
    });

    if (!conn) {
        return res.status(401).json({ error: "Alexa integration revoked" });
    }

    (req as any).oauthToken = oauthToken;
    next();
};

alexaRouter.post("/directive", requireAlexaAuth, async (req: Request, res: Response) => {
    const directive = req.body.directive;
    const header = directive.header;
    const namespace = header.namespace;
    const name = header.name;

    const oauthToken = (req as any).oauthToken;
    const userId = oauthToken.userId;
    const homeId = oauthToken.homeId;

    try {
        if (namespace === "Alexa.Discovery" && name === "Discover") {
            const allHomeDevices = await prisma.device.findMany({ where: { homeId } });

            const endpoints = allHomeDevices.map(d => ({
                endpointId: String(d.id),
                manufacturerName: "SwitchNest",
                friendlyName: d.name,
                description: `SwitchNest ${d.type} device`,
                displayCategories: d.type === "bulb" ? ["LIGHT"] : d.type === "plug" ? ["SMARTPLUG"] : ["SWITCH"],
                cookie: {},
                capabilities: [
                    {
                        type: "AlexaInterface",
                        interface: "Alexa.PowerController",
                        version: "3",
                        properties: {
                            supported: [{ name: "powerState" }],
                            proactivelyReported: false,
                            retrievable: true
                        }
                    },
                    {
                        type: "AlexaInterface",
                        interface: "Alexa",
                        version: "3"
                    }
                ]
            }));

            return res.json({
                event: {
                    header: {
                        namespace: "Alexa.Discovery",
                        name: "Discover.Response",
                        payloadVersion: "3",
                        messageId: header.messageId + "-response"
                    },
                    payload: { endpoints }
                }
            });
        }
        else if (namespace === "Alexa.PowerController") {
            const endpointId = directive.endpoint.endpointId;
            const deviceId = parseInt(endpointId, 10);

            const device = await prisma.device.findFirst({ where: { homeId, id: deviceId } });

            if (!device) {
                return res.json({
                    event: {
                        header: {
                            namespace: "Alexa",
                            name: "ErrorResponse",
                            payloadVersion: "3",
                            messageId: header.messageId + "-error",
                            correlationToken: header.correlationToken
                        },
                        endpoint: { endpointId: String(deviceId) },
                        payload: {
                            type: "NO_SUCH_ENDPOINT",
                            message: "Device not found in SwitchNest"
                        }
                    }
                });
            }

            let powerStateValue = "OFF";
            if (name === "TurnOn") {
                powerStateValue = "ON";
            }

            const newStatus = powerStateValue === "ON" ? "on" : "off";

            await prisma.deviceCommand.create({
                data: {
                    deviceId,
                    actorId: userId,
                    command: newStatus,
                    status: "pending"
                }
            });

            await prisma.device.update({
                where: { id: deviceId },
                data: { status: newStatus }
            });

            const now = new Date().toISOString();
            return res.json({
                context: {
                    properties: [
                        {
                            namespace: "Alexa.PowerController",
                            name: "powerState",
                            value: powerStateValue,
                            timeOfSample: now,
                            uncertaintyInMilliseconds: 50
                        }
                    ]
                },
                event: {
                    header: {
                        namespace: "Alexa",
                        name: "Response",
                        payloadVersion: "3",
                        messageId: header.messageId + "-response",
                        correlationToken: header.correlationToken
                    },
                    endpoint: {
                        scope: {
                            type: "BearerToken",
                            token: oauthToken.accessToken
                        },
                        endpointId: String(deviceId)
                    },
                    payload: {}
                }
            });
        }

        // Default error response
        return res.json({
            event: {
                header: {
                    namespace: "Alexa",
                    name: "ErrorResponse",
                    payloadVersion: "3",
                    messageId: header.messageId + "-error",
                    correlationToken: header.correlationToken
                },
                payload: {
                    type: "INVALID_DIRECTIVE",
                    message: "Unsupported operation"
                }
            }
        });

    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});
