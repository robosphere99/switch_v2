/**
 * ESP32 integration guide — /api/docs/esp32 (English) · /api/docs/esp32/hi (हिंदी)
 *
 * Har device-facing endpoint ke liye curl / python / node snippets + example
 * responses, aur ek complete Arduino sketch (poll → execute → ack → heartbeat).
 * Zero dependencies — pure HTML string, docs.routes.ts se serve hota hai.
 * Code snippets dono languages me shared hain — sirf prose translate hoti hai.
 */

export type GuideLang = "en" | "hi";

const BASE_URL = "https://onlineswitch.bhartitechnical.com";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Syntax-highlighting-free code block — <pre> + mono + label. */
function codeBlock(label: string, code: string): string {
  return `
    <div style="margin:10px 0">
      <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
      <pre style="background:#0f172a;color:#e2e8f0;border-radius:8px;padding:14px 16px;overflow-x:auto;font-size:13px;line-height:1.55;margin:0"><code>${esc(code)}</code></pre>
    </div>`;
}

interface EndpointDoc {
  method: string;
  path: string;
  name: string;
  desc: string;
  params: string;
  /** Hindi (Devanagari) variants — fallback to English fields when missing. */
  nameHi?: string;
  descHi?: string;
  paramsHi?: string;
  curl: string;
  python: string;
  node: string;
  response: string;
}

const methodColor: Record<string, string> = { GET: "#22c55e", POST: "#3b82f6", PATCH: "#eab308", PUT: "#eab308", DELETE: "#ef4444" };

interface PageStrings {
  htmlLang: string;
  title: string;
  headerTitle: string;
  intro: string;
  baseUrlNote: string;
  paramsLabel: string;
  responseLabel: string;
  arduinoHeading: string;
  arduinoDesc: string;
  errorsHeading: string;
  errorsCode: string;
  errorsMeaning: string;
  errUnauthorized: string;
  errKeyNotScoped: string;
  errDeviceNotFound: string;
  errRateLimited: string;
  footerUpdated: string;
  footerLocalDev: string;
  /** Language switcher — opposite page ka link. */
  langHref: string;
  langLabel: string;
}

const EN: PageStrings = {
  htmlLang: "en",
  title: "SwitchNest — ESP32 Integration Guide",
  headerTitle: "📡 SwitchNest — ESP32 Integration Guide",
  intro:
    "ESP32 <b>polling model</b> pe chalta hai — server khud push nahi karta: " +
    "har kuch second device <code>read-all</code> / <code>commands</code> poll karta hai, " +
    "web app me koi toggle kare to <code>commands</code> long-poll response me turant command " +
    "milti hai, ESP relay toggle karta hai aur <code>ack</code> bhejta hai. " +
    "DB hi source of truth hai — heartbeat se relay states 2-way sync hoti hain.",
  baseUrlNote:
    "<b>Base URL:</b> <code>" + BASE_URL + "</code> · <b>Auth:</b> har request me " +
    "<code>?api_key=rs_...</code> (ya <code>Authorization: Bearer rs_...</code>). " +
    "API key app me <b>Dashboard → Device Keys</b> se ban jati hai. " +
    "Har response envelope: <code>{ \"success\": true, \"data\": ... }</code> · " +
    "Error pe <code>{ \"success\": false, \"error\": { \"code\", \"message\" } }</code> + " +
    "HTTP status. Rate limits: read 1200/min, mutate 600/min per IP — boards " +
    "ke liye kaafi generous, kabhi block nahi karega.",
  paramsLabel: "Params / Body:",
  responseLabel: "Example response",
  arduinoHeading: "🛠️ Complete Arduino sketch (ESP32)",
  arduinoDesc:
    "Minimal firmware flow: connect WiFi → long-poll commands (relay toggle + ack) → " +
    "heartbeat (IP + firmware + states, OTA check). ArduinoJson library chahiye " +
    "(Library Manager se install karo). PlatformIO project: <code>hardware/</code> folder me.",
  errorsHeading: "⚠️ Common errors",
  errorsCode: "Code",
  errorsMeaning: "Matlab",
  errUnauthorized: "api_key missing / galat — key copy karke check karo",
  errKeyNotScoped: "Key kisi home se link nahi — home ke liye nayi key banao",
  errDeviceNotFound: "device_id is home me nahi — read-all se sahi id lo",
  errRateLimited: "Bahut zyada requests — Retry-After header dekho",
  footerUpdated: "Last updated",
  footerLocalDev: "Local dev",
  langHref: "/api/docs/esp32/hi",
  langLabel: "हिंदी",
};

