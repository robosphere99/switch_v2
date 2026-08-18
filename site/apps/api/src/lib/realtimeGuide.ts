/**
 * Realtime events guide (Socket.IO) — /api/docs/realtime
 *
 * Web app ka live-push model: device toggle / schedule / OTA / notifications
 * Socket.IO se turant push hote hain. ESP32 boards isse connect NAHI hote —
 * wo HTTP long-poll use karte hain (ESP32 guide). Ye page web/custom clients
 * ke liye + ESP32 command-flow samajhne ke liye.
 * Zero dependencies — pure HTML string, docs.routes.ts se serve hota hai.
 */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function codeBlock(label: string, code: string): string {
  return `
    <div style="margin:10px 0">
      <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
      <pre style="background:#0f172a;color:#e2e8f0;border-radius:8px;padding:14px 16px;overflow-x:auto;font-size:13px;line-height:1.55;margin:0"><code>${esc(code)}</code></pre>
    </div>`;
}

interface EventDoc {
  name: string;
  room: string;
  desc: string;
  example: string;
}

function renderEvent(e: EventDoc): string {
  return `
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px;margin:16px 0">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <code style="background:#7c3aed1a;color:#7c3aed;font-weight:700;padding:4px 10px;border-radius:6px">${e.name}</code>
      <code style="background:#f8fafc;border:1px solid #e2e8f0;color:#334155;padding:4px 10px;border-radius:6px;font-size:12px">room: ${e.room}</code>
    </div>
    <p style="margin:12px 0 0;color:#4b5563;font-size:14px;line-height:1.6">${e.desc}</p>
    ${codeBlock("Example payload", e.example)}
  </div>`;
}

