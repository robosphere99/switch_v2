/**
 * mqtt.service.ts — EMQX Standalone Broker Client for SwitchNest IoT.
 *
 * ESP32 boards connect via MQTT to EMQX. This backend service acts as an MQTT client
 * connecting to the same EMQX broker to bridge messages to Socket.io.
 *
 * Topic contract (board ↔ server):
 *   sn/{mac}/state   — board PUBLISHES relay states          (JSON: { states: [1,0,1,0], fw?, ip?, ssid?, serial?, model? })
 *   sn/{mac}/cmd     — server PUBLISHES commands TO board    (JSON: { commands: [{ ch, action }] })
 *   sn/{mac}/log     — board PUBLISHES terminal logs         (String)
 *
 * Bridge: MQTT ↔ Socket.IO — relay state changes from MQTT are written to the DB
 *         and forwarded to web/mobile clients via the existing socket infrastructure.
 */

import mqtt from "mqtt";
import { prisma } from "../lib/prisma";
import { emitDeviceUpdated, emitToHome, emitToBoardLogs } from "../lib/socket";
import { logger } from "../lib/logger";

// ---------- config ----------
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://127.0.0.1:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "switchnest_backend";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "backend_secret";

// ---------- broker instance ----------
let client: mqtt.MqttClient | null = null;

// ---------- public API ----------

/**
 * Start the MQTT client to connect to EMQX. Call once at startup
 * alongside initSocket / server.listen.
 */
export function startMqttBroker(): void {
    logger.info(`🦟 Connecting to EMQX Broker at ${MQTT_BROKER_URL}...`);
    client = mqtt.connect(MQTT_BROKER_URL, {
        username: MQTT_USERNAME,
        password: MQTT_PASSWORD,
        clientId: `switchnest_backend_${Math.random().toString(16).slice(2, 8)}`,
        clean: true,
        reconnectPeriod: 5000,
    });

    client.on("connect", () => {
        logger.info(`[mqtt-client] Connected to EMQX Broker`);
        
        // Subscribe to state and log topics for all devices
        client?.subscribe("sn/+/state", { qos: 1 }, (err) => {
            if (err) logger.error(`[mqtt-client] Subscribe error: sn/+/state`, err);
            else logger.info(`[mqtt-client] Subscribed to sn/+/state`);
        });
        
        client?.subscribe("sn/+/log", { qos: 0 }, (err) => {
            if (err) logger.error(`[mqtt-client] Subscribe error: sn/+/log`, err);
            else logger.info(`[mqtt-client] Subscribed to sn/+/log`);
        });

        // EMQX internal presence topics (requires $SYS topics enabled in EMQX ACL for this user)
        // client?.subscribe("$SYS/brokers/+/clients/+/connected");
        // client?.subscribe("$SYS/brokers/+/clients/+/disconnected");
    });

    client.on("error", (err) => {
        logger.warn(`[mqtt-client] Connection error`, err.message);
    });

    client.on("message", async (topic, payload) => {
        try {
            // Topic format: sn/{mac}/state or sn/{mac}/log
            const parts = topic.split("/");
            if (parts.length !== 3 || parts[0] !== "sn") return;

            const mac = parts[1].toLowerCase();
            const type = parts[2];

            // Direct lookup by normalized MAC (no colons) — avoids full table scan.
            // ESP devices are stored with macAddress = "aabbccddeeff" format (no colons).
            // If DB has colon format, the MQTT auth handler normalizes on connect.
            const matchedEsp = await prisma.espDevice.findFirst({
                where: { macAddress: mac },
                select: { id: true, macAddress: true, serialCode: true, homeId: true },
            });

            if (!matchedEsp) return;

            if (type === "log") {
                const payloadStr = payload.toString();
                emitToBoardLogs(matchedEsp.id, payloadStr);
                return;
            }

            if (type === "state") {
                const data = JSON.parse(payload.toString());
                await handleDeviceState(matchedEsp, data);
            }

        } catch (err) {
            logger.warn(`[mqtt-client] Message parse error on topic ${topic}`, err instanceof Error ? err.message : String(err));
        }
    });
}