const HI: PageStrings = {
  htmlLang: "hi",
  title: "SwitchNest — ESP32 इंटीग्रेशन गाइड",
  headerTitle: "📡 SwitchNest — ESP32 इंटीग्रेशन गाइड",
  intro:
    "ESP32 <b>polling model</b> पर चलता है — server खुद push नहीं करता: " +
    "हर कुछ सेकंड device <code>read-all</code> / <code>commands</code> poll करता है, " +
    "web app में कोई toggle करे तो <code>commands</code> long-poll response में तुरंत command " +
    "मिलती है, ESP relay toggle करता है और <code>ack</code> भेजता है। " +
    "DB ही source of truth है — heartbeat से relay states 2-way sync होती हैं।",
  baseUrlNote:
    "<b>Base URL:</b> <code>" + BASE_URL + "</code> · <b>Auth:</b> हर request में " +
    "<code>?api_key=rs_...</code> (या <code>Authorization: Bearer rs_...</code>)। " +
    "API key app में <b>Dashboard → Device Keys</b> से बन जाती है। " +
    "हर response envelope: <code>{ \"success\": true, \"data\": ... }</code> · " +
    "Error पर <code>{ \"success\": false, \"error\": { \"code\", \"message\" } }</code> + " +
    "HTTP status। Rate limits: read 1200/min, mutate 600/min per IP — boards " +
    "के लिए काफी generous, कभी block नहीं करेगा।",
  paramsLabel: "Params / Body:",
  responseLabel: "उदाहरण response",
  arduinoHeading: "🛠️ पूरा Arduino sketch (ESP32)",
  arduinoDesc:
    "Minimal firmware flow: WiFi connect करें → long-poll commands (relay toggle + ack) → " +
    "heartbeat (IP + firmware + states, OTA check)। ArduinoJson library चाहिए " +
    "(Library Manager से install करें)। PlatformIO project: <code>hardware/</code> folder में।",
  errorsHeading: "⚠️ Common errors",
  errorsCode: "Code",
  errorsMeaning: "मतलब",
  errUnauthorized: "api_key missing / गलत — key copy करके check करें",
  errKeyNotScoped: "Key किसी home से link नहीं — home के लिए नई key बनाएँ",
  errDeviceNotFound: "device_id इस home में नहीं — read-all से सही id लें",
  errRateLimited: "बहुत ज़्यादा requests — Retry-After header देखें",
  footerUpdated: "आखिरी अपडेट",
  footerLocalDev: "Local dev",
  langHref: "/api/docs/esp32",
  langLabel: "English",
};

function renderEndpoint(e: EndpointDoc, lang: GuideLang, s: PageStrings): string {
  const color = methodColor[e.method] ?? "#6b7280";
  const name = lang === "hi" ? e.nameHi ?? e.name : e.name;
  const desc = lang === "hi" ? e.descHi ?? e.desc : e.desc;
  const params = lang === "hi" ? e.paramsHi ?? e.params : e.params;
  return `
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px;margin:18px 0">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <code style="background:${color}1a;color:${color};font-weight:700;padding:4px 10px;border-radius:6px">${e.method}</code>
      <code style="font-size:14px;font-weight:600;color:#0f172a">${e.path}</code>
    </div>
    <h3 style="margin:12px 0 6px;font-size:16px;color:#0f172a">${name}</h3>
    <p style="margin:0 0 12px;color:#4b5563;font-size:14px;line-height:1.6">${desc}</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;font-size:13px;color:#334155;margin-bottom:14px"><strong style="color:#0f172a">${s.paramsLabel}</strong> ${params}</div>
    ${codeBlock("cURL", e.curl)}
    ${codeBlock("Python (requests)", e.python)}
    ${codeBlock("Node.js (fetch)", e.node)}
    ${codeBlock(s.responseLabel, e.response)}
  </div>`;
}

