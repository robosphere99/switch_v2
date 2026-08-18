import { Router } from "express";
import { getOpenApiSpec } from "../lib/openapi";

export const docsRouter = Router();

/** Swagger UI — CDN se (zero npm dependency). CDN na khule to plain page ka link. */
const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SwitchNest API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
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
    <a href="/api/docs/plain" target="_blank">Plain list (offline)</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true,
        tryItOutEnabled: true,
      });
    };
  </script>
</body>
</html>`;

docsRouter.get("/", (_req, res) => {
  res.type("html").send(SWAGGER_UI_HTML);
});

docsRouter.get("/openapi.json", (_req, res) => {
  res.json(getOpenApiSpec());
});

/** Offline-friendly: bina JS/CDN ke saare endpoints ki simple HTML list. */
docsRouter.get("/plain", (_req, res) => {
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
    <span style="color:#9ca3af;margin-left:16px">Offline list · Swagger UI: <a href="/api/docs" style="color:#60a5fa">/api/docs</a> · Raw: <a href="/api/docs/openapi.json" style="color:#60a5fa">openapi.json</a></span>
  </div>
  <div style="max-width:1100px;margin:0 auto;padding:24px">
    <p style="color:#6b7280;font-size:14px">Auth: <code>Authorization: Bearer &lt;token&gt;</code> · ESP32: <code>?api_key=rs_...</code> · Envelope: <code>{ success, data }</code></p>
    ${sections}
  </div>
</body></html>`);
});
