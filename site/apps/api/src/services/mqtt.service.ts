/**
 * mqtt.service.ts — Embedded MQTT Broker (Aedes) for SwitchNest IoT.
 *
 * ESP32 boards connect via MQTT instead of HTTP long-polling.
 * Authentication: username = serial code, password = plain API key.
 *
 * Topic contract (board ↔ server):
 *   sn/{mac}/state   — board PUBLISHES relay states          (JSON: { states: [1,0,1,0], fw?, ip?, ssid?, serial?, model? })
 *   sn/{mac}/cmd     — server PUBLISHES commands TO board    (JSON: { commands: [{ ch, action }] })
 *   sn/{mac}/online  — last-will / birth: "1" = online, "0" = offline (retained)
 *
 * Bridge: MQTT ↔ Socket.IO — relay state changes from MQTT are written to the DB
 *         and forwarded to web/mobile clients via the existing socket infrastructure.
 */

import Aedes from "aedes";
import { createServer as createNetServer, type Server as NetServer } from "net";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma";
import { emitDeviceUpdated, emitToHome } from "../lib/socket";
import { logger } from "../lib/logger";

// ---------- config ----------
const MQTT_PORT = Number(process.env.MQTT_PORT) || 1883;

/** SHA-256 hash — same as middleware/apiKey.ts */
function hashKey(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
}


// ---------- broker instance ----------
let broker: InstanceType<typeof Aedes> | null = null;
let tcpServer: NetServer | null = null;

/** Track authenticated clients: clientId → { homeId, espId, mac } */
interface ConnectedDevice {
    homeId: number;
    espId: number;
    mac: string;
    serial: string;
}
const connectedDevices = new Map<string, ConnectedDevice>();

// ---------- public API ----------

/**
 * Start the embedded MQTT broker on a TCP port. Call once at startup
 * alongside initSocket / server.listen.
 */
export function startMqttBroker(): void {
    broker = new Aedes();
    tcpServer = createNetServer(broker.handle);

    // ---- Authentication ----
    broker.authenticate = async (client, username, password, callback) => {
        try {
            if (!username || !password) {
                return callback(new Error("credentials required") as any, false);
            }

            const serial = username.toString().trim().toUpperCase();
            const apiKeyPlain = password.toString().trim();

            // Hash the plain key and look up (same as middleware/apiKey.ts)
            const key = await prisma.apiKey.findUnique({
                where: { keyHash: hashKey(apiKeyPlain) },
                select: { id: true, homeId: true, revokedAt: true, expiresAt: true },
            });
            if (!key || !key.homeId) {
                return callback(new Error("invalid API key") as any, false);
            }
            if (key.revokedAt) {
                return callback(new Error("API key revoked") as any, false);
            }
            if (key.expiresAt && key.expiresAt < new Date()) {
                return callback(new Error("API key expired") as any, false);
            }

            // Resolve ESP board by serial
            const esp = await prisma.espDevice.findFirst({
                where: { serialCode: serial, homeId: key.homeId },
                select: { id: true, macAddress: true },
            });
            if (!esp) {
                return callback(new Error("device not registered") as any, false);
            }

            // Stash metadata on the client for use in publish/subscribe handlers
            connectedDevices.set(client.id, {
                homeId: key.homeId,
                espId: esp.id,
                mac: esp.macAddress,
                serial,
            });

            // Track usage
            await prisma.apiKey
                .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
                .catch(() => undefined);

            logger.info(`[mqtt] 🔑 ${serial} authenticated (home ${key.homeId})`);
            callback(null, true);
        } catch (err) {
            logger.warn("[mqtt] auth error", err instanceof Error ? err.message : String(err));
            callback((err instanceof Error ? err : new Error(String(err))) as any, false);
        }
    };

    // ---- Authorize Publish (device → broker) ----
    broker.authorizePublish = (client, packet, callback) => {
        // Devices can only publish to their own topic namespace
        const meta = client ? connectedDevices.get(client.id) : null;
        if (!meta) return callback(new Error("unauthorized"));
        const prefix = `sn/${meta.mac}/`;
        if (!packet.topic.startsWith(prefix)) {
            return callback(new Error("topic not allowed"));
        }
        callback(null);
    };

    // ---- Authorize Subscribe (device ← broker) ----
    broker.authorizeSubscribe = (client, sub, callback) => {
        const meta = client ? connectedDevices.get(client.id) : null;
        if (!meta) return callback(new Error("unauthorized"), null);
        const prefix = `sn/${meta.mac}/`;
        if (!sub.topic.startsWith(prefix)) {
            return callback(new Error("topic not allowed"), null);
        }
        callback(null, sub);
    };

    // ---- Handle published messages (state sync from device) ----
    broker.on("publish", async (packet, client) => {
        if (!client) return; // broker-internal messages (like $SYS)
        const meta = connectedDevices.get(client.id);
        if (!meta) return;

        const topic = packet.topic;

        // ---- State Sync: sn/{mac}/state ----
        if (topic === `sn/${meta.mac}/state`) {
            try {
                const payload = JSON.parse(packet.payload.toString());
                await handleDeviceState(meta, payload);
            } catch (err) {
                logger.warn(`[mqtt] state parse error from ${meta.serial}`, err instanceof Error ? err.message : String(err));
            }
        }
    });

    // ---- Client connected ----
    broker.on("client", async (client) => {
        const meta = connectedDevices.get(client.id);
        if (!meta) return;
        logger.info(`[mqtt] ↗ ${meta.serial} (${meta.mac}) connected`);

        // Mark board online
        await prisma.espDevice.update({
            where: { id: meta.espId },
            data: { lastSeen: new Date(), offline: false },
        }).catch(() => null);
        await prisma.device.updateMany({
            where: { espId: meta.espId },
            data: { lastSeen: new Date(), offline: false },
        }).catch(() => null);

        // Push any pending commands immediately on connect
        await pushPendingCommands(meta);
    });

    // ---- Client disconnected ----
    broker.on("clientDisconnect", async (client) => {
        const meta = connectedDevices.get(client.id);
        if (!meta) return;
        logger.info(`[mqtt] ↘ ${meta.serial} (${meta.mac}) disconnected`);
        connectedDevices.delete(client.id);

        // Mark board offline
        await prisma.espDevice.update({
            where: { id: meta.espId },
            data: { offline: true },
        }).catch(() => null);
        // Emit offline status to web/mobile
        const devices = await prisma.device.findMany({
            where: { espId: meta.espId },
            select: { id: true },
        });
        await prisma.device.updateMany({
            where: { espId: meta.espId },
            data: { offline: true },
        }).catch(() => null);
        for (const d of devices) {
            await emitDeviceUpdated(meta.homeId, d.id);
        }
    });

    // ---- Start TCP listener ----
    tcpServer.listen(MQTT_PORT, () => {
        logger.info(`🦟 MQTT Broker (Aedes) listening on tcp://0.0.0.0:${MQTT_PORT}`);
    });
    tcpServer.on("error", (err) => {
        logger.warn(`[mqtt] TCP server error: ${err.message}`);
    });
}