function buildHtml(): string {
  const events: EventDoc[] = [
    {
      name: "socket:ready",
      room: "user:{userId}",
      desc:
        "Connection ack — connect hote hi ek baar aata hai. <code>homes</code> = kitne home rooms me join hua (0 = koi home nahi, sirf user room). Web UI isi se \"live\" indicator dikhata hai.",
      example: `{
  "homes": 2
}`,
    },
    {
      name: "device:updated",
      room: "home:{homeId}",
      desc:
        "Sabse important event — koi bhi device mutation pe uniform DTO broadcast hota hai: web toggle, ESP heartbeat (relay state sync), physical switch report, offline/online detection. <code>updatedAt</code> stale-event guard ke liye hota hai (purana event ignore karo agar naye se chhota ho).",
      example: `{
  "id": 5,
  "homeId": 1,
  "name": "Living Room Bulb",
  "status": "on",
  "online": true,
  "offline": false,
  "lastSeen": "2026-08-18T10:03:00.000Z",
  "updatedAt": "2026-08-18T10:03:00.120Z"
}`,
    },
    {
      name: "esp:updated",
      room: "home:{homeId}",
      desc:
        "ESP board row change — rename, heartbeat (IP/firmware/states update) ya offline/online. Payload partial hota hai: hamesha <code>id</code>, baaki change ke hisaab se (e.g. <code>{ id, offline: true }</code> power-cut pe).",
      example: `{
  "id": 3,
  "offline": true
}`,
    },
    {
      name: "command:updated",
      room: "home:{homeId}",
      desc:
        "Command execute/fail ack — ESP ne relay toggle kar liya (ya fail). Web UI pending badge isi se confirm hota hai. <code>status</code>: <code>executed</code> | <code>failed</code>.",
      example: `{
  "id": 42,
  "status": "executed",
  "executedAt": "2026-08-18T10:02:16.000Z"
}`,
    },
    {
      name: "notification:new",
      room: "user:{userId}",
      desc:
        "Naya in-app notification (bell/badge) — order status, warranty, offline alert, automation suggestion etc. Poore notification object ke saath.",
      example: `{
  "id": 88,
  "userId": 12,
  "category": "device",
  "type": "warning",
  "title": "Living Room Bulb offline",
  "body": "{\\"t\\":\\"Living Room Bulb 2 min se offline\\"}",
  "read": false,
  "createdAt": "2026-08-18T10:04:00.000Z"
}`,
    },
    {
      name: "support:new",
      room: "user:{userId} (ya admin)",
      desc:
        "Support chat me naya message — user ko admin ka reply, admin ko user ka message. <code>senderRole</code>: <code>user</code> | <code>admin</code>.",
      example: `{
  "senderRole": "admin",
  "message": {
    "id": 51,
    "conversationId": 7,
    "senderId": 1,
    "senderRole": "admin",
    "content": "Ji, serial key email pe bhej di hai!",
    "createdAt": "2026-08-18T10:05:00.000Z"
  }
}`,
    },
    {
      name: "home:access-revoked",
      room: "user:{userId}",
      desc:
        "Home membership revoke/role-change pe socket ko us home room se nikaal diya jata hai + ye event aata hai — client ko apne UI se home hatana chahiye (warna removed member ko devices dikhte rehte).",
      example: `{
  "homeId": 1
}`,
    },
  ];

  const cards = events.map(renderEvent).join("\n");

  const nodeClient = `import { io } from "socket.io-client";

// Auth: login response ka accessToken (Bearer wala JWT).
const socket = io("/", {
  auth: { token: ACCESS_TOKEN },
});

socket.on("connect", () => console.log("connected", socket.id));
socket.on("connect_error", (err) => {
  // "unauthorized" = token missing/expired → wapas login karo
  console.error("socket error:", err.message);
});

socket.on("socket:ready", ({ homes }) =>
  console.log("live:", homes, "homes"));
socket.on("device:updated", (d) =>
  console.log(d.id, d.name, d.status, d.online ? "online" : "offline"));
socket.on("command:updated", (c) =>
  console.log("cmd", c.id, c.status));
socket.on("esp:updated", (e) =>
  console.log("esp", e.id, e.offline === undefined ? "updated" : e.offline ? "offline" : "online"));
socket.on("notification:new", (n) =>
  console.log("🔔", n.title));
socket.on("home:access-revoked", ({ homeId }) =>
  console.log("home access gone:", homeId));`;

  const browserClient = `<script src="/socket.io/socket.io.js"></script>
<script>
  const socket = io({ auth: { token: ACCESS_TOKEN } });
  socket.on("device:updated", (d) => {
    const el = document.getElementById("bulb-" + d.id);
    if (el) el.textContent = d.status + (d.online ? " (live)" : " (offline)");
  });
</script>`;

  const flow = `Web app (Socket.IO push)        Server                ESP32 (HTTP long-poll)
        │                              │                        │
  toggle ON ── POST /status ──────────▶│                        │
        │                              │ enqueue command        │
        │                              │──────── commands long-poll ──▶
        │                              │◀──────── ack (executed) ─────── relay toggle
        │                              │                        │
  ◀─── command:updated ────────────────│                        │
  ◀─── device:updated ────────────────◀┘                        │
        │                              │◀── heartbeat (states) ─┘`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SwitchNest — Realtime Events (Socket.IO)</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;margin:0;background:#fafafa">
  <div style="background:#0f172a;color:#fff;padding:18px 24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <strong>📡 SwitchNest — Realtime Events (Socket.IO)</strong>
    <span style="color:#9ca3af;margin-left:auto;font-size:14px">
      <a href="/api/docs" style="color:#60a5fa">Swagger UI</a> ·
      <a href="/api/docs/plain" style="color:#60a5fa">Endpoint list</a> ·
      <a href="/api/docs/esp32" style="color:#60a5fa">ESP32 guide</a> ·
      <a href="/api/docs/esp32/hi" style="color:#fbbf24">हिंदी</a>
    </span>
  </div>
  <div style="max-width:980px;margin:0 auto;padding:28px 24px">

    <h2 style="margin-top:0">Web app ka live-push model — Socket.IO events</h2>
    <p style="color:#4b5563;font-size:14px;line-height:1.7">
      Web app realtime <b>Socket.IO</b> pe chalta hai — toggle, schedule, OTA, notifications
      <b>push</b> hote hain (polling nahi). <b>ESP32 boards isse connect NAHI hote</b> — wo
      HTTP long-poll use karte hain (dekho: <a href="/api/docs/esp32" style="color:#2563eb">ESP32 guide</a>).
      Ye page un clients ke liye hai jo live UI banate hain, aur ESP32 command-flow
      samajhne ke liye.
    </p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;font-size:13px;color:#1e40af;line-height:1.7">
      <b>Connect:</b> same origin + <code>/socket.io</code> (dev me Vite proxy; production me same domain) ·
      <b>Auth:</b> <code>auth: { token: &lt;accessToken&gt; }</code> — login response ka JWT ·
      <b>Rooms:</b> <code>user:{userId}</code> (personal) + <code>home:{homeId}</code> har membership ke liye
      (admin = saare homes) · events sirf un homes ke aate hain jinme aap member ho.
      Heartbeat/command events <code>device:updated</code> broadcast ke through web UI tak pahunchte hain.
    </div>

    <h2 style="margin-top:36px">🔄 Command flow — ESP32 ke saath (ek nazar)</h2>
    ${codeBlock("Web toggle → relay → ack → live update", flow)}
    <p style="color:#4b5563;font-size:13px;line-height:1.7">
      ESP32 firmware me Socket.IO ki zaroorat <b>nahi</b> — HTTP long-poll hi command delivery +
      relay toggle + ack karta hai. Neeche ke events wo push hain jo web UI ko turant update karte hain.
    </p>

    <h2 style="margin-top:36px">📨 Server → client events</h2>
    ${cards}

    <h2 style="margin-top:36px">🧪 Clients</h2>
    ${codeBlock("Node.js (socket.io-client v4)", nodeClient)}
    ${codeBlock("Browser (script tag — same origin se serve hota hai)", browserClient)}

    <h2 style="margin-top:36px">⚠️ Notes</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;border:1px solid #e5e7eb;border-radius:8px">
      <tr style="background:#f8fafc;text-align:left"><th style="padding:10px 14px">Situation</th><th style="padding:10px 14px">Kya karein</th></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 14px"><code>connect_error: unauthorized</code></td><td style="padding:10px 14px">Token missing/expired — wapas login karke naya access token do</td></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 14px">Pehle connect pe koi home event nahi</td><td style="padding:10px 14px"><code>socket:ready</code> ka <code>homes</code> count dekho — 0 hai to membership check karo</td></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 14px">Purana <code>device:updated</code></td><td style="padding:10px 14px">Naye event ka <code>updatedAt</code> chhota ho to ignore karo (stale guard)</td></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 14px">Reconnect</td><td style="padding:10px 14px">Client khud reconnect karta hai; <code>socket:ready</code> dobara aata hai — state re-fetch karo</td></tr>
    </table>

    <p style="color:#9ca3af;font-size:12px;margin-top:32px">Event names: <code>@robosphere/shared</code> me <code>REALTIME_EVENTS</code> se aate hain (single source of truth)</p>
  </div>
</body></html>`;
}

export function realtimeGuideHtml(): string {
  return buildHtml();
}
