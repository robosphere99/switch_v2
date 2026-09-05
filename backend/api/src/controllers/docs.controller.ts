import { Request, Response } from "express";
import { getOpenApiSpec } from "../lib/openapi";
import { esp32GuideHtml } from "../lib/esp32Guide";
import { realtimeGuideHtml } from "../lib/realtimeGuide";

const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SwitchNest API Docs</title>
  <link rel="icon" type="image/png" sizes="32x32" href="/api/docs/assets/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/api/docs/assets/favicon-16x16.png">
  <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css">
  <style>
    body { margin: 0; background: #fafafa; }
    .topbar { background: #0f172a; color: #fff; padding: 14px 24px; display: flex; align-items: center; gap: 12px; font-family: Arial, sans-serif; }
    .topbar a { color: #60a5fa; text-decoration: none; margin-left: auto; font-size: 14px; }
    .topbar a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="topbar">
    <strong>📡 SwitchNest API</strong>
    <a href="/api/docs/openapi.json" target="_blank">openapi.json</a>
    <a href="/api/docs/plain" target="_blank">Plain list</a>
    <a href="/api/docs/esp32" target="_blank">🛠 ESP32 guide</a>
    <a href="/api/docs/esp32/hi" target="_blank" style="color:#fbbf24">हिंदी</a>
    <a href="/api/docs/realtime" target="_blank">⚡ Realtime</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
  <script src="/api/docs/assets/swagger-init.js"></script>
</body>
</html>`;

export const getSwaggerUi = (_req: Request, res: Response) => {
  res.type("html").send(SWAGGER_UI_HTML);
};

export const getOpenApiJson = (_req: Request, res: Response) => {
  res.json(getOpenApiSpec());
};

export const getEsp32Guide = (_req: Request, res: Response) => {
  res.type("html").send(esp32GuideHtml("en"));
};

export const getEsp32GuideHi = (_req: Request, res: Response) => {
  res.type("html").send(esp32GuideHtml("hi"));
};

export const getRealtimeGuide = (_req: Request, res: Response) => {
  res.type("html").send(realtimeGuideHtml());
};

export const getPlainList = (_req: Request, res: Response) => {
  const spec = getOpenApiSpec();
  const paths = spec.paths as Record<string, Record<string, { summary?: string; tags?: string[] }>>;

  const byTag = new Map<string, Array<{ method: string; path: string; summary: string }>>();
  for (const [path, ops] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(ops)) {
      const tag = op.tags?.[0] ?? "Other";
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push({ method: method.toUpperCase(), path, summary: op.summary ?? "" });
    }
  }

  const methodColor: Record<string, string> = {
    GET: "#22c55e", POST: "#3b82f6", PATCH: "#eab308", PUT: "#eab308", DELETE: "#ef4444",
  };

  const sections = [...byTag.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([tag, eps]) => `
    <h2 style="margin-top:32px;border-bottom:1px solid #e5e7eb;padding-bottom:8px">${tag} <span style="color:#9ca3af;font-weight:normal">(${eps.length})</span></h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${eps
        .map((e) => {
          const color = methodColor[e.method] ?? "#6b7280";
          return `<tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:8px 10px;white-space:nowrap"><code style="background:${color}1a;color:${color};font-weight:700;padding:3px 8px;border-radius:6px">${e.method}</code></td>
            <td style="padding:8px 10px;font-family:monospace;font-size:13px">${e.path}</td>
            <td style="padding:8px 10px;color:#4b5563">${e.summary || ""}</td>
          </tr>`;
        })
        .join("")}
    </table>`,
    )
    .join("");

  res.type("html").send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>SwitchNest API — Endpoint List</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;margin:0;background:#fafafa">
  <div style="background:#0f172a;color:#fff;padding:16px 24px">
    <strong>📡 SwitchNest API — saare endpoints (${Object.keys(paths).length} paths)</strong>
    <span style="color:#9ca3af;margin-left:16px">Offline list · Swagger UI: <a href="/api/docs" style="color:#60a5fa">/api/docs</a> · Raw: <a href="/api/docs/openapi.json" style="color:#60a5fa">openapi.json</a> · ESP32 guide: <a href="/api/docs/esp32" style="color:#60a5fa">/api/docs/esp32</a> · Hindi: <a href="/api/docs/esp32/hi" style="color:#fbbf24">/api/docs/esp32/hi</a> · Realtime: <a href="/api/docs/realtime" style="color:#60a5fa">/api/docs/realtime</a></span>
  </div>
  <div style="max-width:1100px;margin:0 auto;padding:24px">
    <p style="color:#6b7280;font-size:14px">Auth: <code>Authorization: Bearer &lt;token&gt;</code> · ESP32: <code>?api_key=rs_...</code> · Envelope: <code>{ success, data }</code></p>
    ${sections}
  </div>
</body></html>`);
};