function buildHtml(lang: GuideLang): string {
  const s = lang === "hi" ? HI : EN;

  const endpoints: EndpointDoc[] = [
    {
      method: "POST",
      path: "/api/api-keys/",
      name: "1. API key banao (pehla step — sirf ek baar dikhta hai)",
      desc: "ESP32 ko device API use karne ke liye home-scoped API key chahiye. Ye key web app me bhi ban sakti hai (Dashboard → Device Keys). rawKey response me SIRF EK BAAR aati hai — ise save karo. Is endpoint pe JWT auth lagta hai (Bearer token).",
      params: "Header: Authorization: Bearer &lt;JWT&gt; · Body: { homeId: number, label: string }",
      nameHi: "1. API key बनाएँ (पहला कदम — सिर्फ एक बार दिखता है)",
      descHi:
        "ESP32 को device API इस्तेमाल करने के लिए home-scoped API key चाहिए। यह key web app में भी बन सकती है (Dashboard → Device Keys)। rawKey response में सिर्फ एक बार आती है — इसे सेव कर लें। इस endpoint पर JWT auth लगता है (Bearer token)।",
      paramsHi: "Header: Authorization: Bearer &lt;JWT&gt; · Body: { homeId: number, label: string }",
      curl: `curl -X POST ${BASE_URL}/api/api-keys/ \\\\
  -H "Authorization: Bearer <JWT_TOKEN>" \\\\
  -H "Content-Type: application/json" \\\\
  -d '{"homeId": 1, "label": "esp32-kitchen"}'`,
      python: `import requests

r = requests.post(
    f"{BASE}/api/api-keys/",
    headers={"Authorization": f"Bearer {JWT}"},
    json={"homeId": 1, "label": "esp32-kitchen"},
)
key = r.json()["data"]["rawKey"]   # rs_... — save karo, dobara nahi milegi
print(key)`,
      node: `const res = await fetch(BASE + "/api/api-keys/", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: \`Bearer \${JWT}\` },
  body: JSON.stringify({ homeId: 1, label: "esp32-kitchen" }),
});
const { data } = await res.json();
console.log(data.rawKey); // rs_... — save karo, dobara nahi milegi`,
      response: `{
  "success": true,
  "data": {
    "id": 12,
    "label": "esp32-kitchen",
    "homeId": 1,
    "rawKey": "rs_7f3a9c21e5b84d6f0a2c9e8d7b6a5f4e3d2c1b0a",
    "createdAt": "2026-08-18T10:00:00.000Z"
  }
}`,
    },
    {
      method: "GET",
      path: "/api/device/read-all?api_key=rs_...",
      name: "2. Saare devices + status (poll)",
      desc: "ESP32 (ya koi client) apne home ke saare devices aur unki status padhta hai. Har successful poll pe device lastSeen update hota hai (online marker). Long-poll params optional hain — `long=1&hold=20` se response 20s tak hold hota hai agar kuch naya na ho (battery/WiFi friendly).",
      params: "Query: api_key (required) · long=1 · hold=1..25 (seconds, default 20)",
      nameHi: "2. सभी devices + स्टेटस (poll)",
      descHi:
        "ESP32 (या कोई भी client) अपने home के सभी devices और उनकी स्टेटस पढ़ता है। हर सफल poll पर device का lastSeen अपडेट होता है (online marker)। Long-poll params optional हैं — `long=1&hold=20` से response 20 सेकंड तक hold रहता है अगर कुछ नया न हो (battery/WiFi friendly)।",
      paramsHi: "Query: api_key (ज़रूरी) · long=1 · hold=1..25 (सेकंड, default 20)",
      curl: `curl "${BASE_URL}/api/device/read-all?api_key=rs_7f3a9c21e5b84d6f0a2c9e8d7b6a5f4e3d2c1b0a&long=1&hold=20"`,
      python: `import requests

API_KEY = "rs_7f3a9c21e5b84d6f0a2c9e8d7b6a5f4e3d2c1b0a"
r = requests.get(f"{BASE}/api/device/read-all", params={
    "api_key": API_KEY, "long": "1", "hold": "20",
}, timeout=30)
devices = r.json()["data"]["devices"]
for d in devices:
    print(d["id"], d["name"], d["status"])   # on / off`,
      node: `const url = \`\${BASE}/api/device/read-all?api_key=\${API_KEY}&long=1&hold=20\`;
const res = await fetch(url);
const { data } = await res.json();
for (const d of data.devices) console.log(d.id, d.name, d.status);`,
      response: `{
  "success": true,
  "data": {
    "devices": [
      {
        "id": 5,
        "name": "Living Room Bulb",
        "type": "bulb",
        "status": "on",
        "lastSeen": "2026-08-18T09:59:41.000Z",
        "offline": false
      }
    ]
  }
}`,
    },
    {
      method: "GET",
      path: "/api/device/commands?api_key=rs_...&long=1&hold=20",
      name: "3. Pending commands (long-poll)",
      desc: "Web app me koi toggle/schedule chale to yahan pending command milti hai. `long=1&hold=20` me server response tab tak hold karta hai jab tak command na aaye (max hold sec) — ESP32 isi se <2s me relay toggle kar leta hai. Bina long=1 ke instant pending commands milti hain (old firmware).",
      params: "Query: api_key (required) · long=1 · hold=1..25 (seconds, default 20)",
      nameHi: "3. Pending commands (long-poll)",
      descHi:
        "Web app में कोई toggle/schedule चले तो यहाँ pending command मिलती है। `long=1&hold=20` में server response तब तक hold करता है जब तक command न आए (max hold sec) — ESP32 इसी से <2s में relay toggle कर लेता है। बिना long=1 के instant pending commands मिलती हैं (old firmware)।",
      paramsHi: "Query: api_key (ज़रूरी) · long=1 · hold=1..25 (सेकंड, default 20)",
      curl: `curl "${BASE_URL}/api/device/commands?api_key=rs_7f3a9c21e5b84d6f0a2c9e8d7b6a5f4e3d2c1b0a&long=1&hold=20"`,
      python: `import requests

r = requests.get(f"{BASE}/api/device/commands", params={
    "api_key": API_KEY, "long": "1", "hold": "20",
}, timeout=30)
commands = r.json()["data"]["commands"]
for c in commands:
    # c["command"] = "on"/"off"  ·  c["deviceId"]  ·  c["id"]
    print(c["id"], c["deviceId"], c["command"])`,
      node: `const res = await fetch(
  \`\${BASE}/api/device/commands?api_key=\${API_KEY}&long=1&hold=20\`
);
const { data } = await res.json();
for (const c of data.commands) console.log(c.id, c.deviceId, c.command);`,
      response: `{
  "success": true,
  "data": {
    "commands": [
      {
        "id": 42,
        "deviceId": 5,
        "command": "on",
        "status": "pending",
        "createdAt": "2026-08-18T10:02:15.000Z"
      }
    ]
  }
}`,
    },
    {
      method: "POST",
      path: "/api/device/update",
      name: "4. Relay state report (physical switch)",
      desc: "ESP32 ne relay khud toggle kiya (physical switch / local button) to server ko batao — status DB me update hoti hai + device_logs me entry. Ye command enqueue NAHI karta (state device se AA rahi hai, web se nahi).",
      params: "Query/body: api_key · Body: { device_id, status: on|off }",
      nameHi: "4. Relay state रिपोर्ट (physical switch)",
      descHi:
        "ESP32 ने relay खुद toggle किया (physical switch / local button) तो server को बताएँ — स्टेटस DB में अपडेट होती है + device_logs में entry। यह command enqueue नहीं करता (state device से आ रही है, web से नहीं)।",
      paramsHi: "Query/body: api_key · Body: { device_id, status: on|off }",
      curl: `curl -X POST "${BASE_URL}/api/device/update?api_key=rs_7f3a9c21e5b84d6f0a2c9e8d7b6a5f4e3d2c1b0a" \\\\
  -H "Content-Type: application/json" \\\\
  -d '{"device_id": 5, "status": "on"}'`,
      python: `import requests

r = requests.post(f"{BASE}/api/device/update", params={"api_key": API_KEY},
                  json={"device_id": 5, "status": "on"})
print(r.json()["data"]["status"])   # updated device`,
      node: `const res = await fetch(\`\${BASE}/api/device/update?api_key=\${API_KEY}\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ device_id: 5, status: "on" }),
});
console.log(await res.json());`,
      response: `{
  "success": true,
  "data": {
    "id": 5,
    "name": "Living Room Bulb",
    "status": "on",
    "lastSeen": "2026-08-18T10:03:00.000Z"
  }
}`,
    },
    {
      method: "POST",
      path: "/api/device/heartbeat",
      name: "5. Heartbeat — IP / firmware / relay states / OTA",
      desc: "ESP apna IP, firmware version, MAC, SSID, serial aur ACTUAL relay states report karta hai. Server se: (a) ESP board row upsert (MAC se), (b) devices link, (c) relay state 2-way sync, (d) agar admin ne OTA push kiya hai to `ota` object me firmware URL milta hai. States format: JSON array [{ id, status }, ...].",
      params: "Query/body: api_key · Body: { device_id, ip?, fw_version?, mac?, ssid?, serial?, model?, states? }",
      nameHi: "5. Heartbeat — IP / firmware / relay states / OTA",
      descHi:
        "ESP अपना IP, firmware version, MAC, SSID, serial और ACTUAL relay states रिपोर्ट करता है। Server से: (a) ESP board row upsert (MAC से), (b) devices link, (c) relay state 2-way sync, (d) अगर admin ने OTA push किया है तो `ota` object में firmware URL मिलता है। States format: JSON array [{ id, status }, ...]।",
      paramsHi: "Query/body: api_key · Body: { device_id, ip?, fw_version?, mac?, ssid?, serial?, model?, states? }",
      curl: `curl -X POST "${BASE_URL}/api/device/heartbeat?api_key=rs_7f3a9c21e5b84d6f0a2c9e8d7b6a5f4e3d2c1b0a" \\\\
  -H "Content-Type: application/json" \\\\
  -d '{
    "device_id": 5,
    "ip": "192.168.1.36",
    "fw_version": "2.2.0",
    "mac": "A4:CF:12:F5:1B:33",
    "ssid": "MyWiFi",
    "serial": "RS-4CH-001234",
    "model": "4CH",
    "states": "[{\\"id\\":5,\\"status\\":\\"on\\"}]"
  }'`,
      python: `import requests, json

r = requests.post(f"{BASE}/api/device/heartbeat", params={"api_key": API_KEY},
                  json={
    "device_id": 5,
    "ip": "192.168.1.36",
    "fw_version": "2.2.0",
    "mac": "A4:CF:12:F5:1B:33",
    "ssid": "MyWiFi",
    "serial": "RS-4CH-001234",
    "model": "4CH",
    "states": json.dumps([{"id": 5, "status": "on"}]),
})
d = r.json()["data"]
print(d["synced"], d["ota"])   # ota != null → firmware download karo`,
      node: `const res = await fetch(\`\${BASE}/api/device/heartbeat?api_key=\${API_KEY}\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    device_id: 5, ip: "192.168.1.36", fw_version: "2.2.0",
    mac: "A4:CF:12:F5:1B:33", ssid: "MyWiFi",
    serial: "RS-4CH-001234", model: "4CH",
    states: JSON.stringify([{ id: 5, status: "on" }]),
  }),
});
const { data } = await res.json();
if (data.ota) console.log("OTA:", data.ota.version, data.ota.url);`,
      response: `{
  "success": true,
  "data": {
    "device": { "id": 5, "name": "Living Room Bulb", "status": "on" },
    "esp": {
      "id": 3, "macAddress": "a4cf12f51b33",
      "name": "RS-4CH-001234 · MyWiFi", "serialCode": "RS-4CH-001234",
      "firmwareVersion": "2.2.0", "ipAddress": "192.168.1.36"
    },
    "synced": 1,
    "ota": null
  }
}`,
    },
    {
      method: "POST",
      path: "/api/device/commands/ack",
      name: "6. Command ack (executed / failed)",
      desc: "Command execute karne ke baad server ko confirm karo. `status: executed` = command done; `failed` = ESP galat kar gaya (web app pe failed dikhta hai). Already-processed command pe idempotent no-op — safe hai dobara bhejna.",
      params: "Query/body: api_key · Body: { command_id, device_id, status: executed|failed }",
      nameHi: "6. Command ack (executed / failed)",
      descHi:
        "Command execute करने के बाद server को confirm करें। `status: executed` = command done; `failed` = ESP गलत कर गया (web app पर failed दिखता है)। Already-processed command पर idempotent no-op — दोबारा भेजना सुरक्षित है।",
      paramsHi: "Query/body: api_key · Body: { command_id, device_id, status: executed|failed }",
      curl: `curl -X POST "${BASE_URL}/api/device/commands/ack?api_key=rs_7f3a9c21e5b84d6f0a2c9e8d7b6a5f4e3d2c1b0a" \\\\
  -H "Content-Type: application/json" \\\\
  -d '{"command_id": 42, "device_id": 5, "status": "executed"}'`,
      python: `import requests

r = requests.post(f"{BASE}/api/device/commands/ack", params={"api_key": API_KEY},
                  json={"command_id": 42, "device_id": 5, "status": "executed"})
print(r.json()["data"]["status"])   # executed`,
      node: `const res = await fetch(\`\${BASE}/api/device/commands/ack?api_key=\${API_KEY}\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ command_id: 42, device_id: 5, status: "executed" }),
});
console.log(await res.json());`,
      response: `{
  "success": true,
  "data": {
    "id": 42,
    "deviceId": 5,
    "command": "on",
    "status": "executed",
    "executedAt": "2026-08-18T10:02:16.000Z"
  }
}`,
    },
    {
      method: "POST",
      path: "/api/device/ota-progress",
      name: "7. OTA progress report (optional)",
      desc: "Firmware download/flash ke dauran progress bhejo — admin panel OTA / ESP tab me live progress dikhta hai (0-100).",
      params: "Query/body: api_key · Body: { device_id, progress: 0-100, status?: string }",
      nameHi: "7. OTA progress रिपोर्ट (optional)",
      descHi:
        "Firmware download/flash के दौरान progress भेजें — admin panel OTA / ESP tab में live progress दिखता है (0-100)।",
      paramsHi: "Query/body: api_key · Body: { device_id, progress: 0-100, status?: string }",
      curl: `curl -X POST "${BASE_URL}/api/device/ota-progress?api_key=rs_7f3a9c21e5b84d6f0a2c9e8d7b6a5f4e3d2c1b0a" \\\\
  -H "Content-Type: application/json" \\\\
  -d '{"device_id": 5, "progress": 45, "status": "downloading"}'`,
      python: `import requests

r = requests.post(f"{BASE}/api/device/ota-progress", params={"api_key": API_KEY},
                  json={"device_id": 5, "progress": 45, "status": "downloading"})
print(r.json()["data"])   # {"progress": 45, "status": "downloading"}`,
      node: `const res = await fetch(\`\${BASE}/api/device/ota-progress?api_key=\${API_KEY}\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ device_id: 5, progress: 45, status: "downloading" }),
});
console.log(await res.json());`,
      response: `{
  "success": true,
  "data": { "progress": 45, "status": "downloading" }
}`,
    },
  ];

  const cards = endpoints.map((e) => renderEndpoint(e, lang, s)).join("\n");

  const arduinoSketch = `#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ---- Settings: App > Device Keys se API key, Dashboard se device id ----
const char* WIFI_SSID = "MyWiFi";
const char* WIFI_PASS = "yourpassword";
const char* API_KEY   = "rs_7f3a9c21e5b84d6f0a2c9e8d7b6a5f4e3d2c1b0a";
const char* SERVER    = "https://onlineswitch.bhartitechnical.com";
const int   DEVICE_ID = 5;      // Dashboard me device ka id
const int   RELAY_PIN = 4;      // relay module ka control pin

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\\nWiFi connected");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    pollCommands();   // long-poll: naya command aate hi relay toggle
    sendHeartbeat();  // IP + firmware + relay state report (har ~10s)
  }
  delay(10 * 1000);
}

// Long-poll commands — server response ko hold karta hai jab tak
// command na aaye (max 20s), isliye <2s relay response milta hai.
void pollCommands() {
  HTTPClient http;
  http.begin(String(SERVER) + "/api/device/commands?api_key=" + API_KEY +
             "&long=1&hold=20");
  int code = http.GET();
  if (code == HTTP_CODE_OK) {
    JsonDocument doc;
    deserializeJson(doc, http.getString());
    for (JsonObject cmd : doc["data"]["commands"].as<JsonArray>()) {
      int id = cmd["id"];
      int deviceId = cmd["deviceId"];
      String action = cmd["command"] | "off";
      if (deviceId == DEVICE_ID) {
        digitalWrite(RELAY_PIN, action == "on" ? HIGH : LOW);
        ack(id, deviceId, "executed");   // command done — server ko batao
      }
    }
  }
  http.end();
}

void ack(int commandId, int deviceId, const char* status) {
  HTTPClient http;
  http.begin(String(SERVER) + "/api/device/commands/ack?api_key=" + API_KEY);
  http.addHeader("Content-Type", "application/json");
  String body = String("{\\"command_id\\":") + commandId +
                ",\\"device_id\\":" + deviceId +
                ",\\"status\\":\\"" + status + "\\"}";
  http.POST(body);
  http.end();
}

// Heartbeat: IP + firmware version + actual relay state.
// Response me OTA instruction bhi aa sakti hai (admin ne push kiya ho to).
void sendHeartbeat() {
  HTTPClient http;
  http.begin(String(SERVER) + "/api/device/heartbeat?api_key=" + API_KEY);
  http.addHeader("Content-Type", "application/json");
  String states = String("[{\\"id\\":") + DEVICE_ID +
                  ",\\"status\\":\\"" + (digitalRead(RELAY_PIN) ? "on" : "off") + "\\"}]";
  String body = String("{\\"device_id\\":") + DEVICE_ID +
                ",\\"ip\\":\\"" + WiFi.localIP().toString() +
                "\\",\\"fw_version\\":\\"2.2.0\\"" +
                ",\\"mac\\":\\"" + WiFi.macAddress() +
                "\\",\\"ssid\\":\\"" + WIFI_SSID +
                "\\",\\"states\\":\\"" + states + "\\"}";
  int code = http.POST(body);
  if (code == HTTP_CODE_OK) {
    JsonDocument doc;
    deserializeJson(doc, http.getString());
    const char* otaUrl = doc["data"]["ota"]["url"] | "";
    if (strlen(otaUrl) > 0) {
      Serial.print("OTA available: "); Serial.println(otaUrl);
      // yahan HTTPUpdate.begin(url) se download + flash karo
    }
  }
  http.end();
}`;

  const today = new Date().toISOString().slice(0, 10);
  const localBase = BASE_URL.replace("https://onlineswitch.bhartitechnical.com", "http://localhost:4000");

  return `<!DOCTYPE html>
<html lang="${s.htmlLang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${s.title}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;margin:0;background:#fafafa">
  <div style="background:#0f172a;color:#fff;padding:18px 24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <strong>${s.headerTitle}</strong>
    <span style="color:#9ca3af;margin-left:auto;font-size:14px">
      <a href="/api/docs" style="color:#60a5fa">Swagger UI</a> ·
      <a href="/api/docs/plain" style="color:#60a5fa">Endpoint list</a> ·
      <a href="/api/docs/openapi.json" style="color:#60a5fa">openapi.json</a> ·
      <a href="/api/docs/realtime" style="color:#60a5fa">Realtime</a> ·
      <a href="${s.langHref}" style="color:#fbbf24;font-weight:700">${s.langLabel}</a>
    </span>
  </div>
  <div style="max-width:980px;margin:0 auto;padding:28px 24px">

    <h2 style="margin-top:0">${lang === "hi" ? "ESP32 / hardware clients के लिए quick guide" : "ESP32 / hardware clients ke liye quick guide"}</h2>
    <p style="color:#4b5563;font-size:14px;line-height:1.7">
      ${s.intro}
    </p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;font-size:13px;color:#1e40af;line-height:1.7">
      ${s.baseUrlNote}
    </div>

    ${cards}

    <h2 style="margin-top:40px">${s.arduinoHeading}</h2>
    <p style="color:#4b5563;font-size:14px;line-height:1.7">
      ${s.arduinoDesc}
    </p>
    ${codeBlock("Arduino (ESP32 + ArduinoJson)", arduinoSketch)}

    <h2 style="margin-top:40px">${s.errorsHeading}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;border:1px solid #e5e7eb;border-radius:8px">
      <tr style="background:#f8fafc;text-align:left"><th style="padding:10px 14px">${s.errorsCode}</th><th style="padding:10px 14px">${s.errorsMeaning}</th></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 14px"><code>UNAUTHORIZED</code></td><td style="padding:10px 14px">${s.errUnauthorized}</td></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 14px"><code>KEY_NOT_SCOPED</code></td><td style="padding:10px 14px">${s.errKeyNotScoped}</td></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 14px"><code>DEVICE_NOT_FOUND</code></td><td style="padding:10px 14px">${s.errDeviceNotFound}</td></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 14px"><code>RATE_LIMITED</code></td><td style="padding:10px 14px">${s.errRateLimited}</td></tr>
    </table>

    <p style="color:#9ca3af;font-size:12px;margin-top:32px">${s.footerUpdated}: ${today} · ${s.footerLocalDev}: ${localBase} replace karke test karo</p>
  </div>
</body></html>`;
}

export function esp32GuideHtml(lang: GuideLang = "en"): string {
  return buildHtml(lang);
}
