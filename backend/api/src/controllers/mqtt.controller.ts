import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import crypto from "node:crypto";
import { logger } from "../lib/logger";

/** SHA-256 hash — same as middleware/apiKey.ts */
function hashKey(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
}

export const emqxAuth = async (req: Request, res: Response) => {
    try {
        // EMQX sends username and password in the body based on your HTTP Auth config
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(401).json({ result: "ignore" });
        }

        const serial = username.toString().trim().toUpperCase();
        const apiKeyPlain = password.toString().trim();

        // Hash the plain key and look up
        const key = await prisma.apiKey.findUnique({
            where: { keyHash: hashKey(apiKeyPlain) },
            select: { id: true, homeId: true, revokedAt: true, expiresAt: true },
        });

        if (!key || !key.homeId) {
            return res.status(401).json({ result: "deny" });
        }
        if (key.revokedAt) {
            return res.status(401).json({ result: "deny" });
        }
        if (key.expiresAt && key.expiresAt < new Date()) {
            return res.status(401).json({ result: "deny" });
        }

        const clientId = req.body.clientid || req.body.client_id;
        let realMac = `PENDING-${serial}`;
        if (clientId && typeof clientId === "string" && clientId.startsWith("sn-")) {
            realMac = clientId.replace("sn-", "").toLowerCase();
        }

        // Resolve ESP board by serial or MAC
        let esp = await prisma.espDevice.findFirst({
            where: {
                OR: [
                    { serialCode: serial },
                    { macAddress: realMac },
                ],
            },
            select: { id: true, macAddress: true, homeId: true },
        });

        if (esp) {
            // Update home/MAC if needed
            const updateData: { homeId?: number; macAddress?: string; serialCode?: string; offline: boolean } = {
                offline: false,
                homeId: key.homeId,
            };
            if (realMac && realMac !== `PENDING-${serial}` && esp.macAddress !== realMac) {
                updateData.macAddress = realMac;
            }
            if (esp.serialCode !== serial) {
                updateData.serialCode = serial;
            }
            await prisma.espDevice.update({
                where: { id: esp.id },
                data: updateData,
            });
        } else {
            // Auto-provision if missing (happens during factory flashing)
            const registry = await prisma.serialRegistry.findUnique({
                where: { serialCode: serial },
                include: { product: true },
            });

            const productName = registry?.product?.name || "SwitchNest Module";
            const modelCode = registry?.product?.modelCode || "4CH";

            esp = await prisma.espDevice.create({
                data: {
                    homeId: key.homeId,
                    macAddress: realMac,
                    name: `${productName} · ${serial}`,
                    serialCode: serial,
                    modelCode,
                    offline: false,
                },
                select: { id: true, macAddress: true, homeId: true },
            });
            logger.info(`[mqtt-auth] Auto-provisioned ESP device ${serial} with MAC ${realMac}`);
        }

        // Track usage
        await prisma.apiKey
            .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
            .catch(() => undefined);

        logger.info(`[mqtt-auth] 🔑 ${serial} authenticated (home ${key.homeId}) via EMQX`);
        
        // Return allow to EMQX
        return res.status(200).json({
            result: "allow",
            is_superuser: false
        });
    } catch (err) {
        logger.warn("[mqtt-auth] auth error", err instanceof Error ? err.message : String(err));
        return res.status(500).json({ result: "ignore" });
    }
};

export const emqxAcl = async (req: Request, res: Response) => {
    try {
        const { username, topic, access } = req.body;
        // access: 1 = subscribe, 2 = publish
        if (!username || !topic) {
            return res.status(403).json({ result: "ignore" });
        }

        const serial = username.toString().trim().toUpperCase();

        // Fast path for backend itself (if we configure a specific superuser, though typically we use internal EMQX auth for backend)
        if (username === process.env.MQTT_USERNAME) {
            return res.status(200).json({ result: "allow" });
        }

        const esp = await prisma.espDevice.findFirst({
            where: { serialCode: serial },
            select: { macAddress: true },
        });

        if (!esp) {
            return res.status(403).json({ result: "deny" });
        }

        const mac = esp.macAddress.replace(/:/g, "").toLowerCase();
        const prefix = `sn/${mac}/`;

        if (topic.startsWith(prefix)) {
            return res.status(200).json({ result: "allow" });
        }

        return res.status(403).json({ result: "deny" });
    } catch (err) {
        logger.warn("[mqtt-acl] acl error", err instanceof Error ? err.message : String(err));
        return res.status(500).json({ result: "ignore" });
    }
};
