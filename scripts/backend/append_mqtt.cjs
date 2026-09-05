const fs = require('fs');
let content = fs.readFileSync('src/services/mqtt.service.ts', 'utf8');
content += `\n
export function publishTermCommand(mac: string, cmd: string) {
    if (!broker) return;
    const topic = \`sn/\${mac}/term_cmd\`;
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