// ---------- internal handlers ----------

/**
 * Process a state update from a device.
 * Payload: { states: [1,0,1,0], fw?: string, ip?: string, ssid?: string, model?: string }
 */
async function handleDeviceState(
    espMeta: { id: number; homeId: number; macAddress: string; serialCode: string | null },
    payload: {
        states?: number[];
        fw?: string;
        ip?: string;
        ssid?: string;
        model?: string;
    },
): Promise<void> {
    const { homeId, id: espId } = espMeta;

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
 * Called when web/mobile triggers a toggle.
 */
export async function pushPendingCommandsByMac(macRaw: string): Promise<void> {
    if (!client) return;

    const mac = macRaw.replace(/:/g, "").toLowerCase();
    
    // Direct lookup by normalized MAC
    const matchedEsp = await prisma.espDevice.findFirst({
        where: { macAddress: mac },
        select: { id: true, macAddress: true, homeId: true },
    });
    if (!matchedEsp) return;


    const { homeId, id: espId } = matchedEsp;

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
    client.publish(topic, payload, { qos: 1, retain: false }, (err) => {
        if (!err) logger.info(`[mqtt-client] → ${mac} pushed ${commands.length} cmd(s)`);
    });
}

/**
 * Public helper: push commands to a specific device via MQTT.
 * Called from device.service.ts when web/mobile toggles a switch.
 */
export function mqttPushCommands(mac: string): void {
    void pushPendingCommandsByMac(mac);
}

/**
 * Public helper: push rotate_console_pass command to a specific device via MQTT.
 */
export function mqttPushRotatePassword(mac: string, newPass: string): void {
    if (!client) return;
    const cleanMac = mac.replace(/:/g, "").toLowerCase();
    const topic = `sn/${cleanMac}/cmd`;
    const payload = JSON.stringify({
        commands: [{ id: Math.floor(Math.random() * 100000), action: "rotate_console_pass", newPass }]
    });
    client.publish(topic, payload, { qos: 1, retain: false }, (err) => {
        if (!err) logger.info(`[mqtt-client] → ${cleanMac} pushed rotate_console_pass`);
    });
}

/**
 * Public helper: push commands to ALL devices of a home.
 * Used for bulk operations (e.g., "all off").
 */
export async function mqttPushToHome(homeId: number): Promise<void> {
    const esps = await prisma.espDevice.findMany({ where: { homeId }, select: { macAddress: true }});
    for (const esp of esps) {
        void pushPendingCommandsByMac(esp.macAddress);
    }
}

/** Legacy signature mock for diagnostic endpoints */
export function mqttConnectedCount(): number {
    return client?.connected ? 1 : 0; // We don't host the broker anymore, so we only track ourselves
}

export function mqttConnectedDevices(): string[] {
    return []; // Handled by EMQX dashboard now
}

export function publishTermCommand(mac: string, cmd: string) {
    if (!client) return;
    const cleanMac = mac.replace(/:/g, "").toLowerCase();
    const topic = `sn/${cleanMac}/term_cmd`;
    client.publish(topic, cmd, { qos: 1, retain: false }, (err) => {
        if (err) logger.error(`[mqtt-client] Failed to push terminal command to ${mac}`);
    });
}

export function mqttPushLedState(mac: string, enabled: boolean): void {
    if (!client) return;
    const cleanMac = mac.replace(/:/g, "").toLowerCase();
    const topic = `sn/${cleanMac}/cmd`;
    const payload = JSON.stringify({ type: "set_led", enabled });
    client.publish(topic, payload, { qos: 1, retain: false }, (err) => {
        if (!err) logger.info(`[mqtt-client] → ${cleanMac} pushed LED state: ${enabled}`);
    });
}