// ---------- internal handlers ----------

/**
 * Process a state update from a device.
 * Payload: { states: [1,0,1,0], fw?: string, ip?: string, ssid?: string }
 */
async function handleDeviceState(
    meta: ConnectedDevice,
    payload: {
        states?: number[];
        fw?: string;
        ip?: string;
        ssid?: string;
        model?: string;
    },
): Promise<void> {
    const { homeId, espId, serial } = meta;

    // Update ESP telemetry
    const espUpdate: Record<string, unknown> = {
        lastSeen: new Date(),
        offline: false,
    };
    if (payload.fw) espUpdate.firmwareVersion = payload.fw;
    if (payload.ip) espUpdate.ipAddress = payload.ip;
    if (payload.ssid) espUpdate.ssid = payload.ssid;
    if (payload.model) espUpdate.modelCode = payload.model.toUpperCase();

    const esp = await prisma.espDevice.update({
        where: { id: espId },
        data: espUpdate,
    });
    emitToHome(homeId, "esp:updated", esp);

    // Sync relay states to DB + Socket.IO
    if (payload.states && Array.isArray(payload.states)) {
        const mappedDevices = await prisma.device.findMany({
            where: { espId, homeId },
        });

        for (let i = 0; i < payload.states.length; i++) {
            const channelNum = i + 1;
            const target = mappedDevices.find((d) => d.channel === channelNum);
            if (!target) continue;

            const targetStatus = payload.states[i] ? "on" : "off";
            if (target.status === targetStatus) continue; // no change

            await prisma.device.update({
                where: { id: target.id },
                data: {
                    status: targetStatus as "on" | "off",
                    lastSeen: new Date(),
                    offline: false,
                },
            });
            await emitDeviceUpdated(homeId, target.id);
        }
    }

    // Also update all mapped devices as alive
    await prisma.device.updateMany({
        where: { espId, homeId },
        data: { lastSeen: new Date(), offline: false },
    }).catch(() => null);
}

// ---------- command dispatch (server → device) ----------

/**
 * Push pending commands to a connected device via MQTT.
 * Called on device connect + when web/mobile triggers a toggle.
 */
async function pushPendingCommands(meta: ConnectedDevice): Promise<void> {
    if (!broker) return;
    const { homeId, espId, mac } = meta;

    const devices = await prisma.device.findMany({
        where: { espId, homeId },
        select: { id: true, channel: true },
    });
    const deviceIds = devices.map((d) => d.id);
    if (deviceIds.length === 0) return;

    const cmds = await prisma.deviceCommand.findMany({
        where: { deviceId: { in: deviceIds }, status: "pending" },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { id: true, deviceId: true, command: true },
    });
    if (cmds.length === 0) return;

    // Build channel-mapped command payload
    const commands = cmds.map((c) => {
        const dev = devices.find((d) => d.id === c.deviceId);
        return { id: c.id, ch: dev?.channel ?? 0, action: c.command };
    });

    const topic = `sn/${mac}/cmd`;
    const payload = JSON.stringify({ commands });
    broker.publish(
        { cmd: "publish", topic, payload: Buffer.from(payload), qos: 1, retain: false, dup: false },
        () => {
            logger.info(`[mqtt] → ${meta.serial} pushed ${commands.length} cmd(s)`);
        },
    );
}

/**
 * Public helper: push commands to a specific device via MQTT.
 * Called from device.service.ts when web/mobile toggles a switch.
 * Falls back silently if device is not connected via MQTT (HTTP poll will pick it up).
 */
export function mqttPushCommands(mac: string): void {
    // Find connected client by mac
    for (const [, meta] of connectedDevices) {
        if (meta.mac === mac) {
            void pushPendingCommands(meta);
            return;
        }
    }
    // Device not on MQTT — HTTP long-poll will handle it
}

/**
 * Public helper: push commands to ALL connected devices of a home.
 * Used for bulk operations (e.g., "all off").
 */
export function mqttPushToHome(homeId: number): void {
    for (const [, meta] of connectedDevices) {
        if (meta.homeId === homeId) {
            void pushPendingCommands(meta);
        }
    }
}

/** How many devices are currently connected via MQTT. */
export function mqttConnectedCount(): number {
    return connectedDevices.size;
}

/** List connected device serials (diagnostics). */
export function mqttConnectedDevices(): string[] {
    return Array.from(connectedDevices.values()).map((m) => m.serial);
}
