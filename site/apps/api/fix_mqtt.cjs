const fs = require('fs');
let content = fs.readFileSync('src/services/mqtt.service.ts', 'utf8');

// 1. Add log sync handler
content = content.replace(
`        if (topic === \`sn/\${meta.mac}/state\`) {
            try {
                const payload = JSON.parse(packet.payload.toString());
                await handleDeviceState(meta, payload);
            } catch (err) {
                logger.warn(\`[mqtt] state parse error from \${meta.serial}\`, err instanceof Error ? err.message : String(err));
            }
        }`,
`        if (topic === \`sn/\${meta.mac}/state\`) {
            try {
                const payload = JSON.parse(packet.payload.toString());
                await handleDeviceState(meta, payload);
            } catch (err) {
                logger.warn(\`[mqtt] state parse error from \${meta.serial}\`, err instanceof Error ? err.message : String(err));
            }
        }
        
        // ---- Terminal Logs Sync: sn/{mac}/log ----
        if (topic === \`sn/\${meta.mac}/log\`) {
            const logMsg = packet.payload.toString();
            import("../lib/socket").then(({ emitToBoardLogs }) => {
                emitToBoardLogs(meta.espId, logMsg);
            });
        }`
);

// 2. Add clientConnect system log
content = content.replace(
`        // Also push the device names mapping (for local ESP dash)
        await pushDeviceNames(meta);
    });`,
`        // Also push the device names mapping (for local ESP dash)
        await pushDeviceNames(meta);
        
        import("../lib/socket").then(({ emitToBoardLogs }) => {
            emitToBoardLogs(meta.espId, \`[System] ↗ Board connected: \${meta.serial}\`);
        });
    });`
);

// 3. Add clientDisconnect system log
content = content.replace(
`        for (const d of devices) {
            await emitDeviceUpdated(meta.homeId, d.id);
        }
    });`,
`        for (const d of devices) {
            await emitDeviceUpdated(meta.homeId, d.id);
        }
        import("../lib/socket").then(({ emitToBoardLogs }) => {
            emitToBoardLogs(meta.espId, \`[System] ↘ Board disconnected: \${meta.serial}\`);
        });
    });`
);

// 4. Add state system log
content = content.replace(
`    const esp = await prisma.espDevice.update({
        where: { id: espId },
        data: espUpdate,
    });
    emitToHome(homeId, "esp:updated", esp);

    // Sync relay states to DB + Socket.IO`,
`    const esp = await prisma.espDevice.update({
        where: { id: espId },
        data: espUpdate,
    });
    emitToHome(homeId, "esp:updated", esp);

    import("../lib/socket").then(({ emitToBoardLogs }) => {
        let sysLog = \`[System] 📊 Telemetry: \`;
        if (payload.fw) sysLog += \`FW: \${payload.fw} | \`;
        if (payload.ip) sysLog += \`IP: \${payload.ip} | \`;
        if (payload.ssid) sysLog += \`SSID: \${payload.ssid} | \`;
        if (payload.states) sysLog += \`Relays: \${JSON.stringify(payload.states)}\`;
        emitToBoardLogs(espId, sysLog);
    });

    // Sync relay states to DB + Socket.IO`
);

// 5. Add publishTermCommand
content += `\n
export function publishTermCommand(mac: string, cmd: string) {
    if (!broker) return;
    const cleanMac = mac.replace(/:/g, "").toLowerCase();
    const topic = \`sn/\${cleanMac}/term_cmd\`;
    broker.publish({
        topic,
        payload: Buffer.from(cmd),
        qos: 1,
        retain: false,
        cmd: "publish",
        dup: false
    }, (err) => {
        if (err) logger.error(\`[mqtt] Failed to push terminal command to \${mac}\`);
    });
}
`;

fs.writeFileSync('src/services/mqtt.service.ts', content);
