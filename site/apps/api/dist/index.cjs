"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/config/env.ts
function buildDatabaseUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST ?? "127.0.0.1";
  const port = process.env.DB_PORT ?? "3306";
  const user = process.env.DB_USER ?? "root";
  const pass = process.env.DB_PASS ?? "";
  const name = process.env.DB_NAME ?? "switchnest";
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${name}?connection_limit=10`;
}
var import_dotenv, import_node_path, import_node_fs, import_zod, envPaths, envSchema, parsed, env, corsOrigins;
var init_env = __esm({
  "src/config/env.ts"() {
    "use strict";
    import_dotenv = __toESM(require("dotenv"), 1);
    import_node_path = __toESM(require("node:path"), 1);
    import_node_fs = __toESM(require("node:fs"), 1);
    import_zod = require("zod");
    envPaths = [
      import_node_path.default.resolve(process.cwd(), ".env"),
      import_node_path.default.resolve(process.cwd(), "../.env"),
      import_node_path.default.resolve(process.cwd(), "../../.env")
    ];
    for (const p of envPaths) {
      try {
        if (import_node_fs.default.existsSync(p)) import_dotenv.default.config({ path: p, override: true });
      } catch {
      }
    }
    envSchema = import_zod.z.object({
      // Empty DATABASE_URL diya ho to ignore karke DB_* vars use hote hain
      DATABASE_URL: import_zod.z.preprocess(
        (v) => typeof v === "string" && v.trim() ? v : void 0,
        import_zod.z.string().default(buildDatabaseUrl)
      ),
      JWT_ACCESS_SECRET: import_zod.z.string().default("dev-access-secret"),
      JWT_REFRESH_SECRET: import_zod.z.string().default("dev-refresh-secret"),
      JWT_ACCESS_EXPIRES: import_zod.z.string().default("15m"),
      JWT_REFRESH_EXPIRES: import_zod.z.string().default("7d"),
      // Plesk/Paas PORT env var ko respect karta hai (Plesk nginx app ko assigned
      // port pe proxy karta hai); nahi diya to 4000.
      API_PORT: import_zod.z.coerce.number().default(Number(process.env.PORT) || 4e3),
      API_HOST: import_zod.z.string().default("0.0.0.0"),
      CORS_ORIGINS: import_zod.z.string().default("http://localhost:5173"),
      LOG_LEVEL: import_zod.z.enum(["debug", "info", "warn", "error"]).default("info"),
      WIFI_ENC_KEY: import_zod.z.string().default("switchnest-dev-wifi-key-change-me"),
      // Payment gateway (optional) — nahi diya to demo/manual mode chalta hai
      RAZORPAY_KEY_ID: import_zod.z.string().optional().default(""),
      RAZORPAY_KEY_SECRET: import_zod.z.string().optional().default(""),
      UPI_ID: import_zod.z.string().optional().default("switchnest@upi"),
      // First-run admin (install route) — hosting pe yahan se set hota hai
      ADMIN_USERNAME: import_zod.z.string().default("admin"),
      ADMIN_EMAIL: import_zod.z.string().default("admin@switchnest.local"),
      ADMIN_PASSWORD: import_zod.z.string().default("admin123"),
      // Install ko lock karne ke liye (installed flag ke saath match karta hai)
      INSTALL_TOKEN: import_zod.z.string().optional().default(""),
      // AI assistant (Phase 7) — OpenAI-compatible API (OpenAI / Gemini / Ollama)
      AI_PROVIDER: import_zod.z.string().default(""),
      // openai | gemini | ollama | "" (off → rule-based)
      AI_API_KEY: import_zod.z.string().default(""),
      AI_BASE_URL: import_zod.z.string().default(""),
      // empty → provider default
      AI_MODEL: import_zod.z.string().default(""),
      // MQTT IoT broker port (ESP32 devices connect here)
      MQTT_PORT: import_zod.z.coerce.number().default(1883)
    });
    parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error("\u26A0\uFE0F Invalid environment variables \u2014 defaults use kar rahe hain:", parsed.error.flatten().fieldErrors);
    }
    env = parsed.success ? parsed.data : envSchema.parse({});
    if (!process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
    corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim());
  }
});

// src/lib/logger.ts
function fileLog(line) {
  if (!logFilePath) return;
  try {
    const timestamped = /^\[\d{4}-\d{2}-\d{2}T/.test(line) ? line : `[${(/* @__PURE__ */ new Date()).toISOString()}] ${line}`;
    fs2.appendFileSync(logFilePath, timestamped.endsWith("\n") ? timestamped : timestamped + "\n");
  } catch {
  }
}
function log(level, msg, meta) {
  if (ORDER[level] < ORDER[env.LOG_LEVEL]) return;
  const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] [${level.toUpperCase()}] ${msg}`;
  if (meta !== void 0) {
    const suffix = typeof meta === "string" ? meta : JSON.stringify(meta);
    fileLog(`${line} ${suffix}`);
    if (level === "error") console.error(line, suffix);
    else console.log(line, suffix);
  } else {
    fileLog(line);
    if (level === "error") console.error(line);
    else console.log(line);
  }
}
var fs2, path2, os, logFilePath, ORDER, logger;
var init_logger = __esm({
  "src/lib/logger.ts"() {
    "use strict";
    init_env();
    fs2 = __toESM(require("fs"), 1);
    path2 = __toESM(require("path"), 1);
    os = __toESM(require("os"), 1);
    logFilePath = (() => {
      const candidates = [
        path2.resolve(process.cwd(), "../logs"),
        // site/apps/logs — iisnode yahi likhta hai (writable)
        path2.resolve(process.cwd(), "logs"),
        // site/apps/api/logs
        path2.join(os.tmpdir(), "switchnest-logs")
      ];
      for (const dir of candidates) {
        try {
          fs2.mkdirSync(dir, { recursive: true });
          fs2.accessSync(dir, fs2.constants.W_OK);
          return path2.join(dir, "app.log");
        } catch {
          continue;
        }
      }
      return null;
    })();
    ORDER = { debug: 0, info: 1, warn: 2, error: 3 };
    logger = {
      debug: (msg, meta) => log("debug", msg, meta),
      info: (msg, meta) => log("info", msg, meta),
      warn: (msg, meta) => log("warn", msg, meta),
      error: (msg, meta) => log("error", msg, meta)
    };
  }
});

// src/lib/prisma.ts
var prisma_exports = {};
__export(prisma_exports, {
  getEffectiveDbUrl: () => getEffectiveDbUrl,
  prisma: () => prisma,
  resetPrismaClient: () => resetPrismaClient,
  withConnLimit: () => withConnLimit
});
function getEffectiveDbUrl() {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl) return envUrl;
  const host = process.env.DB_HOST ?? "127.0.0.1";
  const port = process.env.DB_PORT ?? "3306";
  const user = process.env.DB_USER ?? "root";
  const pass = process.env.DB_PASS ?? "";
  const name = process.env.DB_NAME ?? "switchnest";
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${name}`;
}
function withConnLimit(url, limit = 10) {
  const target = url.trim() || getEffectiveDbUrl();
  try {
    const u = new URL(target);
    u.searchParams.set("connection_limit", String(limit));
    return u.toString();
  } catch {
    return target;
  }
}
async function resetPrismaClient(databaseUrl) {
  try {
    await prisma.$disconnect();
  } catch {
  }
  process.env.DATABASE_URL = withConnLimit(databaseUrl);
  const next = new import_client.PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
  });
  await next.$connect().catch(() => void 0);
  prisma = next;
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = next;
  return next;
}
var import_client, import_dotenv2, import_node_path2, import_node_fs2, candidatePaths, globalForPrisma, prisma;
var init_prisma = __esm({
  "src/lib/prisma.ts"() {
    "use strict";
    import_client = require("@prisma/client");
    import_dotenv2 = __toESM(require("dotenv"), 1);
    import_node_path2 = __toESM(require("node:path"), 1);
    import_node_fs2 = __toESM(require("node:fs"), 1);
    candidatePaths = [
      import_node_path2.default.resolve(process.cwd(), ".env"),
      import_node_path2.default.resolve(process.cwd(), "../.env"),
      import_node_path2.default.resolve(process.cwd(), "../../.env")
    ];
    for (const p of candidatePaths) {
      try {
        if (import_node_fs2.default.existsSync(p)) {
          import_dotenv2.default.config({ path: p, override: true });
        }
      } catch {
      }
    }
    process.env.DATABASE_URL = withConnLimit(getEffectiveDbUrl());
    globalForPrisma = globalThis;
    prisma = globalForPrisma.prisma ?? new import_client.PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } }
    });
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
  }
});

// src/lib/crypto.ts
function encryptSecret(plain) {
  const iv = import_node_crypto.default.randomBytes(12);
  const cipher = import_node_crypto.default.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}
function decryptSecret(payload) {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted payload");
  const decipher = import_node_crypto.default.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final()
  ]).toString("utf8");
}
var import_node_crypto, KEY;
var init_crypto = __esm({
  "src/lib/crypto.ts"() {
    "use strict";
    import_node_crypto = __toESM(require("node:crypto"), 1);
    init_env();
    KEY = import_node_crypto.default.createHash("sha256").update(env.WIFI_ENC_KEY).digest();
  }
});

// src/services/siteSettings.service.ts
async function getSiteSettings() {
  try {
    const row = await prisma.appMeta.findUnique({ where: { key: KEY2 } });
    if (row?.value) {
      return { ...DEFAULT_SITE_SETTINGS, ...JSON.parse(row.value) };
    }
  } catch {
  }
  return DEFAULT_SITE_SETTINGS;
}
async function getPublicSiteSettings() {
  const s = await getSiteSettings();
  const {
    smtpHost: _h,
    smtpPort: _p,
    smtpUser: _u,
    smtpPass: _pp,
    smtpFrom: _f,
    smtpSecure: _sc,
    aiProvider: _ap,
    aiApiKey: _ak,
    aiBaseUrl: _ab,
    aiModel: _am,
    ...pub
  } = s;
  return pub;
}
async function updateSiteSettings(patch) {
  const current = await getSiteSettings();
  const next = { ...current, ...patch };
  if (patch.smtpPass !== void 0) {
    if (patch.smtpPass) next.smtpPass = encryptSecret(patch.smtpPass);
    else next.smtpPass = current.smtpPass;
  }
  if (patch.aiApiKey !== void 0) {
    if (patch.aiApiKey) next.aiApiKey = encryptSecret(patch.aiApiKey);
    else next.aiApiKey = current.aiApiKey;
  }
  await prisma.appMeta.upsert({
    where: { key: KEY2 },
    create: { key: KEY2, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) }
  });
  return next;
}
var DEFAULT_SITE_SETTINGS, KEY2;
var init_siteSettings_service = __esm({
  "src/services/siteSettings.service.ts"() {
    "use strict";
    init_prisma();
    init_crypto();
    DEFAULT_SITE_SETTINGS = {
      siteName: "SwitchNest",
      supportEmail: "support@switchnest.in",
      supportPhone: "+91 98765 43210",
      supportAddress: "SwitchNest Labs, Sector 62, Noida, UP 201309",
      supportHours: "Mon\u2013Sat \xB7 9:00 AM \u2013 7:00 PM",
      brandColor: "#2563eb",
      siteUrl: "https://onlineswitch.bhartitechnical.com",
      // SMTP defaults yahan empty — asli defaults (587, STARTTLS) email.service me resolve hote hain,
      // taaki SMTP_* env vars hamesha precedence le saken jab settings me kuch set na ho.
      smtpHost: "",
      smtpPort: 0,
      smtpUser: "",
      smtpPass: "",
      smtpFrom: "",
      smtpSecure: false,
      aiProvider: "",
      aiApiKey: "",
      aiBaseUrl: "",
      aiModel: "",
      supportTicketMediaRetentionDays: 90,
      // Defaults to 3 months
      chatHistoryRetentionDays: 90,
      deviceTelemetryRetentionDays: 180
      // Defaults to 6 months for ML analysis (Hot Storage)
    };
    KEY2 = "site_settings";
  }
});

// src/lib/email.service.ts
async function getSmtpConfig() {
  const s = await getSiteSettings().catch(() => null);
  let pass = "";
  if (s?.smtpPass) {
    try {
      pass = decryptSecret(s.smtpPass);
    } catch {
      pass = s.smtpPass;
    }
  }
  return {
    host: s?.smtpHost || process.env.SMTP_HOST || "",
    port: s?.smtpPort || Number(process.env.SMTP_PORT) || 587,
    user: s?.smtpUser || process.env.SMTP_USER || "",
    pass: pass || process.env.SMTP_PASS || "",
    from: s?.smtpFrom || process.env.SMTP_FROM || s?.supportEmail || env.ADMIN_EMAIL,
    secure: s?.smtpSecure || process.env.SMTP_SECURE === "true"
  };
}
function isEmailConfigured(cfg) {
  return !!(cfg.host && cfg.user && cfg.pass);
}
function createReader(sock, timeoutMs) {
  let buf = "";
  let pending = null;
  let timer4 = null;
  const tryResolve = () => {
    if (!pending || !buf.endsWith("\r\n")) return false;
    const lines = buf.split("\r\n").filter((l) => l.length > 0);
    const last = lines[lines.length - 1] ?? "";
    if (!/^\d{3} /.test(last)) return false;
    const p = pending;
    pending = null;
    if (timer4) clearTimeout(timer4);
    buf = "";
    p.resolve(lines);
    return true;
  };
  const onData = (chunk) => {
    buf += chunk.toString("utf8");
    tryResolve();
  };
  sock.on("data", onData);
  return {
    next() {
      if (pending) return Promise.reject(new Error("SMTP: concurrent read"));
      return new Promise((resolve4, reject) => {
        pending = { resolve: resolve4, reject };
        timer4 = setTimeout(() => {
          if (pending) {
            const p = pending;
            pending = null;
            p.reject(new Error("SMTP timeout"));
          }
        }, timeoutMs);
        tryResolve();
      });
    },
    detach() {
      sock.off("data", onData);
      if (timer4) clearTimeout(timer4);
    }
  };
}
function send(sock, line) {
  sock.write(line + "\r\n");
}
function encodeHeader(value) {
  return /[^\x20-\x7E]/.test(value) ? `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=` : value;
}
function buildMessage(from, to, subject, text, html) {
  const date = (/* @__PURE__ */ new Date()).toUTCString();
  const boundary = `----switchnest_${Date.now().toString(36)}`;
  const head = [
    `Date: ${date}`,
    `From: ${encodeHeader("SwitchNest")} <${from}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0"
  ];
  const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
  const lines = html ? [
    ...head,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(html),
    `--${boundary}--`,
    "."
  ] : [
    ...head,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(text),
    "."
  ];
  return lines.join("\r\n");
}
async function sendEmail(opts) {
  const cfg = await getSmtpConfig().catch(() => null);
  if (!cfg || !isEmailConfigured(cfg)) {
    logger.warn(`[email] SMTP configured nahi hai \u2014 email skip (to=${opts.to})`);
    return { ok: false, skipped: true, error: "SMTP not configured" };
  }
  return new Promise((resolve4) => {
    let sock;
    try {
      sock = net.connect({ host: cfg.host, port: cfg.port });
    } catch (e) {
      logger.error("[email] connect error", e);
      return resolve4({ ok: false, error: String(e) });
    }
    let reader = createReader(sock, 2e4);
    let done = false;
    const fail2 = (msg) => {
      if (done) return;
      done = true;
      try {
        reader.detach();
        sock.destroy();
      } catch {
      }
      logger.warn(`[email] SMTP fail (${cfg.host}): ${msg}`);
      resolve4({ ok: false, error: msg });
    };
    const succeed = () => {
      if (done) return;
      done = true;
      try {
        reader.detach();
        sock.destroy();
      } catch {
      }
      logger.info(`[email] sent to ${opts.to}`);
      resolve4({ ok: true });
    };
    sock.on("error", (e) => fail2(String(e.message || e)));
    (async () => {
      try {
        let r = await reader.next();
        if (!r[0]?.startsWith("220")) return fail2(`Greeting: ${r[0] ?? "no response"}`);
        const ehloName = os2.hostname() || "switchnest";
        send(sock, `EHLO ${ehloName}`);
        r = await reader.next();
        let ehlo = r.join("\r\n");
        const useTls = cfg.secure || cfg.port === 465;
        if (!useTls && /STARTTLS/i.test(ehlo)) {
          send(sock, "STARTTLS");
          r = await reader.next();
          if (!r[0]?.startsWith("220")) return fail2(`STARTTLS: ${r[0]}`);
          reader.detach();
          sock = tls.connect({ socket: sock, servername: cfg.host });
          reader = createReader(sock, 2e4);
          await new Promise((res, rej) => {
            sock.once("secureConnect", () => res());
            sock.once("error", rej);
          });
          sock.on("error", (e) => fail2(String(e.message || e)));
          send(sock, `EHLO ${ehloName}`);
          r = await reader.next();
          ehlo = r.join("\r\n");
        }
        const mech = ehlo.toUpperCase();
        if (/AUTH/.test(mech) && !/AUTH=NONE/.test(mech)) {
          if (/LOGIN/.test(mech)) {
            send(sock, "AUTH LOGIN");
            r = await reader.next();
            if (!r[0]?.startsWith("334")) return fail2(`AUTH LOGIN: ${r[0]}`);
            send(sock, Buffer.from(cfg.user, "utf8").toString("base64"));
            r = await reader.next();
            if (!r[0]?.startsWith("334")) return fail2(`AUTH user: ${r[0]}`);
            send(sock, Buffer.from(cfg.pass, "utf8").toString("base64"));
            r = await reader.next();
            if (!r[0]?.startsWith("235")) return fail2(`AUTH pass: ${r[0]}`);
          } else if (/PLAIN/.test(mech)) {
            const token = Buffer.from(`\0${cfg.user}\0${cfg.pass}`, "utf8").toString("base64");
            send(sock, `AUTH PLAIN ${token}`);
            r = await reader.next();
            if (!r[0]?.startsWith("235")) return fail2(`AUTH PLAIN: ${r[0]}`);
          } else {
            return fail2("No supported AUTH mechanism (LOGIN/PLAIN required)");
          }
        }
        send(sock, `MAIL FROM:<${cfg.from}>`);
        r = await reader.next();
        if (!r[0]?.startsWith("250")) return fail2(`MAIL FROM: ${r[0]}`);
        send(sock, `RCPT TO:<${opts.to}>`);
        r = await reader.next();
        if (!r[0]?.startsWith("250")) return fail2(`RCPT TO: ${r[0]}`);
        send(sock, "DATA");
        r = await reader.next();
        if (!r[0]?.startsWith("354")) return fail2(`DATA: ${r[0]}`);
        send(sock, buildMessage(cfg.from, opts.to, opts.subject, opts.text, opts.html));
        r = await reader.next();
        if (!r[0]?.startsWith("250")) return fail2(`send: ${r[0]}`);
        send(sock, "QUIT");
        try {
          r = await reader.next();
          if (!r[0]?.startsWith("221")) return fail2(`QUIT: ${r[0]}`);
        } catch {
        }
        succeed();
      } catch (e) {
        fail2(e instanceof Error ? e.message : String(e));
      }
    })();
  });
}
async function sendSupportReplyEmail(opts) {
  const s = await getSiteSettings().catch(() => null);
  const siteName = s?.siteName || "SwitchNest";
  const siteUrl = s?.siteUrl || "";
  const subject = `\u{1F6E0}\uFE0F ${siteName} Support \u2014 Admin ne reply kiya`;
  const text = [
    `Namaste ${opts.userName},`,
    "",
    `Aapke support message pe ${siteName} team ne reply kiya hai:`,
    "",
    `"${opts.replyText}"`,
    "",
    siteUrl ? `Reply dekhne aur jawab dene ke liye: ${siteUrl}` : "Support chat khol kar turant jawab de sakte ho.",
    "",
    `\u2014 ${siteName} Support Team`
  ].join("\n");
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#2563eb;margin:0 0 16px">${siteName} Support</h2>
      <p style="font-size:15px;color:#333">Namaste <b>${opts.userName}</b>,</p>
      <p style="font-size:15px;color:#333">Aapke support message pe team ne reply kiya hai:</p>
      <div style="border-left:4px solid #2563eb;background:#f5f7fb;padding:12px 16px;border-radius:8px;color:#333;white-space:pre-wrap">${opts.replyText.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</div>
      ${siteUrl ? `<p style="font-size:15px;color:#333;margin-top:16px">Reply dekhne aur jawab dene ke liye: <a href="${siteUrl}" style="color:#2563eb">${siteUrl}</a></p>` : ""}
      <p style="font-size:13px;color:#888;margin-top:24px">\u2014 ${siteName} Support Team</p>
    </div>
  `.trim();
  return sendEmail({ to: opts.to, subject, text, html });
}
async function sendNotificationEmail(opts) {
  const s = await getSiteSettings().catch(() => null);
  const siteName = opts.siteName || s?.siteName || "SwitchNest";
  const siteUrl = (s?.siteUrl || "").replace(/\/$/, "");
  const subject = `${siteName} \u2014 ${opts.title}`;
  const bodyText = opts.body?.trim() ? opts.body.trim() : "";
  const text = [
    `Namaste ${opts.userName},`,
    "",
    opts.title,
    bodyText ? "" : void 0,
    bodyText,
    opts.ctaUrl ? `
Yahan dekho: ${opts.ctaUrl}` : void 0,
    "",
    siteUrl ? `\u2014 ${siteName} Team \xB7 ${siteUrl}` : `\u2014 ${siteName} Team`
  ].filter((l) => Boolean(l)).join("\n");
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#2563eb;margin:0 0 8px">${siteName}</h2>
      <p style="font-size:15px;color:#333">Namaste <b>${opts.userName}</b>,</p>
      <h3 style="margin:8px 0;color:#111">${opts.title}</h3>
      ${bodyText ? `<p style="font-size:15px;color:#333;white-space:pre-wrap">${bodyText.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</p>` : ""}
      ${opts.ctaUrl ? `<p style="margin:20px 0"><a href="${opts.ctaUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">${opts.ctaLabel ?? "Dekho"}</a></p>` : ""}
      <p style="font-size:13px;color:#888;margin-top:24px">\u2014 ${siteName} Team${siteUrl ? ` \xB7 <a href="${siteUrl}" style="color:#888">${siteUrl}</a>` : ""}</p>
    </div>
  `.trim();
  return sendEmail({ to: opts.to, subject, text, html });
}
async function sendPasswordResetEmail(opts) {
  const siteName = opts.siteName || "SwitchNest";
  const subject = `\u{1F511} ${siteName} \u2014 Password reset`;
  const text = [
    `Namaste ${opts.userName},`,
    "",
    `Aapne ${siteName} pe password reset maanga hai.`,
    "",
    opts.resetUrl ? `Password reset karne ke liye ye link 30 min ke andar kholo:` : "Password reset karne ke liye app ke Login page pe 'Forgot password?' ka link use karo.",
    opts.resetUrl || "",
    "",
    "Agar aapne ye request nahi bheji to is email ko ignore kar do \u2014 aapka password change nahi hoga.",
    "",
    `\u2014 ${siteName} Team`
  ].filter((l) => l !== "").join("\n");
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#2563eb;margin:0 0 16px">${siteName}</h2>
      <p style="font-size:15px;color:#333">Namaste <b>${opts.userName}</b>,</p>
      <p style="font-size:15px;color:#333">Aapne <b>${siteName}</b> pe password reset maanga hai. Ye link <b>30 min</b> ke liye valid hai:</p>
      ${opts.resetUrl ? `<p style="margin:20px 0"><a href="${opts.resetUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Password Reset karo</a></p>` : `<p style="font-size:15px;color:#333">Password reset karne ke liye app ke Login page pe 'Forgot password?' ka link use karo.</p>`}
      <p style="font-size:13px;color:#888">Agar aapne ye request nahi bheji to is email ko ignore kar do \u2014 aapka password change nahi hoga.</p>
      <p style="font-size:13px;color:#888;margin-top:24px">\u2014 ${siteName} Team</p>
    </div>
  `.trim();
  return sendEmail({ to: opts.to, subject, text, html });
}
var net, tls, os2;
var init_email_service = __esm({
  "src/lib/email.service.ts"() {
    "use strict";
    net = __toESM(require("node:net"), 1);
    tls = __toESM(require("node:tls"), 1);
    os2 = __toESM(require("node:os"), 1);
    init_siteSettings_service();
    init_crypto();
    init_env();
    init_logger();
  }
});

// ../../packages/shared/src/notificationDraft.ts
function parseNotificationBody(body) {
  if (!body) return { text: "" };
  try {
    const obj = JSON.parse(body);
    if (obj && typeof obj === "object" && typeof obj.t === "string") {
      const o = obj;
      return {
        text: o.t,
        targetUserId: typeof o.u === "number" ? o.u : void 0,
        draft: typeof o.d === "string" && o.d.length > 0 ? o.d : void 0
      };
    }
  } catch {
  }
  return { text: body };
}
function buildClientSupportDraft(n) {
  const title = n.title ?? "";
  const body = n.body ?? "";
  if (/Support ne message bheja/.test(title)) return null;
  if (/User ne support me reply kiya/.test(title)) return null;
  let m = title.match(/Support ne (.+?) (ON|OFF) kiya/i);
  if (m) {
    const on = m[2].toUpperCase() === "ON";
    return `Aapne mera device "${m[1].trim()}" ${on ? "ON" : "OFF"} kar diya, lekin maine aisa koi action nahi kiya tha. Kya yeh sahi hai? Please check karein.`;
  }
  m = title.match(/board renamed kiya: (.+?) → (.+)/i);
  if (m) {
    return `Aapne mera board rename kar diya hai (${m[1].trim()} \u2192 ${m[2].trim()}). Mujhe yeh samajh nahi aaya \u2014 kya yeh galat hua?`;
  }
  m = title.match(/"(.*?)" ke stuck commands clear/i);
  if (m) {
    return `Mera device "${m[1].trim()}" abhi kaam nahi kar raha tha. Ab kya karna hoga? Koi aur dikkat ho toh bata dijiye.`;
  }
  m = title.match(/"(.*?)" ke liye firmware update push/i);
  if (m) {
    return `Aapne mere device "${m[1].trim()}" pe firmware update push kiya hai \u2014 kya yeh expected tha? Update ke baad koi dikkat aaye toh yahi bataunga.`;
  }
  m = title.match(/Board offline: (.+)/i);
  if (m) return `Mera board "${m[1].trim()}" offline ho gaya hai \u2014 WiFi/power check kar liya, phir bhi connect nahi ho raha. Please help karein.`;
  m = title.match(/Board online: (.+)/i);
  if (m) return `Mera board "${m[1].trim()}" wapas online aa gaya hai. Sab theek hai ya kuch aur check karna hai?`;
  m = title.match(/^📡 (.+?) offline$/i);
  if (m) return `Mera device "${m[1].trim()}" offline ho gaya hai \u2014 WiFi/power check kar liya, phir bhi nahi aa raha. Please help karein.`;
  m = title.match(/^✅ (.+?) online$/i);
  if (m) return `Mera device "${m[1].trim()}" wapas online ho gaya hai. Sab theek hai ya kuch aur check karna hai?`;
  m = title.match(/"(.*?)" pe firmware update push/i);
  if (m) return `Mere device "${m[1].trim()}" pe firmware update chal raha hai \u2014 kya yeh sahi hai?`;
  m = title.match(/Board renamed: (.+?) → (.+)/i);
  if (m) return `Mera board rename ho gaya hai (${m[1].trim()} \u2192 ${m[2].trim()}). Kya yeh theek hai ya kuch galat hua?`;
  m = title.match(/Child safety: "(.*?)" band kiya/i);
  if (m) {
    return `Mera device "${m[1].trim()}" child safety ke karan band ho gaya \u2014 kya yeh sahi tha? Agar main ab bhi use kar sakta hoon to bata dijiye.`;
  }
  m = title.match(/"(.*?)" ka time khatam/i);
  if (m) {
    return `Mujhe bataya gaya ki device "${m[1].trim()}" ka aaj ka time khatam ho gaya. Kya main isse dobara ON kar sakta hoon?`;
  }
  m = title.match(/Schedule fired: (.+?) (ON|OFF)/i);
  if (m) return `Mera schedule device "${m[1].trim()}" ko ${m[2].toLowerCase()} kar diya \u2014 kya time aur action sahi tha? Please confirm karein.`;
  if (/Order placed/.test(title)) {
    const num = body.match(/Order ([A-Z0-9-]+)/i);
    return `Mere order${num ? ` ${num[1]}` : ""} ke baare me ek sawal hai \u2014 please madad karein.`;
  }
  m = title.match(/New member joined (.+)/i);
  if (m) return `Mere home "${m[1].trim()}" me koi naya member join hua hai \u2014 kya yeh expected tha?`;
  const text = body ? ` \u2014 ${body}` : "";
  return `Mujhe yeh notification mili: "${title}"${text}. Iske baare me madad chahiye.`;
}
function buildClientAdminReplyDraft(n) {
  const title = n.title ?? "";
  if (!/User ne support me reply kiya/.test(title)) return null;
  const { text } = parseNotificationBody(n.body);
  const trimmed = text.trim();
  if (trimmed) {
    const quote = trimmed.slice(0, 120);
    return `Namaste, aapka message padh liya: "${quote}" \u2014 hum isse check kar rahe hain, jald hi update denge. \u{1F64F}`;
  }
  return `Namaste, aapka support message note kar liya \u2014 hum jald hi update denge. \u{1F64F}`;
}
function buildNotificationDraft(n) {
  return buildClientSupportDraft(n) ?? buildClientAdminReplyDraft(n);
}
var init_notificationDraft = __esm({
  "../../packages/shared/src/notificationDraft.ts"() {
    "use strict";
  }
});

// ../../packages/shared/src/realtime.ts
var REALTIME_EVENTS;
var init_realtime = __esm({
  "../../packages/shared/src/realtime.ts"() {
    "use strict";
    REALTIME_EVENTS = {
      /** Device row change — hamesha uniform DTO (id + status + online + updatedAt). */
      deviceUpdated: "device:updated",
      /** ESP board update (admin/devices page). */
      espUpdated: "esp:updated",
      /** Command executed/failed — pending badge confirm ke liye. */
      commandUpdated: "command:updated",
      /** Naya notification (bell + badge). */
      notificationNew: "notification:new",
      /** Support chat message. */
      supportNew: "support:new",
      /** Socket connect hone pe ack — UI "live" indicator ke liye. */
      socketReady: "socket:ready",
      /** Home membership revoke/role-change — socket ko room se nikaala gaya. */
      homeAccessRevoked: "home:access-revoked"
    };
  }
});

// ../../packages/shared/src/index.ts
var HOME_MEMBER_ROLES;
var init_src = __esm({
  "../../packages/shared/src/index.ts"() {
    "use strict";
    init_notificationDraft();
    init_realtime();
    HOME_MEMBER_ROLES = ["owner", "admin", "member", "viewer"];
  }
});

// src/services/push.service.ts
var push_service_exports = {};
__export(push_service_exports, {
  sendPushToUser: () => sendPushToUser
});
async function sendPushToUser(userId, title, body, payload, category = "system") {
  try {
    let pushCondition = {};
    switch (category) {
      case "device":
        pushCondition = { pushDeviceToggles: true };
        break;
      case "support":
        pushCondition = { pushSupportUpdates: true };
        break;
      case "power":
        pushCondition = { pushPowerAlerts: true };
        break;
      case "order":
        pushCondition = { pushOrderUpdates: true };
        break;
      case "promo":
        pushCondition = { pushPromotional: true };
        break;
      case "security":
        pushCondition = { pushSecurityAlerts: true };
        break;
      default:
        pushCondition = { pushSystemAlerts: true };
        break;
    }
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId,
        ...pushCondition
      },
      select: { token: true }
    });
    if (!subscriptions || subscriptions.length === 0) return false;
    const messages = [];
    for (const sub of subscriptions) {
      const pushToken = sub.token;
      if (!import_expo_server_sdk.Expo.isExpoPushToken(pushToken)) {
        console.warn(`[Push Engine] Token ${pushToken} is invalid. Purging from registry.`);
        await prisma.$executeRawUnsafe(`DELETE FROM \`PushSubscription\` WHERE token = '${pushToken}'`).catch(() => {
        });
        continue;
      }
      messages.push({
        to: pushToken,
        sound: "default",
        // Forces a hardware audio alert
        priority: "high",
        // Bypass battery optimization throttling constraints
        title,
        body,
        data: payload || {},
        categoryId: category,
        channelId: "support-calls"
      });
    }
    if (messages.length === 0) return false;
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log(`[Push Engine] Dispatched payload ${ticketChunk[0].id || "batch"} to hardware bridging layer.`);
      } catch (ticketError) {
        console.error("[Push Engine] Segment Delivery Error:", ticketError);
      }
    }
    return true;
  } catch (e) {
    console.error("[Push Engine] Fatal notification construction error:", e);
    return false;
  }
}
var import_expo_server_sdk, expo;
var init_push_service = __esm({
  "src/services/push.service.ts"() {
    "use strict";
    import_expo_server_sdk = require("expo-server-sdk");
    init_prisma();
    expo = new import_expo_server_sdk.Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
  }
});

// src/services/mqtt.service.ts
var mqtt_service_exports = {};
__export(mqtt_service_exports, {
  mqttConnectedCount: () => mqttConnectedCount,
  mqttConnectedDevices: () => mqttConnectedDevices,
  mqttPushCommands: () => mqttPushCommands,
  mqttPushLedState: () => mqttPushLedState,
  mqttPushRotatePassword: () => mqttPushRotatePassword,
  mqttPushToHome: () => mqttPushToHome,
  publishTermCommand: () => publishTermCommand,
  startMqttBroker: () => startMqttBroker
});
function hashKey(raw) {
  return import_node_crypto2.default.createHash("sha256").update(raw).digest("hex");
}
function startMqttBroker() {
  broker = new import_aedes.default();
  tcpServer = (0, import_net.createServer)(broker.handle);
  broker.authenticate = async (client, username, password, callback) => {
    try {
      if (!username || !password) {
        return callback(new Error("credentials required"), false);
      }
      const serial = username.toString().trim().toUpperCase();
      const apiKeyPlain = password.toString().trim();
      const key = await prisma.apiKey.findUnique({
        where: { keyHash: hashKey(apiKeyPlain) },
        select: { id: true, homeId: true, revokedAt: true, expiresAt: true }
      });
      if (!key || !key.homeId) {
        return callback(new Error("invalid API key"), false);
      }
      if (key.revokedAt) {
        return callback(new Error("API key revoked"), false);
      }
      if (key.expiresAt && key.expiresAt < /* @__PURE__ */ new Date()) {
        return callback(new Error("API key expired"), false);
      }
      const esp = await prisma.espDevice.findFirst({
        where: { serialCode: serial, homeId: key.homeId },
        select: { id: true, macAddress: true }
      });
      if (!esp) {
        return callback(new Error("device not registered"), false);
      }
      connectedDevices.set(client.id, {
        homeId: key.homeId,
        espId: esp.id,
        mac: esp.macAddress.replace(/:/g, "").toLowerCase(),
        serial
      });
      await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: /* @__PURE__ */ new Date() } }).catch(() => void 0);
      logger.info(`[mqtt] \u{1F511} ${serial} authenticated (home ${key.homeId})`);
      callback(null, true);
    } catch (err) {
      logger.warn("[mqtt] auth error", err instanceof Error ? err.message : String(err));
      callback(err instanceof Error ? err : new Error(String(err)), false);
    }
  };
  broker.authorizePublish = (client, packet, callback) => {
    const meta = client ? connectedDevices.get(client.id) : null;
    if (!meta) return callback(new Error("unauthorized"));
    const prefix = `sn/${meta.mac}/`;
    if (!packet.topic.startsWith(prefix)) {
      return callback(new Error("topic not allowed"));
    }
    callback(null);
  };
  broker.authorizeSubscribe = (client, sub, callback) => {
    const meta = client ? connectedDevices.get(client.id) : null;
    if (!meta) return callback(new Error("unauthorized"), null);
    const prefix = `sn/${meta.mac}/`;
    if (!sub.topic.startsWith(prefix)) {
      return callback(new Error("topic not allowed"), null);
    }
    callback(null, sub);
  };
  broker.on("publish", async (packet, client) => {
    if (!client) return;
    const meta = connectedDevices.get(client.id);
    if (!meta) return;
    const topic = packet.topic;
    if (topic === `sn/${meta.mac}/log`) {
      try {
        const payloadStr = packet.payload.toString();
        emitToBoardLogs(meta.espId, payloadStr);
      } catch (err) {
        logger.warn(`[mqtt] log parse error from ${meta.serial}`, err instanceof Error ? err.message : String(err));
      }
      return;
    }
    if (topic === `sn/${meta.mac}/state`) {
      try {
        const payload = JSON.parse(packet.payload.toString());
        await handleDeviceState(meta, payload);
      } catch (err) {
        logger.warn(`[mqtt] state parse error from ${meta.serial}`, err instanceof Error ? err.message : String(err));
      }
    }
  });
  broker.on("client", async (client) => {
    const meta = connectedDevices.get(client.id);
    if (!meta) return;
    logger.info(`[mqtt] \u2197 ${meta.serial} (${meta.mac}) connected`);
    await prisma.espDevice.update({
      where: { id: meta.espId },
      data: { lastSeen: /* @__PURE__ */ new Date(), offline: false }
    }).catch(() => null);
    await prisma.device.updateMany({
      where: { espId: meta.espId },
      data: { lastSeen: /* @__PURE__ */ new Date(), offline: false }
    }).catch(() => null);
    await pushPendingCommands(meta);
    await pushDeviceNames(meta);
  });
  broker.on("clientDisconnect", async (client) => {
    const meta = connectedDevices.get(client.id);
    if (!meta) return;
    logger.info(`[mqtt] \u2198 ${meta.serial} (${meta.mac}) disconnected`);
    connectedDevices.delete(client.id);
    await prisma.espDevice.update({
      where: { id: meta.espId },
      data: { offline: true }
    }).catch(() => null);
    const devices = await prisma.device.findMany({
      where: { espId: meta.espId },
      select: { id: true }
    });
    await prisma.device.updateMany({
      where: { espId: meta.espId },
      data: { offline: true }
    }).catch(() => null);
    for (const d of devices) {
      await emitDeviceUpdated(meta.homeId, d.id);
    }
  });
  tcpServer.listen(MQTT_PORT, () => {
    logger.info(`\u{1F99F} MQTT Broker (Aedes) listening on tcp://0.0.0.0:${MQTT_PORT}`);
  });
  tcpServer.on("error", (err) => {
    logger.warn(`[mqtt] TCP server error: ${err.message}`);
  });
}
async function handleDeviceState(meta, payload) {
  const { homeId, espId, serial } = meta;
  const espUpdate = {
    lastSeen: /* @__PURE__ */ new Date(),
    offline: false
  };
  if (payload.fw) espUpdate.firmwareVersion = payload.fw;
  if (payload.ip) espUpdate.ipAddress = payload.ip;
  if (payload.ssid) espUpdate.ssid = payload.ssid;
  if (payload.model) espUpdate.modelCode = payload.model.toUpperCase();
  const esp = await prisma.espDevice.update({
    where: { id: espId },
    data: espUpdate
  });
  emitToHome(homeId, "esp:updated", esp);
  if (payload.states && Array.isArray(payload.states)) {
    const mappedDevices = await prisma.device.findMany({
      where: { espId, homeId }
    });
    for (let i = 0; i < payload.states.length; i++) {
      const channelNum = i + 1;
      const target = mappedDevices.find((d) => d.channel === channelNum);
      if (!target) continue;
      const targetStatus = payload.states[i] ? "on" : "off";
      if (target.status === targetStatus) continue;
      await prisma.device.update({
        where: { id: target.id },
        data: {
          status: targetStatus,
          lastSeen: /* @__PURE__ */ new Date(),
          offline: false
        }
      });
      await emitDeviceUpdated(homeId, target.id);
    }
  }
  await prisma.device.updateMany({
    where: { espId, homeId },
    data: { lastSeen: /* @__PURE__ */ new Date(), offline: false }
  }).catch(() => null);
}
async function pushPendingCommands(meta) {
  if (!broker) return;
  const { homeId, espId, mac } = meta;
  const devices = await prisma.device.findMany({
    where: { espId, homeId },
    select: { id: true, channel: true }
  });
  const deviceIds = devices.map((d) => d.id);
  if (deviceIds.length === 0) return;
  const cmds = await prisma.deviceCommand.findMany({
    where: { deviceId: { in: deviceIds }, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { id: true, deviceId: true, command: true }
  });
  if (cmds.length === 0) return;
  const commands = cmds.map((c) => {
    const dev = devices.find((d) => d.id === c.deviceId);
    return { id: c.id, ch: dev?.channel ?? 0, action: c.command };
  });
  const topic = `sn/${mac}/cmd`;
  const payload = JSON.stringify({ commands });
  broker.publish(
    { cmd: "publish", topic, payload: Buffer.from(payload), qos: 1, retain: false, dup: false },
    () => {
      logger.info(`[mqtt] \u2192 ${meta.serial} pushed ${commands.length} cmd(s)`);
    }
  );
}
async function pushDeviceNames(meta) {
  if (!broker) return;
  const { homeId, espId, mac } = meta;
  const devices = await prisma.device.findMany({
    where: { espId, homeId },
    select: { channel: true, name: true }
  });
  const chCount = devices.reduce((m, d) => Math.max(m, d.channel ?? 0), 4);
  const names = new Array(chCount).fill("");
  for (const d of devices) {
    if (d.channel != null && d.channel >= 1) {
      names[d.channel - 1] = d.name;
    }
  }
  const topic = `sn/${mac}/cmd`;
  const payload = JSON.stringify({ names });
  broker.publish(
    { cmd: "publish", topic, payload: Buffer.from(payload), qos: 1, retain: false, dup: false },
    () => {
    }
  );
}
function mqttPushCommands(mac) {
  const cleanMac = mac.replace(/:/g, "").toLowerCase();
  const metaMac = mac.toLowerCase();
  for (const [, meta] of connectedDevices) {
    if (meta.mac === cleanMac || meta.mac === metaMac) {
      void pushPendingCommands(meta);
      return;
    }
  }
}
function mqttPushRotatePassword(mac, newPass) {
  if (!broker) return;
  const topic = `sn/${mac}/cmd`;
  const payload = JSON.stringify({
    commands: [{ id: Math.floor(Math.random() * 1e5), action: "rotate_console_pass", newPass }]
  });
  broker.publish(
    { cmd: "publish", topic, payload: Buffer.from(payload), qos: 1, retain: false, dup: false },
    () => {
      logger.info(`[mqtt] \u2192 ${mac} pushed rotate_console_pass`);
    }
  );
}
function mqttPushToHome(homeId) {
  for (const [, meta] of connectedDevices) {
    if (meta.homeId === homeId) {
      void pushPendingCommands(meta);
    }
  }
}
function mqttConnectedCount() {
  return connectedDevices.size;
}
function mqttConnectedDevices() {
  return Array.from(connectedDevices.values()).map((m) => m.serial);
}
function publishTermCommand(mac, cmd) {
  if (!broker) return;
  const cleanMac = mac.replace(/:/g, "").toLowerCase();
  const topic = `sn/${cleanMac}/term_cmd`;
  broker.publish({
    topic,
    payload: Buffer.from(cmd),
    qos: 1,
    retain: false,
    cmd: "publish",
    dup: false
  }, (err) => {
    if (err) logger.error(`[mqtt] Failed to push terminal command to ${mac}`);
  });
}
function mqttPushLedState(mac, enabled) {
  if (!broker) return;
  const cleanMac = mac.replace(/:/g, "").toLowerCase();
  const topic = `sn/${cleanMac}/cmd`;
  const payload = JSON.stringify({ type: "set_led", enabled });
  broker.publish(
    { cmd: "publish", topic, payload: Buffer.from(payload), qos: 1, retain: false, dup: false },
    () => {
      logger.info(`[mqtt] \u2192 ${cleanMac} pushed LED state: ${enabled}`);
    }
  );
}
var import_aedes, import_net, import_node_crypto2, MQTT_PORT, broker, tcpServer, connectedDevices;
var init_mqtt_service = __esm({
  "src/services/mqtt.service.ts"() {
    "use strict";
    import_aedes = __toESM(require("aedes"), 1);
    import_net = require("net");
    import_node_crypto2 = __toESM(require("node:crypto"), 1);
    init_prisma();
    init_socket();
    init_logger();
    MQTT_PORT = Number(process.env.MQTT_PORT) || 1883;
    broker = null;
    tcpServer = null;
    connectedDevices = /* @__PURE__ */ new Map();
  }
});

// src/lib/socket.ts
function initSocket(server) {
  io = new import_socket2.Server(server, {
    cors: { origin: corsOrigins, credentials: true }
  });
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) throw new Error("missing token");
      const payload = import_jsonwebtoken.default.verify(token, env.JWT_ACCESS_SECRET);
      socket.data.userId = payload.sub;
      if (payload.sid) {
        socket.data.sessionId = payload.sid;
      }
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });
  io.on("connection", async (socket) => {
    const userId = socket.data.userId;
    const sessionId = socket.data.sessionId;
    socket.join(`user:${userId}`);
    if (sessionId) {
      socket.join(`session:${sessionId}`);
    }
    let joined = 0;
    let isAdmin = false;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      isAdmin = user?.role === "system_admin";
      const homes = isAdmin ? await prisma.home.findMany({ select: { id: true } }) : await prisma.homeMember.findMany({ where: { userId }, select: { homeId: true } });
      for (const h of homes) {
        socket.join(`home:${"homeId" in h ? h.homeId : h.id}`);
        joined++;
      }
    } catch {
    }
    socket.emit(REALTIME_EVENTS.socketReady, { homes: joined });
    console.log(`[socket] user ${userId} connected (${joined} homes)`);
    const pendingCall = activeCalls.get(userId);
    if (pendingCall && Date.now() - pendingCall.timestamp < 6e4) {
      socket.emit("webrtc:signal", {
        senderId: pendingCall.adminId,
        type: "call-request",
        payload: { callType: pendingCall.callType }
      });
    }
    socket.on("webrtc:signal", (data) => {
      const { targetId, type, payload } = data || {};
      if (targetId) {
        const roomName = `user:${targetId}`;
        const room = io?.sockets.adapter.rooms.get(roomName);
        if (type === "call-request") {
          activeCalls.set(targetId, { adminId: userId, callType: payload?.callType || "video", timestamp: Date.now() });
          setTimeout(() => activeCalls.delete(targetId), 6e4);
          if (!room || room.size === 0) {
            Promise.resolve().then(() => (init_push_service(), push_service_exports)).then(({ sendPushToUser: sendPushToUser2 }) => {
              sendPushToUser2(
                targetId,
                "Incoming Support Call",
                "Admin is calling you for support. Tap to answer.",
                { type: "webrtc-call", callType: payload?.callType || "video", adminId: userId },
                "support"
              ).catch(console.error);
            });
            socket.emit("webrtc:signal", {
              senderId: targetId,
              type: "call-offline-push-sent"
            });
          }
        } else if (type === "call-end" || type === "call-reject" || type === "call-accept") {
          activeCalls.delete(targetId);
          activeCalls.delete(userId);
          if (type === "call-accept" || type === "call-reject") {
            socket.to(`user:${userId}`).emit("webrtc:signal", {
              senderId: targetId,
              type: "call-end",
              payload: { reason: "handled-elsewhere" }
            });
          }
        }
        socket.to(roomName).emit("webrtc:signal", {
          senderId: userId,
          type,
          payload
        });
      }
    });
    socket.on("admin:subscribe-logs", (data) => {
      if (!isAdmin) return;
      const { espId } = data || {};
      if (espId) {
        socket.join(`board-logs-${espId}`);
        socket.emit("admin:board-log", `[Server] Subscribed to terminal logs for board #${espId}`);
      }
    });
    socket.on("admin:unsubscribe-logs", (data) => {
      const { espId } = data || {};
      if (espId) socket.leave(`board-logs-${espId}`);
    });
    socket.on("admin:send-cmd", async (data) => {
      if (!isAdmin) return;
      const { espId, cmd } = data || {};
      if (espId && cmd) {
        try {
          const esp = await prisma.espDevice.findUnique({ where: { id: espId }, select: { macAddress: true } });
          if (esp) {
            Promise.resolve().then(() => (init_mqtt_service(), mqtt_service_exports)).then(({ publishTermCommand: publishTermCommand2 }) => {
              publishTermCommand2(esp.macAddress, cmd);
            });
          }
        } catch (e) {
          console.error("[socket] Failed to send terminal command", e);
        }
      }
    });
  });
  return io;
}
function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}
function emitToSession(sessionId, event, payload) {
  io?.to(`session:${sessionId}`).emit(event, payload);
}
function emitToHome(homeId, event, payload) {
  io?.to(`home:${homeId}`).emit(event, payload);
}
async function emitDeviceUpdated(homeId, deviceId) {
  if (!io) return;
  try {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        name: true,
        status: true,
        offline: true,
        lastSeen: true,
        lastUpdated: true
      }
    });
    if (!device) return;
    const payload = {
      id: device.id,
      homeId,
      name: device.name,
      status: device.status,
      online: !device.offline,
      offline: device.offline,
      lastSeen: device.lastSeen ? device.lastSeen.toISOString() : null,
      updatedAt: device.lastUpdated.toISOString()
    };
    io.to(`home:${homeId}`).emit(REALTIME_EVENTS.deviceUpdated, payload);
  } catch (err) {
    console.error("[socket] emitDeviceUpdated failed", err);
  }
}
async function leaveHomeRoom(userId, homeId) {
  if (!io) return;
  try {
    const sockets = await io.in(`home:${homeId}`).fetchSockets();
    for (const s of sockets) {
      if (s.data.userId === userId) s.leave(`home:${homeId}`);
    }
  } catch {
  }
  emitToUser(userId, REALTIME_EVENTS.homeAccessRevoked, { homeId });
}
function emitToBoardLogs(espId, logMsg) {
  io?.to(`board-logs-${espId}`).emit("admin:board-log", logMsg);
}
var import_socket2, import_jsonwebtoken, io, activeCalls;
var init_socket = __esm({
  "src/lib/socket.ts"() {
    "use strict";
    import_socket2 = require("socket.io");
    import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
    init_src();
    init_env();
    init_prisma();
    io = null;
    activeCalls = /* @__PURE__ */ new Map();
  }
});

// src/services/audit.service.ts
var audit_service_exports = {};
__export(audit_service_exports, {
  audit: () => audit
});
async function audit(actorId, action, opts = {}) {
  try {
    const data = {
      actorId,
      homeId: opts.homeId ?? null,
      action,
      entity: opts.entity ?? null,
      entityId: opts.entityId ?? null
    };
    if (opts.meta) data.meta = opts.meta;
    await prisma.auditLog.create({ data });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}
var init_audit_service = __esm({
  "src/services/audit.service.ts"() {
    "use strict";
    init_prisma();
  }
});

// src/services/notificationQuery.ts
function normalizeCategory(category, title) {
  if (category === "system" && SCHEDULE_TITLE_RE.test(title ?? "")) return "schedule";
  return category;
}
function buildNotificationWhere(userId, args = {}) {
  const where = { userId };
  if (args.category && args.category !== "all") {
    if (args.category === "schedule") {
      where.OR = [{ category: "schedule" }, { category: "system", title: { contains: "Schedule fired" } }];
    } else if (args.category === "system") {
      where.OR = [{ category: "system", NOT: { title: { contains: "Schedule fired" } } }];
    } else {
      where.category = args.category;
    }
  }
  if (args.type && args.type !== "all") where.type = args.type;
  if (args.unread) where.readAt = null;
  return where;
}
var SCHEDULE_TITLE_RE;
var init_notificationQuery = __esm({
  "src/services/notificationQuery.ts"() {
    "use strict";
    SCHEDULE_TITLE_RE = /Schedule fired/i;
  }
});

// src/services/notification.service.ts
var notification_service_exports = {};
__export(notification_service_exports, {
  attachDraftToBody: () => attachDraftToBody,
  createNotification: () => createNotification,
  createNotificationWithEmail: () => createNotificationWithEmail,
  listNotifications: () => listNotifications,
  markAllRead: () => markAllRead,
  markRead: () => markRead,
  remove: () => remove2,
  removeAll: () => removeAll,
  unreadCount: () => unreadCount
});
function attachDraftToBody(body, title) {
  const draft = buildNotificationDraft({ category: "", title, body });
  if (!draft) return body;
  let parsed2 = {};
  if (body) {
    try {
      const o = JSON.parse(body);
      if (o && typeof o === "object") parsed2 = o;
    } catch {
    }
  }
  const t = typeof parsed2.t === "string" ? parsed2.t : body ?? "";
  return JSON.stringify({
    t,
    ...typeof parsed2.u === "number" ? { u: parsed2.u } : {},
    d: draft
  });
}
async function createNotification(userId, input) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      category: input.category ?? "system",
      type: input.type ?? "info",
      title: input.title,
      body: attachDraftToBody(input.body ?? null, input.title)
    }
  });
  emitToUser(userId, "notification:new", notification);
  Promise.resolve().then(() => (init_push_service(), push_service_exports)).then(({ sendPushToUser: sendPushToUser2 }) => {
    let plaintext = input.body || "";
    try {
      const p = JSON.parse(plaintext);
      if (p.t) plaintext = p.t;
    } catch {
    }
    let pushCat = "system";
    const c = input.category ?? "system";
    if (c === "auth" || c === "security") pushCat = "security";
    else if (c === "shop" || c === "order") pushCat = "order";
    else if (c === "hardware" || c === "offline") pushCat = "power";
    else if (c === "support") pushCat = "support";
    else if (c === "promo") pushCat = "promo";
    else if (c === "device") pushCat = "device";
    sendPushToUser2(userId, input.title, plaintext, void 0, pushCat);
  }).catch(console.error);
  return notification;
}
async function createNotificationWithEmail(userId, input, opts = {}) {
  const notification = await createNotification(userId, input);
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true }
    });
    if (user?.email) {
      await sendNotificationEmail({
        to: user.email,
        userName: user.username,
        title: opts.emailSubject ?? input.title,
        body: opts.emailBody ?? input.body ?? input.title,
        ctaUrl: opts.ctaUrl,
        ctaLabel: opts.ctaLabel
      });
    }
  } catch (err) {
    console.error(`[notify+email] email failed for user ${userId}:`, err instanceof Error ? err.message : err);
  }
  return notification;
}
async function listNotifications(userId, args = {}) {
  const page = Math.max(1, Math.floor(args.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(args.pageSize ?? 20)));
  const where = buildNotificationWhere(userId, args);
  const [raw, total2] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.notification.count({ where })
  ]);
  const items = raw.map((n) => ({ ...n, category: normalizeCategory(n.category, n.title) }));
  return { items, total: total2, page, pageSize, totalPages: Math.max(1, Math.ceil(total2 / pageSize)) };
}
async function remove2(userId, notificationId) {
  await prisma.notification.deleteMany({ where: { id: notificationId, userId } });
  emitToUser(userId, "notification:deleted", { id: notificationId });
  return { ok: true };
}
async function removeAll(userId) {
  await prisma.notification.deleteMany({ where: { userId } });
  emitToUser(userId, "notification:updated", { all: true });
  return { ok: true };
}
async function unreadCount(userId) {
  try {
    const count = await prisma.notification.count({ where: { userId, readAt: null } });
    return { unread: count };
  } catch (_err) {
    return { unread: 0 };
  }
}
async function markRead(userId, notificationId) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: /* @__PURE__ */ new Date() }
  });
  emitToUser(userId, "notification:updated", { id: notificationId });
  return { ok: true };
}
async function markAllRead(userId) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: /* @__PURE__ */ new Date() }
  });
  emitToUser(userId, "notification:updated", { all: true });
  return { ok: true };
}
var init_notification_service = __esm({
  "src/services/notification.service.ts"() {
    "use strict";
    init_prisma();
    init_socket();
    init_email_service();
    init_src();
    init_notificationQuery();
  }
});

// src/services/firmware.service.ts
var firmware_service_exports = {};
__export(firmware_service_exports, {
  MODEL_CODES: () => MODEL_CODES,
  resolveFirmware: () => resolveFirmware
});
async function resolveFirmware(modelCode) {
  const model = (modelCode ?? "").trim().toUpperCase();
  return prisma.firmwareVersion.findFirst({
    where: {
      isCurrent: true,
      OR: model ? [{ modelCode: model }, { modelCode: "" }] : [{ modelCode: "" }]
    },
    orderBy: { modelCode: "desc" }
    // "" sabse chhota -> model-specific wins
  });
}
var MODEL_CODES;
var init_firmware_service = __esm({
  "src/services/firmware.service.ts"() {
    "use strict";
    init_prisma();
    MODEL_CODES = ["2CH", "4CH", "5CH", "6CH", "8CH", "4CH-IR", "FAN-DIM", "DIM-3S", "DIM-4S"];
  }
});

// src/index.ts
var import_http = require("http");

// src/app.ts
var import_express24 = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_helmet = __toESM(require("helmet"), 1);
var import_node_path6 = __toESM(require("node:path"), 1);
var import_node_fs6 = __toESM(require("node:fs"), 1);
init_env();

// src/middleware/errorHandler.ts
var import_zod2 = require("zod");

// src/lib/response.ts
function ok(res, data, status = 200) {
  const body = { success: true, data };
  res.status(status).json(body);
}
function fail(res, code, message, status = 400, details) {
  const body = { success: false, error: { code, message, details } };
  res.status(status).json(body);
}
var AppError = class extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
  code;
  status;
  details;
};

// src/middleware/errorHandler.ts
init_logger();
var errorHandler = (err, _req, res, _next) => {
  if (err instanceof import_zod2.ZodError) {
    return fail(res, "VALIDATION_ERROR", "Invalid input", 400, err.flatten());
  }
  if (err instanceof AppError) {
    return fail(res, err.code, err.message, err.status, err.details);
  }
  logger.error("Unhandled error", err instanceof Error ? err.stack : err);
  return fail(res, "INTERNAL_ERROR", "Internal server error", 500);
};

// src/lib/paths.ts
var fs3 = __toESM(require("fs"), 1);
var path3 = __toESM(require("path"), 1);
function findRepoRoot(start) {
  let dir = path3.resolve(start);
  for (let i = 0; i < 8; i++) {
    if (fs3.existsSync(path3.join(dir, "hardware"))) return dir;
    const parent = path3.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
var repoRoot = findRepoRoot(process.cwd());
var firmwareDir = repoRoot ? path3.join(repoRoot, "hardware", "firmware") : path3.resolve(process.cwd(), "../../../hardware/firmware");
var mobileAppDir = repoRoot ? path3.join(repoRoot, "mobile-app") : path3.resolve(process.cwd(), "../../../mobile-app");
var attachmentDir = repoRoot ? path3.join(repoRoot, "hardware", "attachments") : path3.resolve(process.cwd(), "../../../hardware/attachments");
var webDist = repoRoot ? path3.join(repoRoot, "site", "apps", "web", "dist") : path3.resolve(process.cwd(), "../../apps/web/dist");
var swaggerUiDir = repoRoot ? path3.join(repoRoot, "site", "apps", "api", "public", "swagger-ui") : path3.resolve(process.cwd(), "public/swagger-ui");
var uploadsDir = repoRoot ? path3.join(repoRoot, "site", "apps", "api", "uploads") : path3.resolve(process.cwd(), "uploads");

// src/routes/index.ts
var import_express21 = require("express");

// src/routes/auth.routes.ts
var import_express = require("express");
var import_zod3 = require("zod");

// src/controllers/auth.controller.ts
init_prisma();

// src/services/auth.service.ts
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_node_crypto3 = __toESM(require("node:crypto"), 1);
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"), 1);
init_env();
init_prisma();
init_logger();

// src/lib/envPersist.ts
var fs5 = __toESM(require("fs"), 1);
var path5 = __toESM(require("path"), 1);
init_logger();
function escapeEnv(v) {
  return /[\s#"']/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v;
}
function persistEnvKeys(entries) {
  const targets = [
    path5.resolve(process.cwd(), ".env"),
    path5.resolve(process.cwd(), "../.env"),
    path5.resolve(process.cwd(), "../../.env")
  ];
  let mainPath = targets[0];
  let written = false;
  for (const envPath of targets) {
    try {
      let content = "";
      if (fs5.existsSync(envPath)) content = fs5.readFileSync(envPath, "utf-8");
      for (const [key, value] of entries) {
        process.env[key] = value;
        const line = `${key}=${escapeEnv(value)}`;
        const re = new RegExp(`^${key}=.*$`, "m");
        if (re.test(content)) content = content.replace(re, line);
        else content = (content ? content.replace(/\s*$/, "\n") : "") + line + "\n";
      }
      fs5.writeFileSync(envPath, content, "utf-8");
      mainPath = envPath;
      written = true;
    } catch (err) {
      logger.warn(`[envPersist] .env write fail for ${envPath}:`, err instanceof Error ? err.message : String(err));
    }
  }
  return { path: mainPath, ok: written };
}
function persistEnvKey(key, value) {
  return persistEnvKeys([[key, value]]);
}

// src/services/auth.service.ts
init_siteSettings_service();
init_email_service();
init_socket();
function toAuthUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    themePref: user.themePref,
    avatarUrl: user.avatarUrl ?? null,
    dob: user.dob ? user.dob.toISOString().split("T")[0] : null,
    gender: user.gender ?? null,
    phone: user.phone ?? null,
    address: user.address ?? null
  };
}
function hashToken(token) {
  return import_node_crypto3.default.createHash("sha256").update(token).digest("hex");
}
function signAccessToken(user, sessionId) {
  return import_jsonwebtoken2.default.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      ver: user.tokenVersion,
      jti: import_node_crypto3.default.randomUUID(),
      sid: sessionId
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES }
  );
}
function signRefreshToken(user) {
  return import_jsonwebtoken2.default.sign({ sub: user.id, ver: user.tokenVersion, jti: import_node_crypto3.default.randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES
  });
}
async function signup(input, deviceInfo, ipAddress) {
  const existingUsername = await prisma.user.findFirst({ where: { username: input.username }, select: { id: true } });
  if (existingUsername) {
    throw new AppError("USERNAME_TAKEN", `Username '${input.username}' is already taken. Please choose another username.`, 409);
  }
  const existingEmail = await prisma.user.findFirst({ where: { email: input.email }, select: { id: true } });
  if (existingEmail) {
    throw new AppError("EMAIL_TAKEN", `Email '${input.email}' is already registered. Please log in or use another email.`, 409);
  }
  const password = await import_bcryptjs.default.hash(input.password, 10);
  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: input.username,
          email: input.email,
          password,
          role: "user",
          status: "active",
          pushDeviceToggles: true,
          pushSystemAlerts: true,
          tokenVersion: 0
        }
      });
      await tx.home.create({
        data: {
          name: input.homeName?.trim() || `${input.username}'s Home`,
          ownerId: created.id,
          members: {
            create: { userId: created.id, role: "owner", joinedAt: /* @__PURE__ */ new Date() }
          }
        }
      });
      return created;
    });
  } catch (err) {
    logger.error("[signup] Error during user creation transaction", err instanceof Error ? err.stack : err);
    throw err;
  }
  return issueTokens(user, deviceInfo, ipAddress);
}
async function updateProfile(userId, input) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("USER_NOT_FOUND", "User not found", 404);
  const data = {};
  if (input.username && input.username !== user.username) {
    const taken = await prisma.user.findUnique({ where: { username: input.username } });
    if (taken) throw new AppError("USERNAME_TAKEN", "Username already taken", 409);
    data.username = input.username;
  }
  if (input.email && input.email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email: input.email } });
    if (taken) throw new AppError("EMAIL_TAKEN", "Email already taken", 409);
    data.email = input.email;
  }
  if (input.newPassword) {
    if (!input.currentPassword) {
      throw new AppError("CURRENT_PASSWORD_REQUIRED", "Current password required to set a new one", 400);
    }
    if (!await import_bcryptjs.default.compare(input.currentPassword, user.password)) {
      throw new AppError("WRONG_PASSWORD", "Current password is incorrect", 401);
    }
    data.password = await import_bcryptjs.default.hash(input.newPassword, 10);
    data.tokenVersion = { increment: 1 };
  }
  if (input.avatarUrl !== void 0) data.avatarUrl = input.avatarUrl;
  if (input.dob !== void 0) data.dob = input.dob ? new Date(input.dob) : null;
  if (input.gender !== void 0) data.gender = input.gender;
  if (input.phone !== void 0) data.phone = input.phone;
  if (input.address !== void 0) data.address = input.address;
  let updated = user;
  if (Object.keys(data).length > 0) {
    updated = await prisma.user.update({ where: { id: userId }, data });
  }
  if (input.pushDeviceToggles !== void 0 || input.pushSystemAlerts !== void 0) {
    const dt = input.pushDeviceToggles !== void 0 ? input.pushDeviceToggles ? 1 : 0 : null;
    const sa = input.pushSystemAlerts !== void 0 ? input.pushSystemAlerts ? 1 : 0 : null;
    try {
      if (dt !== null && sa !== null) {
        await prisma.$executeRawUnsafe(`UPDATE \`User\` SET push_device_toggles = ${dt}, push_system_alerts = ${sa} WHERE id = ${userId}`);
      } else if (dt !== null) {
        await prisma.$executeRawUnsafe(`UPDATE \`User\` SET push_device_toggles = ${dt} WHERE id = ${userId}`);
      } else if (sa !== null) {
        await prisma.$executeRawUnsafe(`UPDATE \`User\` SET push_system_alerts = ${sa} WHERE id = ${userId}`);
      }
    } catch (e) {
      console.error("Failed to hot-patch push preferences:", e);
    }
  }
  if (input.newPassword) {
    await prisma.refreshToken.deleteMany({ where: { userId } });
    if (user.role === "system_admin") {
      const res = persistEnvKey("ADMIN_PASSWORD", input.newPassword);
      logger.info(
        res.ok ? "Admin password changed \u2014 .env ADMIN_PASSWORD synced" : "Admin password changed \u2014 .env sync FAILED",
        res.ok ? { path: res.path } : void 0
      );
    }
  }
  return toAuthUser(updated);
}
async function updateThemePref(userId, theme) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { themePref: theme }
  });
  return toAuthUser(updated);
}
async function checkAvailability(username, email) {
  const result = { usernameAvailable: true, emailAvailable: true };
  if (username) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) result.usernameAvailable = false;
  }
  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) result.emailAvailable = false;
  }
  return result;
}
async function login(usernameEmail, password, deviceInfo, ipAddress, revokeOtherSessions3) {
  let user = null;
  try {
    user = await prisma.user.findFirst({
      where: { OR: [{ username: usernameEmail }, { email: usernameEmail }] }
    });
  } catch (_pErr) {
    try {
      const mysql2 = (await import("mysql2/promise")).default;
      const dbUrl = getEffectiveDbUrl();
      const u = new URL(dbUrl);
      const conn = await mysql2.createConnection({
        host: u.hostname === "localhost" ? "127.0.0.1" : u.hostname,
        port: Number(u.port || 3306),
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: decodeURIComponent(u.pathname.replace(/^\//, "")),
        connectTimeout: 5e3
      });
      const [rows] = await conn.query(
        "SELECT id, username, email, password, role, status, token_version AS tokenVersion, created_at AS createdAt FROM users WHERE username = ? OR email = ? LIMIT 1",
        [usernameEmail, usernameEmail]
      );
      await conn.end().catch(() => void 0);
      if (Array.isArray(rows) && rows.length > 0) {
        user = rows[0];
      }
    } catch (_mErr) {
      logger.error("[login] Direct mysql user lookup error", _mErr);
    }
  }
  if (!user || !await import_bcryptjs.default.compare(password, user.password)) {
    throw new AppError("INVALID_CREDENTIALS", "Invalid username/email or password", 401);
  }
  if (user.status !== "active") {
    throw new AppError("ACCOUNT_SUSPENDED", "Account is suspended", 403);
  }
  let enrichDevice = deviceInfo || "Unknown Device";
  if (ipAddress && ipAddress !== "::1" && ipAddress !== "127.0.0.1" && !ipAddress.startsWith("192.168.") && !ipAddress.startsWith("10.")) {
    try {
      const resp = await fetch(`http://ip-api.com/json/${ipAddress}?fields=city,region`);
      const loc = await resp.json();
      if (loc && loc.city) {
        enrichDevice = `${enrichDevice} \u2022 ${loc.city}, ${loc.region}`;
      }
    } catch {
    }
  } else if (ipAddress?.startsWith("192.168.") || ipAddress?.startsWith("10.") || ipAddress === "::1" || ipAddress === "127.0.0.1") {
    enrichDevice = `${enrichDevice} \u2022 Local Network`;
  }
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: /* @__PURE__ */ new Date() }
    });
  } catch {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: /* @__PURE__ */ new Date() }
      });
    } catch {
    }
  }
  return issueTokens(user, enrichDevice, ipAddress, revokeOtherSessions3);
}
async function issueTokens(user, deviceInfo, ipAddress, revokeOtherSessions3) {
  if (revokeOtherSessions3) {
    try {
      await prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: /* @__PURE__ */ new Date() }
      });
    } catch (_err) {
    }
    try {
      emitToUser(user.id, "auth:force_logout", { message: "Sessions revoked from new login request." });
    } catch (_err) {
    }
  }
  const refreshToken = signRefreshToken(user);
  const tokenHash = hashToken(refreshToken);
  const exp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3);
  let sessionId = 1;
  try {
    const session = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: exp
      }
    });
    sessionId = session.id;
  } catch (_rErr) {
    try {
      await prisma.$executeRawUnsafe(
        "INSERT INTO refresh_tokens (userId, token_hash, expires_at, created_at) VALUES (?, ?, ?, NOW(3))",
        user.id,
        tokenHash,
        exp
      );
    } catch (_mErr) {
      logger.error("[login] refreshToken fallback error", _mErr);
    }
  }
  try {
    emitToUser(user.id, "auth:sessions_changed", {});
    emitToSession(sessionId, "auth:session_created", { sessionId });
  } catch (_e) {
  }
  const accessToken = signAccessToken(user, sessionId);
  return {
    user: toAuthUser(user),
    accessToken,
    refreshToken,
    tokens: {
      accessToken,
      refreshToken
    }
  };
}
async function refresh(refreshToken, deviceInfo, ipAddress) {
  let payload;
  try {
    payload = import_jsonwebtoken2.default.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError("INVALID_REFRESH_TOKEN", "Invalid or expired refresh token", 401);
  }
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) }
  });
  if (!stored || stored.revokedAt) {
    throw new AppError("INVALID_REFRESH_TOKEN", "Refresh token has been revoked", 401);
  }
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: /* @__PURE__ */ new Date() } });
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AppError("USER_NOT_FOUND", "User no longer exists", 401);
  const tokenVer = payload.ver;
  if (tokenVer !== user.tokenVersion) {
    await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken) }, data: { revokedAt: /* @__PURE__ */ new Date() } }).catch(() => void 0);
    throw new AppError("INVALID_REFRESH_TOKEN", "Session invalidated \u2014 dobara login karo", 401);
  }
  return issueTokens(user, deviceInfo, ipAddress);
}
async function logout(refreshToken, pushToken) {
  let userId;
  if (refreshToken) {
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) }
    });
    if (stored) {
      userId = stored.userId;
      await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: /* @__PURE__ */ new Date() } });
    }
  }
  if (userId) {
    await prisma.pushSubscription.deleteMany({
      where: { userId }
    }).catch(() => {
    });
  } else if (pushToken) {
    await prisma.pushSubscription.deleteMany({
      where: { token: pushToken }
    }).catch(() => {
    });
  }
}
var RESET_TOKEN_TTL_MS = 30 * 60 * 1e3;
async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { sent: true };
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: /* @__PURE__ */ new Date() }
  });
  const rawToken = import_node_crypto3.default.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS)
    }
  });
  const s = await getSiteSettings().catch(() => null);
  const siteName = s?.siteName || "SwitchNest";
  const siteUrl = (s?.siteUrl || "").replace(/\/$/, "");
  const resetUrl = siteUrl ? `${siteUrl}/reset-password?token=${encodeURIComponent(rawToken)}` : "";
  const emailResult = await sendPasswordResetEmail({
    to: user.email,
    userName: user.username,
    resetUrl,
    siteName
  }).catch(() => ({ ok: false, error: "email service error" }));
  if (!emailResult.ok) {
    const hint = resetUrl || `${rawToken} (siteUrl set nahi hai)`;
    logger.info(`[auth] password reset link for ${user.email}: ${hint}`);
  }
  return { sent: true };
}
async function resetPassword(token, newPassword) {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < /* @__PURE__ */ new Date()) {
    throw new AppError("INVALID_RESET_TOKEN", "Reset link invalid ya expired hai \u2014 naya link maango", 400);
  }
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) throw new AppError("USER_NOT_FOUND", "User not found", 404);
  const password = await import_bcryptjs.default.hash(newPassword, 10);
  await prisma.$transaction([
    // Password change → tokenVersion bump: purane access tokens turant invalid.
    prisma.user.update({
      where: { id: user.id },
      data: { password, tokenVersion: { increment: 1 } }
    }),
    // Saare refresh tokens revoke — har device se logout.
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    // Is token ko 1-use mark + baaki pending tokens bhi invalidate.
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: /* @__PURE__ */ new Date() } }),
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: /* @__PURE__ */ new Date() }
    })
  ]);
  if (user.role === "system_admin") {
    const res = persistEnvKey("ADMIN_PASSWORD", newPassword);
    logger.info(
      res.ok ? "Admin password reset \u2014 .env ADMIN_PASSWORD synced" : "Admin password reset \u2014 .env sync FAILED",
      res.ok ? { path: res.path } : void 0
    );
  }
}
async function listSessions(userId) {
  return prisma.refreshToken.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, deviceInfo: true, ipAddress: true, lastActive: true, createdAt: true },
    orderBy: { lastActive: "desc" }
  });
}
async function revokeAllSessions(userId) {
  const t = await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: /* @__PURE__ */ new Date() }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } }
    })
  ]);
  emitToUser(userId, "auth:force_logout", { message: "Your sessions have been globally revoked." });
  emitToUser(userId, "auth:sessions_changed", {});
}
async function revokeOtherSessions(userId, currentSessionId) {
  const otherSessions = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, id: { not: currentSessionId } }
  });
  if (otherSessions.length === 0) return { count: 0 };
  const result = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null, id: { not: currentSessionId } },
    data: { revokedAt: /* @__PURE__ */ new Date() }
  });
  for (const session of otherSessions) {
    emitToSession(session.id, "auth:force_logout", { message: "Session revoked from main device." });
  }
  emitToUser(userId, "auth:sessions_changed", {});
  return { count: result.count };
}
async function revokeSession(userId, sessionId) {
  await prisma.refreshToken.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: /* @__PURE__ */ new Date() }
  });
  emitToSession(sessionId, "auth:force_logout", { message: "Your session was manually revoked." });
  emitToUser(userId, "auth:sessions_changed", {});
}
async function revokeUnauthSession(usernameEmail, password, sessionId) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: usernameEmail }, { email: usernameEmail }] }
  });
  if (!user || !await import_bcryptjs.default.compare(password, user.password)) {
    throw new AppError("INVALID_CREDENTIALS", "Invalid credentials", 401);
  }
  await prisma.refreshToken.updateMany({
    where: { id: sessionId, userId: user.id },
    data: { revokedAt: /* @__PURE__ */ new Date() }
  });
  emitToSession(sessionId, "auth:force_logout", { message: "Your session was terminated from another device." });
  emitToUser(user.id, "auth:sessions_changed", {});
  return prisma.refreshToken.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" }
  });
}

// src/controllers/auth.controller.ts
async function signup2(req, res) {
  const { username, email, password, homeName } = req.body;
  const deviceInfo = req.headers["user-agent"]?.substring(0, 255);
  const ipAddress = (req.ip || req.socket.remoteAddress)?.substring(0, 45);
  const result = await signup({ username, email, password, homeName }, deviceInfo, ipAddress);
  ok(res, result, 201);
}
async function login2(req, res) {
  const { usernameEmail, password, revokeOtherSessions: revokeOtherSessions3 } = req.body;
  const deviceInfo = req.headers["user-agent"]?.substring(0, 255);
  const ipAddress = (req.ip || req.socket.remoteAddress)?.substring(0, 45);
  const result = await login(usernameEmail, password, deviceInfo, ipAddress, revokeOtherSessions3);
  ok(res, result);
}
async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, username: true, email: true, role: true, themePref: true, createdAt: true, pushDeviceToggles: true, pushSystemAlerts: true, avatarUrl: true, dob: true, gender: true, phone: true, address: true }
    });
    ok(res, user);
  } catch (err) {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, username: true, email: true, role: true, themePref: true, createdAt: true, avatarUrl: true, dob: true, gender: true, phone: true, address: true }
    });
    ok(res, { ...user, pushDeviceToggles: true, pushSystemAlerts: true });
  }
}
async function refresh2(req, res) {
  const { refreshToken } = req.body;
  const deviceInfo = req.headers["user-agent"]?.substring(0, 255);
  const ipAddress = (req.ip || req.socket.remoteAddress)?.substring(0, 45);
  const result = await refresh(refreshToken, deviceInfo, ipAddress);
  ok(res, result);
}
async function logout2(req, res) {
  const { refreshToken, pushToken } = req.body;
  if (refreshToken || pushToken) {
    await logout(refreshToken, pushToken);
  }
  ok(res, { message: "Logged out" });
}
async function updateProfile2(req, res) {
  const user = await updateProfile(req.user.sub, req.body);
  ok(res, user);
}
async function uploadAvatar(req, res) {
  if (!req.file) {
    res.status(400).json({ success: false, error: { code: "NO_FILE", message: "No avatar image provided." } });
    return;
  }
  const avatarUrl = `/uploads/avatars/${req.file.filename}?v=${Date.now()}`;
  const user = await updateProfile(req.user.sub, { avatarUrl });
  ok(res, user);
}
async function updateTheme(req, res) {
  const user = await updateThemePref(req.user.sub, req.body.theme);
  ok(res, user);
}
async function forgotPassword(req, res) {
  const { email } = req.body;
  const result = await requestPasswordReset(email);
  ok(res, result);
}
async function resetPassword2(req, res) {
  const { token, newPassword } = req.body;
  await resetPassword(token, newPassword);
  ok(res, { message: "Password reset ho gaya \u2014 naye password se login karo" });
}
async function listSessions2(req, res) {
  const sessions = await listSessions(req.user.sub);
  ok(res, sessions);
}
async function revokeAllSessions2(req, res) {
  await revokeAllSessions(req.user.sub);
  ok(res, { message: "All sessions revoked." });
}
async function revokeSession2(req, res) {
  await revokeSession(req.user.sub, Number(req.params.id));
  ok(res, { message: "Session revoked." });
}
async function revokeUnauth(req, res) {
  const { usernameEmail, password, sessionId } = req.body;
  const sessions = await revokeUnauthSession(usernameEmail, password, sessionId);
  ok(res, sessions);
}
async function revokeOtherSessions2(req, res) {
  console.log("[DEBUG-REVOKE] Entry hit. Body:", req.body, "Query:", req.query);
  const authReq = req;
  let currentSessionId = authReq.user.sid || Number(req.query.currentSessionId);
  console.log(`[DEBUG-REVOKE] Initial currentSessionId resolved to: ${currentSessionId} (from sid:${authReq.user.sid} or query:${req.query.currentSessionId})`);
  if (!currentSessionId || isNaN(currentSessionId)) {
    console.log("[DEBUG-REVOKE] Proceeding to fallback logic because ID is missing or NaN.");
    const iatSeconds = authReq.user.iat;
    if (iatSeconds) {
      console.log(`[DEBUG-REVOKE] Found iatSeconds in payload: ${iatSeconds}. Querying DB...`);
      const allSessions = await prisma.refreshToken.findMany({
        where: { userId: authReq.user.sub, revokedAt: null }
      });
      console.log(`[DEBUG-REVOKE] Retrieved ${allSessions.length} active sessions from DB.`);
      const matchedSession = allSessions.find((s) => Math.abs(Math.floor(s.createdAt.getTime() / 1e3) - iatSeconds) <= 2);
      if (matchedSession) {
        currentSessionId = matchedSession.id;
        console.log(`[DEBUG-REVOKE] Match found! Overwriting currentSessionId to: ${currentSessionId}`);
      } else {
        console.log(`[DEBUG-REVOKE] No match found in DB for iat: ${iatSeconds}. Existing epochs: ${allSessions.map((s) => Math.floor(s.createdAt.getTime() / 1e3)).join(", ")}`);
      }
    }
    if (!currentSessionId) {
      console.log("[DEBUG-REVOKE] Aborting and returning 400. Still no currentSessionId.");
      return res.status(400).json({ success: false, error: { message: "Please log out and log back in to use this feature." } });
    }
  }
  console.log(`[DEBUG-REVOKE] Executing DB sweep. Calling authService.revokeOtherSessions for User: ${authReq.user.sub}, Keeping ID: ${currentSessionId}`);
  const rev = await revokeOtherSessions(authReq.user.sub, currentSessionId);
  console.log(`[DEBUG-REVOKE] Service executed. Rows deleted: ${rev.count}. Returning 200 OK.`);
  ok(res, { message: `Successfully revoked ${rev.count} other session(s).`, currentSessionId });
}
async function checkAvailability2(req, res) {
  const { username, email } = req.query;
  const result = await checkAvailability(username, email);
  ok(res, result);
}

// src/middleware/auth.ts
var import_jsonwebtoken3 = __toESM(require("jsonwebtoken"), 1);
init_env();
init_prisma();
var requireAuth = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("UNAUTHORIZED", "Missing bearer token", 401));
  }
  try {
    const payload = import_jsonwebtoken3.default.verify(header.slice(7), env.JWT_ACCESS_SECRET);
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { tokenVersion: true, status: true }
      });
      if (user) {
        if (payload.ver !== void 0 && payload.ver !== user.tokenVersion) {
          return next(new AppError("UNAUTHORIZED", "Session invalidated \u2014 dobara login karo", 401));
        }
        if (user.status !== "active") {
          return next(new AppError("ACCOUNT_SUSPENDED", "Account is suspended", 403));
        }
      }
    } catch (_dbErr) {
    }
    req.user = payload;
    next();
  } catch {
    next(new AppError("UNAUTHORIZED", "Invalid or expired token", 401));
  }
};
var optionalAuth = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = import_jsonwebtoken3.default.verify(header.slice(7), env.JWT_ACCESS_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { tokenVersion: true, status: true }
      });
      if (user && payload.ver === user.tokenVersion && user.status === "active") {
        req.user = payload;
      }
    } catch {
    }
  }
  next();
};

// src/middleware/rateLimit.ts
var store = /* @__PURE__ */ new Map();
var sweepTimer = null;
function sweepExpired() {
  const now = Date.now();
  for (const [key, b] of store) {
    if (b.resetAt <= now) store.delete(key);
  }
}
function ensureSweep() {
  if (sweepTimer) return;
  sweepTimer = setInterval(sweepExpired, 6e4);
  sweepTimer.unref?.();
}
function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim().length > 0) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}
function rateLimit(opts) {
  ensureSweep();
  return (req, res, next) => {
    if (opts.skip?.(req)) return next();
    const key = `${opts.name}:${opts.keyGenerator ? opts.keyGenerator(req) : clientIp(req)}`;
    const now = Date.now();
    let bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      store.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader("X-RateLimit-Limit", String(opts.max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, opts.max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1e3)));
    if (bucket.count > opts.max) {
      sendTooMany(res, opts.message, bucket.resetAt - now);
      return;
    }
    next();
  };
}
function sendTooMany(res, message, retryAfterMs) {
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1e3));
  res.setHeader("Retry-After", String(retryAfterSec));
  res.status(429).json({
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: message ?? "Bahut zyada requests \u2014 thodi der baad try karo",
      details: { retryAfterSec }
    }
  });
}

// src/middleware/validate.ts
function validateBody(schema) {
  return (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}
function validateQuery(schema) {
  return (req, _res, next) => {
    schema.parse(req.query);
    next();
  };
}
function validateParams(schema) {
  return (req, _res, next) => {
    schema.parse(req.params);
    next();
  };
}

// src/routes/auth.routes.ts
var import_multer = __toESM(require("multer"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);
var import_node_fs3 = __toESM(require("node:fs"), 1);
init_prisma();
var avatarsDir = import_node_path3.default.join(uploadsDir, "avatars");
try {
  import_node_fs3.default.mkdirSync(avatarsDir, { recursive: true });
} catch (e) {
}
var storage = import_multer.default.diskStorage({
  destination: function(_req, _file, cb) {
    cb(null, avatarsDir);
  },
  filename: function(req, file, cb) {
    const ext = import_node_path3.default.extname(file.originalname).toLowerCase() || ".jpg";
    prisma.user.findUnique({ where: { id: req.user.sub }, select: { username: true } }).then((u) => {
      if (!u) return cb(new Error("User not found"), "");
      const username = u.username;
      const canonicalName = `${username}${ext}`;
      try {
        const existing = import_node_fs3.default.readdirSync(avatarsDir).filter(
          (f) => f.startsWith(`${username}.`) && !import_node_fs3.default.statSync(import_node_path3.default.join(avatarsDir, f)).isDirectory()
        );
        if (existing.length > 0) {
          const archiveDir = import_node_path3.default.join(avatarsDir, username);
          import_node_fs3.default.mkdirSync(archiveDir, { recursive: true });
          const archived = import_node_fs3.default.readdirSync(archiveDir);
          let maxNum = 0;
          for (const a of archived) {
            const match = a.match(new RegExp(`^${username}_(\\d+)`));
            if (match) maxNum = Math.max(maxNum, Number(match[1]));
          }
          for (const oldFile of existing) {
            maxNum++;
            const oldExt = import_node_path3.default.extname(oldFile);
            import_node_fs3.default.renameSync(
              import_node_path3.default.join(avatarsDir, oldFile),
              import_node_path3.default.join(archiveDir, `${username}_${maxNum}${oldExt}`)
            );
          }
        }
      } catch {
      }
      cb(null, canonicalName);
    }).catch((err) => cb(err, ""));
  }
});
var upload = (0, import_multer.default)({ storage });
var authRouter = (0, import_express.Router)();
var loginLimiter = rateLimit({
  name: "auth:login",
  windowMs: 15 * 6e4,
  max: 1e3,
  message: "Bahut zyada login attempts \u2014 15 min baad dobara try karo"
});
var signupLimiter = rateLimit({
  name: "auth:signup",
  windowMs: 15 * 6e4,
  max: 5,
  message: "Bahut zyada signup attempts \u2014 thodi der baad try karo"
});
var refreshLimiter = rateLimit({
  name: "auth:refresh",
  windowMs: 15 * 6e4,
  max: 30,
  message: "Bahut zyada refresh attempts \u2014 thodi der baad try karo"
});
var forgotLimiter = rateLimit({
  name: "auth:forgot",
  windowMs: 60 * 6e4,
  max: 5,
  message: "Bahut zyada reset requests \u2014 1 ghanta baad try karo"
});
var resetLimiter = rateLimit({
  name: "auth:reset",
  windowMs: 15 * 6e4,
  max: 10,
  message: "Bahut zyada reset attempts \u2014 15 min baad try karo"
});
var signupSchema = import_zod3.z.object({
  username: import_zod3.z.string().min(3).max(50),
  email: import_zod3.z.string().email().max(100),
  password: import_zod3.z.string().min(6).max(255),
  homeName: import_zod3.z.string().max(100).optional()
});
var loginSchema = import_zod3.z.object({
  usernameEmail: import_zod3.z.string().min(1).max(100),
  password: import_zod3.z.string().min(1).max(255),
  revokeOtherSessions: import_zod3.z.boolean().optional()
});
var revokeUnauthSchema = import_zod3.z.object({
  usernameEmail: import_zod3.z.string().min(1).max(100),
  password: import_zod3.z.string().min(1).max(255),
  sessionId: import_zod3.z.number()
});
var refreshSchema = import_zod3.z.object({
  refreshToken: import_zod3.z.string().min(1)
});
var logoutSchema = import_zod3.z.object({
  refreshToken: import_zod3.z.string().min(1).optional().nullable(),
  pushToken: import_zod3.z.string().min(1).optional().nullable()
});
var pushTokenSchema = import_zod3.z.object({
  token: import_zod3.z.string().min(1),
  deviceModel: import_zod3.z.string().optional(),
  pushDeviceToggles: import_zod3.z.boolean().optional(),
  pushSystemAlerts: import_zod3.z.boolean().optional()
});
var themeSchema = import_zod3.z.object({
  theme: import_zod3.z.enum(["light", "dark", "system"])
});
var profileSchema = import_zod3.z.object({
  username: import_zod3.z.string().min(3).max(50).optional(),
  email: import_zod3.z.string().email().max(100).optional(),
  currentPassword: import_zod3.z.string().min(1).max(255).optional(),
  newPassword: import_zod3.z.string().min(6).max(255).optional(),
  pushDeviceToggles: import_zod3.z.boolean().optional(),
  pushSystemAlerts: import_zod3.z.boolean().optional(),
  avatarUrl: import_zod3.z.string().max(500).optional().nullable(),
  dob: import_zod3.z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }).optional().nullable(),
  gender: import_zod3.z.string().max(20).optional().nullable(),
  phone: import_zod3.z.string().max(20).optional().nullable(),
  address: import_zod3.z.string().max(1e3).optional().nullable()
}).refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" });
var forgotPasswordSchema = import_zod3.z.object({
  email: import_zod3.z.string().email().max(100)
});
var resetPasswordSchema = import_zod3.z.object({
  token: import_zod3.z.string().min(10).max(200),
  newPassword: import_zod3.z.string().min(6).max(255)
});
authRouter.post("/signup", signupLimiter, validateBody(signupSchema), signup2);
authRouter.post("/login", loginLimiter, validateBody(loginSchema), login2);
authRouter.post("/revoke-unauth", loginLimiter, validateBody(revokeUnauthSchema), revokeUnauth);
authRouter.post("/refresh", refreshLimiter, validateBody(refreshSchema), refresh2);
authRouter.post("/logout", validateBody(logoutSchema), logout2);
authRouter.post("/forgot-password", forgotLimiter, validateBody(forgotPasswordSchema), forgotPassword);
authRouter.post("/reset-password", resetLimiter, validateBody(resetPasswordSchema), resetPassword2);
authRouter.get("/me", requireAuth, me);
authRouter.patch("/me", requireAuth, validateBody(profileSchema), updateProfile2);
authRouter.post("/me/avatar", requireAuth, upload.single("avatar"), uploadAvatar);
authRouter.put("/theme", requireAuth, validateBody(themeSchema), updateTheme);
authRouter.get("/check", checkAvailability2);
authRouter.get("/sessions", requireAuth, listSessions2);
authRouter.delete("/sessions/other", requireAuth, revokeOtherSessions2);
authRouter.delete("/sessions/all", requireAuth, revokeAllSessions2);
authRouter.delete("/sessions/:id", requireAuth, revokeSession2);
authRouter.post("/push-token", requireAuth, validateBody(pushTokenSchema), async (req, res) => {
  const { token, deviceModel, pushDeviceToggles, pushSystemAlerts } = req.body;
  const { prisma: prisma2 } = await Promise.resolve().then(() => (init_prisma(), prisma_exports));
  const fallbackDT = pushDeviceToggles !== void 0 ? pushDeviceToggles : true;
  const fallbackSA = pushSystemAlerts !== void 0 ? pushSystemAlerts : true;
  await prisma2.pushSubscription.upsert({
    where: { token },
    update: {
      userId: req.user.sub,
      deviceModel: deviceModel || void 0,
      pushDeviceToggles: fallbackDT,
      pushSystemAlerts: fallbackSA
    },
    create: {
      userId: req.user.sub,
      token,
      deviceModel,
      pushDeviceToggles: fallbackDT,
      pushSystemAlerts: fallbackSA
    }
  });
  res.json({ success: true, message: "Push token securely vaulted in multi-device registry" });
});

// src/routes/home.routes.ts
var import_express2 = require("express");
var import_zod4 = require("zod");

// src/services/home.service.ts
init_prisma();
async function createHome(userId, name) {
  return prisma.$transaction(async (tx) => {
    const home = await tx.home.create({
      data: {
        name,
        ownerId: userId,
        members: { create: { userId, role: "owner" } }
      }
    });
    return home;
  });
}
async function listHomesForUser(userId) {
  return prisma.home.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { where: { userId }, select: { role: true } },
      _count: { select: { devices: true, members: true } }
    },
    orderBy: { createdAt: "asc" }
  });
}
async function getHomeMembers(homeId) {
  return prisma.homeMember.findMany({
    where: { homeId },
    include: { user: { select: { id: true, username: true, email: true, avatarUrl: true } } }
  });
}
async function getHomeDetail(homeId) {
  return prisma.home.findUnique({
    where: { id: homeId },
    include: {
      rooms: { orderBy: { name: "asc" } },
      devices: { orderBy: { createdAt: "desc" } },
      members: { include: { user: { select: { id: true, username: true, email: true } } } },
      _count: { select: { devices: true, members: true } }
    }
  });
}
async function renameHome(homeId, name) {
  return prisma.home.update({ where: { id: homeId }, data: { name } });
}
async function transferOwnership(homeId, newOwnerId) {
  const [home, target] = await Promise.all([
    prisma.home.findUnique({ where: { id: homeId } }),
    prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId: newOwnerId } }
    })
  ]);
  if (!home) throw new AppError("HOME_NOT_FOUND", "Home not found", 404);
  if (!target) throw new AppError("NOT_A_MEMBER", "Target user is not a member of this home", 400);
  if (target.role === "owner") throw new AppError("ALREADY_OWNER", "Target is already the owner", 400);
  return prisma.$transaction([
    prisma.homeMember.update({
      where: { homeId_userId: { homeId, userId: newOwnerId } },
      data: { role: "owner" }
    }),
    prisma.homeMember.update({
      where: { homeId_userId: { homeId, userId: home.ownerId } },
      data: { role: "admin" }
    }),
    prisma.home.update({ where: { id: homeId }, data: { ownerId: newOwnerId } })
  ]);
}
async function deleteHome(homeId) {
  await prisma.home.delete({ where: { id: homeId } });
}
async function getHomeActivity(homeId, limit = 50, deviceId, userId, timeRange) {
  const whereClause = { device: { homeId } };
  if (deviceId) whereClause.deviceId = deviceId;
  if (userId) whereClause.actorId = userId;
  if (timeRange === "24h") {
    whereClause.createdAt = { gte: new Date(Date.now() - 24 * 60 * 60 * 1e3) };
  } else if (timeRange === "7d") {
    whereClause.createdAt = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3) };
  } else if (timeRange === "30d") {
    whereClause.createdAt = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3) };
  }
  return prisma.deviceLog.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { id: true, username: true } },
      device: { select: { id: true, name: true, type: true } }
    }
  });
}

// src/controllers/home.controller.ts
async function create(req, res) {
  const home = await createHome(req.user.sub, req.body.name);
  ok(res, home, 201);
}
async function list(req, res) {
  const homes = await listHomesForUser(req.user.sub);
  ok(res, homes);
}
async function listMembers(req, res) {
  const members = await getHomeMembers(Number(req.params.homeId));
  ok(res, members);
}
async function detail(req, res) {
  const home = await getHomeDetail(Number(req.params.homeId));
  ok(res, home);
}
async function rename(req, res) {
  const home = await renameHome(Number(req.params.homeId), req.body.name);
  ok(res, home);
}
async function transfer(req, res) {
  const home = await transferOwnership(
    Number(req.params.homeId),
    Number(req.body.newOwnerId)
  );
  ok(res, home);
}
async function remove(req, res) {
  await deleteHome(Number(req.params.homeId));
  ok(res, { message: "Home deleted" });
}
async function activity(req, res) {
  const limit = Number(req.query.limit ?? 50);
  const deviceId = req.query.deviceId ? Number(req.query.deviceId) : void 0;
  const userId = req.query.userId ? Number(req.query.userId) : void 0;
  const timeRange = req.query.timeRange;
  const logs2 = await getHomeActivity(Number(req.params.homeId), limit, deviceId, userId, timeRange);
  ok(res, logs2);
}

// src/services/device.service.ts
init_prisma();
init_socket();
init_audit_service();
init_notification_service();
init_push_service();
init_firmware_service();
init_mqtt_service();
async function listDevices(homeId, viewerId) {
  const where = { homeId };
  if (viewerId && prisma.deviceAccess) {
    const membership2 = await prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId: viewerId } },
      select: { restricted: true }
    });
    if (membership2?.restricted) {
      const granted = await prisma.deviceAccess.findMany({
        where: { homeId, userId: viewerId },
        select: { deviceId: true }
      });
      where.id = { in: granted.map((g) => g.deviceId) };
    }
  }
  return prisma.device.findMany({
    where,
    include: {
      esp: { select: { id: true, name: true, serialCode: true, modelCode: true, firmwareVersion: true, offline: true, lastSeen: true } },
      room: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}
async function createDevice(input) {
  if (input.roomId) {
    const room = await prisma.room.findFirst({
      where: { id: input.roomId, homeId: input.homeId }
    });
    if (!room) throw new AppError("ROOM_NOT_FOUND", "Room does not belong to this home", 400);
  }
  const dup = await prisma.device.findFirst({
    where: { homeId: input.homeId, name: input.name },
    select: { id: true }
  });
  if (dup) {
    throw new AppError("DUPLICATE_NAME", `Naam "${input.name}" already is home me hai \u2014 har device ka unique naam chahiye`, 409);
  }
  return prisma.device.create({
    data: {
      homeId: input.homeId,
      createdBy: input.createdBy,
      name: input.name,
      type: input.type,
      roomId: input.roomId,
      serialNumber: input.serialNumber
    }
  });
}
async function setDeviceStatus(input) {
  const device = await prisma.device.findFirst({
    where: { id: input.deviceId, homeId: input.homeId }
  });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  const membership2 = prisma.deviceAccess ? await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId: input.homeId, userId: input.actorId } },
    select: { restricted: true, dailyLimitMinutes: true }
  }) : null;
  if (membership2?.restricted && prisma.deviceAccess) {
    const granted = await prisma.deviceAccess.findUnique({
      where: { deviceId_userId: { deviceId: device.id, userId: input.actorId } }
    });
    if (!granted) {
      throw new AppError("FORBIDDEN", "Is device ka access nahi hai (child mode)", 403);
    }
    const limit = membership2?.dailyLimitMinutes || 5;
    const ONE_MINUTE_AGO = new Date(Date.now() - 60 * 1e3);
    const recentToggles = await prisma.deviceLog.count({
      where: {
        actorId: input.actorId,
        deviceId: device.id,
        logType: "status_change",
        createdAt: { gte: ONE_MINUTE_AGO }
      }
    });
    if (recentToggles >= limit) {
      throw new AppError("RATE_LIMIT_EXCEEDED", `Tumne is switch (${device.name}) ke sath bahut chedkhaani ki hai. 1 minute ruko! (Limit: ${limit}/min)`, 429);
    }
  }
  await prisma.$transaction([
    prisma.device.update({
      where: { id: device.id },
      data: { status: input.status }
    }),
    prisma.deviceCommand.create({
      data: {
        deviceId: device.id,
        actorId: input.actorId,
        command: `set_status:${input.status}`
      }
    }),
    prisma.deviceLog.create({
      data: {
        deviceId: device.id,
        actorId: input.actorId,
        logType: "status_change",
        logMessage: `Device turned ${input.status}`
      }
    })
  ]);
  const updated = await prisma.device.findUnique({ where: { id: device.id } });
  if (updated) {
    await emitDeviceUpdated(input.homeId, updated.id);
    if (updated.espId) {
      const esp = await prisma.espDevice.findUnique({ where: { id: updated.espId }, select: { macAddress: true } });
      if (esp) mqttPushCommands(esp.macAddress);
    }
    try {
      const members = await prisma.homeMember.findMany({
        where: { homeId: input.homeId, role: { in: ["admin", "owner"] } }
      });
      const actor = await prisma.user.findUnique({ where: { id: input.actorId }, select: { username: true } });
      const actorName = actor?.username || "A member";
      for (const m of members) {
        sendPushToUser(
          m.userId,
          `${updated.name} turned ${input.status.toUpperCase()}`,
          `${actorName} just interacted with the ${updated.name}`,
          void 0,
          "device"
        );
      }
    } catch (e) {
      console.warn("[Push] Background dispatch failure:", e);
    }
  }
  return updated;
}
async function sendDeviceCommand(input) {
  const device = await prisma.device.findFirst({
    where: { id: input.deviceId, homeId: input.homeId }
  });
  if (!device) {
    throw new AppError("DEVICE_NOT_FOUND", "Device nahi mila is home me", 404);
  }
  const membership2 = prisma.deviceAccess ? await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId: input.homeId, userId: input.actorId } },
    select: { restricted: true }
  }) : null;
  if (membership2?.restricted && prisma.deviceAccess) {
    const granted = await prisma.deviceAccess.findUnique({
      where: { deviceId_userId: { deviceId: device.id, userId: input.actorId } }
    });
    if (!granted) {
      throw new AppError("FORBIDDEN", "Is device ka access nahi hai (child mode)", 403);
    }
  }
  await prisma.$transaction([
    prisma.deviceCommand.create({
      data: { deviceId: device.id, actorId: input.actorId, command: input.command }
    }),
    prisma.deviceLog.create({
      data: { deviceId: device.id, actorId: input.actorId, logType: input.logType, logMessage: input.logMessage }
    })
  ]);
  const updated = await prisma.device.findUnique({ where: { id: device.id } });
  if (updated) {
    await emitDeviceUpdated(input.homeId, updated.id);
    try {
      const members = await prisma.homeMember.findMany({
        where: { homeId: input.homeId, role: { in: ["admin", "owner"] } }
      });
      const actor = await prisma.user.findUnique({ where: { id: input.actorId }, select: { username: true } });
      for (const m of members) {
        sendPushToUser(
          m.userId,
          `System Command: ${input.command}`,
          `${actor?.username || "A member"} dispatched a remote hardware command.`,
          void 0,
          "device"
        );
      }
    } catch (e) {
      console.warn("[Push] Remote Command Background dispatch failure:", e);
    }
  }
  return updated;
}
async function bulkSetStatus(input) {
  const ids = [...new Set(input.deviceIds)];
  let devices = await prisma.device.findMany({
    where: { id: { in: ids }, homeId: input.homeId }
  });
  if (devices.length === 0) {
    throw new AppError("DEVICE_NOT_FOUND", "Koi device nahi mila is home me", 404);
  }
  const membership2 = prisma.deviceAccess ? await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId: input.homeId, userId: input.actorId } },
    select: { restricted: true, dailyLimitMinutes: true }
  }) : null;
  if (membership2?.restricted && prisma.deviceAccess) {
    const granted = await prisma.deviceAccess.findMany({
      where: { userId: input.actorId, deviceId: { in: devices.map((d) => d.id) } },
      select: { deviceId: true }
    });
    const grantedSet = new Set(granted.map((g) => g.deviceId));
    const allowed = devices.filter((d) => grantedSet.has(d.id));
    if (allowed.length === 0) {
      throw new AppError("FORBIDDEN", "In devices ka access nahi hai (child mode)", 403);
    }
    devices = allowed;
    const limit = membership2?.dailyLimitMinutes || 5;
    const ONE_MINUTE_AGO = new Date(Date.now() - 60 * 1e3);
    const recentToggles = await prisma.deviceLog.groupBy({
      by: ["deviceId"],
      where: {
        actorId: input.actorId,
        deviceId: { in: devices.map((d) => d.id) },
        logType: "status_change",
        createdAt: { gte: ONE_MINUTE_AGO }
      },
      _count: { deviceId: true }
    });
    const maxToggles = Math.max(...recentToggles.map((t) => t._count.deviceId), 0);
    if (maxToggles + 1 > limit) {
      throw new AppError("RATE_LIMIT_EXCEEDED", `Tumne group me kisi switch ko ek minute me limit (${limit}) ke paar daba diya hai, thodi der wait karo!`, 429);
    }
  }
  await prisma.$transaction([
    prisma.device.updateMany({
      where: { id: { in: devices.map((d) => d.id) } },
      data: { status: input.status }
    }),
    ...devices.map(
      (d) => prisma.deviceCommand.create({
        data: { deviceId: d.id, actorId: input.actorId, command: `set_status:${input.status}` }
      })
    ),
    ...devices.map(
      (d) => prisma.deviceLog.create({
        data: {
          deviceId: d.id,
          actorId: input.actorId,
          logType: "status_change",
          logMessage: `Device turned ${input.status}`
        }
      })
    )
  ]);
  const updated = await prisma.device.findMany({
    where: { id: { in: devices.map((d) => d.id) }, homeId: input.homeId }
  });
  for (const d of updated) await emitDeviceUpdated(input.homeId, d.id);
  try {
    const members = await prisma.homeMember.findMany({
      where: { homeId: input.homeId, role: { in: ["admin", "owner"] } }
    });
    const actor = await prisma.user.findUnique({ where: { id: input.actorId }, select: { username: true } });
    for (const m of members) {
      sendPushToUser(
        m.userId,
        `Room Actuation: ${input.status.toUpperCase()}`,
        `${actor?.username || "A member"} toggled grouped components.`,
        void 0,
        "device"
      );
    }
  } catch (e) {
    console.warn("[Push] Bulk Group Background dispatch failure:", e);
  }
  return updated;
}
async function updateDevice(homeId, deviceId, patch) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, homeId } });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  if (patch.roomId !== void 0 && patch.roomId !== null) {
    const room = await prisma.room.findFirst({ where: { id: patch.roomId, homeId } });
    if (!room) throw new AppError("ROOM_NOT_FOUND", "Room does not belong to this home", 400);
  }
  if (patch.name !== void 0) {
    const dup = await prisma.device.findFirst({
      where: { homeId, name: patch.name, id: { not: deviceId } },
      select: { id: true }
    });
    if (dup) {
      throw new AppError("DUPLICATE_NAME", `Naam "${patch.name}" already is home me kisi aur device pe hai \u2014 unique naam chahiye`, 409);
    }
  }
  return prisma.device.update({
    where: { id: deviceId },
    data: { name: patch.name, roomId: patch.roomId, espId: patch.espId, channel: patch.channel }
  });
}
async function setEspLed(args) {
  const { homeId, espId, actorId, enabled } = args;
  const esp = await prisma.espDevice.update({
    where: { id: espId, homeId },
    data: { ledEnabled: enabled }
  });
  await prisma.auditLog.create({
    data: {
      homeId,
      actorId,
      action: "esp_led",
      entity: "esp",
      entityId: espId,
      meta: { title: `Status LED ${enabled ? "enabled" : "disabled"}` }
    }
  });
  emitToHome(homeId, "esp:updated", { id: esp.id, ledEnabled: esp.ledEnabled });
  if (esp.macAddress) {
    mqttPushLedState(esp.macAddress, esp.ledEnabled);
  }
  return esp;
}
async function getDeviceLogs(homeId, deviceId, limit = 50) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, homeId } });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  return prisma.deviceLog.findMany({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { id: true, username: true } } }
  });
}
async function deleteDevice(homeId, deviceId) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, homeId } });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  await prisma.device.delete({ where: { id: deviceId } });
}
async function renameEsp(homeId, espId, name, actorId) {
  if (!name) throw new AppError("BAD_REQUEST", "Board ka naam required hai", 400);
  if (name.length > 60) throw new AppError("BAD_REQUEST", "Naam 60 chars se chhota rakho", 400);
  const esp = await prisma.espDevice.findFirst({ where: { id: espId, homeId } });
  if (!esp) throw new AppError("NOT_FOUND", "Board is home me nahi mila", 404);
  const dup = await prisma.espDevice.findFirst({ where: { name, id: { not: espId } }, select: { id: true } });
  if (dup) {
    throw new AppError("DUPLICATE_NAME", `Naam "${name}" already kisi aur board pe hai \u2014 unique naam chahiye`, 409);
  }
  const updated = await prisma.espDevice.update({ where: { id: espId }, data: { name } });
  await audit(actorId, "user.esp.rename", {
    homeId,
    entity: "esp",
    entityId: espId,
    meta: { from: esp.name ?? null, to: name }
  });
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { username: true } });
  const home = await prisma.home.findUnique({
    where: { id: homeId },
    include: { members: { where: { role: { in: ["owner", "admin"] } }, select: { userId: true } } }
  });
  if (home) {
    const oldName = esp.name ?? esp.serialCode ?? `ESP-${esp.macAddress.slice(-6).toUpperCase()}`;
    for (const m of home.members) {
      await createNotification(m.userId, {
        category: "device",
        type: "info",
        title: `\u{1F6F0}\uFE0F Board renamed: ${oldName} \u2192 ${name}`,
        body: `${actor?.username ?? "Kisi ne"} ne board ka naam "${oldName}" se "${name}" kar diya.`
      });
    }
    emitToHome(homeId, "esp:updated", { id: espId, name });
  }
  return updated;
}
async function listMyBoards(userId) {
  const homes = await prisma.home.findMany({
    where: { members: { some: { userId, role: { in: ["owner", "admin"] } } } },
    select: {
      id: true,
      name: true,
      members: { where: { userId }, select: { role: true } }
    },
    orderBy: { createdAt: "asc" }
  });
  const homeIds = homes.map((h) => h.id);
  const homeApiKeys = await prisma.apiKey.findMany({
    where: { homeId: { in: homeIds }, revokedAt: null },
    select: { homeId: true, keyPrefix: true, expiresAt: true },
    orderBy: [{ homeId: "asc" }, { createdAt: "desc" }]
  });
  const apiKeyByHome = /* @__PURE__ */ new Map();
  for (const k of homeApiKeys) {
    if (k.homeId && !apiKeyByHome.has(k.homeId)) apiKeyByHome.set(k.homeId, k);
  }
  const boards = await prisma.espDevice.findMany({
    where: { homeId: { in: homeIds } },
    include: {
      devices: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          offline: true,
          lastSeen: true,
          channel: true
        },
        orderBy: { channel: "asc" }
      }
    },
    orderBy: { id: "asc" }
  });
  const unassignedDevices = await prisma.device.findMany({
    where: { homeId: { in: homeIds }, espId: null },
    select: {
      id: true,
      homeId: true,
      name: true,
      type: true,
      status: true,
      offline: true,
      lastSeen: true,
      channel: true
    },
    orderBy: { createdAt: "desc" }
  });
  const withHistory = boards.map((b) => ({
    ...b,
    history: []
  }));
  const byHome = /* @__PURE__ */ new Map();
  for (const b of withHistory) {
    const arr = byHome.get(b.homeId) ?? [];
    arr.push(b);
    byHome.set(b.homeId, arr);
  }
  return homes.map((h) => {
    const role = h.members[0]?.role ?? "member";
    const canManage = role === "owner" || role === "admin";
    return {
      homeId: h.id,
      homeName: h.name,
      role,
      apiKey: canManage ? apiKeyByHome.get(h.id) ?? null : null,
      boards: canManage ? (byHome.get(h.id) ?? []).map((b) => ({
        ...b,
        hotspotName: b.serialCode ? `SwitchNest-${b.serialCode}` : null,
        hotspotPassword: b.serialCode ?? null
      })) : [],
      unassignedDevices: canManage ? unassignedDevices.filter((d) => d.homeId === h.id) : []
    };
  });
}
async function requestOta(homeId, deviceId, actorId) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, homeId } });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device is home me nahi mila", 404);
  const esp = device.espId ? await prisma.espDevice.findUnique({ where: { id: device.espId } }) : null;
  const current = await resolveFirmware(esp?.modelCode);
  if (!current) {
    throw new AppError("NO_FIRMWARE", "Abhi koi current firmware published nahi hai", 400);
  }
  await prisma.device.update({
    where: { id: deviceId },
    data: { otaPendingVersion: current.version, otaRequestedAt: /* @__PURE__ */ new Date() }
  });
  let espId = null;
  if (esp) {
    espId = esp.id;
    await prisma.espDevice.update({
      where: { id: esp.id },
      data: { otaPendingVersion: current.version, otaRequestedAt: /* @__PURE__ */ new Date() }
    });
  }
  await audit(actorId, "user.ota.push", {
    homeId,
    entity: "device",
    entityId: deviceId,
    meta: { version: current.version, model: esp?.modelCode ?? null }
  });
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { username: true } });
  const home = await prisma.home.findUnique({
    where: { id: homeId },
    include: { members: { where: { role: { in: ["owner", "admin"] } }, select: { userId: true } } }
  });
  if (home) {
    for (const m of home.members) {
      await createNotification(m.userId, {
        category: "device",
        type: "info",
        title: `\u{1F4F2} "${device.name}" pe firmware update push kiya`,
        body: `${actor?.username ?? "Kisi ne"} ne board ke liye v${current.version} request kiya \u2014 agle heartbeat pe install hoga.`
      });
    }
  }
  await emitDeviceUpdated(homeId, deviceId);
  return {
    deviceId,
    espId,
    version: current.version,
    model: current.modelCode || "universal",
    message: "OTA update pushed \u2014 device agle heartbeat pe update ho jayega"
  };
}

// src/controllers/device.controller.ts
async function list2(req, res) {
  const devices = await listDevices(
    Number(req.params.homeId),
    req.user?.sub
  );
  ok(res, devices);
}
async function create2(req, res) {
  const device = await createDevice({
    homeId: Number(req.params.homeId),
    createdBy: req.user.sub,
    name: req.body.name,
    type: req.body.type,
    roomId: req.body.roomId,
    serialNumber: req.body.serialNumber
  });
  ok(res, device, 201);
}
async function setStatus(req, res) {
  const device = await setDeviceStatus({
    homeId: Number(req.params.homeId),
    deviceId: Number(req.params.deviceId),
    actorId: req.user.sub,
    status: req.body.status
  });
  ok(res, device);
}
async function bulkSetStatus2(req, res) {
  const updated = await bulkSetStatus({
    homeId: Number(req.params.homeId),
    actorId: req.user.sub,
    deviceIds: req.body.deviceIds,
    status: req.body.status
  });
  ok(res, updated);
}
async function restart(req, res) {
  const device = await sendDeviceCommand({
    homeId: Number(req.params.homeId),
    deviceId: Number(req.params.deviceId),
    actorId: req.user.sub,
    command: "reboot",
    logType: "remote_restart",
    logMessage: "Remote restart requested"
  });
  ok(res, device);
}
async function setWifi(req, res) {
  const ssid = String(req.body.ssid).trim();
  const pass = String(req.body.password ?? "");
  const device = await sendDeviceCommand({
    homeId: Number(req.params.homeId),
    deviceId: Number(req.params.deviceId),
    actorId: req.user.sub,
    command: `setwifi:${ssid}|${pass}`,
    logType: "remote_wifi",
    logMessage: `Remote WiFi set: ${ssid}`
  });
  ok(res, device);
}
async function setLed(req, res) {
  const enabled = req.body.enabled === true;
  const esp = await setEspLed({
    homeId: Number(req.params.homeId),
    espId: Number(req.params.espId),
    actorId: req.user.sub,
    enabled
  });
  ok(res, esp);
}
async function update(req, res) {
  const device = await updateDevice(
    Number(req.params.homeId),
    Number(req.params.deviceId),
    {
      name: req.body.name,
      roomId: req.body.roomId,
      espId: req.body.espId,
      channel: req.body.channel
    }
  );
  ok(res, device);
}
async function logs(req, res) {
  const logs2 = await getDeviceLogs(
    Number(req.params.homeId),
    Number(req.params.deviceId),
    Number(req.query.limit ?? 50)
  );
  ok(res, logs2);
}
async function remove3(req, res) {
  await deleteDevice(Number(req.params.homeId), Number(req.params.deviceId));
  ok(res, { message: "Device deleted" });
}
async function renameEsp2(req, res) {
  const board = await renameEsp(
    Number(req.params.homeId),
    Number(req.params.espId),
    String(req.body?.name ?? "").trim().slice(0, 60),
    req.user.sub
  );
  ok(res, board);
}
async function listMyBoards2(req, res) {
  const data = await listMyBoards(req.user.sub);
  ok(res, data);
}
async function requestOta2(req, res) {
  const data = await requestOta(
    Number(req.params.homeId),
    Number(req.params.deviceId),
    req.user.sub
  );
  ok(res, data);
}

// src/middleware/requireRole.ts
init_src();
init_prisma();
var ROLE_INDEX = Object.fromEntries(HOME_MEMBER_ROLES.map((r, i) => [r, i]));
function requireHomeMember(minRole = "member") {
  return async (req, _res, next) => {
    try {
      const userId = req.user?.sub;
      if (!userId) return next(new AppError("UNAUTHORIZED", "Not authenticated", 401));
      const homeId = Number(req.params.homeId);
      if (!Number.isInteger(homeId)) return next(new AppError("BAD_REQUEST", "Invalid home id"));
      const membership2 = await prisma.homeMember.findUnique({
        where: { homeId_userId: { homeId, userId } }
      });
      if (!membership2) {
        return next(new AppError("FORBIDDEN", "Not a member of this home", 403));
      }
      if (ROLE_INDEX[membership2.role] > ROLE_INDEX[minRole]) {
        return next(new AppError("FORBIDDEN", "Insufficient role for this action", 403));
      }
      req.homeMembership = membership2;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// src/routes/home.routes.ts
var homeRouter = (0, import_express2.Router)();
var idParams = import_zod4.z.object({ homeId: import_zod4.z.coerce.number().int().positive() });
var createSchema = import_zod4.z.object({ name: import_zod4.z.string().min(1).max(100) });
var renameSchema = import_zod4.z.object({ name: import_zod4.z.string().min(1).max(100) });
var transferSchema = import_zod4.z.object({ newOwnerId: import_zod4.z.coerce.number().int().positive() });
homeRouter.post("/", requireAuth, validateBody(createSchema), create);
homeRouter.get("/", requireAuth, list);
homeRouter.get("/my-boards", requireAuth, listMyBoards2);
homeRouter.get(
  "/:homeId",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("viewer"),
  detail
);
homeRouter.patch(
  "/:homeId",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("admin"),
  validateBody(renameSchema),
  rename
);
homeRouter.delete(
  "/:homeId",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("owner"),
  remove
);
homeRouter.post(
  "/:homeId/transfer",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("owner"),
  validateBody(transferSchema),
  transfer
);
homeRouter.get(
  "/:homeId/activity",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("admin"),
  activity
);
homeRouter.get(
  "/:homeId/members",
  requireAuth,
  validateParams(idParams),
  requireHomeMember("member"),
  listMembers
);

// src/routes/member.routes.ts
var import_express3 = require("express");
var import_zod5 = require("zod");

// src/services/member.service.ts
var import_node_crypto4 = __toESM(require("node:crypto"), 1);
init_prisma();
init_socket();
init_notification_service();
function generateInviteCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = import_node_crypto4.default.randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
async function listMembers2(homeId, viewerRole) {
  const members = await prisma.homeMember.findMany({
    where: { homeId },
    include: { user: { select: { id: true, username: true, email: true } } },
    orderBy: { joinedAt: "asc" }
  });
  if ((viewerRole === "owner" || viewerRole === "admin") && prisma.deviceAccess) {
    const grants = await prisma.deviceAccess.findMany({
      where: { homeId },
      select: { userId: true, deviceId: true }
    });
    const byUser = /* @__PURE__ */ new Map();
    for (const g of grants) {
      const arr = byUser.get(g.userId) ?? [];
      arr.push({ deviceId: g.deviceId });
      byUser.set(g.userId, arr);
    }
    return members.map((m) => ({ ...m, deviceAccess: byUser.get(m.userId) ?? [] }));
  }
  return members;
}
async function createInvitation(input) {
  const existingUser = input.email ? await prisma.user.findUnique({ where: { email: input.email } }) : null;
  const userFound = !!existingUser;
  if (existingUser) {
    const already = await prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId: input.homeId, userId: existingUser.id } }
    });
    if (already) throw new AppError("ALREADY_MEMBER", "User is already a member of this home", 409);
  }
  const expiresInHours = input.expiresInHours ?? 48;
  let inviteCode = generateInviteCode();
  for (let attempt = 0; attempt < 3; attempt++) {
    const exists = await prisma.invitation.findUnique({ where: { inviteCode } });
    if (!exists) break;
    inviteCode = generateInviteCode();
  }
  const invitation = await prisma.invitation.create({
    data: {
      homeId: input.homeId,
      email: input.email ?? "",
      // Store empty string when no email given
      inviteCode,
      role: input.role,
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1e3)
    }
  });
  return { ...invitation, userFound };
}
async function acceptInvitation(inviteCode, userId, userEmail) {
  const invitation = await prisma.invitation.findUnique({
    where: { inviteCode: inviteCode.trim().toUpperCase() },
    include: { home: true }
  });
  if (!invitation || invitation.status !== "pending") {
    throw new AppError("INVALID_INVITE", "Invitation not found or no longer active", 404);
  }
  if (invitation.expiresAt < /* @__PURE__ */ new Date()) {
    throw new AppError("INVITE_EXPIRED", "Invitation has expired", 410);
  }
  if (invitation.email && invitation.email !== userEmail.toLowerCase()) {
    throw new AppError("INVITE_EMAIL_MISMATCH", "Invitation was sent to a different email", 403);
  }
  const returnedHome = await prisma.$transaction(async (tx) => {
    const existing = await tx.homeMember.findUnique({
      where: { homeId_userId: { homeId: invitation.homeId, userId } }
    });
    if (existing) throw new AppError("ALREADY_MEMBER", "You are already a member of this home", 409);
    await tx.homeMember.create({
      data: { homeId: invitation.homeId, userId, role: invitation.role }
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: /* @__PURE__ */ new Date() }
    });
    await createNotification(invitation.home.ownerId, {
      category: "system",
      type: "info",
      title: `\u{1F464} New member joined ${invitation.home.name}`,
      body: `A user joined your home with the ${invitation.role} role.`
    });
    return invitation.home;
  });
  emitToHome(returnedHome.id, "home-updated", { homeId: returnedHome.id });
  return returnedHome;
}
async function listInvitations(homeId) {
  return prisma.invitation.findMany({
    where: { homeId, status: "pending" },
    orderBy: { createdAt: "desc" }
  });
}
async function revokeInvitation(homeId, invitationId) {
  const invitation = await prisma.invitation.findFirst({ where: { id: invitationId, homeId } });
  if (!invitation) throw new AppError("INVITATION_NOT_FOUND", "Invitation not found", 404);
  const updated = await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: "revoked" }
  });
  emitToHome(homeId, "home-updated", { homeId });
  return updated;
}
async function changeRole(homeId, userId, role) {
  const member = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId } }
  });
  if (!member) throw new AppError("NOT_A_MEMBER", "User is not a member of this home", 404);
  if (member.role === "owner") {
    throw new AppError("CANNOT_DEMOTE_OWNER", "The owner's role cannot be changed", 400);
  }
  const updated = await prisma.homeMember.update({
    where: { homeId_userId: { homeId, userId } },
    data: { role }
  });
  emitToHome(homeId, "home-updated", { homeId });
  return updated;
}
async function removeMember(homeId, userId) {
  const member = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId } }
  });
  if (!member) throw new AppError("NOT_A_MEMBER", "User is not a member of this home", 404);
  if (member.role === "owner") {
    throw new AppError("CANNOT_REMOVE_OWNER", "The owner cannot be removed", 400);
  }
  await prisma.homeMember.delete({ where: { homeId_userId: { homeId, userId } } });
  await leaveHomeRoom(userId, homeId);
  emitToHome(homeId, "home-updated", { homeId });
}
async function updateMemberSafety(input) {
  if (input.actorRole !== "owner" && input.actorRole !== "admin") {
    throw new AppError("FORBIDDEN", "Only owner/admin can manage member safety", 403);
  }
  const member = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId: input.homeId, userId: input.targetUserId } }
  });
  if (!member) throw new AppError("NOT_A_MEMBER", "User is not a member of this home", 404);
  if (member.role === "owner") throw new AppError("BAD_REQUEST", "Owner ko child mode me nahi rakha ja sakta", 400);
  const data = {};
  if (input.restricted !== void 0) data.restricted = input.restricted;
  if (input.dailyLimitMinutes !== void 0) {
    const mins = Number(input.dailyLimitMinutes);
    data.dailyLimitMinutes = Number.isFinite(mins) && mins > 0 ? Math.floor(mins) : null;
  }
  if (data.restricted === false) data.dailyLimitMinutes = null;
  const updated = await prisma.homeMember.update({
    where: { homeId_userId: { homeId: input.homeId, userId: input.targetUserId } },
    data,
    include: { user: { select: { id: true, username: true } } }
  });
  const { audit: audit2 } = await Promise.resolve().then(() => (init_audit_service(), audit_service_exports));
  await audit2(input.actorId, "member.safety", {
    homeId: input.homeId,
    entity: "homeMember",
    entityId: member.id,
    meta: { targetUserId: input.targetUserId, ...data }
  });
  emitToHome(input.homeId, "home-updated", { homeId: input.homeId });
  return updated;
}
async function setDeviceAccess(input) {
  if (input.actorRole !== "owner" && input.actorRole !== "admin") {
    throw new AppError("FORBIDDEN", "Only owner/admin can manage device access", 403);
  }
  const member = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId: input.homeId, userId: input.targetUserId } }
  });
  if (!member) throw new AppError("NOT_A_MEMBER", "User is not a member of this home", 404);
  if (member.role === "owner") throw new AppError("BAD_REQUEST", "Owner pe device access set nahi kar sakte", 400);
  const ids = [...new Set(input.deviceIds)];
  if (ids.length > 0) {
    const devices = await prisma.device.findMany({
      where: { id: { in: ids }, homeId: input.homeId },
      select: { id: true }
    });
    if (devices.length !== ids.length) {
      throw new AppError("BAD_REQUEST", "Kuch devices is home ke nahi hain", 400);
    }
  }
  await prisma.$transaction([
    prisma.deviceAccess.deleteMany({ where: { homeId: input.homeId, userId: input.targetUserId } }),
    ...ids.length > 0 ? [
      prisma.deviceAccess.createMany({
        data: ids.map((deviceId) => ({
          homeId: input.homeId,
          deviceId,
          userId: input.targetUserId
        }))
      })
    ] : []
  ]);
  const { audit: audit2 } = await Promise.resolve().then(() => (init_audit_service(), audit_service_exports));
  await audit2(input.actorId, "member.access", {
    homeId: input.homeId,
    entity: "homeMember",
    entityId: member.id,
    meta: { targetUserId: input.targetUserId, deviceIds: ids }
  });
  emitToHome(input.homeId, "home-updated", { homeId: input.homeId });
  return { deviceIds: ids };
}

// src/controllers/member.controller.ts
async function list3(req, res) {
  const members = await listMembers2(
    Number(req.params.homeId),
    req.homeMembership?.role
  );
  ok(res, members);
}
async function invite(req, res) {
  const invitation = await createInvitation({
    homeId: Number(req.params.homeId),
    email: req.body.email,
    role: req.body.role
  });
  ok(res, invitation, 201);
}
async function accept(req, res) {
  const home = await acceptInvitation(
    req.body.inviteCode,
    req.user.sub,
    req.user.email
  );
  ok(res, home);
}
async function listInvitations2(req, res) {
  const invitations = await listInvitations(Number(req.params.homeId));
  ok(res, invitations);
}
async function revokeInvitation2(req, res) {
  const invitation = await revokeInvitation(
    Number(req.params.homeId),
    Number(req.params.invitationId)
  );
  ok(res, invitation);
}
async function changeRole2(req, res) {
  const member = await changeRole(
    Number(req.params.homeId),
    Number(req.params.userId),
    req.body.role
  );
  ok(res, member);
}
async function remove4(req, res) {
  await removeMember(Number(req.params.homeId), Number(req.params.userId));
  ok(res, { message: "Member removed" });
}
async function updateSafety(req, res) {
  const member = await updateMemberSafety({
    homeId: Number(req.params.homeId),
    actorId: req.user.sub,
    actorRole: req.homeMembership.role,
    targetUserId: Number(req.params.userId),
    restricted: req.body.restricted,
    dailyLimitMinutes: req.body.dailyLimitMinutes
  });
  ok(res, member);
}
async function updateAccess(req, res) {
  const result = await setDeviceAccess({
    homeId: Number(req.params.homeId),
    actorId: req.user.sub,
    actorRole: req.homeMembership.role,
    targetUserId: Number(req.params.userId),
    deviceIds: req.body.deviceIds
  });
  ok(res, result);
}

// src/routes/member.routes.ts
var memberRouter = (0, import_express3.Router)();
var idParams2 = import_zod5.z.object({ homeId: import_zod5.z.coerce.number().int().positive() });
var memberParams = import_zod5.z.object({
  homeId: import_zod5.z.coerce.number().int().positive(),
  userId: import_zod5.z.coerce.number().int().positive()
});
var inviteSchema = import_zod5.z.object({
  email: import_zod5.z.string().email().max(100).optional(),
  role: import_zod5.z.enum(["admin", "member", "viewer"])
  // cannot invite as owner
});
var acceptSchema = import_zod5.z.object({ inviteCode: import_zod5.z.string().min(6).max(12) });
var roleSchema = import_zod5.z.object({ role: import_zod5.z.enum(["admin", "member", "viewer"]) });
var safetySchema = import_zod5.z.object({
  restricted: import_zod5.z.boolean().optional(),
  dailyLimitMinutes: import_zod5.z.coerce.number().int().min(1).max(1440).nullable().optional()
});
var accessSchema = import_zod5.z.object({
  deviceIds: import_zod5.z.array(import_zod5.z.number().int().positive()).max(100)
});
memberRouter.get(
  "/:homeId/members",
  requireAuth,
  validateParams(idParams2),
  requireHomeMember("viewer"),
  list3
);
memberRouter.get(
  "/:homeId/invitations",
  requireAuth,
  validateParams(idParams2),
  requireHomeMember("admin"),
  listInvitations2
);
memberRouter.delete(
  "/:homeId/invitations/:invitationId",
  requireAuth,
  validateParams(
    import_zod5.z.object({
      homeId: import_zod5.z.coerce.number().int().positive(),
      invitationId: import_zod5.z.coerce.number().int().positive()
    })
  ),
  requireHomeMember("admin"),
  revokeInvitation2
);
memberRouter.post(
  "/:homeId/invitations",
  requireAuth,
  validateParams(idParams2),
  requireHomeMember("admin"),
  validateBody(inviteSchema),
  invite
);
memberRouter.patch(
  "/:homeId/members/:userId/role",
  requireAuth,
  validateParams(memberParams),
  requireHomeMember("admin"),
  validateBody(roleSchema),
  changeRole2
);
memberRouter.delete(
  "/:homeId/members/:userId",
  requireAuth,
  validateParams(memberParams),
  requireHomeMember("admin"),
  remove4
);
memberRouter.patch(
  "/:homeId/members/:userId/safety",
  requireAuth,
  validateParams(memberParams),
  requireHomeMember("admin"),
  validateBody(safetySchema),
  updateSafety
);
memberRouter.put(
  "/:homeId/members/:userId/access",
  requireAuth,
  validateParams(memberParams),
  requireHomeMember("admin"),
  validateBody(accessSchema),
  updateAccess
);
memberRouter.post("/invitations/accept", requireAuth, validateBody(acceptSchema), accept);

// src/routes/device.routes.ts
var import_express4 = require("express");
var import_zod6 = require("zod");

// src/services/analytics.service.ts
init_prisma();
function computeUsageAnalytics(logs2, days, now = Date.now()) {
  const perDay = /* @__PURE__ */ new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    perDay.set(d.toISOString().slice(0, 10), 0);
  }
  const deviceMap = /* @__PURE__ */ new Map();
  const memberMap = /* @__PURE__ */ new Map();
  for (const log2 of logs2) {
    const day = log2.createdAt.toISOString().slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    const dev = deviceMap.get(log2.deviceId) ?? {
      deviceId: log2.deviceId,
      name: log2.deviceName,
      toggles: 0,
      onMs: 0
    };
    dev.toggles += 1;
    const turnedOn = log2.logMessage.trim().endsWith("on");
    if (turnedOn) {
      dev.lastOnAt = log2.createdAt.getTime();
    } else if (dev.lastOnAt !== void 0) {
      dev.onMs += log2.createdAt.getTime() - dev.lastOnAt;
      dev.lastOnAt = void 0;
    }
    deviceMap.set(log2.deviceId, dev);
    const actorId = log2.actorId ?? -1;
    const member = memberMap.get(actorId) ?? {
      userId: log2.actorId,
      username: log2.actorId === null ? "Auto (schedule/device)" : log2.actorName ?? "Unknown",
      toggles: 0
    };
    member.toggles += 1;
    memberMap.set(actorId, member);
  }
  for (const dev of deviceMap.values()) {
    if (dev.lastOnAt !== void 0) {
      dev.onMs += now - dev.lastOnAt;
      dev.lastOnAt = void 0;
    }
  }
  const perDevice = [...deviceMap.values()].map(({ deviceId, name, toggles, onMs }) => ({ deviceId, name, toggles, onMs })).sort((a, b) => b.toggles - a.toggles);
  const perMember = [...memberMap.values()].sort((a, b) => b.toggles - a.toggles);
  return {
    days,
    totals: {
      toggles: logs2.length,
      onMs: perDevice.reduce((s, d) => s + d.onMs, 0)
    },
    togglesPerDay: [...perDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
    perDevice,
    perMember
  };
}
async function getUsageAnalytics(homeId, days) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1e3);
  const logs2 = await prisma.deviceLog.findMany({
    where: {
      logType: "status_change",
      createdAt: { gte: since },
      device: { homeId }
    },
    include: {
      device: { select: { id: true, name: true } },
      actor: { select: { id: true, username: true } }
    },
    orderBy: { createdAt: "asc" }
  });
  return computeUsageAnalytics(
    logs2.map((l) => ({
      deviceId: l.deviceId,
      deviceName: l.device.name,
      actorId: l.actorId,
      actorName: l.actor?.username,
      logMessage: l.logMessage,
      createdAt: l.createdAt
    })),
    days
  );
}

// src/services/automation.service.ts
init_prisma();
var MIN_DAYS = 2;
var MIN_CONFIDENCE = 0.5;
function suggestAutomationsFromLogs(logs2, minDays = MIN_DAYS, minConfidence = MIN_CONFIDENCE) {
  const byDevice = /* @__PURE__ */ new Map();
  for (const log2 of logs2) {
    const msg = log2.logMessage.trim();
    if (!msg.endsWith("on") && !msg.endsWith("off")) continue;
    const action = msg.endsWith("on") ? "on" : "off";
    const d = log2.createdAt;
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const hourKey2 = `${String(d.getHours()).padStart(2, "0")}:00`;
    const dev = byDevice.get(log2.deviceId) ?? {
      name: log2.deviceName,
      days: /* @__PURE__ */ new Set(),
      hours: /* @__PURE__ */ new Map()
      // "07:00:on" -> set of dates
    };
    dev.days.add(dateKey);
    const slotKey = `${hourKey2}|${action}`;
    const slot = dev.hours.get(slotKey) ?? /* @__PURE__ */ new Set();
    slot.add(dateKey);
    dev.hours.set(slotKey, slot);
    byDevice.set(log2.deviceId, dev);
  }
  const suggestions = [];
  for (const [deviceId, dev] of byDevice) {
    const totalDays = dev.days.size;
    if (totalDays < minDays) continue;
    for (const [slotKey, dates] of dev.hours) {
      const [time, action] = slotKey.split("|");
      const confidence = dates.size / totalDays;
      if (confidence < minConfidence) continue;
      const hour = Number(time.slice(0, 2));
      const period = hour < 12 ? "subah" : hour < 17 ? "dopahar" : hour < 21 ? "shaam" : "raat";
      suggestions.push({
        deviceId,
        deviceName: dev.name,
        type: "daily",
        time,
        action,
        confidence: Math.round(confidence * 100) / 100,
        days: dates.size,
        reason: `Aap "${dev.name}" ${time} baje (${period}) ${action === "on" ? "ON" : "OFF"} karte ho \u2014 ${dates.size}/${totalDays} din me.`
      });
    }
  }
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}
var DEMO_PATTERNS = [
  { time: "07:00", action: "on", note: "subah ON \u2014 din ki shuruaat" },
  { time: "18:00", action: "on", note: "shaam ON \u2014 ghar aate hi" },
  { time: "21:30", action: "off", note: "raat OFF \u2014 sone se pehle" }
];
function demoSuggestions(devices) {
  return devices.slice(0, 3).map((d, i) => {
    const p = DEMO_PATTERNS[i % DEMO_PATTERNS.length];
    return {
      deviceId: d.id,
      deviceName: d.name,
      type: "daily",
      time: p.time,
      action: p.action,
      confidence: 0.6,
      days: 3,
      reason: `Demo: "${d.name}" ko ${p.time} baje ${p.action === "on" ? "ON" : "OFF"} karna \u2014 ${p.note}. (Aapke usage data se nahi \u2014 schedule bana ke try karo.)`,
      demo: true
    };
  });
}
async function getAutomationSuggestions(homeId) {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1e3);
  const logs2 = await prisma.deviceLog.findMany({
    where: {
      logType: "status_change",
      createdAt: { gte: since },
      device: { homeId }
    },
    include: { device: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" }
  });
  const real = suggestAutomationsFromLogs(
    logs2.map((l) => ({
      deviceId: l.deviceId,
      deviceName: l.device.name,
      logMessage: l.logMessage,
      createdAt: l.createdAt
    }))
  );
  if (real.length > 0) return real;
  const devices = await prisma.device.findMany({
    where: { homeId },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
    take: 10
  });
  return demoSuggestions(devices);
}

// src/routes/device.routes.ts
var deviceRouter = (0, import_express4.Router)();
var idParams3 = import_zod6.z.object({ homeId: import_zod6.z.coerce.number().int().positive() });
var deviceParams = import_zod6.z.object({
  homeId: import_zod6.z.coerce.number().int().positive(),
  deviceId: import_zod6.z.coerce.number().int().positive()
});
var espParams = import_zod6.z.object({
  homeId: import_zod6.z.coerce.number().int().positive(),
  espId: import_zod6.z.coerce.number().int().positive()
});
var createSchema2 = import_zod6.z.object({
  name: import_zod6.z.string().min(1).max(100),
  type: import_zod6.z.enum(["bulb", "fan", "ac", "tv", "plug", "custom"]),
  roomId: import_zod6.z.coerce.number().int().positive().optional(),
  serialNumber: import_zod6.z.string().min(1).max(64).optional()
});
var statusSchema = import_zod6.z.object({ status: import_zod6.z.enum(["on", "off"]) });
var wifiSchema = import_zod6.z.object({
  ssid: import_zod6.z.string().min(1).max(64),
  password: import_zod6.z.string().max(64).optional().or(import_zod6.z.literal(""))
});
var ledSchema = import_zod6.z.object({ enabled: import_zod6.z.boolean() });
var bulkStatusSchema = import_zod6.z.object({
  deviceIds: import_zod6.z.array(import_zod6.z.number().int().positive()).min(1).max(50),
  status: import_zod6.z.enum(["on", "off"])
});
var espNameSchema = import_zod6.z.object({ name: import_zod6.z.string().min(1).max(60) });
var updateSchema = import_zod6.z.object({
  name: import_zod6.z.string().min(1).max(100).optional(),
  roomId: import_zod6.z.coerce.number().int().positive().nullable().optional(),
  espId: import_zod6.z.coerce.number().int().positive().nullable().optional(),
  channel: import_zod6.z.coerce.number().int().min(0).max(16).nullable().optional()
});
deviceRouter.get(
  "/:homeId/devices",
  requireAuth,
  validateParams(idParams3),
  requireHomeMember("viewer"),
  list2
);
deviceRouter.post(
  "/:homeId/devices",
  requireAuth,
  validateParams(idParams3),
  requireHomeMember("admin"),
  validateBody(createSchema2),
  create2
);
deviceRouter.post(
  "/:homeId/devices/bulk-status",
  requireAuth,
  validateParams(idParams3),
  requireHomeMember("member"),
  validateBody(bulkStatusSchema),
  bulkSetStatus2
);
deviceRouter.patch(
  "/:homeId/devices/:deviceId",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("admin"),
  validateBody(updateSchema),
  update
);
deviceRouter.get(
  "/:homeId/devices/:deviceId/logs",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("viewer"),
  logs
);
deviceRouter.post(
  "/:homeId/devices/:deviceId/status",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("member"),
  validateBody(statusSchema),
  setStatus
);
deviceRouter.delete(
  "/:homeId/devices/:deviceId",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("admin"),
  remove3
);
deviceRouter.post(
  "/:homeId/devices/:deviceId/restart",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("member"),
  restart
);
deviceRouter.post(
  "/:homeId/devices/:deviceId/wifi",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("member"),
  validateBody(wifiSchema),
  setWifi
);
deviceRouter.post(
  "/:homeId/esp/:espId/led",
  requireAuth,
  validateParams(espParams),
  requireHomeMember("member"),
  validateBody(ledSchema),
  setLed
);
deviceRouter.post(
  "/:homeId/devices/:deviceId/ota",
  requireAuth,
  validateParams(deviceParams),
  requireHomeMember("admin"),
  requestOta2
);
deviceRouter.patch(
  "/:homeId/esp/:espId",
  requireAuth,
  validateParams(idParams3),
  requireHomeMember("admin"),
  validateBody(espNameSchema),
  renameEsp2
);
deviceRouter.get(
  "/:homeId/analytics/usage",
  requireAuth,
  validateParams(idParams3),
  requireHomeMember("viewer"),
  async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
    ok(res, await getUsageAnalytics(Number(req.params.homeId), days));
  }
);
deviceRouter.get(
  "/:homeId/automations/suggestions",
  requireAuth,
  validateParams(idParams3),
  requireHomeMember("viewer"),
  async (req, res) => {
    ok(res, await getAutomationSuggestions(Number(req.params.homeId)));
  }
);

// src/routes/deviceApi.routes.ts
var import_express5 = require("express");
var import_zod7 = require("zod");

// src/middleware/apiKey.ts
var import_node_crypto5 = __toESM(require("node:crypto"), 1);
init_prisma();
function hashKey2(raw) {
  return import_node_crypto5.default.createHash("sha256").update(raw).digest("hex");
}
function extractKey(req) {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer rs_")) {
    return header.slice(7);
  }
  const query = req.query["api_key"];
  if (typeof query === "string" && query.length > 0) return query;
  const body = req.body["api_key"];
  if (typeof body === "string" && body.length > 0) return body;
  return null;
}
var requireApiKey = async (req, _res, next) => {
  try {
    const raw = extractKey(req);
    if (!raw) {
      return next(new AppError("UNAUTHORIZED", "Missing api_key", 401));
    }
    const key = await prisma.apiKey.findUnique({ where: { keyHash: hashKey2(raw) } });
    if (!key) {
      return next(new AppError("UNAUTHORIZED", "Invalid api_key", 401));
    }
    if (key.revokedAt) {
      return next(new AppError("UNAUTHORIZED", "API key has been revoked", 401));
    }
    if (key.expiresAt && key.expiresAt < /* @__PURE__ */ new Date()) {
      return next(new AppError("UNAUTHORIZED", "API key has expired", 401));
    }
    if (!key.homeId) {
      return next(
        new AppError(
          "KEY_NOT_SCOPED",
          "This API key is not scoped to a home \u2014 create a device key for a home first",
          400
        )
      );
    }
    await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: /* @__PURE__ */ new Date() } }).catch(() => void 0);
    req.apiKey = key;
    next();
  } catch (err) {
    next(err);
  }
};

// src/services/deviceApi.service.ts
init_prisma();
init_socket();
function homeScope(key) {
  if (!key.homeId) {
    throw new AppError("KEY_NOT_SCOPED", "API key is not scoped to a home", 400);
  }
  return key.homeId;
}
async function readAll(key, mac) {
  const homeId = homeScope(key);
  if (mac) {
    const macKey = mac.replace(/[^0-9A-Fa-f:]/g, "").toLowerCase();
    const esp = await prisma.espDevice.findFirst({
      where: { homeId, macAddress: macKey }
    });
    if (!esp) return { states: [], led: 1 };
    const devices2 = await prisma.device.findMany({
      where: { homeId, espId: esp.id },
      select: { channel: true, status: true }
    });
    const relayCount = esp.modelCode === "sn-r2" ? 2 : esp.modelCode === "sn-r1" ? 1 : 4;
    const states = new Array(relayCount).fill(0);
    const led = esp.ledEnabled ? 1 : 0;
    for (const d of devices2) {
      if (d.channel != null && d.channel >= 1 && d.channel <= relayCount) {
        states[d.channel - 1] = d.status === "on" ? 1 : 0;
      }
    }
    await prisma.espDevice.update({
      where: { id: esp.id },
      data: { lastSeen: /* @__PURE__ */ new Date(), offline: false }
    }).catch(() => null);
    return { states, led };
  }
  const devices = await prisma.device.findMany({
    where: { homeId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true, offline: true }
  });
  const result = await prisma.device.updateMany({ where: { homeId }, data: { lastSeen: /* @__PURE__ */ new Date(), offline: false } }).catch(() => null);
  if (result?.count) {
    const offlineDevices = devices.filter((d) => d.offline);
    for (const d of offlineDevices) {
      await emitDeviceUpdated(homeId, d.id);
    }
  }
  return devices.map((d) => ({ id: d.id, name: d.name, status: d.status }));
}
async function updateFromDevice(key, deviceId, status, mac, channel) {
  const homeId = homeScope(key);
  let targetDeviceId = deviceId;
  if (mac && channel != null) {
    const esp = await prisma.espDevice.findFirst({ where: { homeId, macAddress: mac } });
    if (esp) {
      const dev = await prisma.device.findFirst({ where: { espId: esp.id, channel, homeId } });
      if (dev) targetDeviceId = dev.id;
    }
  }
  if (!targetDeviceId) {
    throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  }
  const device = await prisma.device.findFirst({ where: { id: targetDeviceId, homeId } });
  if (!device) {
    throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  }
  await prisma.$transaction([
    prisma.device.update({
      where: { id: targetDeviceId },
      data: { status, lastSeen: /* @__PURE__ */ new Date(), offline: false }
    }),
    prisma.deviceLog.create({
      data: {
        deviceId: targetDeviceId,
        actorId: null,
        logType: "status_change",
        logMessage: `Device switched ${status} (physical switch)`
      }
    })
  ]);
  const updated = await prisma.device.findUnique({ where: { id: targetDeviceId } });
  if (updated) await emitDeviceUpdated(homeId, updated.id);
  return updated;
}
async function reportOtaProgress(key, input) {
  const homeId = homeScope(key);
  const device = await prisma.device.findFirst({
    where: { id: input.device_id, homeId }
  });
  if (!device) {
    throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  }
  const progress = Math.max(0, Math.min(100, Math.round(input.progress)));
  const status = input.status ?? null;
  if (device.espId) {
    const esp = await prisma.espDevice.update({
      where: { id: device.espId },
      data: { otaProgress: progress, otaStatus: status, lastSeen: /* @__PURE__ */ new Date(), offline: false }
    });
    emitToHome(homeId, "esp:updated", esp);
  }
  const updated = await prisma.device.update({
    where: { id: device.id },
    data: { otaProgress: progress, otaStatus: status, lastSeen: /* @__PURE__ */ new Date(), offline: false }
  });
  await emitDeviceUpdated(homeId, updated.id);
  return { progress, status };
}
async function heartbeat(key, input, baseUrl) {
  const homeId = homeScope(key);
  let device = void 0;
  if (input.device_id) {
    device = await prisma.device.findFirst({
      where: { id: input.device_id, homeId }
    });
  }
  const fw = input.fw_version?.trim() || void 0;
  const ip = input.ip?.trim() || void 0;
  const mac = input.mac?.trim() || void 0;
  const ssid = input.ssid?.trim() || void 0;
  const serial = input.serial?.trim().toUpperCase() || void 0;
  const model = input.model?.trim().toUpperCase() || void 0;
  let esp = null;
  const macKey = mac ? mac.replace(/[^0-9A-Fa-f:]/g, "").toLowerCase() : "";
  let attachSerial = serial;
  if (macKey && serial) {
    const pendingStub = await prisma.espDevice.findUnique({
      where: { macAddress: `PENDING-${serial}` }
    });
    if (pendingStub) {
      const existingMac = await prisma.espDevice.findUnique({ where: { macAddress: macKey } });
      if (!existingMac) {
        await prisma.espDevice.update({
          where: { id: pendingStub.id },
          data: { macAddress: macKey }
        });
      } else {
        await prisma.espDevice.delete({ where: { id: pendingStub.id } });
      }
    }
    const other = await prisma.espDevice.findFirst({
      where: { serialCode: serial, macAddress: { not: macKey } },
      select: { id: true }
    });
    if (other) attachSerial = void 0;
  }
  const macTail = macKey.replace(/:/g, "").slice(-6).toUpperCase();
  if (macKey) {
    const existing = await prisma.espDevice.findFirst({
      where: { macAddress: macKey },
      select: { id: true, serialCode: true }
    });
    esp = await prisma.espDevice.upsert({
      where: { macAddress: macKey },
      create: {
        homeId,
        macAddress: macKey,
        // Unique + searchable naam: serial (product code) pehle, SSID baad me.
        // Serial na ho to MAC-tail se unique `ESP-XXXXXX` fallback.
        name: attachSerial ? `${attachSerial} \xB7 ${ssid ?? "SwitchNest"}` : ssid ? `${ssid} \xB7 ESP-${macTail}` : `ESP-${macTail}`,
        ssid,
        serialCode: attachSerial,
        modelCode: model,
        ipAddress: ip,
        firmwareVersion: fw,
        lastSeen: /* @__PURE__ */ new Date(),
        offline: false
      },
      update: {
        homeId,
        ssid: ssid ?? void 0,
        serialCode: attachSerial ?? void 0,
        modelCode: model ?? void 0,
        ipAddress: ip ?? void 0,
        firmwareVersion: fw ?? void 0,
        lastSeen: /* @__PURE__ */ new Date(),
        offline: false,
        ...attachSerial && existing?.serialCode && attachSerial !== existing.serialCode ? { name: `${attachSerial} \xB7 ${ssid ?? "SwitchNest"}` } : {}
      }
    });
    emitToHome(homeId, "esp:updated", esp);
  }
  const data = {
    lastSeen: /* @__PURE__ */ new Date(),
    offline: false
  };
  if (ip) data.ipAddress = ip;
  if (fw) data.firmwareVersion = fw;
  if (esp) data.esp = { connect: { id: esp.id } };
  const pendingVer = esp ? esp.otaPendingVersion : device?.otaPendingVersion ?? null;
  if (fw && pendingVer && fw === pendingVer) {
    if (esp) {
      await prisma.espDevice.update({
        where: { id: esp.id },
        data: { otaPendingVersion: null, otaRequestedAt: null, otaProgress: null, otaStatus: null }
      });
    }
    data.otaPendingVersion = null;
    data.otaRequestedAt = null;
    data.otaProgress = null;
    data.otaStatus = null;
  }
  let updatedDevice = device;
  if (device) {
    updatedDevice = await prisma.device.update({ where: { id: device.id }, data });
    if (device.offline) {
      await emitDeviceUpdated(homeId, updatedDevice.id);
    }
  }
  let synced = 0;
  let statesParsed = false;
  const controlledIds = device ? [device.id] : [];
  if (input.states && input.states.trim()) {
    try {
      const parsed2 = JSON.parse(input.states);
      if (Array.isArray(parsed2)) {
        statesParsed = true;
        if (parsed2.length > 0 && typeof parsed2[0] === "number") {
          if (esp) {
            const mappedDevices = await prisma.device.findMany({ where: { espId: esp.id, homeId } });
            for (let i = 0; i < parsed2.length; i++) {
              const channelNum = i + 1;
              const target = mappedDevices.find((d) => d.channel === channelNum);
              if (target) {
                const targetStatus = parsed2[i] ? "on" : "off";
                const res = await prisma.device.updateMany({
                  where: { id: target.id, homeId },
                  data: { status: targetStatus, lastSeen: /* @__PURE__ */ new Date(), offline: false }
                });
                if (res.count > 0) {
                  synced++;
                  controlledIds.push(target.id);
                  await emitDeviceUpdated(homeId, target.id);
                }
              }
            }
          }
        } else {
          let states = parsed2;
          for (const st of states) {
            if (!st || typeof st.id !== "number" || st.status !== "on" && st.status !== "off") continue;
            const value = typeof st.value === "string" && /^\d+$/.test(st.value) ? st.value : void 0;
            const res = await prisma.device.updateMany({
              where: { id: st.id, homeId },
              data: {
                status: st.status,
                ...value ? { customValue: value } : {},
                lastSeen: /* @__PURE__ */ new Date(),
                offline: false
              }
            });
            if (res.count > 0) {
              synced++;
              controlledIds.push(st.id);
              await emitDeviceUpdated(homeId, st.id);
            }
          }
        }
      }
    } catch {
    }
  }
  if (esp) {
    await prisma.device.updateMany({
      where: { homeId, id: { in: [...new Set(controlledIds)] } },
      data: { espId: esp.id }
    });
    if (statesParsed) {
      await prisma.device.updateMany({
        where: { espId: esp.id, id: { notIn: [...new Set(controlledIds)] } },
        data: { espId: null }
      });
    }
  }
  const { resolveFirmware: resolveFirmware2 } = await Promise.resolve().then(() => (init_firmware_service(), firmware_service_exports));
  const current = await resolveFirmware2(esp?.modelCode);
  const running2 = fw ?? updatedDevice?.firmwareVersion;
  const pendingNow = esp ? esp.otaPendingVersion : device?.otaPendingVersion;
  let ota = null;
  if (pendingNow && current && running2 !== current.version) {
    ota = {
      version: current.version,
      url: baseUrl + current.url,
      releaseNotes: current.releaseNotes,
      required: true
    };
  }
  return {
    device: updatedDevice,
    esp: esp ? { id: esp.id, macAddress: esp.macAddress, name: esp.name, ssid: esp.ssid, serialCode: esp.serialCode, modelCode: esp.modelCode, ipAddress: esp.ipAddress, firmwareVersion: esp.firmwareVersion } : null,
    synced,
    ota
  };
}
async function pendingCommands(key, mac) {
  const commands = await findPendingCommands(key, mac);
  await markHomeAlive(key);
  return commands;
}
async function findPendingCommands(key, mac) {
  const homeId = homeScope(key);
  if (mac) {
    const esp = await prisma.espDevice.findFirst({ where: { homeId, macAddress: mac } });
    if (!esp) return [];
    const devices = await prisma.device.findMany({ where: { espId: esp.id, homeId } });
    const deviceIds = devices.map((d) => d.id);
    const cmds = await prisma.deviceCommand.findMany({
      where: { deviceId: { in: deviceIds }, status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { id: true, deviceId: true, command: true }
    });
    return cmds.map((c) => {
      const dev = devices.find((d) => d.id === c.deviceId);
      return { id: c.id, channel: dev?.channel, command: c.command };
    });
  }
  return prisma.deviceCommand.findMany({
    where: { device: { homeId }, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { id: true, deviceId: true, command: true }
  });
}
async function markHomeAlive(key) {
  const homeId = homeScope(key);
  await prisma.device.updateMany({ where: { homeId }, data: { lastSeen: /* @__PURE__ */ new Date() } }).catch(() => void 0);
}
async function pendingCommandsLongPoll(key, holdMs, signal, mac) {
  const deadline = Date.now() + holdMs;
  let commands = await findPendingCommands(key, mac);
  while (commands.length === 0 && Date.now() < deadline) {
    if (signal?.aborted) break;
    await new Promise((r) => setTimeout(r, 300));
    commands = await findPendingCommands(key, mac);
  }
  await markHomeAlive(key);
  return commands;
}
async function ackCommand(key, commandId, deviceId, status) {
  const homeId = homeScope(key);
  const command = await prisma.deviceCommand.findFirst({
    where: { id: commandId },
    include: { device: true }
  });
  if (!command) {
    throw new AppError("COMMAND_NOT_FOUND", "Command not found", 404);
  }
  if (command.device.homeId !== homeId) {
    throw new AppError("FORBIDDEN", "Command does not belong to this home", 403);
  }
  if (command.status !== "pending") {
    return command;
  }
  const updated = await prisma.deviceCommand.update({
    where: { id: commandId },
    data: { status, executedAt: /* @__PURE__ */ new Date() }
  });
  emitToHome(homeId, "command:updated", { id: commandId, status, executedAt: updated.executedAt });
  return updated;
}

// src/routes/deviceApi.routes.ts
var deviceApiRouter = (0, import_express5.Router)();
var readLimiter = rateLimit({
  name: "device:read",
  windowMs: 6e4,
  max: 1200,
  message: "Too many device API requests"
});
var mutateLimiter = rateLimit({
  name: "device:mutate",
  windowMs: 6e4,
  max: 600,
  message: "Too many device API requests"
});
var keyQuery = import_zod7.z.object({
  api_key: import_zod7.z.string().min(1),
  // Long-poll mode (ESP32 v2 firmware): `long=1&hold=20` — server response ko
  // hold karta hai jab tak command na aaye (max hold seconds). Old firmware
  // bina long=1 ke same instant behaviour paata hai.
  long: import_zod7.z.string().optional(),
  hold: import_zod7.z.string().optional(),
  mac: import_zod7.z.string().optional()
});
var updateSchema2 = import_zod7.z.object({
  api_key: import_zod7.z.string().optional(),
  device_id: import_zod7.z.coerce.number().int().positive().optional(),
  status: import_zod7.z.enum(["on", "off"]),
  mac: import_zod7.z.string().optional(),
  channel: import_zod7.z.coerce.number().int().positive().optional()
});
var ackSchema = import_zod7.z.object({
  api_key: import_zod7.z.string().optional(),
  command_id: import_zod7.z.coerce.number().int().positive(),
  device_id: import_zod7.z.coerce.number().int().positive().optional(),
  status: import_zod7.z.enum(["executed", "failed"])
});
var heartbeatSchema = import_zod7.z.object({
  api_key: import_zod7.z.string().optional(),
  device_id: import_zod7.z.coerce.number().int().positive().optional(),
  ip: import_zod7.z.string().optional(),
  fw_version: import_zod7.z.string().optional(),
  mac: import_zod7.z.string().optional(),
  ssid: import_zod7.z.string().optional(),
  serial: import_zod7.z.string().optional(),
  model: import_zod7.z.string().optional(),
  states: import_zod7.z.string().optional()
});
deviceApiRouter.get(
  "/read-all",
  readLimiter,
  validateQuery(keyQuery),
  requireApiKey,
  async (req, res) => {
    const mac = req.query.mac;
    if (mac) {
      return ok(res, await readAll(req.apiKey, mac));
    }
    return ok(res, { devices: await readAll(req.apiKey) });
  }
);
deviceApiRouter.post(
  "/update",
  mutateLimiter,
  requireApiKey,
  validateBody(updateSchema2),
  async (req, res) => {
    return ok(res, await updateFromDevice(req.apiKey, req.body.device_id, req.body.status, req.body.mac, req.body.channel));
  }
);
deviceApiRouter.post(
  "/heartbeat",
  mutateLimiter,
  requireApiKey,
  validateBody(heartbeatSchema),
  async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    ok(
      res,
      await heartbeat(
        req.apiKey,
        {
          device_id: req.body.device_id,
          ip: req.body.ip,
          fw_version: req.body.fw_version,
          mac: req.body.mac,
          ssid: req.body.ssid,
          serial: req.body.serial,
          model: req.body.model,
          states: req.body.states
        },
        baseUrl
      )
    );
  }
);
var otaProgressSchema = import_zod7.z.object({
  api_key: import_zod7.z.string().optional(),
  device_id: import_zod7.z.coerce.number().int().positive(),
  progress: import_zod7.z.coerce.number().min(0).max(100),
  status: import_zod7.z.string().max(32).optional()
});
deviceApiRouter.post(
  "/ota-progress",
  mutateLimiter,
  requireApiKey,
  validateBody(otaProgressSchema),
  async (req, res) => ok(res, await reportOtaProgress(req.apiKey, {
    device_id: req.body.device_id,
    progress: req.body.progress,
    status: req.body.status
  }))
);
deviceApiRouter.get(
  "/commands",
  validateQuery(keyQuery),
  requireApiKey,
  async (req, res) => {
    const long = req.query.long === "1" || req.query.long === "true";
    const mac = req.query.mac;
    if (!long) {
      return ok(res, { commands: await pendingCommands(req.apiKey, mac) });
    }
    const holdSec = Math.min(25, Math.max(1, Number(req.query.hold) || 20));
    const ac = new AbortController();
    res.on("close", () => ac.abort());
    const commands = await pendingCommandsLongPoll(
      req.apiKey,
      holdSec * 1e3,
      ac.signal,
      mac
    );
    if (!res.headersSent) ok(res, { commands });
  }
);
deviceApiRouter.post(
  "/commands/ack",
  mutateLimiter,
  requireApiKey,
  validateBody(ackSchema),
  async (req, res) => ok(
    res,
    await ackCommand(
      req.apiKey,
      req.body.command_id,
      req.body.device_id,
      req.body.status
    )
  )
);

// src/routes/apiKey.routes.ts
var import_express6 = require("express");
var import_node_crypto6 = __toESM(require("node:crypto"), 1);
var import_zod8 = require("zod");
init_prisma();
var apiKeyRouter = (0, import_express6.Router)();
var createKeyLimiter = rateLimit({
  name: "api-key:create",
  windowMs: 60 * 6e4,
  max: 20,
  message: "Bahut zyada API keys bana rahe ho \u2014 1 ghanta baad try karo"
});
var createSchema3 = import_zod8.z.object({
  label: import_zod8.z.string().min(1).max(100).optional(),
  homeId: import_zod8.z.coerce.number().int().positive().optional(),
  expiresInDays: import_zod8.z.coerce.number().int().positive().max(3650).optional()
});
function hashKey3(raw) {
  return import_node_crypto6.default.createHash("sha256").update(raw).digest("hex");
}
function generateKey() {
  const raw = `rs_${import_node_crypto6.default.randomBytes(24).toString("hex")}`;
  return { raw, prefix: raw.slice(0, 8) };
}
apiKeyRouter.get("/", requireAuth, async (req, res) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.user.sub },
      include: { home: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" }
    });
    ok(res, keys);
  } catch (err) {
    console.error("[apiKey] list failed:", err?.message ?? err);
    ok(res, []);
  }
});
apiKeyRouter.post("/", requireAuth, createKeyLimiter, validateBody(createSchema3), async (req, res) => {
  const { raw, prefix } = generateKey();
  const key = await prisma.apiKey.create({
    data: {
      userId: req.user.sub,
      homeId: req.body.homeId,
      label: req.body.label,
      keyHash: hashKey3(raw),
      keyPrefix: prefix,
      expiresAt: req.body.expiresInDays ? new Date(Date.now() + req.body.expiresInDays * 24 * 60 * 60 * 1e3) : null
    }
  });
  ok(res, { ...key, keyHash: void 0, rawKey: raw }, 201);
});
apiKeyRouter.delete("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.apiKey.findFirst({ where: { id, userId: req.user.sub } });
  if (!existing) throw new AppError("API_KEY_NOT_FOUND", "API key not found", 404);
  try {
    await prisma.apiKey.delete({ where: { id } });
  } catch {
    await prisma.apiKey.update({ where: { id }, data: { revokedAt: /* @__PURE__ */ new Date() } }).catch(() => {
    });
  }
  ok(res, { message: "API key revoked" });
});

// src/routes/room.routes.ts
var import_express7 = require("express");
var import_zod9 = require("zod");

// src/services/room.service.ts
init_prisma();
async function createRoom(homeId, name) {
  const existing = await prisma.room.findUnique({
    where: { homeId_name: { homeId, name } }
  });
  if (existing) throw new AppError("ROOM_EXISTS", "A room with this name already exists", 409);
  return prisma.room.create({ data: { homeId, name } });
}
async function deleteRoom(homeId, roomId) {
  const room = await prisma.room.findFirst({ where: { id: roomId, homeId } });
  if (!room) throw new AppError("ROOM_NOT_FOUND", "Room not found in this home", 404);
  await prisma.room.delete({ where: { id: roomId } });
}
async function listRooms(homeId) {
  return prisma.room.findMany({
    where: { homeId },
    orderBy: { name: "asc" }
  });
}

// src/routes/room.routes.ts
var roomRouter = (0, import_express7.Router)();
var idParams4 = import_zod9.z.object({ homeId: import_zod9.z.coerce.number().int().positive() });
var roomParams = import_zod9.z.object({
  homeId: import_zod9.z.coerce.number().int().positive(),
  roomId: import_zod9.z.coerce.number().int().positive()
});
var createSchema4 = import_zod9.z.object({ name: import_zod9.z.string().min(1).max(100) });
roomRouter.get(
  "/:homeId/rooms",
  requireAuth,
  validateParams(idParams4),
  requireHomeMember("viewer"),
  async (req, res) => ok(res, await listRooms(Number(req.params.homeId)))
);
roomRouter.post(
  "/:homeId/rooms",
  requireAuth,
  validateParams(idParams4),
  requireHomeMember("admin"),
  validateBody(createSchema4),
  async (req, res) => ok(res, await createRoom(Number(req.params.homeId), req.body.name), 201)
);
roomRouter.delete(
  "/:homeId/rooms/:roomId",
  requireAuth,
  validateParams(roomParams),
  requireHomeMember("admin"),
  async (req, res) => {
    await deleteRoom(Number(req.params.homeId), Number(req.params.roomId));
    ok(res, { message: "Room deleted" });
  }
);

// src/routes/schedule.routes.ts
var import_express8 = require("express");
var import_zod10 = require("zod");

// src/services/schedule.service.ts
init_prisma();
init_socket();
function parseField(field, min, max) {
  const values = /* @__PURE__ */ new Set();
  for (const part of field.split(",")) {
    if (part === "*") {
      for (let i = min; i <= max; i++) values.add(i);
      continue;
    }
    let m = part.match(/^\*\/(\d+)$/);
    if (m) {
      const step = Number(m[1]);
      for (let i = min; i <= max; i += step) values.add(i);
      continue;
    }
    m = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const step = Number(m[3] ?? 1);
      for (let i = a; i <= b; i += step) values.add(i);
      continue;
    }
    m = part.match(/^(\d+)$/);
    if (m) {
      values.add(Number(m[1]));
      continue;
    }
    if (/^\d+$/.test(part)) values.add(Number(part) % 7);
  }
  return values;
}
function parseCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new AppError("BAD_REQUEST", "Cron must have 5 fields: minute hour day-of-month month day-of-week");
  }
  const dow = parseField(parts[4], 0, 6);
  if (dow.has(7)) {
    dow.delete(7);
    dow.add(0);
  }
  return {
    minutes: parseField(parts[0], 0, 59),
    hours: parseField(parts[1], 0, 23),
    dom: parseField(parts[2], 1, 31),
    months: parseField(parts[3], 1, 12),
    dow
  };
}
function matches(cron, d) {
  if (!cron.minutes.has(d.getMinutes())) return false;
  if (!cron.hours.has(d.getHours())) return false;
  if (!cron.dom.has(d.getDate())) return false;
  if (!cron.months.has(d.getMonth() + 1)) return false;
  if (!cron.dow.has(d.getDay())) return false;
  return true;
}
function nextCronRun(expr, from) {
  let cron;
  try {
    cron = parseCron(expr);
  } catch {
    return null;
  }
  const t = new Date(from);
  t.setSeconds(0, 0);
  t.setMinutes(t.getMinutes() + 1);
  const end = from.getTime() + 366 * 24 * 60 * 60 * 1e3;
  while (t.getTime() <= end) {
    if (matches(cron, t)) return t;
    t.setMinutes(t.getMinutes() + 1);
  }
  return null;
}
function computeNextRun(input) {
  const from = input.from ?? /* @__PURE__ */ new Date();
  if (input.type === "once") return input.runAt && input.runAt > from ? input.runAt : null;
  if (input.type === "cron") {
    if (!input.cron) return null;
    return nextCronRun(input.cron, from);
  }
  if (!input.runAt) return null;
  const intervalMs = input.type === "daily" ? 24 * 60 * 60 * 1e3 : 7 * 24 * 60 * 60 * 1e3;
  let next = new Date(input.runAt.getTime());
  const maxIterations = 400;
  for (let i = 0; i < maxIterations && next.getTime() <= from.getTime(); i++) {
    next = new Date(next.getTime() + intervalMs);
  }
  return next.getTime() > from.getTime() ? next : null;
}
async function createSchedule(input) {
  const device = await prisma.device.findFirst({
    where: { id: input.deviceId, homeId: input.homeId }
  });
  if (!device) throw new AppError("DEVICE_NOT_FOUND", "Device not found in this home", 404);
  const membership2 = prisma.deviceAccess ? await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId: input.homeId, userId: input.actorId } },
    select: { restricted: true }
  }) : null;
  if (membership2?.restricted && prisma.deviceAccess) {
    const granted = await prisma.deviceAccess.findUnique({
      where: { deviceId_userId: { deviceId: input.deviceId, userId: input.actorId } }
    });
    if (!granted) {
      throw new AppError("FORBIDDEN", "Is device ka access nahi hai (child mode)", 403);
    }
  }
  let runAt = input.runAt ? new Date(input.runAt) : null;
  if (input.type !== "once" && input.type !== "cron" && runAt) {
    const now = /* @__PURE__ */ new Date();
    runAt = computeNextRun({ type: input.type, runAt, cron: null, from: now });
  }
  const nextRun = computeNextRun({ type: input.type, runAt, cron: input.cron ?? null });
  const created = await prisma.schedule.create({
    data: {
      deviceId: input.deviceId,
      createdBy: input.actorId,
      action: input.action,
      type: input.type,
      runAt,
      cron: input.type === "cron" ? input.cron : null,
      nextRun
    }
  });
  emitToHome(input.homeId, "schedule:sync", { scheduleId: created.id, type: "create" });
  return created;
}
async function listSchedules(homeId) {
  const schedules = await prisma.schedule.findMany({
    where: { device: { homeId } },
    include: { device: { select: { id: true, name: true, type: true } } },
    orderBy: [{ enabled: "desc" }, { nextRun: "asc" }]
  });
  return schedules;
}
async function updateSchedule(homeId, scheduleId, actorId, input) {
  const existing = await prisma.schedule.findFirst({
    where: { id: scheduleId, device: { homeId } }
  });
  if (!existing) throw new AppError("NOT_FOUND", "Schedule not found", 404);
  if (existing.createdBy !== actorId) {
    const membership2 = await prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId: actorId } },
      select: { role: true }
    });
    if (!membership2 || membership2.role !== "owner" && membership2.role !== "admin") {
      throw new AppError("FORBIDDEN", "Only the creator or an Admin can modify this routine.", 403);
    }
  }
  const action = input.action ?? existing.action;
  const type = existing.type;
  let runAt = input.runAt !== void 0 ? input.runAt ? new Date(input.runAt) : null : existing.runAt;
  const cron = input.cron !== void 0 ? input.cron : existing.cron;
  const nextRun = input.enabled === false ? existing.nextRun : computeNextRun({ type, runAt, cron, from: /* @__PURE__ */ new Date() });
  const updatedRecord = await prisma.schedule.update({
    where: { id: scheduleId },
    data: { action, runAt, cron, nextRun, enabled: input.enabled ?? existing.enabled }
  });
  emitToHome(homeId, "schedule:sync", { scheduleId, type: "update" });
  return updatedRecord;
}
async function deleteSchedule(homeId, scheduleId, actorId) {
  const existing = await prisma.schedule.findFirst({
    where: { id: scheduleId, device: { homeId } }
  });
  if (!existing) throw new AppError("NOT_FOUND", "Schedule not found", 404);
  if (existing.createdBy !== actorId) {
    const membership2 = await prisma.homeMember.findUnique({
      where: { homeId_userId: { homeId, userId: actorId } },
      select: { role: true }
    });
    if (!membership2 || membership2.role !== "owner" && membership2.role !== "admin") {
      throw new AppError("FORBIDDEN", "Only the creator or an Admin can delete this routine.", 403);
    }
  }
  await prisma.schedule.delete({ where: { id: scheduleId } });
  emitToHome(homeId, "schedule:sync", { scheduleId, type: "delete" });
  return { deleted: true };
}

// src/routes/schedule.routes.ts
var scheduleRouter = (0, import_express8.Router)();
var homeParams = import_zod10.z.object({ homeId: import_zod10.z.coerce.number().int().positive() });
var scheduleParams = import_zod10.z.object({
  homeId: import_zod10.z.coerce.number().int().positive(),
  scheduleId: import_zod10.z.coerce.number().int().positive()
});
var createSchema5 = import_zod10.z.object({
  deviceId: import_zod10.z.number().int().positive(),
  action: import_zod10.z.enum(["on", "off"]),
  type: import_zod10.z.enum(["once", "daily", "weekly", "cron"]),
  runAt: import_zod10.z.string().datetime({ offset: true }).optional().nullable(),
  cron: import_zod10.z.string().regex(/^(\S+\s){4}\S+$/, "Cron must have 5 fields: minute hour day-of-month month day-of-week").optional().nullable()
});
var updateSchema3 = import_zod10.z.object({
  action: import_zod10.z.enum(["on", "off"]).optional(),
  enabled: import_zod10.z.boolean().optional(),
  runAt: import_zod10.z.string().datetime({ offset: true }).optional().nullable(),
  cron: import_zod10.z.string().regex(/^(\S+\s){4}\S+$/, "Cron must have 5 fields").optional().nullable()
}).refine((d) => Object.keys(d).length > 0, "At least one field to update is required");
scheduleRouter.post(
  "/:homeId/schedules",
  requireAuth,
  validateParams(homeParams),
  requireHomeMember("member"),
  validateBody(createSchema5),
  async (req, res) => {
    const { deviceId, action, type, runAt, cron } = req.body;
    const schedule = await createSchedule({
      homeId: Number(req.params.homeId),
      actorId: req.user.sub,
      deviceId,
      action,
      type,
      runAt,
      cron: type === "cron" ? cron : null
    });
    ok(res, schedule, 201);
  }
);
scheduleRouter.get(
  "/:homeId/schedules",
  requireAuth,
  validateParams(homeParams),
  requireHomeMember("viewer"),
  async (req, res) => {
    ok(res, await listSchedules(Number(req.params.homeId)));
  }
);
scheduleRouter.patch(
  "/:homeId/schedules/:scheduleId",
  requireAuth,
  validateParams(scheduleParams),
  requireHomeMember("member"),
  validateBody(updateSchema3),
  async (req, res) => {
    const updated = await updateSchedule(
      Number(req.params.homeId),
      Number(req.params.scheduleId),
      req.user.sub,
      req.body
    );
    ok(res, updated);
  }
);
scheduleRouter.delete(
  "/:homeId/schedules/:scheduleId",
  requireAuth,
  validateParams(scheduleParams),
  requireHomeMember("member"),
  async (req, res) => {
    await deleteSchedule(Number(req.params.homeId), Number(req.params.scheduleId), req.user.sub);
    ok(res, { message: "Schedule deleted" });
  }
);

// src/routes/notification.routes.ts
var import_express9 = require("express");
var import_zod11 = require("zod");
init_notification_service();
var notificationRouter = (0, import_express9.Router)();
notificationRouter.get("/", requireAuth, async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  const category = String(req.query.category ?? "all");
  const type = String(req.query.type ?? "all");
  const unread = req.query.unread === "1" || req.query.unread === "true";
  ok(
    res,
    await listNotifications(req.user.sub, { page, pageSize, category, type, unread })
  );
});
notificationRouter.get("/unread-count", requireAuth, async (req, res) => {
  ok(res, await unreadCount(req.user.sub));
});
notificationRouter.post("/read-all", requireAuth, async (req, res) => {
  ok(res, await markAllRead(req.user.sub));
});
var idParams5 = import_zod11.z.object({ id: import_zod11.z.coerce.number().int().positive() });
notificationRouter.post("/:id/read", requireAuth, validateParams(idParams5), async (req, res) => {
  ok(res, await markRead(req.user.sub, Number(req.params.id)));
});
notificationRouter.delete("/delete-all", requireAuth, async (req, res) => {
  ok(res, await removeAll(req.user.sub));
});
notificationRouter.delete("/:id", requireAuth, validateParams(idParams5), async (req, res) => {
  ok(res, await remove2(req.user.sub, Number(req.params.id)));
});

// src/routes/assistant.routes.ts
var import_express10 = require("express");
var import_zod12 = require("zod");
init_prisma();

// src/services/assistant.service.ts
init_prisma();
init_audit_service();

// src/lib/ai.ts
init_env();
init_crypto();
init_siteSettings_service();
var DEFAULT_BASE_URLS = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  ollama: "http://localhost:11434/v1"
};
function envAiConfig() {
  const provider = (env.AI_PROVIDER || "").trim().toLowerCase();
  const configured = Boolean(provider && env.AI_MODEL);
  return {
    provider,
    apiKey: env.AI_API_KEY?.trim() ?? "",
    baseUrl: (env.AI_BASE_URL?.trim() || DEFAULT_BASE_URLS[provider] || "").replace(/\/$/, ""),
    model: env.AI_MODEL?.trim() ?? "",
    ...configured ? {} : { provider: "", model: "" }
  };
}
async function getAiConfig() {
  let db = {};
  try {
    const s = await getSiteSettings();
    if (s.aiProvider) {
      let apiKey = "";
      if (s.aiApiKey) {
        try {
          apiKey = decryptSecret(s.aiApiKey);
        } catch {
          apiKey = s.aiApiKey;
        }
      }
      db = { provider: s.aiProvider, apiKey, baseUrl: s.aiBaseUrl, model: s.aiModel };
    }
  } catch {
  }
  const cfg = { ...envAiConfig(), ...db };
  const configured = Boolean(cfg.provider && cfg.model);
  if (!configured) {
    return { provider: "", apiKey: "", baseUrl: "", model: "" };
  }
  return {
    ...cfg,
    provider: cfg.provider.trim().toLowerCase(),
    baseUrl: (cfg.baseUrl.trim() || DEFAULT_BASE_URLS[cfg.provider] || "").replace(/\/$/, "")
  };
}
async function aiConfigured() {
  const c = await getAiConfig();
  return Boolean(c.provider && c.model && c.baseUrl);
}
async function chatCompletion(opts) {
  const cfg = await getAiConfig();
  if (!cfg.provider || !cfg.model || !cfg.baseUrl) {
    throw new Error("AI not configured (AI_PROVIDER/AI_MODEL)");
  }
  if (cfg.provider !== "ollama" && !cfg.apiKey) {
    throw new Error(`AI provider "${cfg.provider}" ke liye AI_API_KEY chahiye`);
  }
  const timeoutMs = opts.timeoutMs ?? 25e3;
  const controller = new AbortController();
  const timer4 = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "system", content: opts.system }, ...opts.messages],
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 500
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`LLM API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    if (data.error?.message) throw new Error(`LLM error: ${data.error.message}`);
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM: empty response");
    return content.trim();
  } finally {
    clearTimeout(timer4);
  }
}

// src/services/assistant.service.ts
var ON_PATTERNS = [
  /\b(turn\s+)?on\b/,
  /\bstart\b/,
  /\bchalu\b/,
  /\bjalao\b/,
  /\bopen\b/,
  /\bkholo\b/
];
var OFF_PATTERNS = [
  /\b(turn\s+)?off\b/,
  /\bstop\b/,
  /\bband\b/,
  /\bbujhao\b/,
  /\bclose\b/,
  /\bband karo\b/
];
var ALL_PATTERNS = [/\ball\b/, /\bsab\b/, /\bsabhi\b/, /\bsaare\b/, /\beverything\b/, /\bhar ek\b/];
var TYPE_KEYWORDS = [
  { types: ["fan"], words: /\bfan\b|\bpankh/ },
  { types: ["bulb", "light"], words: /\blight|\bbulb\b|\blamp\b|\bdiya\b/ },
  { types: ["tv"], words: /\btv\b|\btelevision\b/ },
  { types: ["ac"], words: /\bac\b|\bair\s*condition|\bcooler\b/ },
  { types: ["plug"], words: /\bplug\b|\bsocket\b/ }
];
function detectAction(text) {
  const lower = text.toLowerCase();
  const hasOn = ON_PATTERNS.some((r) => r.test(lower));
  const hasOff = OFF_PATTERNS.some((r) => r.test(lower));
  if (hasOn && hasOff) return null;
  if (hasOn) return "on";
  if (hasOff) return "off";
  return null;
}
function isAllRequest(text) {
  const lower = text.toLowerCase();
  return ALL_PATTERNS.some((r) => r.test(lower));
}
function matchedTypes(text) {
  const lower = text.toLowerCase();
  const found = /* @__PURE__ */ new Set();
  for (const t of TYPE_KEYWORDS) {
    if (t.words.test(lower)) for (const ty of t.types) found.add(ty);
  }
  return [...found];
}
function parseIntent(enhancedText, currentText, rawDevices) {
  const action = detectAction(currentText);
  const lower = enhancedText.toLowerCase();
  const all = isAllRequest(enhancedText);
  const types = matchedTypes(enhancedText);
  const roomNames = new Set(rawDevices.map((d) => d.room?.name).filter(Boolean));
  let targetRoom = null;
  for (const r of roomNames) {
    if (lower.includes(r.toLowerCase())) {
      targetRoom = r;
      break;
    }
  }
  const devices = targetRoom ? rawDevices.filter((d) => d.room?.name === targetRoom) : rawDevices;
  let matches2 = [];
  if (all && types.length === 0) {
    matches2 = devices;
  } else {
    for (const d of devices) {
      if (lower.includes(d.name.toLowerCase())) matches2.push(d);
    }
    if (types.length > 0) {
      for (const d of devices) {
        if (types.includes(d.type) && !matches2.includes(d)) matches2.push(d);
      }
    }
  }
  return {
    action,
    actions: action ? matches2.map((d) => ({ deviceId: d.id, deviceName: d.name, action })) : [],
    matchedBy: (targetRoom ? `room:${targetRoom},` : "") + (types.length > 0 ? `type:${types.join(",")}` : all ? "all" : matches2.length > 0 ? "name" : "none")
  };
}
async function createChat(userId, homeId, title) {
  const existing = await prisma.assistantChat.findFirst({
    where: { userId, homeId }
  });
  if (existing) return existing;
  const home = await prisma.home.findUnique({ where: { id: homeId } });
  return prisma.assistantChat.create({
    data: { userId, homeId, title: title?.trim() || (home ? `${home.name} AI` : "AI Assist") }
  });
}
async function listChats(userId) {
  return prisma.assistantChat.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20
  });
}
async function getChat(userId, chatId) {
  return prisma.assistantChat.findFirst({ where: { id: chatId, userId } });
}
async function listMessages(chatId) {
  return prisma.assistantMessage.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" }
  });
}
function encodeAssistantContent(text, proposal) {
  return JSON.stringify({ text, proposal });
}
function decodeAssistantContent(content) {
  try {
    const parsed2 = JSON.parse(content);
    return { text: parsed2.text ?? content, proposal: parsed2.proposal ?? null };
  } catch {
    return { text: content, proposal: null };
  }
}
var STATUS_PATTERNS = [
  /\bstatus\b/,
  /\bstates?\b/,
  /\bkya (haal|hal)\b/,
  /\bkaise (hai|hain)\b/,
  /\bcheck\b/,
  /\bcondition\b/,
  /\bkaun se (on|chalu)\b/,
  /\bwhich.*(on|chalu)\b/,
  /\bsab (on|off|chalu|band)\b/,
  /\bkitne (on|chalu)\b/
];
var TROUBLE_PATTERNS = [
  /\bkaam nahi (kar raha|kar rahi)\b/,
  /\bnahi (chal|chalu|khul|khuli|ja raha|ho raha)\b/,
  /\bnot (working|turning|responding)\b/,
  /\bproblem\b/,
  /\bissue\b/,
  /\bkharab\b/,
  /\bgadbad\b/,
  /\btrouble\b/,
  /\bbroken\b/,
  /\bkyu(n)?\b.*\bnahi\b/,
  /\bwhy.*(not|isn.t)\b/,
  /\bmadad\b/
];
var ONLINE_PATTERNS = [/online/, /offline/, /connected/, /zinda/, /available/];
function detectQueryType(text) {
  const lower = text.toLowerCase();
  if (TROUBLE_PATTERNS.some((r) => r.test(lower))) return "troubleshoot";
  if (STATUS_PATTERNS.some((r) => r.test(lower)) || ONLINE_PATTERNS.some((r) => r.test(lower))) return "status";
  return null;
}
function fmtRelative(ts) {
  if (!ts) return "kabhi nahi";
  const mins = Math.floor((Date.now() - ts.getTime()) / 6e4);
  if (mins < 1) return "abhi";
  if (mins < 60) return `${mins} min pehle`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ghante pehle`;
  return `${Math.floor(hrs / 24)} din pehle`;
}
function deviceOnline(d) {
  if (d.offline) return false;
  if (!d.lastSeen) return false;
  return Date.now() - d.lastSeen.getTime() < 24 * 60 * 60 * 1e3;
}
function buildStatusReply(devices, content) {
  const lower = content.toLowerCase();
  const matched = devices.filter((d) => lower.includes(d.name.toLowerCase()));
  const list4 = matched.length > 0 ? matched : devices;
  const lines = list4.map((d) => {
    const st = d.status === "on" ? "ON \u2705" : "OFF";
    const conn = deviceOnline(d) ? "online" : "offline \u26A0\uFE0F";
    return `\u2022 ${d.name} \u2014 ${st} (${conn}, last seen ${fmtRelative(d.lastSeen)})`;
  });
  const header = matched.length > 0 ? `\u{1F4CA} "${content.trim()}" ka status:` : `\u{1F4CA} Tumhare home ke devices ka status:`;
  return `${header}
${lines.join(String.fromCharCode(10))}

Kisi device ki problem ho to bolo \u2014 jaise "bulb kyu kaam nahi kar raha".`;
}
function buildTroubleshootReply(devices, content) {
  const lower = content.toLowerCase();
  const matched = devices.filter((d) => lower.includes(d.name.toLowerCase()));
  const target = matched.length > 0 ? matched : devices;
  const parts = [];
  for (const d of target) {
    const pending = d._count?.commands ?? 0;
    parts.push(`\u{1F527} ${d.name}:`);
    parts.push(`  \u2022 Status: ${d.status.toUpperCase()}`);
    parts.push(`  \u2022 Connection: ${deviceOnline(d) ? "ONLINE" : "OFFLINE \u26A0\uFE0F"} (last seen ${fmtRelative(d.lastSeen)})`);
    if (d.firmwareVersion) parts.push(`  \u2022 Firmware: ${d.firmwareVersion}`);
    if (d.ipAddress) parts.push(`  \u2022 Board IP: ${d.ipAddress}`);
    parts.push(`  \u2022 Pending commands: ${pending}`);
    if (!deviceOnline(d)) {
      parts.push(`  \u2192 ${d.name} board se connected NAHI hai.`);
      parts.push(`    Fix: (1) Board ka power check karo (USB/adapter)  (2) WiFi router on hai?  (3) Board reboot karo`);
    } else if (pending > 0) {
      parts.push(`  \u2192 Kuch commands atki hui hain (pending queue).`);
      parts.push(`    Fix: (1) 5-10 sec wait karo \u2014 board har 5s poll karta hai  (2) fir bhi na ho to support se "clear stuck commands" karwao`);
    } else if (d.status === "on") {
      parts.push(`  \u2192 Device ON dikh raha hai par kaam nahi kar raha?`);
      parts.push(`    Fix: (1) wiring/connection check karo  (2) kisi dusre device se relay test karo`);
    } else {
      parts.push(`  \u2192 Device OFF hai. Pehle ON karo \u2014 "ON karo" bolo ya dashboard se toggle karo.`);
    }
  }
  return parts.join(String.fromCharCode(10)) + `

Aur madad chahiye? Board level ki details ke liye admin/support se baat karo.`;
}
function buildDeviceContext(devices) {
  return devices.map((d) => `- id=${d.id} name="${d.name}" type=${d.type} status=${d.status}`).join("\n");
}
var LLM_SYSTEM_PROMPT = `Tu SwitchNest ka AI assistant hai \u2014 smart-home device control + chat helper.
Reply Hinglish me do (Roman Hindi + thoda English), chhota aur friendly.

Home ke devices (sirf inhi ids use karo):
{devices}

Rules:
1. Agar user device ON/OFF karna chahta hai to SIRF ye JSON format do (koi aur text nahi, code fence bhi nahi):
{"actions":[{"deviceId":1,"action":"on"}],"reply":"<chhota confirm message>"}
   - Device name/type se sahi id match karo (case-insensitive).
   - Group request ("saare lights", "all fans") me saare matching devices ke actions do.
   - Action sirf "on" ya "off" ho sakta hai.
2. Agar user sirf sawaal/puchta hai (help, status, baat-cheet) to seedha normal reply do \u2014 bina JSON.
3. Kabhi bhi devices list me na ho to us device ka action mat do \u2014 reply me bata do ki device nahi mila.`;
function extractJsonObject(text) {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed2 = JSON.parse(cleaned.slice(start, end + 1));
    return parsed2 && typeof parsed2 === "object" ? parsed2 : null;
  } catch {
    return null;
  }
}
function parseLlmActions(raw, devices) {
  const reply = typeof raw.reply === "string" ? raw.reply.trim() : "";
  const actionsRaw = Array.isArray(raw.actions) ? raw.actions : [];
  const deviceMap = new Map(devices.map((d) => [d.id, d]));
  const actions = [];
  for (const a of actionsRaw) {
    const o = a;
    const deviceId = Number(o.deviceId);
    const device = deviceMap.get(deviceId);
    if (!device) continue;
    if (o.action !== "on" && o.action !== "off") continue;
    actions.push({ deviceId, deviceName: device.name, action: o.action });
  }
  return { reply: reply || (actions.length ? "Confirm karo to execute ho jayega." : ""), actions };
}
async function tryLlmReply(content, devices, products) {
  if (!await aiConfigured()) return null;
  try {
    const raw = await chatCompletion({
      system: LLM_SYSTEM_PROMPT.replace("{devices}", buildDeviceContext(devices) || "(koi device nahi)"),
      messages: [{ role: "user", content }],
      maxTokens: 400
    });
    const json = extractJsonObject(raw);
    if (json) {
      const parsed2 = parseLlmActions(json, devices);
      if (parsed2 && parsed2.actions.length > 0) {
        return { content: parsed2.reply, proposal: parsed2.actions };
      }
      if (parsed2 && parsed2.reply) {
        return { content: parsed2.reply, proposal: null };
      }
      return null;
    }
    return { content: raw, proposal: null };
  } catch (err) {
    console.error("[assistant] LLM failed \u2014 rule-based fallback:", err instanceof Error ? err.message : err);
    return null;
  }
}
async function sendMessage(userId, chatId, content, replyToMessageId) {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new AppError("NOT_FOUND", "Chat not found", 404);
  const userMessage = await prisma.assistantMessage.create({
    data: { chatId, role: "user", content }
  });
  const devices = await prisma.device.findMany({
    where: { homeId: chat.homeId },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      lastSeen: true,
      offline: true,
      ipAddress: true,
      firmwareVersion: true,
      room: { select: { id: true, name: true } },
      _count: { select: { commands: { where: { status: "pending" } } } }
    }
  });
  const products = await prisma.product.findMany({ where: { active: true }, select: { id: true, name: true, modelCode: true, relayCount: true, price: true, stockCount: true } });
  let enhancedContent = content;
  if (replyToMessageId) {
    const repliedMsg = await prisma.assistantMessage.findUnique({ where: { id: replyToMessageId } });
    if (repliedMsg) {
      enhancedContent = `(Context: The user is replying to a previous message: "${repliedMsg.content}")
User says: ${content}`;
    }
  }
  const queryType = detectQueryType(enhancedContent);
  if (queryType) {
    const replyText2 = queryType === "troubleshoot" ? buildTroubleshootReply(devices, enhancedContent) : buildStatusReply(devices, enhancedContent);
    const assistantMessage2 = await prisma.assistantMessage.create({
      data: { chatId, role: "assistant", content: encodeAssistantContent(replyText2, null) }
    });
    if (chat.title === "AI Assist" && content.trim().length > 0) {
      await prisma.assistantChat.update({
        where: { id: chat.id },
        data: { title: content.trim().slice(0, 60) }
      });
    }
    return { chat, userMessage, assistantMessage: { ...assistantMessage2, content: replyText2, proposal: null } };
  }
  const llm = await tryLlmReply(enhancedContent, devices, products);
  if (llm) {
    const assistantMessage2 = await prisma.assistantMessage.create({
      data: { chatId, role: "assistant", content: encodeAssistantContent(llm.content, llm.proposal) }
    });
    if (chat.title === "AI Assist" && content.trim().length > 0) {
      await prisma.assistantChat.update({
        where: { id: chat.id },
        data: { title: content.trim().slice(0, 60) }
      });
    }
    return {
      chat,
      userMessage,
      assistantMessage: { ...assistantMessage2, content: llm.content, proposal: llm.proposal }
    };
  }
  const parsed2 = parseIntent(enhancedContent, content, devices);
  let replyText;
  let proposal = null;
  if (!parsed2.action) {
    replyText = 'Mujhe samajh nahi aaya ki device ON karni hai ya OFF. Kuch aise bolo:\n\u2022 "turn on the fan" / "pankha chalu karo"\n\u2022 "turn off all lights" / "saare bulbs band karo"\n\u2022 "TV on karo"';
  } else if (parsed2.actions.length === 0) {
    replyText = 'Mujhe koi device nahi mili is home me jo tumhari baat se match kare. Device ka naam batao (jaise PANKHA, TV, Bulb) ya "all devices" bolo.';
  } else {
    proposal = parsed2.actions;
    const labels = parsed2.actions.map((a) => `${a.deviceName} (${a.action.toUpperCase()})`);
    replyText = `Main in devices ko ${parsed2.action.toUpperCase()} kar dunga:
\u2022 ${labels.join(
      "\n\u2022 "
    )}

Confirm karo to execute ho jayega.`;
  }
  const assistantMessage = await prisma.assistantMessage.create({
    data: { chatId, role: "assistant", content: encodeAssistantContent(replyText, proposal) }
  });
  if (chat.title === "AI Assist" && content.trim().length > 0) {
    await prisma.assistantChat.update({
      where: { id: chat.id },
      data: { title: content.trim().slice(0, 60) }
    });
  }
  return { chat, userMessage, assistantMessage: { ...assistantMessage, content: replyText, proposal } };
}
async function confirmProposal(userId, chatId, messageId) {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new AppError("NOT_FOUND", "Chat not found", 404);
  const message = await prisma.assistantMessage.findFirst({
    where: { id: messageId, chatId, role: "assistant" }
  });
  if (!message) throw new AppError("NOT_FOUND", "Proposal message not found", 404);
  const { proposal } = decodeAssistantContent(message.content);
  if (!proposal || proposal.length === 0) {
    throw new AppError("BAD_REQUEST", "This message has no executable proposal", 400);
  }
  const results = [];
  for (const p of proposal) {
    try {
      await setDeviceStatus({ homeId: chat.homeId, deviceId: p.deviceId, actorId: userId, status: p.action });
      results.push({ deviceId: p.deviceId, deviceName: p.deviceName, action: p.action, ok: true });
    } catch (err) {
      results.push({
        deviceId: p.deviceId,
        deviceName: p.deviceName,
        action: p.action,
        ok: false,
        error: err instanceof Error ? err.message : "failed"
      });
    }
  }
  const done = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  let replyText = `\u2705 ${done} device(s) ${results[0]?.action.toUpperCase() ?? ""} ho gaye: ${results.filter((r) => r.ok).map((r) => r.deviceName).join(", ")}.`;
  if (failed.length > 0) {
    replyText += `
\u274C Failed: ${failed.map((r) => `${r.deviceName} (${r.error})`).join(", ")}`;
  }
  const assistantMessage = await prisma.assistantMessage.create({
    data: { chatId, role: "assistant", content: encodeAssistantContent(replyText, null) }
  });
  await audit(userId, "assistant.execute", {
    homeId: chat.homeId,
    entity: "assistant",
    entityId: chat.id,
    meta: { results }
  });
  return { results, assistantMessage: { ...assistantMessage, content: replyText, proposal: null } };
}

// src/routes/assistant.routes.ts
var assistantRouter = (0, import_express10.Router)();
var chatCreateLimiter = rateLimit({
  name: "assistant:create",
  windowMs: 60 * 6e4,
  max: 30,
  message: "Bahut zyada chats \u2014 1 ghanta baad try karo"
});
var messageLimiter = rateLimit({
  name: "assistant:message",
  windowMs: 6e4,
  max: 20,
  message: "Bahut fast messages \u2014 thodi der ruk kar bhejo"
});
var confirmLimiter = rateLimit({
  name: "assistant:confirm",
  windowMs: 6e4,
  max: 30,
  message: "Bahut zyada confirm requests \u2014 thodi der baad try karo"
});
var chatParams = import_zod12.z.object({ chatId: import_zod12.z.coerce.number().int().positive() });
var createSchema6 = import_zod12.z.object({
  homeId: import_zod12.z.number().int().positive(),
  title: import_zod12.z.string().max(100).optional()
});
var messageSchema = import_zod12.z.object({ content: import_zod12.z.string().min(1).max(2e3), replyToMessageId: import_zod12.z.number().int().positive().optional() });
var confirmSchema = import_zod12.z.object({ messageId: import_zod12.z.number().int().positive() });
async function membership(userId, homeId) {
  return prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId } }
  });
}
assistantRouter.post("/chats", chatCreateLimiter, requireAuth, validateBody(createSchema6), async (req, res) => {
  const { homeId, title } = req.body;
  const member = await membership(req.user.sub, homeId);
  if (!member) {
    return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not a member of this home" } });
  }
  ok(res, await createChat(req.user.sub, homeId, title), 201);
});
assistantRouter.get("/chats", requireAuth, async (req, res) => {
  ok(res, await listChats(req.user.sub));
});
assistantRouter.post(
  "/chats/:chatId/messages",
  messageLimiter,
  requireAuth,
  validateParams(chatParams),
  validateBody(messageSchema),
  async (req, res) => {
    const result = await sendMessage(req.user.sub, Number(req.params.chatId), req.body.content, req.body.replyToMessageId);
    const member = await membership(req.user.sub, result.chat.homeId);
    if (!member) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not a member of this home" } });
    }
    ok(res, result);
  }
);
assistantRouter.post(
  "/chats/:chatId/confirm",
  confirmLimiter,
  requireAuth,
  validateParams(chatParams),
  validateBody(confirmSchema),
  async (req, res) => {
    const chat = await getChat(req.user.sub, Number(req.params.chatId));
    if (!chat) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Chat not found" } });
    }
    const member = await membership(req.user.sub, chat.homeId);
    if (!member) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not a member of this home" } });
    }
    ok(res, await confirmProposal(req.user.sub, Number(req.params.chatId), req.body.messageId));
  }
);
assistantRouter.get("/chats/:chatId/messages", requireAuth, validateParams(chatParams), async (req, res) => {
  const chat = await getChat(req.user.sub, Number(req.params.chatId));
  if (!chat) {
    return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Chat not found" } });
  }
  const messages = await listMessages(chat.id);
  ok(
    res,
    messages.map((m) => {
      if (m.role !== "assistant") return m;
      const { text, proposal } = decodeAssistantContent(m.content);
      return { ...m, content: text, proposal };
    })
  );
});

// src/routes/admin.routes.ts
var import_express11 = require("express");
var import_zod13 = require("zod");
var import_multer2 = __toESM(require("multer"), 1);
var import_node_path4 = __toESM(require("node:path"), 1);
var import_node_fs4 = __toESM(require("node:fs"), 1);
var import_node_child_process = require("node:child_process");
init_prisma();

// src/lib/healthMonitor.ts
var fs7 = __toESM(require("fs"), 1);
var path7 = __toESM(require("path"), 1);
init_logger();

// src/lib/dbState.ts
var ready = true;
function setDbReady(value) {
  ready = value;
}
function isDbReady() {
  return ready;
}

// src/lib/healthMonitor.ts
var CHECK_INTERVAL_MS = 3e4;
var INCIDENT_THRESHOLD = 2;
var FETCH_TIMEOUT_MS = 1e4;
var lastSeenHost = null;
var startedAt = Date.now();
var lastCheck = null;
var checksTotal = 0;
var checksOk = 0;
var failStreak = 0;
var checking = false;
var activeIncident = null;
function hcFile() {
  if (!logFilePath) return null;
  return path7.join(path7.dirname(logFilePath), "health-check.jsonl");
}
function append(ev) {
  const f = hcFile();
  if (!f) return;
  try {
    fs7.appendFileSync(f, JSON.stringify(ev) + "\n");
  } catch {
  }
}
function setLastSeenHost(host) {
  if (!host) return;
  const h = host.toLowerCase();
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)/.test(h)) return;
  if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(h)) return;
  if (/^[a-z0-9.-]+(:\d+)?$/i.test(h)) lastSeenHost = host;
}
function adoptOpenIncident() {
  const f = hcFile();
  if (!f || !fs7.existsSync(f)) return;
  try {
    const lines = fs7.readFileSync(f, "utf8").split("\n").filter(Boolean).slice(-200);
    let open = null;
    for (const l of lines) {
      try {
        const e = JSON.parse(l);
        if (e.type === "incident_start") open = e;
        else if (e.type === "incident_end" && open && e.id === open.id) open = null;
      } catch {
      }
    }
    if (open) {
      activeIncident = {
        id: open.id,
        startedAt: open.ts,
        lastStatus: open.lastStatus ?? null,
        lastErr: open.lastErr ?? null
      };
    }
  } catch {
  }
}
async function checkOnce() {
  checking = true;
  const t0 = Date.now();
  let ok2 = false;
  let status = null;
  let err = null;
  if (lastSeenHost) {
    const ctrl = new AbortController();
    const timer4 = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`https://${lastSeenHost}/api/health`, {
        signal: ctrl.signal,
        headers: { "user-agent": "SwitchNestHealthMonitor/1.0" }
      });
      status = res.status;
      ok2 = res.status === 200;
      if (!ok2) err = `status_${res.status}`;
    } catch (e) {
      const anyErr = e;
      err = anyErr?.name === "AbortError" ? "timeout" : String(anyErr?.cause?.code || anyErr?.name || e);
      ok2 = false;
    } finally {
      clearTimeout(timer4);
    }
  } else {
    ok2 = isDbReady();
    status = ok2 ? 200 : 503;
    err = ok2 ? null : "db_not_ready";
  }
  const ms = Date.now() - t0;
  checking = false;
  checksTotal++;
  if (ok2) checksOk++;
  const ev = { ts: (/* @__PURE__ */ new Date()).toISOString(), type: "check", ok: ok2, status, ms: Math.round(ms), err };
  append(ev);
  lastCheck = { ts: ev.ts, ok: ok2, status, ms: Math.round(ms), err };
  if (!ok2) {
    failStreak++;
    if (failStreak >= INCIDENT_THRESHOLD && !activeIncident) {
      activeIncident = { id: `${Date.now()}`, startedAt: ev.ts, lastStatus: status, lastErr: err };
      append({
        ts: ev.ts,
        type: "incident_start",
        id: activeIncident.id,
        failCount: failStreak,
        lastStatus: status,
        lastErr: err
      });
    }
  } else if (activeIncident) {
    const durSec = Math.round((Date.now() - Date.parse(activeIncident.startedAt)) / 1e3);
    append({ ts: ev.ts, type: "incident_end", id: activeIncident.id, durationSec: durSec, recoveredStatus: status });
    activeIncident = null;
    failStreak = 0;
  }
}
function startHealthMonitor() {
  try {
    const envUrl = process.env.PUBLIC_SITE_URL;
    if (envUrl) {
      const u = new URL(envUrl);
      if (u.host) setLastSeenHost(u.host);
    }
  } catch {
  }
  adoptOpenIncident();
  checkOnce().catch(() => void 0);
  setInterval(() => {
    checkOnce().catch(() => void 0);
  }, CHECK_INTERVAL_MS);
}
function getHealthMonitorState() {
  const incidents2 = [];
  const f = hcFile();
  if (f && fs7.existsSync(f)) {
    try {
      const lines = fs7.readFileSync(f, "utf8").split("\n").filter(Boolean).slice(-500);
      for (const l of lines) {
        try {
          const e = JSON.parse(l);
          if (e.type === "incident_start" || e.type === "incident_end") incidents2.push(e);
        } catch {
        }
      }
    } catch {
    }
  }
  const ends = /* @__PURE__ */ new Map();
  for (const e of incidents2) {
    if (e.type === "incident_end") {
      const endEv = e;
      ends.set(e.id, { ts: e.ts, durationSec: endEv.durationSec ?? 0, recoveredStatus: endEv.recoveredStatus });
    }
  }
  const paired = [];
  for (const e of incidents2) {
    if (e.type === "incident_start") {
      paired.push({ ...e, end: ends.get(e.id) ?? null });
    }
  }
  paired.reverse();
  return {
    running: true,
    intervalSec: CHECK_INTERVAL_MS / 1e3,
    startedAt: new Date(startedAt).toISOString(),
    lastCheck,
    checksTotal,
    checksOk,
    successRate: checksTotal ? Number((checksOk / checksTotal * 100).toFixed(1)) : null,
    activeIncident,
    checking,
    incidents: paired.slice(0, 20)
  };
}

// src/lib/leakMonitor.ts
var fs8 = __toESM(require("fs"), 1);
var path8 = __toESM(require("path"), 1);
init_logger();
var CHECK_INTERVAL_MS2 = 6e4;
var LEAK_WINDOW_MS = 4 * 36e5;
var LEAK_MIN_SPAN_MS = 30 * 6e4;
var LEAK_STALE_MS = 2 * 6e4;
var LEAK_THRESHOLD_PCT = 20;
var TAIL_MAX = 5 * 1024 * 1024;
var startedAt2 = Date.now();
var lastCheckedAt = null;
var activeLeak = null;
var incidents = [];
function incidentFile() {
  if (!logFilePath) return null;
  return path8.join(path8.dirname(logFilePath), "leak-incidents.jsonl");
}
function append2(ev) {
  const f = incidentFile();
  if (!f) return;
  try {
    fs8.appendFileSync(f, JSON.stringify(ev) + "\n");
  } catch {
  }
}
function loadIncidents() {
  const f = incidentFile();
  if (!f || !fs8.existsSync(f)) return;
  try {
    const lines = fs8.readFileSync(f, "utf8").split("\n").filter(Boolean).slice(-500);
    const evs = [];
    for (const l of lines) {
      try {
        evs.push(JSON.parse(l));
      } catch {
      }
    }
    incidents = evs.slice(-200);
    for (const e of evs) {
      if (e.type === "leak_start") {
        activeLeak = {
          pid: Number(e.pid),
          growthPct: Number(e.growthPct ?? 0),
          spanH: Number(e.spanH ?? 0),
          rssFirst: Number(e.rssFirst ?? 0),
          rssLast: Number(e.rssLast ?? 0),
          firstTs: String(e.firstTs ?? e.ts ?? ""),
          lastTs: String(e.lastTs ?? e.ts ?? "")
        };
      } else if (e.type === "leak_end") {
        activeLeak = null;
      }
    }
    if (activeLeak) {
      const pid = activeLeak.pid;
      const alive = readHeartbeatPoints().some((p) => p.pid === pid && Date.now() - p.ts < LEAK_STALE_MS);
      if (!alive) activeLeak = null;
    }
  } catch {
  }
}
function readHeartbeatPoints() {
  if (!logFilePath || !fs8.existsSync(logFilePath)) return [];
  try {
    const st = fs8.statSync(logFilePath);
    if (st.size <= 0) return [];
    const start = Math.max(0, st.size - TAIL_MAX);
    const len = st.size - start;
    const fd = fs8.openSync(logFilePath, "r");
    const buf = Buffer.alloc(len);
    fs8.readSync(fd, buf, 0, len, start);
    fs8.closeSync(fd);
    const text = buf.toString("utf8");
    const re = /\[hb\] alive ts=([\d:.TZ-]+) uptime=(\d+)s pid=(\d+) rss=(\d+)MB(?: heap=(\d+)MB)?/g;
    const points = [];
    let m;
    while (m = re.exec(text)) {
      const t = Date.parse(m[1]);
      if (Number.isNaN(t)) continue;
      points.push({ ts: t, pid: Number(m[3]), rss: Number(m[4]) });
    }
    return points;
  } catch {
    return [];
  }
}
function detectLeak() {
  const points = readHeartbeatPoints();
  if (points.length < 2) return null;
  const byPid = /* @__PURE__ */ new Map();
  for (const p of points) {
    const arr = byPid.get(p.pid) || [];
    arr.push({ ts: p.ts, rss: p.rss });
    byPid.set(p.pid, arr);
  }
  let worst = null;
  for (const [pid, pts] of byPid) {
    const tEnd = Math.max(...pts.map((p) => p.ts));
    const tStart = tEnd - LEAK_WINDOW_MS;
    const win = pts.filter((p) => p.ts >= tStart);
    if (win.length < 2) continue;
    const times = win.map((p) => p.ts);
    const span = Math.max(...times) - Math.min(...times);
    if (span < LEAK_MIN_SPAN_MS) continue;
    const sorted = [...win].sort((a, b) => a.ts - b.ts);
    const first = sorted[0].rss;
    const last = sorted[sorted.length - 1].rss;
    if (first <= 0) continue;
    const pct = (last - first) / first * 100;
    if (pct >= LEAK_THRESHOLD_PCT && tEnd >= Date.now() - LEAK_STALE_MS) {
      const cand = {
        pid,
        growthPct: pct,
        spanH: span / 36e5,
        rssFirst: first,
        rssLast: last,
        firstTs: new Date(sorted[0].ts).toISOString(),
        lastTs: new Date(sorted[sorted.length - 1].ts).toISOString()
      };
      if (!worst || cand.growthPct > worst.growthPct) worst = cand;
    }
  }
  return worst;
}
function push(ev) {
  append2(ev);
  incidents.push(ev);
  if (incidents.length > 200) incidents = incidents.slice(-200);
}
function lastFileEvent() {
  const f = incidentFile();
  if (!f || !fs8.existsSync(f)) return null;
  try {
    const lines = fs8.readFileSync(f, "utf8").split("\n").filter(Boolean);
    if (!lines.length) return null;
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}
function openLeak(leak) {
  activeLeak = leak;
  const last = incidents[incidents.length - 1];
  const alreadyOpen = last && last.type === "leak_start" && Number(last.pid) === leak.pid;
  const fileLast = lastFileEvent();
  const fileOpen = fileLast && fileLast.type === "leak_start" && Number(fileLast.pid) === leak.pid;
  if (!alreadyOpen && !fileOpen) {
    push({
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      type: "leak_start",
      pid: leak.pid,
      growthPct: Number(leak.growthPct.toFixed(1)),
      spanH: Number(leak.spanH.toFixed(2)),
      rssFirst: leak.rssFirst,
      rssLast: leak.rssLast,
      firstTs: leak.firstTs,
      lastTs: leak.lastTs
    });
  }
}
function closeLeak() {
  if (!activeLeak) return;
  const fileLast = lastFileEvent();
  const matches2 = fileLast && fileLast.type === "leak_start" && Number(fileLast.pid) === activeLeak.pid;
  if (matches2) {
    push({
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      type: "leak_end",
      pid: activeLeak.pid,
      growthPct: Number(activeLeak.growthPct.toFixed(1))
    });
  }
  activeLeak = null;
}
function tick() {
  lastCheckedAt = (/* @__PURE__ */ new Date()).toISOString();
  const leak = detectLeak();
  if (activeLeak && (!leak || leak.pid !== activeLeak.pid)) closeLeak();
  if (leak && !activeLeak) openLeak(leak);
}
function startLeakMonitor() {
  loadIncidents();
  tick();
  setInterval(tick, CHECK_INTERVAL_MS2);
}
function getLeakMonitorState() {
  return {
    running: true,
    startedAt: new Date(startedAt2).toISOString(),
    lastCheckedAt,
    leaking: !!activeLeak,
    detail: activeLeak,
    thresholdPct: LEAK_THRESHOLD_PCT,
    windowH: LEAK_WINDOW_MS / 36e5,
    incidents: incidents.slice(-20)
  };
}

// src/routes/admin.routes.ts
init_audit_service();
init_notification_service();
init_socket();

// src/services/shop.service.ts
init_prisma();
init_crypto();
init_notification_service();
var ORDER_STATUS_FLOW = {
  pending: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: []
};
function makeOrderNumber() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RS${t}${r}`;
}
function makeSerialCode(modelCode) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rnd = "";
  for (let i = 0; i < 6; i++) rnd += chars[Math.floor(Math.random() * chars.length)];
  return `RS-${modelCode}-${rnd}`;
}
async function reserveSerials(tx, orderId, productId, qty) {
  const found = await tx.serialRegistry.findMany({
    where: { productId, status: "available" },
    orderBy: { id: "asc" },
    take: qty
  });
  if (!found.length) return [];
  await tx.serialRegistry.updateMany({
    where: { id: { in: found.map((f) => f.id) } },
    data: { status: "reserved", orderId }
  });
  return found.map((f) => f.serialCode);
}
async function createOrder(input) {
  if (!input.items.length) throw new AppError("BAD_REQUEST", "Cart is empty");
  const products = await prisma.product.findMany({
    where: { id: { in: input.items.map((i) => i.productId) }, active: true }
  });
  if (!products.length) throw new AppError("NOT_FOUND", "No valid products in cart");
  const productMap = new Map(products.map((p) => [p.id, p]));
  let total2 = 0;
  for (const it of input.items) {
    const prod = productMap.get(it.productId);
    if (!prod) throw new AppError("NOT_FOUND", `Product ${it.productId} not found`);
    if (!Number.isInteger(it.quantity) || it.quantity < 1) {
      throw new AppError("BAD_REQUEST", `Invalid quantity for ${prod.name}`);
    }
    if (prod.stockCount < it.quantity) {
      throw new AppError("BAD_REQUEST", `Insufficient stock for ${prod.name}. Only ${prod.stockCount} left.`);
    }
    total2 += Number(prod.price) * it.quantity;
  }
  const wifiPasswordEnc = input.wifi?.password ? encryptSecret(input.wifi.password) : null;
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: makeOrderNumber(),
        userId: input.userId,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentMethod === "cod" ? "pending" : "unpaid",
        totalAmount: total2,
        shippingName: input.shipping.name,
        shippingPhone: input.shipping.phone,
        shippingAddress: input.shipping.address,
        wifiSsid: input.wifi?.ssid?.trim() || null,
        wifiPasswordEnc
      }
    });
    for (const it of input.items) {
      const prod = productMap.get(it.productId);
      const serials = await reserveSerials(tx, created.id, prod.id, it.quantity);
      await tx.product.update({
        where: { id: prod.id },
        data: { stockCount: { decrement: it.quantity } }
      });
      await tx.orderItem.create({
        data: {
          orderId: created.id,
          productId: prod.id,
          productName: prod.name,
          price: prod.price,
          quantity: it.quantity,
          serialCode: serials[0] ?? null
        }
      });
    }
    return tx.order.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: true }
    });
  });
  try {
    await createNotificationWithEmail(
      input.userId,
      {
        category: "system",
        type: "info",
        title: "\u{1F4E6} Order placed",
        body: `Order ${order.orderNumber} \u2014 \u20B9${Number(order.totalAmount).toLocaleString("en-IN")}, ${order.items.length} item(s). Status: ${order.status}.`
      },
      {
        emailSubject: `\u{1F4E6} Order ${order.orderNumber} placed \u2014 \u20B9${Number(order.totalAmount).toLocaleString("en-IN")}`,
        ctaUrl: "/orders",
        ctaLabel: "Order dekho"
      }
    );
  } catch (err) {
    console.error("[shop] order notification failed", err);
  }
  return order;
}
async function generateSerials(productId, count) {
  if (count < 1 || count > 500) throw new AppError("BAD_REQUEST", "Count must be between 1 and 500");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError("NOT_FOUND", "Product not found");
  const data = [];
  while (data.length < count) {
    const code = makeSerialCode(product.modelCode);
    const exists = await prisma.serialRegistry.findUnique({ where: { serialCode: code } });
    if (!exists) data.push({ serialCode: code, productId });
  }
  await prisma.serialRegistry.createMany({ data });
  return data.map((d) => d.serialCode);
}
async function updateOrderStatus(orderId, status) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });
  if (!order) throw new AppError("NOT_FOUND", "Order not found");
  if (order.status === status && status !== "processing") {
    return prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, user: { select: { id: true, username: true, email: true } } }
    });
  }
  if (!(status in ORDER_STATUS_FLOW)) {
    throw new AppError("BAD_REQUEST", `Invalid status ${status}`);
  }
  const allowed = ORDER_STATUS_FLOW[order.status] ?? [];
  if (order.status !== status && !allowed.includes(status)) {
    throw new AppError("BAD_REQUEST", `Cannot move order from ${order.status} to ${status}`);
  }
  if (status === "processing") {
    for (const item of order.items) {
      if (item.serialCode) continue;
      const need = item.quantity;
      const foundCount = await prisma.serialRegistry.count({
        where: { productId: item.productId, status: "available" }
      });
      const delta = need - foundCount;
      if (delta > 0) {
        await generateSerials(item.productId, delta);
      }
    }
  }
  const updated = await prisma.$transaction(async (tx) => {
    if (status === "cancelled") {
      await tx.serialRegistry.updateMany({
        where: { orderId: order.id },
        data: { status: "available", orderId: null }
      });
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockCount: { increment: item.quantity } }
        });
      }
    } else if (status === "processing") {
      for (const item of order.items) {
        if (item.serialCode) continue;
        const need = item.quantity;
        const found = await tx.serialRegistry.findMany({
          where: { productId: item.productId, status: "available" },
          orderBy: { id: "asc" },
          take: need
        });
        if (found.length) {
          await tx.serialRegistry.updateMany({
            where: { id: { in: found.map((f) => f.id) } },
            data: { status: "reserved", orderId: order.id }
          });
          await tx.orderItem.update({
            where: { id: item.id },
            data: { serialCode: found[0].serialCode }
          });
        }
      }
    } else if (status === "shipped") {
      await tx.serialRegistry.updateMany({
        where: { orderId: order.id, status: "reserved" },
        data: { status: "shipped" }
      });
    } else if (status === "delivered") {
      await tx.serialRegistry.updateMany({
        where: { orderId: order.id, status: { in: ["shipped", "reserved"] } },
        data: { status: "delivered" }
      });
    }
    return tx.order.update({
      where: { id: order.id },
      data: {
        status,
        ...status !== "cancelled" ? { paymentStatus: "paid" } : {}
      },
      include: { items: true, user: { select: { id: true, username: true, email: true } } }
    });
  });
  if (status === "processing") {
    try {
      await createNotificationWithEmail(
        updated.userId,
        {
          category: "system",
          type: "info",
          title: "\u2699\uFE0F Order Processing",
          body: `Order ${updated.orderNumber} processing initiate hui hai \u2014 aapka order factory se taiyaar ho raha hai.`
        },
        { emailSubject: `\u2699\uFE0F Order Processing \u2014 ${updated.orderNumber}`, ctaUrl: "/orders", ctaLabel: "Order dekho" }
      );
    } catch (err) {
      console.error("[shop] payment notification failed", err);
    }
  }
  if (status === "packed") {
    try {
      await createNotificationWithEmail(
        updated.userId,
        {
          category: "system",
          type: "info",
          title: "\u{1F4E6} Order packed",
          body: `Order ${updated.orderNumber} ki saari testing done, ab yeh pack ho chuka hai aur dispatch hone wala hai.`
        },
        { emailSubject: `\u{1F4E6} Order ${updated.orderNumber} packed`, ctaUrl: "/orders", ctaLabel: "Order dekho" }
      );
    } catch (err) {
      console.error("[shop] packed notification failed", err);
    }
  }
  if (status === "shipped" || status === "delivered") {
    const serialCodes = (updated.items ?? []).map((i) => i.serialCode).filter((c) => Boolean(c));
    const keys = serialCodes.length ? serialCodes.join(", ") : "box sticker pe milenge";
    try {
      await createNotificationWithEmail(
        updated.userId,
        {
          category: "system",
          type: "info",
          title: status === "shipped" ? "\u{1F69A} Order shipped" : "\u{1F4E6} Order delivered",
          body: status === "shipped" ? `Order ${updated.orderNumber} ship ho gaya. Aapke serial keys: ${keys} \u2014 Activate page pe daal kar device link karo.` : `Order ${updated.orderNumber} deliver ho gaya! Serial keys: ${keys} \u2014 Activate page pe daal kar device add karo (box sticker pe bhi hain).`
        },
        {
          emailSubject: status === "shipped" ? `\u{1F69A} Order ${updated.orderNumber} shipped` : `\u{1F4E6} Order ${updated.orderNumber} delivered`,
          emailBody: status === "shipped" ? `Order ${updated.orderNumber} ship ho gaya. Serial keys: ${keys}

Activate page pe serial daal kar device link karo.` : `Order ${updated.orderNumber} deliver ho gaya! Serial keys: ${keys}

Activate page pe serial daal kar device add karo (box sticker pe bhi hain).`,
          ctaUrl: status === "shipped" ? "/activate" : "/activate",
          ctaLabel: "Device activate karo"
        }
      );
    } catch (err) {
      console.error("[shop] status notification failed", err);
    }
  }
  return updated;
}

// src/routes/admin.routes.ts
init_crypto();

// src/lib/billVerify.ts
var import_node_crypto7 = __toESM(require("node:crypto"), 1);
init_env();
var SECRET = import_node_crypto7.default.createHash("sha256").update(env.JWT_ACCESS_SECRET).digest();
function signBillToken(orderId) {
  const sig = import_node_crypto7.default.createHmac("sha256", SECRET).update(`bill:${orderId}`).digest("base64url");
  return `${orderId}.${sig}`;
}
function verifyBillToken(token) {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const idPart = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const orderId = Number(idPart);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return null;
  const expected = import_node_crypto7.default.createHmac("sha256", SECRET).update(`bill:${orderId}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  try {
    if (!import_node_crypto7.default.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { orderId };
}

// src/lib/lanIp.ts
var import_node_dgram = __toESM(require("node:dgram"), 1);
var import_node_os = __toESM(require("node:os"), 1);
function detectLanIp() {
  const candidates = ["192.168.1.1", "192.168.0.1", "10.0.0.1", "172.16.0.1", "8.8.8.8"];
  const fromInterfaces = () => {
    for (const ifaces of Object.values(import_node_os.default.networkInterfaces())) {
      for (const iface of ifaces ?? []) {
        if (iface.family === "IPv4" && !iface.internal) return iface.address;
      }
    }
    return "192.168.1.100";
  };
  return new Promise((resolve4) => {
    let i = 0;
    const tryNext = () => {
      if (i >= candidates.length) {
        resolve4(fromInterfaces());
        return;
      }
      const target = candidates[i++];
      const sock = import_node_dgram.default.createSocket("udp4");
      const fail2 = () => {
        try {
          sock.close();
        } catch {
        }
        tryNext();
      };
      sock.on("error", fail2);
      sock.on("connect", () => {
        let ip = "";
        try {
          ip = sock.address().address;
          sock.close();
        } catch {
        }
        if (ip && !ip.startsWith("127.")) resolve4(ip);
        else tryNext();
      });
      try {
        sock.connect(80, target);
      } catch {
        fail2();
      }
    };
    tryNext();
  });
}

// src/routes/admin.routes.ts
init_firmware_service();
init_logger();

// src/lib/requestTracker.ts
init_prisma();
var DAY_MS = 24 * 60 * 60 * 1e3;
var STORE_KEY = "req_tracker";
var hourly = /* @__PURE__ */ new Map();
var daily = /* @__PURE__ */ new Map();
var total = 0;
var loaded = false;
function dayKey(d) {
  return d.toISOString().slice(0, 10);
}
function hourKey(d) {
  return d.toISOString().slice(0, 13);
}
function trackRequest() {
  const now = /* @__PURE__ */ new Date();
  const hk = hourKey(now);
  const dk = dayKey(now);
  hourly.set(hk, (hourly.get(hk) ?? 0) + 1);
  daily.set(dk, (daily.get(dk) ?? 0) + 1);
  total++;
}
function getRequestStats() {
  const now = /* @__PURE__ */ new Date();
  const cutoff = now.getTime() - DAY_MS;
  let last24h = 0;
  for (const [k, v] of hourly) {
    const t = (/* @__PURE__ */ new Date(`${k}:00:00.000Z`)).getTime();
    if (t >= cutoff) last24h += v;
  }
  return { today: daily.get(dayKey(now)) ?? 0, last24h, total };
}
async function loadRequestTracker() {
  if (loaded) return;
  try {
    const row = await prisma.appMeta.findUnique({ where: { key: STORE_KEY } });
    if (row?.value) {
      const p = JSON.parse(row.value);
      for (const [k, v] of Object.entries(p.hourly ?? {})) hourly.set(k, v);
      for (const [k, v] of Object.entries(p.daily ?? {})) daily.set(k, v);
      total = p.total ?? Object.values(p.daily ?? {}).reduce((a, b) => a + b, 0);
      const cutoff = Date.now() - 40 * DAY_MS;
      for (const k of [...hourly.keys()]) {
        if ((/* @__PURE__ */ new Date(`${k}:00:00.000Z`)).getTime() < cutoff) hourly.delete(k);
      }
      for (const k of [...daily.keys()]) {
        if ((/* @__PURE__ */ new Date(`${k}T00:00:00.000Z`)).getTime() < cutoff) daily.delete(k);
      }
    }
  } catch {
  }
  loaded = true;
}
var flushTimer = null;
function startRequestFlush(intervalMs = 6e4) {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushRequestTracker();
  }, intervalMs);
  flushTimer.unref?.();
}
async function flushRequestTracker() {
  try {
    await prisma.appMeta.upsert({
      where: { key: STORE_KEY },
      create: {
        key: STORE_KEY,
        value: JSON.stringify({
          hourly: Object.fromEntries(hourly),
          daily: Object.fromEntries(daily),
          total
        })
      },
      update: {
        value: JSON.stringify({
          hourly: Object.fromEntries(hourly),
          daily: Object.fromEntries(daily),
          total
        })
      }
    });
  } catch {
  }
}

// src/routes/admin.routes.ts
init_siteSettings_service();
init_email_service();
var import_bcryptjs2 = __toESM(require("bcryptjs"), 1);
var adminRouter = (0, import_express11.Router)();
function requireAdmin(req, _res, next) {
  if (req.user?.role !== "system_admin") {
    return next(new AppError("FORBIDDEN", "Admin access required", 403));
  }
  next();
}
adminRouter.use(requireAuth, requireAdmin);
var DAY_MS2 = 24 * 60 * 60 * 1e3;
function dayKey2(d) {
  return d.toISOString().slice(0, 10);
}
adminRouter.get("/stats", async (_req, res) => {
  const dayAgo = new Date(Date.now() - DAY_MS2);
  const weekAgo = new Date(Date.now() - 7 * DAY_MS2);
  const twoMin = new Date(Date.now() - 12e4);
  const monthStart = /* @__PURE__ */ new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [
    users,
    homes,
    devices,
    activeToday,
    onlineDevices,
    pendingCommands2,
    apiKeys,
    auditCount,
    espBoards,
    offlineBoards,
    orders,
    pendingOrders,
    ordersToday,
    ordersThisMonth,
    revenueTotal,
    revenueThisMonth,
    newUsers7d,
    supportMessages,
    contactMessages,
    deviceLogs24h,
    usersRecent,
    ordersRecent
  ] = await Promise.all([
    prisma.user.count().catch(() => 0),
    prisma.home.count().catch(() => 0),
    prisma.device.count().catch(() => 0),
    Promise.resolve(0),
    prisma.device.count({ where: { lastSeen: { gte: dayAgo } } }).catch(() => 0),
    prisma.deviceCommand.count({ where: { status: "pending" } }).catch(() => 0),
    prisma.apiKey.count().catch(() => 0),
    prisma.auditLog.count().catch(() => 0),
    prisma.espDevice.count().catch(() => 0),
    prisma.espDevice.count({ where: { OR: [{ offline: true }, { lastSeen: { lt: twoMin } }] } }).catch(() => 0),
    prisma.order.count().catch(() => 0),
    prisma.order.count({ where: { status: "pending" } }).catch(() => 0),
    prisma.order.count({ where: { createdAt: { gte: dayAgo } } }).catch(() => 0),
    prisma.order.count({ where: { createdAt: { gte: monthStart } } }).catch(() => 0),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paidAt: { not: null } } }).catch(() => ({ _sum: { totalAmount: 0 } })),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paidAt: { not: null }, createdAt: { gte: monthStart } } }).catch(() => ({ _sum: { totalAmount: 0 } })),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }).catch(() => 0),
    prisma.supportMessage.count().catch(() => 0),
    prisma.contactMessage.count().catch(() => 0),
    prisma.deviceLog.count({ where: { createdAt: { gte: dayAgo } } }).catch(() => 0),
    prisma.user.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true } }).catch(() => []),
    prisma.order.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true, totalAmount: true, paidAt: true } }).catch(() => [])
  ]);
  const usersByDay = {};
  for (const u of usersRecent) {
    const k = dayKey2(u.createdAt);
    usersByDay[k] = (usersByDay[k] ?? 0) + 1;
  }
  const ordersByDay = {};
  const revenueByDay = {};
  for (const o of ordersRecent) {
    const k = dayKey2(o.createdAt);
    ordersByDay[k] = (ordersByDay[k] ?? 0) + 1;
    if (o.paidAt) {
      const pk = dayKey2(o.paidAt);
      revenueByDay[pk] = (revenueByDay[pk] ?? 0) + Number(o.totalAmount);
    }
  }
  ok(res, {
    users,
    homes,
    devices,
    activeToday,
    onlineDevices,
    pendingCommands: pendingCommands2,
    apiKeys,
    auditCount,
    espBoards,
    offlineBoards,
    orders,
    pendingOrders,
    ordersToday,
    ordersThisMonth,
    revenueTotal: Number(revenueTotal._sum.totalAmount ?? 0),
    revenueThisMonth: Number(revenueThisMonth._sum.totalAmount ?? 0),
    newUsers7d,
    supportMessages,
    contactMessages,
    deviceLogs24h,
    leak: getLeakMonitorState(),
    requests: getRequestStats(),
    usersByDay,
    ordersByDay,
    revenueByDay
  });
});
var settingsSchema = import_zod13.z.object({
  siteName: import_zod13.z.string().min(1).max(60).optional(),
  supportEmail: import_zod13.z.string().email().max(100).optional(),
  supportPhone: import_zod13.z.string().min(1).max(30).optional(),
  supportAddress: import_zod13.z.string().min(1).max(200).optional(),
  supportHours: import_zod13.z.string().min(1).max(100).optional(),
  brandColor: import_zod13.z.string().regex(/^#[0-9a-fA-F]{6}$/, "Hex color (#RRGGBB)").optional(),
  siteUrl: import_zod13.z.string().url().max(200).optional().or(import_zod13.z.literal("")),
  smtpHost: import_zod13.z.string().max(150).optional(),
  smtpPort: import_zod13.z.number().int().min(1).max(65535).optional(),
  smtpUser: import_zod13.z.string().max(150).optional(),
  smtpPass: import_zod13.z.string().max(200).optional(),
  // blank = purana rakho
  smtpFrom: import_zod13.z.string().email().max(150).optional().or(import_zod13.z.literal("")),
  smtpSecure: import_zod13.z.boolean().optional(),
  // AI assistant config (Phase 7) — UI se, env ke bajaye
  aiProvider: import_zod13.z.enum(["openai", "gemini", "ollama", ""]).optional(),
  aiApiKey: import_zod13.z.string().max(200).optional(),
  // blank = purana rakho
  aiBaseUrl: import_zod13.z.string().max(200).optional().or(import_zod13.z.literal("")),
  aiModel: import_zod13.z.string().max(100).optional(),
  supportTicketMediaRetentionDays: import_zod13.z.number().int().min(1).max(3650).optional(),
  chatHistoryRetentionDays: import_zod13.z.number().int().min(1).max(3650).optional(),
  deviceTelemetryRetentionDays: import_zod13.z.number().int().min(1).max(3650).optional()
}).refine((d) => Object.keys(d).length > 0, { message: "At least one field to update" });
adminRouter.get("/settings", async (_req, res) => {
  const s = await getSiteSettings();
  ok(res, {
    ...s,
    smtpPass: s.smtpPass ? "********" : "",
    smtpPassSet: !!s.smtpPass,
    aiApiKey: s.aiApiKey ? "********" : "",
    aiApiKeySet: !!s.aiApiKey
  });
});
adminRouter.put("/settings", validateBody(settingsSchema), async (req, res) => {
  ok(res, await updateSiteSettings(req.body));
  void audit(req.user.sub, "settings.update", { entity: "site", meta: { fields: Object.keys(req.body) } });
});
adminRouter.post("/settings/test-email", async (req, res) => {
  const me2 = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { email: true, username: true }
  });
  if (!me2?.email) {
    throw new AppError("VALIDATION_ERROR", "Aapke account pe email set nahi hai \u2014 test bhejne ke liye email chahiye", 400);
  }
  const r = await sendEmail({
    to: me2.email,
    subject: "\u{1F9EA} SwitchNest test email",
    text: `Ye test email hai, ${me2.username}. SMTP settings sahi kaam kar rahi hain. \u2705`
  });
  if (!r.ok) {
    if (r.skipped) {
      throw new AppError("CONFIG_ERROR", "SMTP configured nahi hai \u2014 Settings me host/user/pass daalo aur Save karo", 400);
    }
    throw new AppError("SMTP_ERROR", `Email fail: ${r.error ?? "unknown"}`, 500);
  }
  ok(res, { sent: true });
});
adminRouter.post("/settings/ai-test", async (_req, res) => {
  if (!await aiConfigured()) {
    throw new AppError("CONFIG_ERROR", "AI configured nahi hai \u2014 Settings me provider + model + API key daalo aur Save karo", 400);
  }
  const cfg = await getAiConfig();
  try {
    const reply = await chatCompletion({
      system: "Reply with exactly: AI_OK",
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 10,
      timeoutMs: 2e4
    });
    ok(res, { ok: true, reply, provider: cfg.provider, model: cfg.model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError("AI_ERROR", `AI call fail: ${msg}`, 502);
  }
});
adminRouter.get("/users", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          ownedHomes: true,
          memberships: true,
          orders: true,
          apiKeys: true,
          createdDevices: true,
          claimedSerials: true,
          warrantyClaims: true
        }
      }
    },
    where: q ? {
      OR: [
        { username: { contains: q } },
        { email: { contains: q } }
      ]
    } : void 0,
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const userIds = users.map((u) => u.id);
  const memberships = await prisma.homeMember.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, homeId: true }
  });
  const espCounts = await prisma.espDevice.groupBy({
    by: ["homeId"],
    where: { homeId: { in: memberships.map((m) => m.homeId) } },
    _count: { _all: true }
  });
  const espByHome = new Map(espCounts.map((e) => [e.homeId, e._count._all]));
  const boardsByUser = /* @__PURE__ */ new Map();
  for (const m of memberships) {
    boardsByUser.set(m.userId, (boardsByUser.get(m.userId) ?? 0) + (espByHome.get(m.homeId) ?? 0));
  }
  const usageRows = await prisma.deviceUsage.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds } },
    _sum: { onMinutes: true }
  });
  const usageByUser = new Map(usageRows.map((r) => [r.userId, r._sum.onMinutes ?? 0]));
  ok(
    res,
    users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      _count: u._count,
      boards: boardsByUser.get(u.id) ?? 0,
      usageMinutes: usageByUser.get(u.id) ?? 0
    }))
  );
});
adminRouter.get("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          ownedHomes: true,
          orders: true,
          apiKeys: true,
          createdDevices: true,
          claimedSerials: true,
          warrantyClaims: true,
          contactMessages: true
        }
      },
      memberships: {
        select: {
          home: { select: { id: true, name: true } },
          role: true
        },
        orderBy: { role: "asc" }
      },
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" },
        take: 10
      },
      apiKeys: {
        select: {
          id: true,
          keyPrefix: true,
          label: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
          lastUsedAt: true,
          home: { select: { name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 20
      }
    }
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
  const espCounts = await prisma.espDevice.groupBy({
    by: ["homeId"],
    where: { homeId: { in: user.memberships.map((m) => m.home.id) } },
    _count: { _all: true }
  });
  const boards = espCounts.reduce((n, e) => n + e._count._all, 0);
  const usageAgg = await prisma.deviceUsage.aggregate({
    where: { userId: user.id },
    _sum: { onMinutes: true }
  });
  ok(res, {
    ...user,
    boards,
    usageMinutes: usageAgg._sum.onMinutes ?? 0
  });
});
var createUserSchema = import_zod13.z.object({
  username: import_zod13.z.string().min(3).max(50),
  email: import_zod13.z.string().email().max(100),
  password: import_zod13.z.string().min(6).max(255),
  role: import_zod13.z.enum(["user", "system_admin"]).optional()
});
adminRouter.post("/users", validateBody(createUserSchema), async (req, res) => {
  const { username, email, password, role } = req.body;
  const existingUsername = await prisma.user.findFirst({ where: { username }, select: { id: true } });
  if (existingUsername) throw new AppError("USER_EXISTS", `Username '${username}' is already taken. Please use another username.`, 409);
  const existingEmail = await prisma.user.findFirst({ where: { email }, select: { id: true, username: true } });
  if (existingEmail) throw new AppError("USER_EXISTS", `Email '${email}' is already registered (account: '${existingEmail.username}').`, 409);
  const hashed = await import_bcryptjs2.default.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashed,
      role: role ?? "user",
      status: "active",
      pushDeviceToggles: true,
      pushSystemAlerts: true,
      tokenVersion: 0
    },
    select: { id: true, username: true, email: true, role: true, status: true, createdAt: true }
  });
  await audit(req.user.sub, "admin.user.create", {
    entity: "user",
    entityId: user.id,
    meta: { username: user.username, email: user.email, role: user.role }
  });
  ok(res, user, 201);
});
adminRouter.post("/users/:id/send-reset-email", async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, email: true }
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
  await requestPasswordReset(user.email);
  await audit(req.user.sub, "admin.user.sendResetEmail", {
    entity: "user",
    entityId: id,
    meta: { username: user.username, email: user.email }
  });
  ok(res, { sent: true, message: `Password reset email bheja (${user.email})` });
});
var resetPasswordSchema2 = import_zod13.z.object({
  password: import_zod13.z.string().min(6).max(255)
});
adminRouter.post("/users/:id/reset-password", validateBody(resetPasswordSchema2), async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, email: true }
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
  const hashed = await import_bcryptjs2.default.hash(req.body.password, 10);
  await prisma.user.update({ where: { id }, data: { password: hashed } });
  await audit(req.user.sub, "admin.user.resetPassword", {
    entity: "user",
    entityId: id,
    meta: { username: user.username, email: user.email }
  });
  ok(res, { reset: true, message: `Password reset ho gaya (${user.username})` });
});
var broadcastLimiter = rateLimit({
  name: "admin:broadcast",
  windowMs: 60 * 6e4,
  max: 5,
  message: "Bahut zyada broadcasts \u2014 1 ghanta baad try karo"
});
var broadcastSchema = import_zod13.z.object({
  title: import_zod13.z.string().trim().min(1).max(120),
  body: import_zod13.z.string().trim().min(1).max(2e3),
  sendEmail: import_zod13.z.boolean().optional()
});
adminRouter.post("/broadcast", broadcastLimiter, validateBody(broadcastSchema), async (req, res) => {
  const { title, body, sendEmail: sendEmail2 } = req.body;
  const targets = await prisma.user.findMany({
    where: { role: "user", status: "active" },
    select: { id: true }
  });
  let emailed = 0;
  for (const t of targets) {
    if (sendEmail2) {
      await createNotificationWithEmail(
        t.id,
        { category: "system", type: "info", title, body },
        { emailSubject: title, emailBody: body }
      );
      emailed++;
    } else {
      await createNotification(t.id, { category: "system", type: "info", title, body });
    }
  }
  await audit(req.user.sub, "admin.broadcast", {
    entity: "site",
    meta: { title, targets: targets.length, emailed }
  });
  ok(res, { sent: targets.length, emailed });
});
adminRouter.patch("/users/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.sub) throw new AppError("BAD_REQUEST", "You cannot suspend your own account");
  const status = String(req.body.status ?? "");
  if (!["active", "suspended"].includes(status)) {
    throw new AppError("BAD_REQUEST", "Status must be active or suspended");
  }
  const user = await prisma.user.update({
    where: { id },
    data: { status }
  });
  await audit(req.user.sub, `admin.user.${status}`, { entity: "user", entityId: id, meta: { username: user.username } });
  ok(res, user);
});
adminRouter.patch("/users/:id/role", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.sub) throw new AppError("BAD_REQUEST", "You cannot change your own role");
  const role = String(req.body.role ?? "");
  if (!["user", "system_admin"].includes(role)) {
    throw new AppError("BAD_REQUEST", "Role must be user or system_admin");
  }
  const user = await prisma.user.update({
    where: { id },
    data: { role }
  });
  await audit(req.user.sub, `admin.user.role`, { entity: "user", entityId: id, meta: { username: user.username, role } });
  ok(res, user);
});
adminRouter.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.sub) throw new AppError("BAD_REQUEST", "You cannot delete your own account");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  await audit(req.user.sub, "admin.user.delete", { entity: "user", entityId: id, meta: { username: user.username, email: user.email } });
  await prisma.user.delete({ where: { id } });
  ok(res, { deleted: true });
});
adminRouter.get("/homes", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const homes = await prisma.home.findMany({
    include: {
      owner: { select: { id: true, username: true, email: true } },
      _count: { select: { devices: true, members: true, rooms: true } }
    },
    where: q ? { name: { contains: q } } : void 0,
    orderBy: { createdAt: "desc" },
    take: 200
  });
  ok(res, homes);
});
adminRouter.get("/homes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const home = await prisma.home.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, username: true, email: true } },
      members: { include: { user: { select: { id: true, username: true, email: true } } } },
      devices: { orderBy: { id: "asc" } },
      rooms: true,
      _count: { select: { devices: true, members: true, invitations: true } }
    }
  });
  if (!home) throw new AppError("NOT_FOUND", "Home not found");
  ok(res, home);
});
adminRouter.patch("/homes/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status ?? "");
  if (!["active", "suspended"].includes(status)) {
    throw new AppError("BAD_REQUEST", "Status must be active or suspended");
  }
  const home = await prisma.home.update({
    where: { id },
    data: { status }
  });
  await audit(req.user.sub, `admin.home.${status}`, { homeId: id, entity: "home", entityId: id, meta: { name: home.name } });
  ok(res, home);
});
adminRouter.delete("/homes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const home = await prisma.home.findUnique({ where: { id } });
  if (!home) throw new AppError("NOT_FOUND", "Home not found");
  await audit(req.user.sub, "admin.home.delete", { homeId: id, entity: "home", entityId: id, meta: { name: home.name } });
  await prisma.home.delete({ where: { id } });
  ok(res, { deleted: true });
});
adminRouter.get("/devices", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const devices = await prisma.device.findMany({
    include: {
      home: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          owner: { select: { username: true } },
          apiKeys: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { keyPrefix: true, label: true, createdAt: true }
          }
        }
      },
      room: { select: { name: true } },
      _count: { select: { commands: true, logs: true } }
    },
    where: q ? {
      OR: [
        { name: { contains: q } },
        { serialNumber: { contains: q } },
        { ipAddress: { contains: q } },
        { home: { name: { contains: q } } },
        { home: { owner: { username: { contains: q } } } }
      ]
    } : void 0,
    orderBy: { id: "desc" },
    take: 200
  });
  ok(
    res,
    devices.map((d) => ({
      ...d,
      online: d.lastSeen !== null && d.lastSeen.getTime() > dayAgo.getTime()
    }))
  );
});
adminRouter.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return ok(res, { q, users: [], homes: [], devices: [], esps: [], orders: [], serials: [] });
  const qUp = q.toUpperCase();
  const [users, homes, devices, esps, orders, serials] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ username: { contains: q } }, { email: { contains: q } }] },
      select: { id: true, username: true, email: true, role: true, status: true, createdAt: true },
      orderBy: { id: "desc" },
      take: 5
    }),
    prisma.home.findMany({
      where: { OR: [{ name: { contains: q } }, { owner: { username: { contains: q } } }] },
      select: {
        id: true,
        name: true,
        status: true,
        owner: { select: { username: true } },
        _count: { select: { devices: true, members: true } }
      },
      orderBy: { id: "desc" },
      take: 5
    }),
    prisma.device.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { serialNumber: { contains: q } },
          { ipAddress: { contains: q } },
          { home: { name: { contains: q } } }
        ]
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        serialNumber: true,
        ipAddress: true,
        home: { select: { name: true } }
      },
      orderBy: { id: "desc" },
      take: 5
    }),
    prisma.espDevice.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { serialCode: { contains: q } },
          { macAddress: { contains: q } },
          { ipAddress: { contains: q } },
          { ssid: { contains: q } },
          { modelCode: { contains: q } }
        ]
      },
      select: {
        id: true,
        name: true,
        serialCode: true,
        modelCode: true,
        ipAddress: true,
        offline: true,
        home: { select: { name: true } }
      },
      orderBy: { id: "desc" },
      take: 5
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: qUp } },
          { shippingName: { contains: q } },
          { shippingPhone: { contains: q } },
          { user: { username: { contains: q } } }
        ]
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true,
        user: { select: { username: true } }
      },
      orderBy: { id: "desc" },
      take: 5
    }),
    prisma.serialRegistry.findMany({
      where: { serialCode: { contains: qUp } },
      select: {
        id: true,
        serialCode: true,
        status: true,
        orderId: true,
        product: { select: { name: true } },
        user: { select: { username: true } }
      },
      orderBy: { id: "desc" },
      take: 5
    })
  ]);
  ok(res, { q, users, homes, devices, esps, orders, serials });
});
adminRouter.get("/api-keys", async (_req, res) => {
  try {
    const keys = await prisma.apiKey.findMany({
      include: {
        user: { select: { id: true, username: true, email: true } },
        home: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    ok(res, keys);
  } catch (err) {
    console.error(`[admin] api-keys query failed:`, err?.message ?? err);
    ok(res, []);
  }
});
adminRouter.post("/api-keys", async (req, res) => {
  const userId = Number(req.body?.userId);
  if (!userId) throw new AppError("BAD_REQUEST", "userId required");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  let homeId = req.body?.homeId ? Number(req.body.homeId) : null;
  if (!homeId) {
    const home = await prisma.home.findFirst({ where: { ownerId: userId } });
    homeId = home?.id ?? null;
  }
  const label = String(req.body?.label ?? "factory").slice(0, 100);
  const crypto10 = await import("node:crypto");
  const plain = `rs_${crypto10.randomBytes(9).toString("base64url").replace(/-/g, "").slice(0, 16)}`;
  const keyHash = crypto10.createHash("sha256").update(plain).digest("hex");
  const keyPrefix = plain.slice(0, 8);
  await prisma.apiKey.create({ data: { userId, homeId, label, keyHash, keyPrefix } });
  await audit(req.user.sub, "admin.apikey.create", {
    entity: "api_key",
    entityId: userId,
    meta: { label, prefix: keyPrefix, userId }
  });
  ok(res, { apiKey: plain, keyPrefix, userId, homeId });
});
adminRouter.delete("/api-keys/:id", async (req, res) => {
  const id = Number(req.params.id);
  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) throw new AppError("NOT_FOUND", "API key not found");
  await audit(req.user.sub, "admin.apikey.revoke", { homeId: key.homeId, entity: "api_key", entityId: id, meta: { prefix: key.keyPrefix } });
  await prisma.apiKey.delete({ where: { id } });
  ok(res, { deleted: true });
});
adminRouter.get("/find", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    return ok(res, { q, users: [], orders: [], serials: [], boards: [], devices: [], messages: [], claims: [] });
  }
  const contains = { contains: q };
  const phone = q.replace(/\D/g, "");
  const users = await prisma.user.findMany({
    where: { OR: [{ username: contains }, { email: contains }] },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      _count: { select: { ownedHomes: true, createdDevices: true, orders: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  const orders = await prisma.order.findMany({
    where: { OR: [{ orderNumber: contains }, { shippingPhone: contains }, { shippingName: contains }] },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      shippingName: true,
      shippingPhone: true,
      totalAmount: true,
      createdAt: true,
      userId: true,
      user: { select: { username: true, email: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  const serials = await prisma.serialRegistry.findMany({
    where: { serialCode: contains },
    select: {
      id: true,
      serialCode: true,
      status: true,
      warrantyStatus: true,
      warrantyExpiresAt: true,
      orderId: true,
      userId: true,
      homeId: true,
      product: { select: { name: true, modelCode: true } },
      order: { select: { orderNumber: true } },
      user: { select: { id: true, username: true, email: true } },
      home: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  const boards = await prisma.espDevice.findMany({
    where: { OR: [{ macAddress: contains }, { serialCode: contains }, { name: contains }] },
    select: {
      id: true,
      name: true,
      macAddress: true,
      serialCode: true,
      modelCode: true,
      offline: true,
      lastSeen: true,
      firmwareVersion: true,
      homeId: true,
      home: { select: { id: true, name: true, owner: { select: { id: true, username: true, email: true } } } }
    },
    orderBy: { id: "desc" },
    take: 10
  });
  const devices = await prisma.device.findMany({
    where: { OR: [{ name: contains }, { serialNumber: contains }] },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      serialNumber: true,
      offline: true,
      home: { select: { id: true, name: true, owner: { select: { id: true, username: true, email: true } } } }
    },
    orderBy: { id: "desc" },
    take: 10
  });
  const messages = await prisma.contactMessage.findMany({
    where: { OR: [{ phone: phone ? { contains: phone } : contains }, { email: contains }, { name: contains }] },
    select: { id: true, name: true, phone: true, email: true, subject: true, status: true, createdAt: true, userId: true },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  const claims = await prisma.warrantyClaim.findMany({
    where: { OR: [{ serialCode: contains }] },
    select: {
      id: true,
      serialCode: true,
      reason: true,
      status: true,
      createdAt: true,
      userId: true,
      user: { select: { id: true, username: true, email: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  ok(res, { q, users, orders, serials, boards, devices, messages, claims });
});
adminRouter.get("/audit", async (req, res) => {
  const action = String(req.query.action ?? "");
  const where = action ? { action } : void 0;
  const logs2 = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  ok(res, logs2);
});
function buildDiagnosticsText(d) {
  const L = [];
  const sec = (t) => L.push(`
${"=".repeat(70)}
${t}
${"=".repeat(70)}`);
  L.push(`SwitchNest Diagnostics Export`);
  L.push(`Exported: ${(/* @__PURE__ */ new Date()).toISOString()}`);
  L.push(`Log file: ${d.logPath ?? "?"} (${d.logBytes ?? 0} bytes)`);
  if (d.error) L.push(`Parse error: ${d.error}`);
  sec("PROCESS");
  L.push(`PID:            ${d.process.pid}`);
  L.push(`Uptime:         ${Math.floor(d.process.uptimeSec / 60)}m ${d.process.uptimeSec % 60}s`);
  L.push(`RSS:            ${d.process.rssMB} MB`);
  L.push(`Heap:           ${d.process.heapMB} MB`);
  L.push(`Node:           ${d.process.node}`);
  L.push(`Started at:     ${d.process.startedAt}`);
  if (d.parent) {
    L.push(`Parent:         ${d.parent.name} (pid ${d.parent.pid})`);
    L.push(`Parent start:   ${d.parent.startTime}`);
    L.push(`Parent cmdline: ${d.parent.cmdline}`);
  }
  sec("STATS (log tail)");
  L.push(`Requests (END):   ${d.stats.reqEnd}`);
  L.push(`Requests (ABORT): ${d.stats.reqAbort}`);
  L.push(`Boots in tail:    ${d.stats.bootsInTail}`);
  L.push(`Exits in tail:    ${d.stats.exitsInTail}`);
  sec("HEALTH CHECKER");
  const hc = d.healthCheck;
  if (hc.lastCheck) {
    L.push(`Last check: ${hc.lastCheck.ts}  ${hc.lastCheck.ok ? "OK" : "FAIL"}  status=${hc.lastCheck.status ?? "-"}  ${hc.lastCheck.ms}ms  err=${hc.lastCheck.err ?? "-"}`);
  } else {
    L.push(`Last check: (none yet)`);
  }
  L.push(`Checks:     ${hc.checksOk}/${hc.checksTotal}  (success ${hc.successRate ?? "-"}%)`);
  if (hc.activeIncident) {
    L.push(`ACTIVE INCIDENT: ${hc.activeIncident.id}  since ${hc.activeIncident.startedAt}  last=${hc.activeIncident.lastStatus ?? hc.activeIncident.lastErr}`);
  }
  L.push(`Incidents:`);
  if (hc.incidents.length === 0) L.push(`  (none)`);
  for (const inc of hc.incidents) {
    L.push(
      `  ${inc.ts}  id=${inc.id}  ${inc.lastStatus ? `HTTP ${inc.lastStatus}` : inc.lastErr ?? "?"}` + (inc.end ? `  -> recovered ${inc.end.durationSec}s` : "  -> OPEN")
    );
  }
  sec(`BOOT HISTORY (last ${d.boot.length})`);
  for (const b of d.boot) L.push(`  ${b}`);
  sec(`EXITS / RESTARTS (tail ${d.exits.length})`);
  if (d.exits.length === 0) L.push(`  (no exits recorded)`);
  for (const e of d.exits) L.push(`  ${e}`);
  sec(`CRASHES / FATAL (tail ${d.crashes.length})`);
  if (d.crashes.length === 0) L.push(`  (no crashguard/fatal lines)`);
  for (const c of d.crashes) L.push(`  ${c}`);
  sec(`SERVER ERRORS (tail ${d.serverErrors.length})`);
  if (d.serverErrors.length === 0) L.push(`  (none)`);
  for (const s of d.serverErrors) L.push(`  ${s}`);
  sec(`HEARTBEAT SUMMARY (per process, ${d.hbSummary.length})`);
  L.push(`  pid	hb	firstUptime	lastUptime	firstRss	lastRss	growthMB/hr`);
  for (const h of d.hbSummary.slice(0, 60)) {
    L.push(`  ${h.pid}	${h.count}	${h.firstUptime}	${h.lastUptime}	${h.firstRss}	${h.lastRss}	${h.rssGrowthPerHour}`);
  }
  sec(`MEMORY TREND (24h, ${d.hbSeries.length} points \u2014 first/last 10)`);
  const sample = [...d.hbSeries.slice(0, 10), ...d.hbSeries.slice(-10)];
  L.push(`  ts	pid	uptime	rss	heap`);
  for (const p of sample) {
    L.push(`  ${p.ts}	${p.pid}	${p.uptime}	${p.rss}	${p.heap ?? "-"}`);
  }
  sec("WEB.CONFIG");
  if (d.webconfig) {
    L.push(`Path: ${d.webconfig.path}`);
    if (d.webconfig.iisnode) L.push(`iisnode: ${d.webconfig.iisnode}`);
    if (d.webconfig.httpErrors) L.push(`httpErrors: ${d.webconfig.httpErrors}`);
    if (d.webconfig.appPoolRecycling) L.push(`recycling: ${d.webconfig.appPoolRecycling}`);
  } else {
    L.push(`(not readable)`);
  }
  sec("APP POOL (appcmd)");
  L.push(d.appPool ? d.appPool.slice(0, 3e3) : `(unavailable)`);
  if (d.wpEvents) {
    sec("WORKER PROCESS EVENTS (wevtutil)");
    L.push(d.wpEvents.slice(0, 2e3));
  }
  L.push(`
${"=".repeat(70)}`);
  return L.join("\n");
}
var ciCache = { key: "", at: 0, value: { status: "unknown" } };
async function fetchCiStatus(sha) {
  const cacheKey = sha ?? "latest-main";
  const now = Date.now();
  if (ciCache.key === cacheKey && now - ciCache.at < 3e5) return ciCache.value;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const q = sha ? `head_sha=${sha}` : "branch=main";
  const store2 = (v) => {
    ciCache.key = cacheKey;
    ciCache.at = now;
    ciCache.value = v;
    return v;
  };
  try {
    const res = await fetch(`https://api.github.com/repos/robosphere99/switch_v2/actions/runs?${q}&per_page=1`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "switchnest-admin",
        ...token ? { Authorization: `Bearer ${token}` } : {}
      },
      signal: AbortSignal.timeout(8e3)
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return store2(
        token ? { status: "unknown", reason: `GitHub API ${res.status}` } : { status: "unknown", reason: "private repo \u2014 GITHUB_TOKEN env me daalo" }
      );
    }
    if (!res.ok) return store2({ status: "unknown", reason: `GitHub API ${res.status}` });
    const data = await res.json();
    const run = data.workflow_runs?.[0];
    if (!run) return store2({ status: "unknown", reason: "no workflow runs yet" });
    const conclusion = run.conclusion;
    return store2({
      status: conclusion === "success" ? "pass" : conclusion === "failure" || conclusion === "cancelled" || conclusion === "timed_out" || conclusion === "action_required" ? "fail" : run.status === "completed" ? "unknown" : "pending",
      runId: run.id,
      workflow: run.name ?? void 0,
      createdAt: run.created_at,
      updatedAt: run.updated_at
    });
  } catch (e) {
    return { status: "unknown", reason: e instanceof Error ? e.message : "network error" };
  }
}
var latestCache = { at: 0, value: null };
async function fetchLatestMain() {
  const now = Date.now();
  if (now - latestCache.at < 6e4) return latestCache.value;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  try {
    const res = await fetch("https://api.github.com/repos/robosphere99/switch_v2/commits/main", {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "switchnest-admin",
        ...token ? { Authorization: `Bearer ${token}` } : {}
      },
      signal: AbortSignal.timeout(8e3)
    });
    if (!res.ok) return latestCache.value;
    const j = await res.json();
    latestCache.value = { commit: j.sha || "", branch: "main", ts: j.commit?.committer?.date || "" };
    latestCache.at = now;
  } catch {
  }
  return latestCache.value;
}
function isAncestorOf(ancestor, head) {
  try {
    (0, import_node_child_process.execSync)(`git merge-base --is-ancestor ${ancestor} ${head}`, {
      stdio: "ignore",
      windowsHide: true,
      timeout: 5e3
    });
    return true;
  } catch {
    return false;
  }
}
adminRouter.get("/lan-info", async (_req, res) => {
  const lanIp = await detectLanIp();
  ok(res, { lanIp, espServerUrl: `http://${lanIp}:4000` });
});
var checkUrlLimiter = rateLimit({
  name: "admin:check-url",
  windowMs: 6e4,
  max: 30,
  message: "Bahut zyada URL checks \u2014 thodi der baad try karo"
});
var checkUrlSchema = import_zod13.z.object({ url: import_zod13.z.string().min(1).max(300) });
adminRouter.post("/check-url", checkUrlLimiter, validateBody(checkUrlSchema), async (req, res) => {
  const raw = String(req.body.url ?? "").trim();
  if (!/^https?:\/\//i.test(raw)) {
    throw new AppError("VALIDATION_ERROR", "URL http:// ya https:// se shuru hona chahiye", 400);
  }
  const started = Date.now();
  try {
    const ctrl = new AbortController();
    const timer4 = setTimeout(() => ctrl.abort(), 6e3);
    const r = await fetch(raw, { signal: ctrl.signal });
    clearTimeout(timer4);
    ok(res, { ok: true, status: r.status, ms: Date.now() - started });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    const msg = aborted ? "Timeout \u2014 6s me koi response nahi (URL galat ya server down?)" : err instanceof Error ? err.message : String(err);
    ok(res, { ok: false, error: msg, ms: Date.now() - started });
  }
});
adminRouter.get("/deploy-info", async (_req, res) => {
  let marker = null;
  const markerPath = import_node_path4.default.resolve(process.cwd(), "../logs/deploy.json");
  try {
    if (import_node_fs4.default.existsSync(markerPath)) {
      marker = JSON.parse(import_node_fs4.default.readFileSync(markerPath, "utf8"));
    }
  } catch {
  }
  let git = null;
  try {
    const head = (0, import_node_child_process.execSync)("git rev-parse HEAD", { encoding: "utf8", windowsHide: true, timeout: 8e3 }).trim();
    const branch = (0, import_node_child_process.execSync)("git rev-parse --abbrev-ref HEAD", { encoding: "utf8", windowsHide: true, timeout: 8e3 }).trim();
    if (head) git = { commit: head, branch };
  } catch {
  }
  let build = null;
  try {
    const bp = import_node_path4.default.resolve(process.cwd(), "dist/build-commit.json");
    if (import_node_fs4.default.existsSync(bp)) {
      const bj = JSON.parse(import_node_fs4.default.readFileSync(bp, "utf8"));
      if (bj?.commit) build = { commit: bj.commit, builtAt: bj.builtAt || "" };
    }
  } catch {
  }
  const ciSha = marker?.commit || git?.commit || build?.commit || void 0;
  const ci = await fetchCiStatus(ciSha);
  const latest = await fetchLatestMain();
  const deployedSource = marker?.commit ? "marker" : git?.commit ? "git" : build?.commit ? "build" : null;
  const deployedCommit = marker?.commit || git?.commit || build?.commit || null;
  const deployedAt = deployedSource === "marker" ? marker?.deployedAt || null : deployedSource === "build" ? build?.builtAt || null : null;
  const latestCommit = latest?.commit || null;
  const latestTs = latest?.ts || null;
  const markerTrusted = marker?.commit ? marker?.source !== "build" : true;
  let syncStatus = "unknown";
  let syncAgeMin = null;
  if (markerTrusted && deployedCommit && latestCommit && latestTs) {
    syncAgeMin = Math.round((Date.now() - new Date(latestTs).getTime()) / 6e4);
    if (deployedCommit === latestCommit) syncStatus = "synced";
    else if (syncAgeMin > 5) {
      const aheadOfMain = deployedSource === "git" && git?.commit && latestCommit ? isAncestorOf(latestCommit, git.commit) : false;
      syncStatus = aheadOfMain ? "local" : "lagging";
    } else syncStatus = "pending";
  }
  ok(res, {
    marker,
    git,
    build,
    deployedAt,
    latest,
    sync: {
      status: syncStatus,
      deployedCommit,
      deployedSource,
      latestCommit,
      ageMin: syncAgeMin,
      since: latest?.ts || null
    },
    ci,
    processUptimeSec: Math.round(process.uptime()),
    startedAt: new Date(Date.now() - process.uptime() * 1e3).toISOString()
  });
});
adminRouter.get("/diagnostics", async (_req, res) => {
  const TAIL_MAX2 = 5 * 1024 * 1024;
  const result = {
    logPath: logFilePath ?? null,
    logBytes: 0,
    process: {
      pid: process.pid,
      uptimeSec: Math.round(process.uptime()),
      rssMB: Math.round(process.memoryUsage().rss / 1048576),
      heapMB: Math.round(process.memoryUsage().heapUsed / 1048576),
      node: process.version,
      startedAt: new Date(Date.now() - process.uptime() * 1e3).toISOString()
    },
    parent: null,
    boot: [],
    exits: [],
    crashes: [],
    serverErrors: [],
    stats: { reqEnd: 0, reqAbort: 0, exitsInTail: 0, bootsInTail: 0 },
    hbSummary: [],
    hbSeries: [],
    healthCheck: {
      running: false,
      intervalSec: 30,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastCheck: null,
      checksTotal: 0,
      checksOk: 0,
      successRate: null,
      activeIncident: null,
      checking: false,
      incidents: []
    },
    leak: getLeakMonitorState(),
    webconfig: null,
    appPool: null,
    wpEvents: null
  };
  if (logFilePath && import_node_fs4.default.existsSync(logFilePath)) {
    try {
      const st = import_node_fs4.default.statSync(logFilePath);
      result.logBytes = st.size;
      let raw = "";
      if (st.size > TAIL_MAX2) {
        const fd = import_node_fs4.default.openSync(logFilePath, "r");
        const buf = Buffer.alloc(TAIL_MAX2);
        import_node_fs4.default.readSync(fd, buf, 0, TAIL_MAX2, st.size - TAIL_MAX2);
        import_node_fs4.default.closeSync(fd);
        raw = buf.toString("utf8");
      } else {
        raw = import_node_fs4.default.readFileSync(logFilePath, "utf8");
      }
      const lines = raw.split(/\r?\n/).filter(Boolean);
      const pushCap = (arr, l, cap) => {
        if (arr.length >= cap) return;
        arr.push(l);
      };
      for (const l of lines) {
        if (/^\[boot\]/.test(l)) {
          result.stats.bootsInTail += 1;
          pushCap(result.boot, l, 25);
        } else if (/\[hb\] (exit|beforeExit)/.test(l)) {
          result.stats.exitsInTail += 1;
          pushCap(result.exits, l, 25);
        } else if (/\[crashguard\]|\[fatal\]/.test(l)) {
          pushCap(result.crashes, l, 25);
        } else if (/^\[server\]/.test(l)) {
          pushCap(result.serverErrors, l, 10);
        } else if (/\[req\].*END/.test(l)) {
          result.stats.reqEnd += 1;
        } else if (/\[req\].*ABORT/.test(l)) {
          result.stats.reqAbort += 1;
        }
      }
      const hbRe = /\[hb\] alive uptime=(\d+)s pid=(\d+) rss=(\d+)MB/;
      const hbMap = /* @__PURE__ */ new Map();
      for (const l of lines) {
        const m = hbRe.exec(l);
        if (!m) continue;
        const pid = Number(m[2]);
        const uptime = Number(m[1]);
        const rss = Number(m[3]);
        const cur = hbMap.get(pid);
        if (!cur) {
          hbMap.set(pid, { pid, count: 1, firstUptime: uptime, lastUptime: uptime, firstRss: rss, lastRss: rss });
        } else {
          cur.count += 1;
          cur.lastUptime = uptime;
          cur.lastRss = rss;
        }
      }
      result.hbSummary = [...hbMap.values()].map((h) => ({
        ...h,
        rssGrowthPerHour: h.lastUptime > h.firstUptime ? Number(((h.lastRss - h.firstRss) / ((h.lastUptime - h.firstUptime) / 3600) || 0).toFixed(1)) : 0
      })).sort((a, b) => b.lastRss - a.lastRss);
      const hbSeriesRe = /\[hb\] alive ts=([\d:.TZ-]+) uptime=(\d+)s pid=(\d+) rss=(\d+)MB(?: heap=(\d+)MB)?/;
      const nowMs = Date.now();
      const dayAgo = nowMs - 24 * 3600 * 1e3;
      const series = [];
      for (const l of lines) {
        const m = hbSeriesRe.exec(l);
        if (!m) continue;
        const t = Date.parse(m[1]);
        if (Number.isNaN(t) || t < dayAgo) continue;
        series.push({
          ts: new Date(t).toISOString(),
          pid: Number(m[3]),
          uptime: Number(m[2]),
          rss: Number(m[4]),
          heap: m[5] ? Number(m[5]) : null
        });
      }
      series.sort((a, b) => a.ts.localeCompare(b.ts));
      const MAX_SERIES = 700;
      if (series.length > MAX_SERIES) {
        const step = Math.ceil(series.length / MAX_SERIES);
        result.hbSeries = series.filter((_, i) => i % step === 0);
      } else {
        result.hbSeries = series;
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }
  }
  result.healthCheck = getHealthMonitorState();
  result.leak = getLeakMonitorState();
  for (const cand of [
    import_node_path4.default.resolve(process.cwd(), "web.config"),
    import_node_path4.default.resolve(process.cwd(), "../web.config"),
    import_node_path4.default.resolve(process.cwd(), "../../web.config")
  ]) {
    if (!import_node_fs4.default.existsSync(cand)) continue;
    try {
      const content = import_node_fs4.default.readFileSync(cand, "utf8");
      const grab = (re) => {
        const m = re.exec(content);
        return m ? m[0].slice(0, 500) : null;
      };
      result.webconfig = {
        path: cand,
        iisnode: grab(/<iisnode\b[^>]*>/i),
        httpErrors: grab(/<httpErrors\b[^>]*>/i),
        appPoolRecycling: grab(/<recycling\b[\s\S]*?<\/recycling>/i)?.slice(0, 400) ?? null
      };
      break;
    } catch (err) {
      result.webconfig = {
        path: cand,
        iisnode: null,
        httpErrors: null,
        appPoolRecycling: null,
        error: err instanceof Error ? err.message : String(err)
      };
      break;
    }
  }
  const windir = process.env.windir || "C:\\Windows";
  try {
    const out = (0, import_node_child_process.execSync)(
      `"${windir}\\System32\\inetsrv\\appcmd.exe" list apppool /config`,
      { encoding: "utf8", windowsHide: true, timeout: 15e3 }
    );
    result.appPool = out.slice(0, 5e3);
  } catch (err) {
    result.appPool = `appcmd unavailable: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500);
  }
  try {
    const out = (0, import_node_child_process.execSync)(
      `"${windir}\\System32\\wevtutil.exe" qe Microsoft-Windows-IIS-W3SVC-WP/Operational /c:8 /rd:true /f:text`,
      { encoding: "utf8", windowsHide: true, timeout: 15e3 }
    );
    result.wpEvents = out.slice(0, 4e3);
  } catch {
  }
  try {
    const wm = (cmd) => (0, import_node_child_process.execSync)(cmd, { encoding: "utf8", windowsHide: true, timeout: 1e4 });
    const out = wm(`wmic process where ProcessId=${process.pid} get ParentProcessId /value`);
    const m = /ParentProcessId=(\d+)/.exec(out);
    if (m) {
      const ppid = Number(m[1]);
      const p2 = wm(`wmic process where ProcessId=${ppid} get Name,CreationDate,CommandLine /value`);
      result.parent = {
        pid: ppid,
        name: /Name=(.*)/.exec(p2)?.[1] ?? "",
        startTime: /CreationDate=(.*)/.exec(p2)?.[1] ?? "",
        cmdline: (/CommandLine=(.*)/.exec(p2)?.[1] ?? "").slice(0, 300)
      };
    }
  } catch {
  }
  if (String(_req.query.download) === "1") {
    const txt = buildDiagnosticsText(result);
    const fname = `switchnest-diagnostics-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    return res.send(txt);
  }
  ok(res, result);
});
adminRouter.get("/logs", async (_req, res) => {
  const n = Math.min(Number(_req.query.lines ?? 300) || 300, 1e3);
  const result = { path: logFilePath ?? null, totalLines: 0, lines: [], crashes: [], iisnodeLogs: [] };
  if (logFilePath && import_node_fs4.default.existsSync(logFilePath)) {
    const raw = import_node_fs4.default.readFileSync(logFilePath, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean).slice(-n);
    result.lines = lines;
    result.totalLines = lines.length;
    const crashMap = /* @__PURE__ */ new Map();
    for (const l of lines) {
      if (!/crashguard|unhandled|error|fail|exception/i.test(l)) continue;
      const key = l.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, " ").replace(/pid=\d+/g, "pid=N").replace(/uptime=\d+s/g, "uptime=N").replace(/rss=\d+MB/g, "rss=N").replace(/\[(boot|req|hb|scheduler|offline)\]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
      if (!key) continue;
      const cur = crashMap.get(key);
      if (cur) cur.count += 1;
      else crashMap.set(key, { line: l, count: 1 });
    }
    result.crashes = [...crashMap.values()];
  }
  const dirs = /* @__PURE__ */ new Set();
  if (logFilePath) dirs.add(import_node_path4.default.dirname(logFilePath));
  dirs.add(import_node_path4.default.resolve(process.cwd(), "../logs"));
  dirs.add(import_node_path4.default.resolve(process.cwd(), "../../logs"));
  for (const dir of dirs) {
    let entries = [];
    try {
      entries = import_node_fs4.default.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isFile()) continue;
      const name = e.name;
      if (!/^stdout_/i.test(name) && !/^stderr_/i.test(name) && !/\.log$/i.test(name)) continue;
      const full = import_node_path4.default.join(dir, name);
      try {
        const size = import_node_fs4.default.statSync(full).size;
        const buf = import_node_fs4.default.readFileSync(full, "utf8");
        const ls = buf.split(/\r?\n/).filter(Boolean).slice(-200);
        result.iisnodeLogs.push({ name, path: full, size, lines: ls });
      } catch {
      }
    }
  }
  ok(res, result);
});
try {
  import_node_fs4.default.mkdirSync(firmwareDir, { recursive: true });
} catch (err) {
  console.warn(`[firmware] cannot create ${firmwareDir}:`, err instanceof Error ? err.message : err);
}
var upload2 = (0, import_multer2.default)({
  storage: import_multer2.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, firmwareDir),
    filename: (_req, _file, cb) => cb(null, "firmware.bin")
  }),
  limits: { fileSize: 8 * 1024 * 1024 }
  // 8 MB is plenty for ESP32 .bin
});
adminRouter.get("/esp", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const current = await prisma.firmwareVersion.findFirst({ where: { isCurrent: true } });
  const esps = await prisma.espDevice.findMany({
    where: q ? {
      OR: [
        { name: { contains: q } },
        { serialCode: { contains: q } },
        { macAddress: { contains: q } },
        { ipAddress: { contains: q } },
        { ssid: { contains: q } },
        { modelCode: { contains: q } },
        { home: { OR: [{ name: { contains: q } }, { owner: { username: { contains: q } } }] } }
      ]
    } : void 0,
    select: {
      id: true,
      homeId: true,
      macAddress: true,
      name: true,
      ssid: true,
      serialCode: true,
      modelCode: true,
      ipAddress: true,
      firmwareVersion: true,
      lastSeen: true,
      offline: true,
      otaPendingVersion: true,
      otaRequestedAt: true,
      otaProgress: true,
      otaStatus: true,
      home: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          owner: { select: { username: true } },
          apiKeys: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { keyPrefix: true, label: true, createdAt: true }
          }
        }
      },
      devices: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          room: { select: { name: true } }
        },
        orderBy: { id: "asc" }
      }
    },
    orderBy: { lastSeen: "desc" },
    take: 100
  });
  const unlinked = await prisma.device.findMany({
    where: { espId: null },
    select: {
      id: true,
      homeId: true,
      name: true,
      type: true,
      status: true,
      firmwareVersion: true,
      ipAddress: true,
      lastSeen: true,
      offline: true,
      serialNumber: true,
      home: { select: { name: true } }
    },
    orderBy: { id: "asc" },
    take: 100
  });
  ok(res, { esps, unlinked, currentVersion: current?.version ?? null });
});
adminRouter.post("/esp/:id/key", async (req, res) => {
  const id = Number(req.params.id);
  const esp = await prisma.espDevice.findUnique({
    where: { id },
    include: { home: { select: { id: true, ownerId: true } } }
  });
  if (!esp?.home) throw new AppError("NOT_FOUND", "ESP ya home nahi mila");
  const crypto10 = await import("node:crypto");
  const plain = `rs_${crypto10.randomBytes(9).toString("base64url").replace(/-/g, "").slice(0, 16)}`;
  const keyHash = crypto10.createHash("sha256").update(plain).digest("hex");
  const keyPrefix = plain.slice(0, 8);
  await prisma.apiKey.create({
    data: {
      userId: esp.home.ownerId,
      homeId: esp.home.id,
      label: `admin-support-${Date.now()}`,
      keyHash,
      keyPrefix
    }
  });
  await audit(req.user.sub, "admin.esp.key.issue", {
    entity: "esp",
    entityId: id,
    meta: { homeId: esp.home.id }
  });
  ok(res, { apiKey: plain, keyPrefix });
});
adminRouter.get("/esp/issues", async (req, res) => {
  const esps = await prisma.espDevice.findMany({
    select: {
      id: true,
      homeId: true,
      macAddress: true,
      name: true,
      ssid: true,
      serialCode: true,
      modelCode: true,
      ipAddress: true,
      firmwareVersion: true,
      lastSeen: true,
      offline: true,
      home: {
        select: {
          id: true,
          name: true,
          owner: { select: { username: true } }
        }
      }
    },
    orderBy: { lastSeen: "asc" },
    take: 500
  });
  const now = Date.now();
  const DAY = 864e5;
  const issues = esps.map((e) => {
    const expectedName = e.serialCode && e.ssid ? `${e.serialCode} \xB7 ${e.ssid}` : null;
    const nameMismatch = !!e.name && !!expectedName && e.name !== expectedName && e.name.includes(" \xB7 ");
    const lastSeenMs = e.lastSeen ? e.lastSeen.getTime() : null;
    const staleDays = lastSeenMs ? Math.floor((now - lastSeenMs) / DAY) : null;
    const stale = e.offline && (lastSeenMs === null || now - lastSeenMs > DAY);
    return {
      id: e.id,
      homeId: e.homeId,
      macAddress: e.macAddress,
      name: e.name,
      expectedName,
      nameMismatch,
      ssid: e.ssid,
      serialCode: e.serialCode,
      modelCode: e.modelCode,
      ipAddress: e.ipAddress,
      firmwareVersion: e.firmwareVersion,
      lastSeen: e.lastSeen,
      offline: e.offline,
      stale,
      staleDays,
      home: e.home ? { id: e.home.id, name: e.home.name, owner: e.home.owner?.username ?? null } : null
    };
  });
  const filtered = issues.filter((i) => i.nameMismatch || i.stale);
  filtered.sort((a, b) => {
    if (a.nameMismatch !== b.nameMismatch) return a.nameMismatch ? -1 : 1;
    return (a.staleDays ?? 0) - (b.staleDays ?? 0);
  });
  ok(res, {
    issues: filtered,
    mismatchCount: filtered.filter((i) => i.nameMismatch).length,
    staleCount: filtered.filter((i) => i.stale).length
  });
});
adminRouter.patch("/esp/:id", async (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body?.name ?? "").trim().slice(0, 60);
  if (!name) throw new AppError("BAD_REQUEST", "Name required");
  const dup = await prisma.espDevice.findFirst({ where: { name, id: { not: id } }, select: { id: true } });
  if (dup) {
    throw new AppError("DUPLICATE_NAME", `Naam "${name}" already kisi aur board pe hai \u2014 har board ka unique naam chahiye`, 409);
  }
  const before = await prisma.espDevice.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Board nahi mila", 404);
  const esp = await prisma.espDevice.update({ where: { id }, data: { name } });
  await audit(req.user.sub, "admin.esp.rename", {
    entity: "esp",
    entityId: id,
    meta: { from: before.name ?? null, to: name }
  });
  const home = await prisma.home.findUnique({
    where: { id: esp.homeId },
    include: { members: { where: { role: { in: ["owner", "admin"] } }, select: { userId: true } } }
  });
  if (home) {
    const oldName = before.name ?? before.serialCode ?? `ESP-${before.macAddress.slice(-6).toUpperCase()}`;
    for (const m of home.members) {
      await createNotification(m.userId, {
        category: "support",
        type: "info",
        title: `\u{1F6F0}\uFE0F Support ne board renamed kiya: ${oldName} \u2192 ${name}`,
        body: `Support team ne board ka naam "${oldName}" se "${name}" kar diya.`
      });
    }
    emitToHome(esp.homeId, "esp:updated", { id, name });
  }
  ok(res, esp);
});
adminRouter.get("/esp/:id/history", async (req, res) => {
  const id = Number(req.params.id);
  const logs2 = await prisma.auditLog.findMany({
    where: {
      entity: "esp",
      entityId: id,
      action: { in: ["user.esp.rename", "admin.esp.rename"] }
    },
    include: { actor: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  ok(res, logs2);
});
adminRouter.get("/firmware", async (_req, res) => {
  const versions = await prisma.firmwareVersion.findMany({ orderBy: { createdAt: "desc" } });
  const current = versions.find((v) => v.isCurrent) ?? null;
  ok(res, { versions, current });
});
adminRouter.post("/firmware", upload2.single("firmware"), async (req, res) => {
  const version = String(req.body.version ?? "").trim();
  const releaseNotes = String(req.body.release_notes ?? "").trim();
  const modelCode = String(req.body.model ?? "").trim().toUpperCase();
  if (!version) throw new AppError("BAD_REQUEST", "Version is required (e.g. 1.0.1)");
  if (!req.file) throw new AppError("BAD_REQUEST", "Firmware .bin file is required");
  if (!req.file.originalname.toLowerCase().endsWith(".bin")) {
    throw new AppError("BAD_REQUEST", "Only .bin files are accepted");
  }
  if (!/^[A-Z0-9-]*$/.test(modelCode)) {
    throw new AppError("BAD_REQUEST", "Model code me sirf A-Z 0-9 - allowed");
  }
  const filename = modelCode ? `firmware-${modelCode.toLowerCase()}.bin` : "firmware.bin";
  const url = `/firmware/${filename}`;
  if (modelCode && filename !== "firmware.bin") {
    const uploaded = import_node_path4.default.join(firmwareDir, "firmware.bin");
    const target = import_node_path4.default.join(firmwareDir, filename);
    if (import_node_fs4.default.existsSync(uploaded) && uploaded !== target) {
      if (import_node_fs4.default.existsSync(target)) import_node_fs4.default.unlinkSync(target);
      import_node_fs4.default.renameSync(uploaded, target);
    }
  }
  await prisma.$transaction([
    // Sirf isi model ke puraane current deactivate karo — doosre models ke current untouched
    prisma.firmwareVersion.updateMany({ where: { modelCode, isCurrent: true }, data: { isCurrent: false } }),
    prisma.firmwareVersion.upsert({
      where: { version_modelCode: { version, modelCode } },
      create: { version, modelCode, url, releaseNotes, isCurrent: true },
      update: { releaseNotes, isCurrent: true, url }
    })
  ]);
  await audit(req.user.sub, "admin.firmware.upload", {
    entity: "firmware",
    meta: { version, modelCode: modelCode || "universal", releaseNotes }
  });
  ok(res, { version, modelCode, releaseNotes, published: true, url });
});
adminRouter.post("/firmware/:id/activate", async (req, res) => {
  const id = Number(req.params.id);
  const fw = await prisma.firmwareVersion.findUnique({ where: { id } });
  if (!fw) throw new AppError("NOT_FOUND", "Firmware version not found", 404);
  await prisma.$transaction([
    prisma.firmwareVersion.updateMany({ where: { modelCode: fw.modelCode }, data: { isCurrent: false } }),
    prisma.firmwareVersion.update({ where: { id }, data: { isCurrent: true } })
  ]);
  await audit(req.user.sub, "admin.firmware.activate", {
    entity: "firmware",
    entityId: id,
    meta: { version: fw.version }
  });
  ok(res, { id, version: fw.version, isCurrent: true });
});
adminRouter.post("/devices/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (status !== "on" && status !== "off") throw new AppError("VALIDATION_ERROR", "status must be 'on' or 'off'", 400);
  const device = await prisma.device.findUnique({
    where: { id },
    include: { home: { select: { ownerId: true } } }
  });
  if (!device) throw new AppError("NOT_FOUND", "Device not found", 404);
  await prisma.$transaction([
    prisma.device.update({ where: { id }, data: { status } }),
    prisma.deviceCommand.create({
      data: { deviceId: id, actorId: req.user.sub, command: `set_status:${status}` }
    }),
    prisma.deviceLog.create({
      data: { deviceId: id, actorId: req.user.sub, logType: "status_change", logMessage: `Admin turned device ${status}` }
    })
  ]);
  await audit(req.user.sub, "admin.device.control", {
    homeId: device.homeId,
    entity: "device",
    entityId: id,
    meta: { name: device.name, status }
  });
  await createNotification(device.home.ownerId, {
    category: "support",
    type: "info",
    title: `Support ne ${device.name} ${status === "on" ? "ON" : "OFF"} kiya`,
    body: `Admin ne aapke device "${device.name}" ko ${status === "on" ? "chalu (ON)" : "band (OFF)"} kiya. Agar yeh galat hai to turant support ko batayein.`
  });
  ok(res, { id, status });
});
adminRouter.get("/devices/:id/support", async (req, res) => {
  const id = Number(req.params.id);
  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      home: {
        select: {
          id: true,
          name: true,
          owner: { select: { id: true, username: true, email: true } },
          apiKeys: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { keyPrefix: true, label: true, createdAt: true }
          }
        }
      },
      room: { select: { name: true } },
      esp: {
        include: {
          devices: {
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              customValue: true,
              lastSeen: true
            },
            orderBy: { id: "asc" }
          }
        }
      },
      logs: { orderBy: { createdAt: "desc" }, take: 20 },
      commands: { orderBy: { createdAt: "desc" }, take: 20 }
    }
  });
  if (!device) throw new AppError("NOT_FOUND", "Device not found", 404);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  ok(res, { ...device, online: device.lastSeen !== null && device.lastSeen.getTime() > dayAgo.getTime() });
});
adminRouter.post("/esp/:id/rotate-console-password", async (req, res) => {
  const id = Number(req.params.id);
  const crypto10 = await import("node:crypto");
  const newPass = crypto10.randomBytes(4).toString("hex");
  const esp = await prisma.espDevice.findUnique({ where: { id } });
  if (!esp) throw new AppError("NOT_FOUND", "ESP not found", 404);
  await prisma.espDevice.update({
    where: { id },
    data: { consolePassword: newPass }
  });
  const { mqttPushRotatePassword: mqttPushRotatePassword2 } = await Promise.resolve().then(() => (init_mqtt_service(), mqtt_service_exports));
  mqttPushRotatePassword2(esp.macAddress, newPass);
  await audit(req.user.sub, "admin.esp.rotate_password", {
    entity: "esp",
    entityId: id,
    meta: { macAddress: esp.macAddress, newPass }
  });
  ok(res, { id, newPass });
});
adminRouter.post("/devices/:id/clear-commands", async (req, res) => {
  const id = Number(req.params.id);
  const device = await prisma.device.findUnique({
    where: { id },
    include: { home: { select: { ownerId: true } } }
  });
  if (!device) throw new AppError("NOT_FOUND", "Device not found", 404);
  const cleared = await prisma.deviceCommand.updateMany({
    where: { deviceId: id, status: "pending" },
    data: { status: "failed", executedAt: /* @__PURE__ */ new Date() }
  });
  await prisma.deviceLog.create({
    data: { deviceId: id, actorId: req.user.sub, logType: "support", logMessage: `Admin cleared ${cleared.count} stuck command(s)` }
  });
  await audit(req.user.sub, "admin.device.fix", {
    homeId: device.homeId,
    entity: "device",
    entityId: id,
    meta: { name: device.name, cleared: cleared.count }
  });
  if (cleared.count > 0) {
    await createNotification(device.home.ownerId, {
      category: "support",
      type: "warning",
      title: `Support ne "${device.name}" ke stuck commands clear kiye`,
      body: `${cleared.count} pending command(s) clear kiye gaye. Device ab dobara responsive hoga.`
    });
  }
  ok(res, { cleared: cleared.count });
});
adminRouter.post("/devices/:id/push-ota", async (req, res) => {
  const id = Number(req.params.id);
  const device = await prisma.device.findUnique({
    where: { id },
    include: { home: { select: { ownerId: true } } }
  });
  if (!device) throw new AppError("NOT_FOUND", "Device not found", 404);
  const esp = device.espId ? await prisma.espDevice.findUnique({ where: { id: device.espId } }) : null;
  const current = await resolveFirmware(esp?.modelCode);
  if (!current) {
    throw new AppError("NO_FIRMWARE", "No current firmware published yet \u2014 upload a .bin first", 400);
  }
  await prisma.device.update({
    where: { id },
    data: { otaPendingVersion: current.version, otaRequestedAt: /* @__PURE__ */ new Date() }
  });
  let espId = null;
  if (device.espId) {
    espId = device.espId;
    await prisma.espDevice.update({
      where: { id: espId },
      data: { otaPendingVersion: current.version, otaRequestedAt: /* @__PURE__ */ new Date() }
    });
  }
  await audit(req.user.sub, "admin.ota.push", {
    homeId: device.homeId,
    entity: "device",
    entityId: id,
    meta: { version: current.version, model: esp?.modelCode ?? null }
  });
  await createNotification(device.home.ownerId, {
    category: "support",
    type: "info",
    title: `Support ne "${device.name}" ke liye firmware update push kiya`,
    body: `Naya firmware v${current.version} aapke device pe agle heartbeat pe install hoga.`
  });
  ok(res, {
    deviceId: id,
    espId,
    version: current.version,
    model: current.modelCode || "universal",
    message: "OTA update pushed \u2014 the device will update on its next heartbeat"
  });
});
adminRouter.post("/devices/push-ota-all", async (req, res) => {
  const current = await prisma.firmwareVersion.findFirst({ where: { isCurrent: true } });
  if (!current) {
    throw new AppError("NO_FIRMWARE", "No current firmware published yet \u2014 upload a .bin first", 400);
  }
  const rawHome = Number(req.body.homeId ?? 0);
  const homeId = rawHome > 0 ? rawHome : void 0;
  const espResult = await prisma.espDevice.updateMany({
    where: homeId ? { homeId } : {},
    data: { otaPendingVersion: current.version, otaRequestedAt: /* @__PURE__ */ new Date() }
  });
  const deviceResult = await prisma.device.updateMany({
    where: { ...homeId ? { homeId } : {}, espId: null },
    data: { otaPendingVersion: current.version, otaRequestedAt: /* @__PURE__ */ new Date() }
  });
  const count = espResult.count + deviceResult.count;
  await audit(req.user.sub, "admin.ota.push_all", {
    homeId,
    entity: "device",
    meta: { version: current.version, count }
  });
  const homeIds = /* @__PURE__ */ new Set();
  if (homeId) {
    homeIds.add(homeId);
  } else {
    (await prisma.espDevice.findMany({ select: { homeId: true } })).forEach((r) => r.homeId && homeIds.add(r.homeId));
    (await prisma.device.findMany({ where: { espId: null }, select: { homeId: true } })).forEach((r) => r.homeId && homeIds.add(r.homeId));
  }
  const ownerIds = new Set(
    (await prisma.home.findMany({ where: { id: { in: [...homeIds] } }, select: { ownerId: true } })).map((h) => h.ownerId)
  );
  await Promise.all(
    [...ownerIds].map(
      (ownerId) => createNotification(ownerId, {
        category: "support",
        type: "info",
        title: "Support ne firmware update push kiya",
        body: `Aapke ${count} device(s) ke liye naya firmware v${current.version} available hai \u2014 agle heartbeat pe auto-install hoga.`
      })
    )
  );
  ok(res, { count, version: current.version });
});
adminRouter.get("/esp/:id/probe", async (req, res) => {
  const id = Number(req.params.id);
  const esp = await prisma.espDevice.findUnique({ where: { id } });
  if (!esp) throw new AppError("NOT_FOUND", "ESP not found", 404);
  const ip = esp.ipAddress?.trim();
  if (!ip) {
    return ok(res, { reachable: false, reason: "no_ip" });
  }
  if (!/^[\d.a-fA-F:]+$/.test(ip)) {
    return ok(res, { reachable: false, reason: "invalid_ip" });
  }
  const url = `http://${ip}/`;
  const started = Date.now();
  const controller = new AbortController();
  const timer4 = setTimeout(() => controller.abort(), 3e3);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "SwitchNest-Admin/1.0" }
    });
    return ok(res, { reachable: true, latencyMs: Date.now() - started, statusCode: r.status });
  } catch {
    return ok(res, { reachable: false, reason: "unreachable", latencyMs: Date.now() - started });
  } finally {
    clearTimeout(timer4);
  }
});
adminRouter.get("/products", async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { serials: true } }, media: { orderBy: { id: "asc" } } }
    });
    ok(res, products);
  } catch (err) {
    const products = await prisma.product.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { serials: true } } }
    });
    ok(res, products.map((p) => ({ ...p, media: [] })));
  }
});
adminRouter.post("/products", async (req, res) => {
  const { name, modelCode, relayCount, price, description, features, imageUrl, stockCount } = req.body ?? {};
  if (!name || !modelCode || price == null) {
    throw new AppError("BAD_REQUEST", "name, modelCode and price are required");
  }
  const product = await prisma.product.create({
    data: {
      name: String(name).slice(0, 100),
      modelCode: String(modelCode).trim().toUpperCase().slice(0, 32),
      relayCount: Number(relayCount) || 0,
      price: Number(price),
      description: description ? String(description) : void 0,
      features: features ? typeof features === "string" ? JSON.parse(features) : features : void 0,
      imageUrl: imageUrl ? String(imageUrl).slice(0, 255) : void 0,
      stockCount: stockCount != null ? Number(stockCount) : 0
    }
  });
  await audit(req.user.sub, "admin.product.create", { entity: "product", entityId: product.id, meta: { modelCode } });
  ok(res, product, 201);
});
adminRouter.patch("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, price, description, features, imageUrl, active, stockCount } = req.body ?? {};
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: name != null ? String(name).slice(0, 100) : void 0,
      price: price != null ? Number(price) : void 0,
      description: description != null ? String(description) : void 0,
      features: features ? typeof features === "string" ? JSON.parse(features) : features : void 0,
      imageUrl: imageUrl != null ? String(imageUrl).slice(0, 255) : void 0,
      stockCount: stockCount != null ? Number(stockCount) : void 0,
      active: active != null ? Boolean(active) : void 0
    }
  });
  await audit(req.user.sub, "admin.product.update", { entity: "product", entityId: id });
  ok(res, product);
});
adminRouter.delete("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.product.delete({ where: { id } });
  await audit(req.user.sub, "admin.product.delete", { entity: "product", entityId: id });
  ok(res, { deleted: true });
});
var productMediaUpload = (0, import_multer2.default)({
  storage: import_multer2.default.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = import_node_path4.default.join(process.cwd(), "uploads/product-media");
      import_node_fs4.default.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = import_node_path4.default.extname(file.originalname);
      cb(null, `pm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 }
});
adminRouter.post("/products/:id/media", productMediaUpload.single("file"), async (req, res) => {
  const productId = Number(req.params.id);
  if (!req.file) throw new AppError("BAD_REQUEST", "No file uploaded");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError("NOT_FOUND", "Product not found");
  const fileUrl = `/uploads/product-media/${req.file.filename}`;
  const ext = import_node_path4.default.extname(req.file.originalname).toLowerCase();
  const type = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext) ? "image" : [".mp4", ".webm", ".mov"].includes(ext) ? "video" : "document";
  const media = await prisma.productMedia.create({
    data: { productId, url: fileUrl, type }
  });
  await audit(req.user.sub, "admin.product.media.add", { entity: "product", entityId: productId, meta: { mediaId: media.id } });
  ok(res, media, 201);
});
adminRouter.delete("/products/media/:mediaId", async (req, res) => {
  const mediaId = Number(req.params.mediaId);
  const media = await prisma.productMedia.findUnique({ where: { id: mediaId } });
  if (!media) throw new AppError("NOT_FOUND", "Media not found");
  const filePath = import_node_path4.default.join(process.cwd(), media.url.replace(/^\/+/, ""));
  try {
    import_node_fs4.default.unlinkSync(filePath);
  } catch {
  }
  await prisma.productMedia.delete({ where: { id: mediaId } });
  await audit(req.user.sub, "admin.product.media.delete", { entity: "product", entityId: media.productId ?? void 0, meta: { mediaId } });
  ok(res, { deleted: true });
});
adminRouter.get("/orders", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : void 0;
  const orders = await prisma.order.findMany({
    where: status ? { status } : void 0,
    include: {
      items: true,
      serials: { select: { serialCode: true, testedAt: true } },
      user: { select: { id: true, username: true, email: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  ok(res, orders);
});
adminRouter.get("/orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      serials: { select: { serialCode: true, testedAt: true } },
      user: { select: { id: true, username: true, email: true } }
    }
  });
  if (!order) throw new AppError("NOT_FOUND", "Order not found");
  ok(res, { ...order, verifyToken: signBillToken(order.id) });
});
adminRouter.patch("/orders/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  const order = await updateOrderStatus(id, status);
  await audit(req.user.sub, `admin.order.${status}`, {
    entity: "order",
    entityId: id,
    meta: { orderNumber: order.orderNumber }
  });
  ok(res, order);
});
adminRouter.patch("/orders/:id/payment-status", async (req, res) => {
  const id = Number(req.params.id);
  const paymentStatus = String(req.body?.paymentStatus ?? "");
  const order = await prisma.order.update({
    where: { id },
    data: {
      paymentStatus,
      paidAt: paymentStatus === "paid" ? /* @__PURE__ */ new Date() : null
    }
  });
  await audit(req.user.sub, `admin.order.payment.${paymentStatus}`, {
    entity: "order",
    entityId: id,
    meta: { orderNumber: order.orderNumber }
  });
  ok(res, order);
});
adminRouter.get("/serials", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : void 0;
  const productId = req.query.productId ? Number(req.query.productId) : void 0;
  const orderId = req.query.orderId ? Number(req.query.orderId) : void 0;
  const serials = await prisma.serialRegistry.findMany({
    where: {
      ...status ? { status } : {},
      ...productId ? { productId } : {},
      ...orderId ? { orderId } : {}
    },
    select: {
      id: true,
      serialCode: true,
      productId: true,
      orderId: true,
      userId: true,
      homeId: true,
      status: true,
      createdAt: true,
      claimedAt: true,
      testedAt: true,
      product: { select: { id: true, name: true, modelCode: true } },
      user: { select: { id: true, username: true, email: true } },
      order: { select: { id: true, orderNumber: true, status: true } }
    },
    orderBy: { id: "desc" },
    take: 500
  });
  const orderIds = [...new Set(serials.map((s) => s.orderId).filter((x) => Boolean(x)))];
  const perOrder = {};
  if (orderIds.length) {
    const byOrder = await prisma.serialRegistry.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true, serialCode: true, orderId: true },
      orderBy: { id: "asc" }
    });
    for (const s of byOrder) {
      if (!s.orderId) continue;
      (perOrder[s.orderId] ??= []).push(s.serialCode);
    }
  }
  const enriched = serials.map((s) => {
    const codes = s.orderId ? perOrder[s.orderId] : void 0;
    return {
      ...s,
      orderIdx: codes ? codes.indexOf(s.serialCode) + 1 : 0,
      orderTotal: codes?.length ?? 0
    };
  });
  ok(res, enriched);
});
adminRouter.get("/serials/:code", async (req, res) => {
  const code = String(req.params.code ?? "").trim().toUpperCase();
  const serial = await prisma.serialRegistry.findUnique({
    where: { serialCode: code },
    include: {
      product: { select: { id: true, name: true, modelCode: true } },
      user: { select: { id: true, username: true, email: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      home: { select: { id: true, name: true } }
    }
  });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");
  ok(res, serial);
});
adminRouter.post("/serials/generate", async (req, res) => {
  const productId = Number(req.body?.productId);
  const count = Number(req.body?.count ?? 10);
  const codes = await generateSerials(productId, count);
  await audit(req.user.sub, "admin.serial.generate", {
    entity: "product",
    entityId: productId,
    meta: { count, codes: codes.slice(0, 5) }
  });
  ok(res, { generated: codes.length, codes }, 201);
});
adminRouter.delete("/serials/:code", async (req, res) => {
  const code = String(req.params.code ?? "").trim().toUpperCase();
  const serial = await prisma.serialRegistry.findUnique({ where: { serialCode: code } });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");
  if (serial.status !== "available") {
    throw new AppError("BAD_REQUEST", "Sirf available serials delete ho sakte hain");
  }
  await prisma.serialRegistry.delete({ where: { id: serial.id } });
  await audit(req.user.sub, "admin.serial.delete", {
    entity: "serial",
    entityId: serial.id,
    meta: { serialCode: code }
  });
  ok(res, { deleted: true });
});
adminRouter.delete("/serials", async (req, res) => {
  const codes = req.body?.codes;
  if (!Array.isArray(codes) || codes.length === 0) {
    throw new AppError("BAD_REQUEST", "codes array required");
  }
  if (codes.length > 500) {
    throw new AppError("BAD_REQUEST", "Ek baar me max 500 serials delete kar sakte ho");
  }
  const upperCodes = codes.map((c) => String(c).trim().toUpperCase());
  const serials = await prisma.serialRegistry.findMany({
    where: { serialCode: { in: upperCodes } }
  });
  const available = serials.filter((s) => s.status === "available");
  const skipped = upperCodes.length - available.length;
  if (available.length === 0) {
    throw new AppError("BAD_REQUEST", "Koi available serial nahi mila delete karne ke liye");
  }
  await prisma.serialRegistry.deleteMany({
    where: { id: { in: available.map((s) => s.id) } }
  });
  await audit(req.user.sub, "admin.serial.bulk_delete", {
    entity: "serial",
    meta: { count: available.length, skipped, codes: upperCodes.slice(0, 10) }
  });
  ok(res, { deleted: available.length, skipped });
});
adminRouter.post("/orders/:id/serials/generate", async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true }
  });
  if (!order) throw new AppError("NOT_FOUND", "Order not found", 404);
  const item = order.items[0];
  if (!item) throw new AppError("BAD_REQUEST", "Order me koi item nahi", 400);
  const made = await prisma.serialRegistry.count({ where: { orderId: order.id } });
  const totalQty = order.items.reduce((sum, it) => sum + it.quantity, 0);
  if (made >= totalQty) {
    return ok(res, { done: true, serialCode: null, modelCode: null });
  }
  const product = await prisma.product.findUnique({ where: { id: item.productId } });
  const modelCode = product?.modelCode ?? "4CH";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let tries = 0; tries < 10; tries++) {
    let rnd = "";
    for (let i = 0; i < 6; i++) rnd += chars[Math.floor(Math.random() * chars.length)];
    const candidate = `RS-${modelCode}-${rnd}`;
    const dup = await prisma.serialRegistry.findUnique({ where: { serialCode: candidate } });
    if (!dup) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new AppError("CONFLICT", "Serial generate nahi ho paya \u2014 try again", 409);
  await prisma.serialRegistry.create({
    data: { serialCode: code, productId: item.productId, orderId: order.id, status: "reserved" }
  });
  if (!item.serialCode) {
    await prisma.orderItem.update({ where: { id: item.id }, data: { serialCode: code } });
  }
  await audit(req.user.sub, "admin.serial.generate.order", {
    entity: "order",
    entityId: order.id,
    meta: { serialCode: code, orderNumber: order.orderNumber }
  });
  ok(res, { done: false, serialCode: code, modelCode }, 201);
});
adminRouter.get("/orders/:id/provision", async (req, res) => {
  const include = {
    items: true,
    user: { select: { id: true, username: true, email: true } }
  };
  const raw = String(req.params.id).trim();
  let order = /^\d+$/.test(raw) ? await prisma.order.findUnique({ where: { id: Number(raw) }, include }) : null;
  if (!order && raw) {
    const matches2 = await prisma.order.findMany({
      where: { orderNumber: { contains: raw.toUpperCase() } },
      orderBy: { id: "desc" },
      take: 1,
      include
    });
    order = matches2[0] ?? null;
  }
  if (!order) throw new AppError("NOT_FOUND", "Order not found");
  if (order.status === "pending" || order.status === "cancelled") {
    throw new AppError(
      "BAD_REQUEST",
      "Payment verify nahi hua \u2014 pehle admin Orders me order ko 'Mark Paid' karo, phir fetch karo"
    );
  }
  const items = await Promise.all(
    order.items.map(async (it) => {
      const prod = await prisma.product.findUnique({
        where: { id: it.productId },
        select: { modelCode: true }
      });
      return {
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        price: Number(it.price),
        quantity: it.quantity,
        serialCode: it.serialCode,
        modelCode: prod?.modelCode ?? null
      };
    })
  );
  let wifiPassword = null;
  if (order.wifiPasswordEnc) {
    try {
      wifiPassword = decryptSecret(order.wifiPasswordEnc);
    } catch {
      wifiPassword = null;
    }
  }
  const crypto10 = await import("node:crypto");
  const plain = `rs_${crypto10.randomBytes(9).toString("base64url").replace(/-/g, "").slice(0, 16)}`;
  const keyHash = crypto10.createHash("sha256").update(plain).digest("hex");
  const keyPrefix = plain.slice(0, 8);
  const home = await prisma.home.findFirst({ where: { ownerId: order.userId } });
  if (home) {
    await prisma.apiKey.create({
      data: {
        userId: order.userId,
        homeId: home.id,
        label: `factory-order-${order.orderNumber}`,
        keyHash,
        keyPrefix
      }
    });
  }
  const apiKeyPlain = home ? plain : null;
  ok(res, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    wifiSsid: order.wifiSsid,
    wifiPassword,
    apiKey: apiKeyPlain,
    user: order.user,
    items
  });
});
adminRouter.post("/serials/:code/mark-tested", async (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const { consolePassword } = req.body ?? {};
  const serial = await prisma.serialRegistry.findUnique({ where: { serialCode: code } });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");
  const updated = await prisma.serialRegistry.update({
    where: { id: serial.id },
    data: {
      testedAt: /* @__PURE__ */ new Date(),
      consolePassword: consolePassword ? String(consolePassword) : void 0
    }
  });
  await audit(req.user.sub, "admin.serial.tested", {
    entity: "serial",
    entityId: serial.id,
    meta: { serialCode: code, hasConsolePassword: !!consolePassword }
  });
  if (serial.orderId) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: serial.orderId },
        include: { items: true, serials: { select: { testedAt: true } } }
      });
      if (order && order.status === "processing") {
        await createNotification(order.userId, {
          category: "system",
          type: "info",
          title: "\u2705 Factory test pass",
          body: `Aapka board (${code}) factory relay self-test pass kar chuka hai. Order ${order.orderNumber}.`
        });
        const qtyRequired = order.items.reduce((sum, item) => sum + item.quantity, 0);
        const testedCount = order.serials.filter((s) => s.testedAt !== null).length;
        if (testedCount >= qtyRequired) {
          await updateOrderStatus(order.id, "packed");
        }
      }
    } catch (err) {
      console.error("[admin] tested notification/cascade failed", err);
    }
  }
  ok(res, { tested: true, serialCode: code, testedAt: updated.testedAt });
});
adminRouter.get("/warranty", async (_req, res) => {
  const claims = await prisma.warrantyClaim.findMany({
    include: { user: { select: { id: true, username: true, email: true } } },
    orderBy: { createdAt: "desc" }
  });
  const codes = [...new Set(claims.map((c) => c.serialCode))];
  const serials = await prisma.serialRegistry.findMany({
    where: { serialCode: { in: codes } },
    select: { serialCode: true, warrantyStatus: true, warrantyExpiresAt: true, product: { select: { name: true, modelCode: true } } }
  });
  ok(res, claims.map((c) => ({ ...c, serial: serials.find((s) => s.serialCode === c.serialCode) ?? null })));
});
adminRouter.patch("/warranty/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!["approved", "rejected", "resolved"].includes(status)) {
    throw new AppError("BAD_REQUEST", "Status approved | rejected | resolved hona chahiye");
  }
  const claim = await prisma.warrantyClaim.findUnique({ where: { id } });
  if (!claim) throw new AppError("NOT_FOUND", "Claim not found");
  const serial = await prisma.serialRegistry.findUnique({ where: { serialCode: claim.serialCode } });
  if (claim.status === "resolved") throw new AppError("BAD_REQUEST", "Resolved claim change nahi hoti");
  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.warrantyClaim.update({
      where: { id },
      data: { status }
    });
    if (status === "resolved" || status === "rejected") {
      await tx.serialRegistry.update({
        where: { serialCode: claim.serialCode },
        data: { warrantyStatus: "active" }
      });
    }
    return c;
  });
  await audit(req.user.sub, `admin.warranty.${status}`, {
    entity: "warranty_claim",
    entityId: id,
    meta: { serialCode: claim.serialCode }
  });
  const statusMsg = {
    approved: `Aapki warranty claim (${claim.serialCode}) APPROVED ho gayi \u2014 replacement/repair ke liye support se baat karo.`,
    rejected: `Aapki warranty claim (${claim.serialCode}) REJECT ho gayi. Reason ke liye support se baat karo.`,
    resolved: `Aapki warranty claim (${claim.serialCode}) RESOLVED ho gayi \u2014 issue sort ho gaya.`
  };
  try {
    await createNotificationWithEmail(
      claim.userId,
      {
        category: "system",
        type: status === "rejected" ? "warning" : "info",
        title: `\u{1F6E1}\uFE0F Warranty ${status}: ${claim.serialCode}`,
        body: statusMsg[status] ?? `Claim status update: ${status}`
      },
      {
        emailSubject: `\u{1F6E1}\uFE0F Warranty claim ${status} \u2014 ${claim.serialCode}`,
        ctaUrl: "/warranty",
        ctaLabel: "Warranty dekho"
      }
    );
  } catch (err) {
    console.error("[admin] warranty email failed", err);
  }
  ok(res, { id: updated.id, status: updated.status });
});
adminRouter.get("/contact", async (_req, res) => {
  const msgs = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, username: true, email: true, role: true } } }
  });
  ok(res, msgs);
});
adminRouter.patch("/contact/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!["new", "read", "done"].includes(status)) throw new AppError("BAD_REQUEST", "Status new | read | done");
  const updated = await prisma.contactMessage.update({ where: { id }, data: { status } });
  ok(res, updated);
});
adminRouter.delete("/contact/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.contactMessage.delete({ where: { id } });
  ok(res, { deleted: true });
});
var resetSchema = import_zod13.z.object({
  mode: import_zod13.z.enum(["data", "factory"]),
  confirm: import_zod13.z.literal("RESET")
});
adminRouter.post("/reset", validateBody(resetSchema), async (req, res) => {
  const { mode } = req.body;
  const ALL_TABLES = [
    "api_keys",
    "app_meta",
    "assistant_chats",
    "assistant_messages",
    "audit_logs",
    "contact_messages",
    "device_access",
    "device_commands",
    "device_configurations",
    "device_logs",
    "device_usage",
    "devices",
    "esp_devices",
    "firmware_versions",
    "home_members",
    "homes",
    "invitations",
    "notifications",
    "order_items",
    "orders",
    "products",
    "refresh_tokens",
    "rooms",
    "schedules",
    "serial_registry",
    "support_chat_settings",
    "support_messages",
    "users",
    "warranty_claims"
  ];
  const KEEP_IN_DATA = /* @__PURE__ */ new Set(["products", "app_meta", "users", "firmware_versions"]);
  const tablesToWipe = mode === "factory" ? ALL_TABLES : ALL_TABLES.filter((t) => !KEEP_IN_DATA.has(t));
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=0");
    for (const t of tablesToWipe) {
      await tx.$executeRawUnsafe(`DELETE FROM \`${t}\``);
    }
    if (mode === "data") {
      await tx.$executeRawUnsafe("DELETE FROM `users` WHERE role <> 'system_admin'");
    }
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=1");
  });
  if (mode === "factory") {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=0");
      for (const t of ALL_TABLES) {
        await tx.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${t}\``);
      }
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=1");
    });
    setDbReady(false);
  } else {
    await audit(req.user.sub, "admin.reset", { entity: "platform", meta: { mode } });
  }
  ok(res, {
    reset: true,
    mode,
    message: mode === "factory" ? "Factory reset ho gaya \u2014 ab install wizard se fresh setup karo" : "Data reset ho gaya \u2014 admin + catalog rahe, baaki sab clear"
  });
});

// src/routes/shop.routes.ts
var import_express12 = require("express");
var import_multer3 = __toESM(require("multer"), 1);
init_prisma();
init_audit_service();

// src/services/payment.service.ts
var import_node_crypto8 = __toESM(require("node:crypto"), 1);
init_env();
function razorpayConfigured() {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}
async function createRazorpayOrder(amountInr, receipt) {
  const auth = "Basic " + Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ amount: Math.round(amountInr * 100), currency: "INR", receipt })
  });
  if (!res.ok) throw new AppError("PAYMENT_ERROR", `Razorpay order create fail (${res.status})`);
  return res.json();
}
function verifyRazorpaySignature(orderId, paymentId, signature) {
  const expected = import_node_crypto8.default.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  return expected === signature;
}
function verifyRazorpayWebhook(rawBody, signature) {
  const expected = import_node_crypto8.default.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(rawBody).digest("hex");
  return expected === signature;
}

// src/routes/shop.routes.ts
var import_child_process = require("child_process");
var import_util = require("util");
var import_os = __toESM(require("os"), 1);
var execAsync = (0, import_util.promisify)(import_child_process.exec);
var shopRouter = (0, import_express12.Router)();
var storage2 = import_multer3.default.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_"))
});
var upload3 = (0, import_multer3.default)({ storage: storage2, limits: { fileSize: 50 * 1024 * 1024 } });
shopRouter.get("/products", async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: { media: true },
      orderBy: { id: "asc" }
    });
    ok(res, products);
  } catch (err) {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { id: "asc" }
    });
    ok(res, products.map((p) => ({ ...p, media: [] })));
  }
});
shopRouter.post("/upload", requireAuth, upload3.single("file"), (req, res) => {
  if (!req.file) throw new AppError("BAD_REQUEST", "No file uploaded");
  ok(res, { url: `/uploads/${req.file.filename}` });
});
shopRouter.get("/products/:id/reviews", async (req, res) => {
  const reviews = await prisma.productReview.findMany({
    where: { productId: Number(req.params.id) },
    include: { user: { select: { username: true, avatarUrl: true } }, media: true },
    orderBy: { createdAt: "desc" }
  });
  ok(res, reviews);
});
shopRouter.post("/products/:id/reviews", requireAuth, async (req, res) => {
  const productId = Number(req.params.id);
  const { rating, comment, mediaUrls } = req.body;
  if (!rating || rating < 1 || rating > 5) throw new AppError("BAD_REQUEST", "Valid rating (1-5) required");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError("NOT_FOUND", "Product not found");
  const review = await prisma.$transaction(async (tx) => {
    const rev = await tx.productReview.create({
      data: {
        productId,
        userId: req.user.sub,
        rating,
        comment,
        media: {
          create: (mediaUrls || []).map((url) => ({ url, type: url.match(/\.(mp4|mov|webm)$/i) ? "video" : "image" }))
        }
      },
      include: { media: true, user: { select: { username: true } } }
    });
    const all = await tx.productReview.findMany({ where: { productId }, select: { rating: true } });
    const total2 = all.length;
    const avg = all.reduce((sum, r) => sum + Number(r.rating), 0) / total2;
    await tx.product.update({
      where: { id: productId },
      data: { rating: avg, totalReviews: total2 }
    });
    return rev;
  });
  ok(res, review, 201);
});
shopRouter.post("/orders", requireAuth, async (req, res) => {
  const { items, shipping, wifi, paymentMethod } = req.body ?? {};
  if (!Array.isArray(items) || !items.length) {
    throw new AppError("BAD_REQUEST", "Cart is empty");
  }
  if (!shipping?.name || !shipping?.phone || !shipping?.address) {
    throw new AppError("BAD_REQUEST", "Shipping name, phone and address are required");
  }
  const method = String(paymentMethod ?? "cod");
  if (!["cod", "upi", "manual"].includes(method)) {
    throw new AppError("BAD_REQUEST", "Invalid payment method");
  }
  const order = await createOrder({
    userId: req.user.sub,
    items: items.map((i) => ({
      productId: Number(i.productId),
      quantity: Number(i.quantity)
    })),
    shipping: {
      name: String(shipping.name).slice(0, 100),
      phone: String(shipping.phone).slice(0, 20),
      address: String(shipping.address).slice(0, 255)
    },
    wifi: wifi?.ssid || wifi?.password ? { ssid: String(wifi.ssid ?? ""), password: String(wifi.password ?? "") } : void 0,
    paymentMethod: method
  });
  await audit(req.user.sub, "shop.order.create", {
    entity: "order",
    entityId: order.id,
    meta: { orderNumber: order.orderNumber, total: Number(order.totalAmount) }
  });
  ok(res, order, 201);
});
shopRouter.get("/orders", requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.sub },
    include: { items: true },
    orderBy: { createdAt: "desc" }
  });
  const serialCodes = [...new Set(orders.flatMap((o) => o.items.map((i) => i.serialCode).filter(Boolean)))];
  const claimedSet = /* @__PURE__ */ new Set();
  if (serialCodes.length > 0) {
    const rows = await prisma.serialRegistry.findMany({
      where: { serialCode: { in: serialCodes } },
      select: { serialCode: true, status: true }
    });
    for (const r of rows) {
      if (r.status === "claimed") claimedSet.add(r.serialCode);
    }
  }
  ok(
    res,
    orders.map((o) => {
      const codes = o.items.map((i) => i.serialCode).filter(Boolean);
      return {
        ...o,
        allClaimed: codes.length > 0 && codes.every((c) => claimedSet.has(c))
      };
    })
  );
});
shopRouter.get("/orders/:id/stickers", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, orderNumber: true, userId: true, status: true }
  });
  if (!order || order.userId !== req.user.sub) {
    throw new AppError("NOT_FOUND", "Order not found", 404);
  }
  const serials = await prisma.serialRegistry.findMany({
    where: { orderId: id },
    include: {
      product: { select: { id: true, name: true, modelCode: true } },
      user: { select: { id: true, username: true, email: true } },
      order: { select: { id: true, orderNumber: true, status: true } }
    },
    orderBy: { id: "asc" }
  });
  const enriched = serials.map((s, i) => ({
    ...s,
    orderIdx: i + 1,
    orderTotal: serials.length
  }));
  ok(res, { orderId: id, orderNumber: order.orderNumber, status: order.status, serials: enriched });
});
shopRouter.post("/orders/:id/cancel", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== req.user.sub) {
    throw new AppError("NOT_FOUND", "Order not found");
  }
  if (order.status !== "pending") {
    throw new AppError("BAD_REQUEST", "Only pending orders can be cancelled");
  }
  await updateOrderStatus(id, "cancelled");
  await audit(req.user.sub, "shop.order.cancel", { entity: "order", entityId: id });
  ok(res, { cancelled: true });
});
shopRouter.post("/orders/:id/pay", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  console.log(`[BACKEND PAYMENT DEBUG] Initiate payment requested for Order ID: ${id}`);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== req.user.sub) {
    throw new AppError("NOT_FOUND", "Order not found");
  }
  if (order.status !== "pending") {
    throw new AppError("BAD_REQUEST", "Only pending orders can be paid");
  }
  if (order.paymentMethod === "cod") {
    throw new AppError("BAD_REQUEST", "COD order me online payment nahi hoti");
  }
  if (razorpayConfigured()) {
    const rp = await createRazorpayOrder(Number(order.totalAmount), `order_${order.id}`);
    await prisma.order.update({
      where: { id },
      data: { razorpayOrderId: String(rp.id) }
    });
    await audit(req.user.sub, "shop.payment.initiate", {
      entity: "order",
      entityId: id,
      meta: { razorpayOrderId: rp.id, total: Number(order.totalAmount) }
    });
    ok(res, { mode: "razorpay", razorpayOrderId: rp.id, amount: Number(order.totalAmount), keyId: process.env.RAZORPAY_KEY_ID ?? "" });
  } else {
    const upiIntent = `upi://pay?pa=switchnest@okaxis&pn=SwitchNest&am=${Number(order.totalAmount).toFixed(2)}&tn=Order%20${order.orderNumber}`;
    await audit(req.user.sub, "shop.payment.initiate", {
      entity: "order",
      entityId: id,
      meta: { mode: "demo", upiIntent, total: Number(order.totalAmount) }
    });
    ok(res, { mode: "demo", upiIntent, amount: Number(order.totalAmount), note: "Demo mode \u2014 UPI app se pay karke 'Paid' verify karo" });
  }
});
shopRouter.post("/orders/:id/pay/verify", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body ?? {};
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new AppError("BAD_REQUEST", "razorpayOrderId, razorpayPaymentId, razorpaySignature required");
  }
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== req.user.sub) {
    throw new AppError("NOT_FOUND", "Order not found");
  }
  if (order.razorpayOrderId !== razorpayOrderId) {
    throw new AppError("BAD_REQUEST", "Razorpay order mismatch");
  }
  if (!verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
    throw new AppError("PAYMENT_ERROR", "Signature verify fail");
  }
  await prisma.order.update({ where: { id }, data: { paidAt: /* @__PURE__ */ new Date(), paymentRef: razorpayPaymentId } });
  const updatedOrder = await updateOrderStatus(id, "processing");
  await audit(req.user.sub, "shop.payment.verified", { entity: "order", entityId: id, meta: { paymentId: razorpayPaymentId } });
  ok(res, { paid: true, status: "processing", paymentRef: razorpayPaymentId });
});
shopRouter.post("/orders/:id/pay/demo", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== req.user.sub) {
    throw new AppError("NOT_FOUND", "Order not found");
  }
  if (order.status !== "pending") {
    throw new AppError("BAD_REQUEST", "Only pending orders can be paid");
  }
  if (order.paymentMethod === "cod") {
    throw new AppError("BAD_REQUEST", "COD order me online payment nahi hoti");
  }
  const ref = `DEMO-${Date.now()}`;
  await prisma.order.update({
    where: { id },
    data: { paidAt: /* @__PURE__ */ new Date(), paymentRef: ref, paymentStatus: "paid" }
  });
  const updatedOrder = await updateOrderStatus(id, "processing");
  await audit(req.user.sub, "shop.payment.demo", { entity: "order", entityId: id, meta: { ref, total: Number(order.totalAmount) } });
  ok(res, { paid: true, status: updatedOrder.status, paymentRef: ref });
});
shopRouter.get("/wifi/current", requireAuth, async (req, res) => {
  const platform = import_os.default.platform();
  try {
    let ssid = null;
    if (platform === "win32") {
      const { stdout } = await execAsync("netsh wlan show interfaces");
      const match = stdout.match(/^\s*SSID\s*:\s*(.+)$/m);
      ssid = match ? match[1].trim() : null;
    } else if (platform === "darwin") {
      const { stdout } = await execAsync("/System/Library/PrivateFrameworks/Apple80211.framework/Resources/airport -I");
      const match = stdout.match(/^\s*SSID\s*:\s*(.+)$/m);
      ssid = match ? match[1].trim() : null;
    } else {
      const { stdout } = await execAsync("iwgetid -r");
      ssid = stdout.trim() || null;
    }
    ok(res, { ssid });
  } catch (err) {
    console.error("Failed to query WiFi interface:", err);
    ok(res, { ssid: null });
  }
});

// src/routes/claim.routes.ts
var import_express13 = require("express");
init_prisma();
init_audit_service();
var claimRouter = (0, import_express13.Router)();
var claimLimiter = rateLimit({
  name: "claim:create",
  windowMs: 60 * 6e4,
  max: 20,
  message: "Bahut zyada claim attempts \u2014 1 ghanta baad try karo"
});
var claimHomesLimiter = rateLimit({
  name: "claim:homes",
  windowMs: 6e4,
  max: 60
});
claimRouter.use(requireAuth);
var TYPE_BY_MODEL = {
  "2CH": "custom",
  "4CH": "custom",
  "5CH": "custom",
  "6CH": "custom",
  "8CH": "custom",
  "4CH-IR": "custom",
  "FAN-DIM": "dimmer",
  "DIM-3S": "dimmer",
  "DIM-4S": "dimmer"
};
async function claimableHomes(userId) {
  return prisma.homeMember.findMany({
    where: {
      userId,
      role: { in: ["owner", "admin"] },
      home: { status: "active" }
    },
    include: { home: { select: { id: true, name: true } } }
  });
}
claimRouter.get("/homes", claimHomesLimiter, async (req, res) => {
  const homes = await claimableHomes(req.user.sub);
  ok(res, homes.map((h) => h.home));
});
claimRouter.post("/", claimLimiter, async (req, res) => {
  const serialCode = String(req.body?.serialCode ?? "").trim().toUpperCase();
  const homeId = Number(req.body?.homeId);
  if (!serialCode) throw new AppError("BAD_REQUEST", "Serial code is required");
  if (!Number.isInteger(homeId) || homeId < 1) {
    throw new AppError("BAD_REQUEST", "A valid home is required");
  }
  const serial = await prisma.serialRegistry.findUnique({
    where: { serialCode },
    include: { product: true }
  });
  if (!serial) throw new AppError("NOT_FOUND", "Unknown serial code \u2014 check the sticker on the box");
  if (serial.status === "claimed") {
    if (serial.userId === req.user.sub) {
      throw new AppError("CONFLICT", "This device is already activated in your home \u2014 check your Devices/Boards");
    }
    throw new AppError("CONFLICT", "This device was already activated by another user");
  }
  if (!["delivered", "shipped"].includes(serial.status)) {
    throw new AppError("CONFLICT", `This device is not yet ready to activate (status: ${serial.status})`);
  }
  const membership2 = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId: req.user.sub } }
  });
  if (!membership2 || !["owner", "admin"].includes(membership2.role)) {
    throw new AppError("FORBIDDEN", "You are not the owner or admin of that home");
  }
  const type = TYPE_BY_MODEL[serial.product.modelCode] ?? "custom";
  const deviceName = `${serial.product.name} \xB7 ${serial.serialCode}`;
  const device = await prisma.$transaction(async (tx) => {
    await tx.serialRegistry.update({
      where: { id: serial.id },
      data: {
        status: "claimed",
        userId: req.user.sub,
        homeId,
        claimedAt: /* @__PURE__ */ new Date(),
        warrantyExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3)
      }
    });
    const espStub = await tx.espDevice.create({
      data: {
        homeId,
        macAddress: `PENDING-${serial.serialCode}`,
        name: deviceName,
        serialCode: serial.serialCode,
        modelCode: serial.product.modelCode,
        offline: true
      }
    });
    return espStub;
  });
  await audit(req.user.sub, "shop.device.claim", {
    entity: "esp_device",
    entityId: device.id,
    meta: { serialCode, homeId, model: serial.product.modelCode }
  });
  ok(res, {
    claimed: true,
    device: { id: device.id, name: device.name, type: "custom" },
    serialCode,
    homeId
  }, 201);
});

// src/routes/warranty.routes.ts
var import_express14 = require("express");
init_prisma();
init_notification_service();
var warrantyRouter = (0, import_express14.Router)();
var statusLimiter = rateLimit({
  name: "warranty:status",
  windowMs: 6e4,
  max: 30,
  message: "Bahut zyada serial checks \u2014 thodi der baad try karo"
});
var claimLimiter2 = rateLimit({
  name: "warranty:claim",
  windowMs: 60 * 6e4,
  max: 10,
  message: "Bahut zyada claim attempts \u2014 1 ghanta baad try karo"
});
var mineLimiter = rateLimit({
  name: "warranty:mine",
  windowMs: 6e4,
  max: 60
});
warrantyRouter.use(requireAuth);
warrantyRouter.get("/status", statusLimiter, async (req, res) => {
  const code = String(req.query.serial ?? "").trim().toUpperCase();
  if (!code) throw new AppError("BAD_REQUEST", "serial query required");
  const serial = await prisma.serialRegistry.findUnique({
    where: { serialCode: code },
    include: { product: { select: { name: true, modelCode: true } } }
  });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");
  if (serial.userId !== req.user.sub) {
    throw new AppError("FORBIDDEN", "Ye device aapke account me nahi hai");
  }
  ok(res, {
    serialCode: serial.serialCode,
    productName: serial.product.name,
    modelCode: serial.product.modelCode,
    warrantyStatus: serial.warrantyStatus,
    warrantyExpiresAt: serial.warrantyExpiresAt,
    claimedAt: serial.claimedAt
  });
});
warrantyRouter.post("/", claimLimiter2, async (req, res) => {
  const serialCode = String(req.body?.serialCode ?? "").trim().toUpperCase();
  const reason = String(req.body?.reason ?? "").trim();
  const description = String(req.body?.description ?? "").trim() || void 0;
  if (!serialCode) throw new AppError("BAD_REQUEST", "Serial code is required");
  if (!reason) throw new AppError("BAD_REQUEST", "Reason is required");
  if (reason.length > 255) throw new AppError("BAD_REQUEST", "Reason 255 chars se kam rakho");
  const serial = await prisma.serialRegistry.findUnique({ where: { serialCode } });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");
  if (serial.status !== "claimed") {
    throw new AppError("CONFLICT", "Device pehle activate nahi hua \u2014 serial claim karo");
  }
  if (serial.userId !== req.user.sub) {
    throw new AppError("FORBIDDEN", "Ye device aapke account me nahi hai");
  }
  if (serial.warrantyStatus === "claimed") {
    throw new AppError("CONFLICT", "Is device ki ek claim pehle se active hai");
  }
  if (serial.warrantyExpiresAt && serial.warrantyExpiresAt < /* @__PURE__ */ new Date()) {
    throw new AppError("CONFLICT", "Warranty expire ho chuki hai (serial ke claim ke 1 saal baad)");
  }
  const openClaim = await prisma.warrantyClaim.findFirst({
    where: { serialCode, status: { in: ["submitted", "approved"] } }
  });
  if (openClaim) throw new AppError("CONFLICT", "Ek claim already submitted hai");
  const claim = await prisma.$transaction(async (tx) => {
    const created = await tx.warrantyClaim.create({
      data: { serialCode, userId: req.user.sub, reason, description }
    });
    await tx.serialRegistry.update({
      where: { id: serial.id },
      data: { warrantyStatus: "claimed" }
    });
    return created;
  });
  try {
    await createNotificationWithEmail(
      req.user.sub,
      {
        category: "system",
        type: "info",
        title: `\u{1F6E1}\uFE0F Warranty claim submitted (${serialCode})`,
        body: `Aapki claim file ho gayi \u2014 team review kar ke status update karegi.`
      },
      {
        emailSubject: `\u{1F6E1}\uFE0F Warranty claim received \u2014 ${serialCode}`,
        ctaUrl: "/warranty",
        ctaLabel: "Claim status dekho"
      }
    );
  } catch (err) {
    console.error("[warranty] email failed", err);
  }
  ok(res, {
    id: claim.id,
    serialCode,
    reason,
    description,
    status: claim.status,
    createdAt: claim.createdAt
  }, 201);
});
warrantyRouter.get("/mine", mineLimiter, async (req, res) => {
  const [claims, serials] = await Promise.all([
    prisma.warrantyClaim.findMany({
      where: { userId: req.user.sub },
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.serialRegistry.findMany({
      where: { userId: req.user.sub },
      include: { product: { select: { name: true, modelCode: true } } },
      orderBy: { createdAt: "desc" }
    })
  ]);
  ok(res, { claims, serials });
});

// src/routes/public.routes.ts
var import_express15 = require("express");
init_prisma();
init_audit_service();
init_siteSettings_service();
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var publicRouter = (0, import_express15.Router)();
publicRouter.get("/apk", (req, res) => {
  const apkPath = import_path.default.resolve(process.cwd(), "../mobile/android/app/build/outputs/apk/debug/app-debug.apk");
  if (import_fs.default.existsSync(apkPath)) {
    res.download(apkPath, "SwitchNest.apk");
  } else {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "APK not built yet." } });
  }
});
var assistantLimiter = rateLimit({
  name: "public:assistant",
  windowMs: 6e4,
  max: 20,
  message: "Bahut zyada messages \u2014 thodi der baad try karo"
});
var adminAssistantLimiter = rateLimit({
  name: "public:assistant-admin",
  windowMs: 6e4,
  max: 30,
  message: "Bahut zyada messages \u2014 thodi der baad try karo"
});
var contactLimiter = rateLimit({
  name: "public:contact",
  windowMs: 60 * 6e4,
  max: 5,
  message: "Bahut zyada contact messages \u2014 1 ghanta baad try karo"
});
var supportFormLimiter = rateLimit({
  name: "public:support-form",
  windowMs: 60 * 6e4,
  max: 10,
  message: "Bahut zyada support messages \u2014 1 ghanta baad try karo"
});
var siteSettingsLimiter = rateLimit({
  name: "public:site-settings",
  windowMs: 6e4,
  max: 120
});
var mySupportLimiter = rateLimit({
  name: "public:my-support",
  windowMs: 6e4,
  max: 60
});
publicRouter.get("/site-settings", siteSettingsLimiter, async (_req, res) => {
  try {
    const settings = await getPublicSiteSettings();
    ok(res, settings);
  } catch (_err) {
    ok(res, {
      siteName: "SwitchNest",
      supportEmail: "support@switchnest.in",
      supportPhone: "+91 98765 43210",
      supportAddress: "SwitchNest Labs, Noida, UP",
      supportHours: "24/7 Support",
      brandColor: "#0284c7"
    });
  }
});
var verifyBillLimiter = rateLimit({
  name: "public:verify-bill",
  windowMs: 6e4,
  max: 120,
  message: "Bahut zyada verify requests \u2014 thodi der baad try karo"
});
publicRouter.get("/verify/bill/:token", verifyBillLimiter, async (req, res) => {
  const payload = verifyBillToken(typeof req.params.token === "string" ? req.params.token : "");
  if (!payload) {
    return ok(res, { verified: false, reason: "invalid_token" });
  }
  const order = await prisma.order.findUnique({
    where: { id: payload.orderId },
    include: {
      items: { orderBy: { id: "asc" } },
      user: { select: { username: true } },
      serials: {
        include: { product: { select: { name: true, modelCode: true } } },
        orderBy: { id: "asc" }
      }
    }
  });
  if (!order) return ok(res, { verified: false, reason: "not_found" });
  const items = order.items.map((i) => ({
    productName: i.productName,
    quantity: i.quantity,
    price: i.price.toString(),
    serialCode: i.serialCode
  }));
  const serials = order.serials.map((s) => ({
    serialCode: s.serialCode,
    modelCode: s.product.modelCode,
    status: s.status,
    tested: Boolean(s.testedAt),
    testedAt: s.testedAt,
    claimedAt: s.claimedAt,
    warrantyStatus: s.warrantyStatus
  }));
  ok(res, {
    verified: true,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount.toString(),
    buyer: { name: order.shippingName, username: order.user?.username ?? null },
    items,
    serials
  });
});
var CHIPS = [
  "Kis board ki zaroorat hai?",
  "Site kaise kaam karti hai?",
  "WiFi setup kaise hota hai?",
  "Dimmer chahiye",
  "Fan speed control",
  "IR remote se control",
  "Warranty kya milti hai?",
  "Payment ke options"
];
var FAQ = [
  {
    test: /what is switchnest|yeh (kya|site) hai|kya hai ye|about (switchnest|site|company)|introduce|platform (kya|about)/i,
    reply: "SwitchNest ek smart-home IoT platform hai \u2014 WiFi relay boards (2CH se 8CH), dimmers aur fan regulators bechte hain. Board kharido \u2192 serial code se activate karo \u2192 app se ghar ke lights/fans/appliances ko kisi bhi jagah se control karo. Naya firmware bhi WiFi se hi (OTA) update hota hai \u2014 kabhi USB nahi chahiye."
  },
  {
    test: /how (does )?(it|this|site) (work|kaam)|kaise kaam|kaise chalta|process|flow|kya kaam/i,
    reply: "Poora flow 4 step me: 1\uFE0F\u20E3 Shop se board order karo (WiFi name/password order pe bhi de sakte ho) 2\uFE0F\u20E3 Delivery pe box me unique serial code sticker milta hai 3\uFE0F\u20E3 Serial code se device activate karo \u2014 board aapke home se link 4\uFE0F\u20E3 App/dashboard se on-off control, timers, voice/AI assistant. Hardware factory me pre-tested aata hai aur OTA se updates milte rahte hain."
  },
  {
    test: /wifi|wireless|set up|setup|config|network|connect (karo|karna)|internet/i,
    reply: "WiFi setup 2 tarike se: (1) Order ke waqt WiFi name + password de do \u2014 board factory me hi pre-configured flash hoke aayega, (2) Ya phir board first-boot pe apna khud ka WiFi (SwitchNest-IoT) kholta hai \u2014 phone se connect karke WiFi + server details daal do. Board phir khud connect ho jata hai. WiFi change ho jaye to captive portal se fresh setup ho jata hai."
  },
  {
    test: /ota|update|firmware|upgrade|naya version|software/i,
    reply: "Haan \u2014 saare boards OTA (over-the-air) updates support karte hain. Naya firmware admin publish karta hai aur board khud WiFi se download + flash kar leta hai, bina USB ke. Update safe hai \u2014 dual-slot system, kuch gadbad ho to purana version wapas boot ho jata hai."
  },
  {
    test: /warranty|guarantee|return|refund|repair|service/i,
    reply: "Har board ke sath serial claim ke din se 1 saal ki warranty milti hai. Koi problem aaye to Warranty page se claim file karo \u2014 support team approve karke resolution deti hai. Serial number se har board track hota hai (kaun kharida, kab bheja, kya status)."
  },
  {
    test: /pay|payment|cod|upi|price|cost|kitne ka|rate|rs\.? ?[0-9]/i,
    reply: "Payment options: Cash on Delivery (COD) aur UPI \u2014 online payment bhi (Razorpay) aa raha hai. Prices shop page pe: 2CH \u20B9599 \xB7 4CH \u20B9799 \xB7 5CH \u20B9899 \xB7 6CH \u20B9999 \xB7 8CH \u20B91,199 \xB7 IR \u20B9999 \xB7 Fan Dimmer \u20B9899 \xB7 Dimmers \u20B9749-799. Ek baar order karke dekho \u2014 billing address + optional WiFi ke saath."
  },
  {
    test: /ship|deliver|delivery|kab milega|shipping|dispatch|transport/i,
    reply: "Order ke baad status track hota hai: pending \u2192 paid \u2192 shipped \u2192 delivered. Delivery hone pe box pe serial sticker hota hai. India me sab jagah shipping available hai. Shipping ke baad hi serial code assign hota hai (flasher box me serial + WiFi pre-flash karta hai)."
  },
  {
    test: /activate|serial|claim|code|sticker|box/i,
    reply: "Delivery pe box ke andar sticker me unique serial code (RS-XXXX-XXXXXX) + QR code hota hai. QR scan karo ya Activate page pe serial daalo \u2192 apna home choose karo \u2192 board aapke account me aa jata hai. Serial = aapka ownership proof \u2014 koi aur usse claim nahi kar sakta."
  },
  {
    test: /contact|phone|call|email|support|help|baat|number/i,
    reply: "Contact section me form bharke message bhej sakte ho \u2014 humara team reply karta hai. Email: support@switchnest.in \xB7 Phone/WhatsApp: +91 98765 43210 \xB7 Address: SwitchNest Labs, Noida, UP. Feedback bhi welcome hai!"
  },
  {
    test: /hello|hi|hey|namaste|namaskar|hii|hola|salaam/i,
    reply: "Namaste! \u{1F64F} Main SwitchNest ka assistant hoon. Batao aapko kya chahiye \u2014 kitne lights/fans control karne hain, dimmer chahiye, IR remote se control karna hai, ya site ke baare me kuch poochna hai?"
  }
];
function detectNeed(text, products) {
  const lower = text.toLowerCase();
  if (/(dimmer|brightness|light dim|roshni (kam|zyada)|dima|bright)/i.test(lower)) {
    const steps = /4|four|chaar/.test(lower) ? "DIM-4S" : "DIM-3S";
    const picks = products.filter((p) => p.modelCode === steps);
    return {
      reply: steps === "DIM-4S" ? "4-step touch dimmer best rahega \u2014 off \u2192 33% \u2192 66% \u2192 100%. Touch + app dono se control." : "3-step touch dimmer best rahega \u2014 off \u2192 50% \u2192 100%. Simple aur budget-friendly.",
      products: picks.map((p) => ({ ...p, price: p.price.toString(), reason: "Touch dimmer \u2014 brightness steps" }))
    };
  }
  if (/(fan|pankh).{0,15}(speed|regulator|dim)|(speed|regulator).{0,15}(fan|pankh)|fan dim|regulator/i.test(lower)) {
    const picks = products.filter((p) => p.modelCode === "FAN-DIM");
    return {
      reply: "Fan Speed Dimmer (WiFi fan regulator) \u2014 purane 5-step regulator ki jagah. App se fan speed control karo, voice se bhi.",
      products: picks.map((p) => ({ ...p, price: p.price.toString(), reason: "Fan speed regulator" }))
    };
  }
  if (/(ir|remote|ac |tv |television|air condition)/i.test(lower)) {
    const picks = products.filter((p) => p.modelCode === "4CH-IR");
    return {
      reply: "4CH IR WiFi Relay Module \u2014 4 relay + built-in IR receiver. AC/TV apne remote se bhi control hoga, app se bhi.",
      products: picks.map((p) => ({ ...p, price: p.price.toString(), reason: "IR remote + app control" }))
    };
  }
  const countMatch = lower.match(/(\d+)\s*(?:light|lights|fan|fans|switch|switches|room|channel|device|devices|bulb|bulbs|load|point|points)/) || lower.match(/(?:light|lights|fan|fans|switch|switches|room|channel|device|devices|bulb|bulbs|load|point|points)\s*(\d+)/) || lower.match(/\b(2|3|4|5|6|7|8)\b/);
  if (countMatch) {
    const n = parseInt(countMatch[1] ?? countMatch[0], 10);
    let model = "2CH";
    let note = "";
    if (n <= 2) {
      model = "2CH";
      note = "2 devices ke liye perfect.";
    } else if (n <= 4) {
      model = "4CH";
      note = "4 devices \u2014 ek room ke liye classic choice.";
    } else if (n <= 5) {
      model = "5CH";
      note = "4 devices + 1 spare.";
    } else if (n <= 6) {
      model = "6CH";
      note = "6 devices \u2014 medium home.";
    } else {
      model = "8CH";
      note = "8 devices \u2014 poore ghar ka control ek panel se.";
    }
    const picks = products.filter((p) => p.modelCode === model);
    return {
      reply: `Aapko lagbhag ${n} devices control karne hain \u2014 **${model} WiFi Relay Board** best rahega. ${note} Relay channels khud map kar sakte ho (kis channel pe kaunsa device).`,
      products: picks.map((p) => ({ ...p, price: p.price.toString(), reason: `${n} devices ke liye ${p.relayCount} channel board` }))
    };
  }
  return null;
}
publicRouter.post("/assistant", assistantLimiter, optionalAuth, async (req, res) => {
  const text = String(req.body?.message ?? "").trim();
  if (!text) return ok(res, { reply: "Kuch likho \u2014 e.g. '4 lights control karne hain' ya 'dimmer chahiye'.", chips: CHIPS });
  if (req.user?.role === "system_admin") {
    return ok(res, await adminAssistantReply(text));
  }
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, modelCode: true, relayCount: true, price: true },
    orderBy: { id: "asc" }
  });
  const need = detectNeed(text, products);
  if (need) return ok(res, { ...need, chips: CHIPS });
  for (const faq of FAQ) {
    if (faq.test.test(text)) {
      return ok(res, { reply: faq.reply, products: [], chips: faq.chips ?? CHIPS });
    }
  }
  const picks = products.slice(0, 6).map((p) => ({ ...p, price: p.price.toString(), reason: "Sabse popular boards" }));
  return ok(res, {
    reply: "Poora clear nahi hua \u{1F642} \u2014 yeh rahe hamare boards, ya mujhe batao: kitne lights/fans? dimmer chahiye? IR remote se control karna hai? Main sahi board suggest kar dunga.",
    products: picks,
    chips: CHIPS
  });
});
var ADMIN_CHIPS = [
  "Kitne users online hain?",
  "Overview stats kaise dekhein?",
  "User ko block/delete kaise karein?",
  "Support inbox kaise use karein?",
  "Firmware OTA kaise push karein?",
  "Audit logs kaise check karein?"
];
var ADMIN_FAQ = [
  {
    test: /overview|stats|statistics|dashboard|report|metrics|trend|kya chal raha/i,
    reply: "Admin panel ke **Overview** tab me platform ke saare stats milte hain \u2014 total users, active today, revenue, orders, homes, devices, ESP boards, API requests (24h), support messages, pending commands, API keys, audit events aur ESP logs. Neeche last 7 days ka signups/orders graph bhi hai. Koi bhi cheez turant dhundhni ho to top me **\u{1F198} Find anything** use karo."
  },
  {
    test: /user|member|customer|block|ban|delete user|role|kaun kaun/i,
    reply: "**Users** tab me har user dikhta hai \u2014 status (active/blocked) badal sakte ho, role (user/system_admin) assign kar sakte ho, delete bhi kar sakte ho. Kisi user ke orders, homes, devices aur ESP boards ka poora context **Support** inbox me user select karke **User Info** panel se milta hai."
  },
  {
    test: /support|inbox|chat|conversation|reply|message aaya/i,
    reply: "**Support** tab WhatsApp-style inbox hai: conversations list left me, chat beech me, aur right me **User Info** panel (orders/homes/devices/boards). Quick replies ready hain (WiFi/OTA/Warranty/Order/Offline), attachments bhej sakte ho, chat mute/pin/clear kar sakte ho. Naya user message aaye to notification + unread badge se pata chal jata hai."
  },
  {
    test: /ota|firmware|push update|flash|update push|version/i,
    reply: "**OTA / ESP** tab me firmware upload karke activate karte ho. Uske baad kisi ek board pe ya saare boards pe ek saath OTA push kar sakte ho. ESP boards rename karna, probe karna, aur online/offline status dekhna bhi yahin se hota hai."
  },
  {
    test: /api key|api-key|integration|third.party|device access/i,
    reply: "**API Keys** tab me device-access API keys banate aur delete karte ho \u2014 ESP32 ya third-party integrations ke liye. Har key ka record audit log me bhi track hota hai."
  },
  {
    test: /audit|log|track|history|activity|kisne kya/i,
    reply: "**Audit Log** tab me har important action track hota hai \u2014 kaun, kis entity pe, kya kiya, kab (user, entity type, meta, timestamp). Suspicious activity check karne ke liye perfect. ESP boards ki history alag se **OTA / ESP** tab me dikhti hai."
  },
  {
    test: /settings|site setting|brand|test email|theme|contact info/i,
    reply: "**Settings** tab me site-wide settings hain \u2014 site name, support email/phone/address/hours, theme/brand color. **Test email** bhejkar verify bhi kar sakte ho ki email system sahi chal raha hai."
  },
  {
    test: /search|find|dhundo|dhundho|lookup|khojo/i,
    reply: "Top me **\u{1F198} Find anything** button aur **Global search** dono hain \u2014 users, homes, devices, ESP boards, orders, serials \u2014 jo bhi daalo, turant result. Kisi user ka context chahiye to **Support** inbox kholo."
  },
  {
    test: /order|payment|revenue|sale|sell|shop|kitna bik/i,
    reply: "**Shop / Orders** tab me saare orders + payment status dikhte hain. **Overview** me revenue stats milte hain. Order cancel karna, payment verify karna \u2014 sab yahin se hota hai."
  },
  {
    test: /hello|hi|hey|namaste|namaskar|hii|hola|salaam/i,
    reply: "Namaste Admin! \u{1F6E1}\uFE0F Main SwitchNest ka admin assistant hoon. Admin panel ke har feature me guide kar sakta hoon \u2014 stats, users, homes, devices, OTA/firmware, API keys, audit logs, support inbox ya settings. Batao kya karna hai?"
  }
];
var DAY_MS3 = 864e5;
var FIVE_MIN_MS = 3e5;
async function adminLiveStats() {
  const dayAgo = new Date(Date.now() - DAY_MS3);
  const fiveMinAgo = new Date(Date.now() - FIVE_MIN_MS);
  const monthStart = /* @__PURE__ */ new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [
    users,
    activeToday,
    onlineNow,
    homes,
    devices,
    onlineDevices,
    espBoards,
    offlineBoards,
    orders,
    pendingOrders,
    revenueTotal,
    revenueMonth,
    unreadSupport,
    apiKeys
  ] = await Promise.all([
    prisma.user.count(),
    Promise.resolve(0),
    // lastLoginAt column not yet on production DB
    Promise.resolve(0),
    // lastLoginAt column not yet on production DB
    prisma.home.count(),
    prisma.device.count(),
    prisma.device.count({ where: { lastSeen: { gte: dayAgo } } }),
    prisma.espDevice.count(),
    prisma.espDevice.count({ where: { OR: [{ offline: true }, { lastSeen: { lt: fiveMinAgo } }] } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paidAt: { not: null } } }),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paidAt: { not: null }, createdAt: { gte: monthStart } } }),
    prisma.supportMessage.count({ where: { senderRole: "user", readByAdmin: false, deletedAt: null } }),
    prisma.apiKey.count()
  ]);
  const apiRequests = getRequestStats();
  return {
    users,
    activeToday,
    onlineNow,
    homes,
    devices,
    onlineDevices,
    espBoards,
    offlineBoards,
    orders,
    pendingOrders,
    revenueTotal: Number(revenueTotal._sum.totalAmount ?? 0),
    revenueMonth: Number(revenueMonth._sum.totalAmount ?? 0),
    unreadSupport,
    apiKeys,
    apiRequests
  };
}
var plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
var ADMIN_LIVE_INTENTS = [
  {
    test: /(kitne|kitna|how many|count).{0,15}(user|users|member|log|bande|account)|(user|users|member)s? (online|active)|online (user|users)|active user|kitne log/i,
    reply: (s) => `Abhi platform pe **${plural(s.onlineNow, "user")} online** hain (last 5 min me active). Aaj (24h) **${plural(s.activeToday, "active user")}** \u2014 total **${plural(s.users, "registered user")}**. Devices: **${plural(s.onlineDevices, "device")}/${s.devices} online**, ESP boards: **${s.espBoards - s.offlineBoards}/${s.espBoards} online**.`
  },
  {
    test: /(kitne|kitna|how many|count|total).{0,15}(order|sale|revenue|paisa|kamai)|revenue (kya|kitna|abhi)|kitna kamaya|total (revenue|orders)/i,
    reply: (s) => `Total revenue: **\u20B9${s.revenueTotal.toLocaleString("en-IN")}** (is mahine \u20B9${s.revenueMonth.toLocaleString("en-IN")}). Total orders: **${plural(s.orders, "order")}** \u2014 abhi **${plural(s.pendingOrders, "pending")}**.`
  },
  {
    test: /(kitne|kitna|how many|count).{0,15}(device|board|esp)|device(s)? (online|offline)|board(s)? (online|offline)|online (device|board)/i,
    reply: (s) => `Devices: **${plural(s.onlineDevices, "device")}/${s.devices} online** (24h me active). ESP boards: **${s.espBoards - s.offlineBoards}/${s.espBoards} online** \u2014 **${plural(s.offlineBoards, "board")} offline**. Homes: **${plural(s.homes, "home")}**, API keys: **${s.apiKeys}**.`
  },
  {
    test: /(kitne|kitna|unread).{0,15}(support )?(message|chat)|unread (messages?|chats?)|pending (support|message|chat)/i,
    reply: (s) => `Support me **${plural(s.unreadSupport, "unread message")}** hain abhi. Saari conversations **Support** tab me hain \u2014 unread badge se naye messages ka pata chal jata hai.`
  },
  {
    test: /api (request|hit|call)|request(s)? (kitne|count|kitte)|kitne (request|hit)|traffic|kitna traffic/i,
    reply: (s) => `API requests: **${plural(s.apiRequests.today, "request")}** aaj, **${plural(s.apiRequests.last24h, "request")}** last 24h \u2014 total **${plural(s.apiRequests.total, "request")}** all-time.`
  }
];
async function adminAssistantReply(text) {
  if (!text) {
    return { reply: "Kya help chahiye? e.g. 'Kitne users online hain?' ya 'Overview stats kaise dekhein?'", products: [], chips: ADMIN_CHIPS };
  }
  for (const intent of ADMIN_LIVE_INTENTS) {
    if (intent.test.test(text)) {
      const stats = await adminLiveStats();
      return { reply: intent.reply(stats), products: [], chips: ADMIN_CHIPS };
    }
  }
  for (const faq of ADMIN_FAQ) {
    if (faq.test.test(text)) {
      return { reply: faq.reply, products: [], chips: faq.chips ?? ADMIN_CHIPS };
    }
  }
  return {
    reply: "Yeh sawaal mera clear nahi hua \u{1F642} Main in cheezon me help kar sakta hoon \u2014 live stats (kitne users online, revenue, devices online), Overview, Users, Homes, Devices, OTA/firmware, API keys, Audit logs, Support inbox, Settings aur Global search. Koi ek batao \u2014 main jawab de dunga.",
    products: [],
    chips: ADMIN_CHIPS
  };
}
publicRouter.post("/assistant/admin", adminAssistantLimiter, requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") {
    throw new AppError("FORBIDDEN", "Admin access required", 403);
  }
  return ok(res, await adminAssistantReply(String(req.body?.message ?? "").trim()));
});
publicRouter.post("/contact", contactLimiter, async (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 100);
  const email = String(req.body?.email ?? "").trim().slice(0, 120) || null;
  const phone = String(req.body?.phone ?? "").trim().slice(0, 20) || null;
  const subject = String(req.body?.subject ?? "Feedback").trim().slice(0, 150);
  const message = String(req.body?.message ?? "").trim();
  if (!name) return ok(res, { error: "Name required" }, 400);
  if (!message) return ok(res, { error: "Message required" }, 400);
  if (message.length > 4e3) return ok(res, { error: "Message 4000 chars se kam rakho" }, 400);
  const created = await prisma.contactMessage.create({
    data: { name, email, phone, subject, message }
  });
  ok(res, { id: created.id, status: created.status }, 201);
});
publicRouter.get("/support/my", mySupportLimiter, requireAuth, async (req, res) => {
  const msgs = await prisma.contactMessage.findMany({
    where: { userId: req.user.sub },
    orderBy: { createdAt: "desc" },
    take: 30
  });
  ok(res, msgs);
});
publicRouter.post("/support", supportFormLimiter, requireAuth, async (req, res) => {
  const subject = String(req.body?.subject ?? "Support").trim().slice(0, 150);
  const message = String(req.body?.message ?? "").trim();
  const phone = String(req.body?.phone ?? "").trim().slice(0, 20) || null;
  const orderNumber = String(req.body?.orderNumber ?? "").trim().slice(0, 50) || null;
  if (!message) return ok(res, { error: "Message required" }, 400);
  if (message.length > 4e3) return ok(res, { error: "Message 4000 chars se kam rakho" }, 400);
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, username: true, email: true }
  });
  const created = await prisma.contactMessage.create({
    data: {
      userId: user?.id ?? req.user.sub,
      name: user?.username ?? "User",
      email: user?.email ?? null,
      phone,
      subject: orderNumber ? `${subject} (Order ${orderNumber})` : subject,
      message
    }
  });
  await audit(req.user.sub, "user.support.contact", {
    entity: "contactMessage",
    entityId: created.id,
    meta: { subject }
  });
  ok(res, { id: created.id, status: created.status }, 201);
});

// src/routes/support.routes.ts
var import_express16 = require("express");
var import_zod14 = require("zod");
var import_jsonwebtoken4 = __toESM(require("jsonwebtoken"), 1);
init_prisma();
init_notification_service();
init_socket();

// src/lib/attachmentStore.ts
var fs11 = __toESM(require("fs"), 1);
var path11 = __toESM(require("path"), 1);
function extFor(type, name) {
  const fromName = name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  if (type.startsWith("image/png")) return "png";
  if (type.startsWith("image/jpeg")) return "jpg";
  if (type.startsWith("image/gif")) return "gif";
  if (type.startsWith("image/webp")) return "webp";
  if (type.startsWith("image/heic")) return "heic";
  if (type === "application/pdf") return "pdf";
  if (type === "text/plain") return "txt";
  return "bin";
}
function saveAttachment(base64, type, name) {
  const buf = Buffer.from(base64, "base64");
  if (buf.length === 0) throw new Error("Empty file");
  const filename = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}.${extFor(type, name)}`;
  fs11.mkdirSync(attachmentDir, { recursive: true });
  fs11.writeFileSync(path11.join(attachmentDir, filename), buf);
  return filename;
}
function readAttachmentFile(filename) {
  const safe = path11.basename(filename);
  if (safe !== filename) return null;
  try {
    return fs11.readFileSync(path11.join(attachmentDir, safe));
  } catch {
    return null;
  }
}
function deleteAttachmentFile(filename) {
  if (!filename) return;
  const safe = path11.basename(filename);
  if (safe !== filename) return;
  try {
    fs11.unlinkSync(path11.join(attachmentDir, safe));
  } catch {
  }
}

// src/routes/support.routes.ts
init_email_service();
init_env();
var import_multer4 = __toESM(require("multer"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var supportRouter = (0, import_express16.Router)();
try {
  if (!import_fs2.default.existsSync(attachmentDir)) {
    import_fs2.default.mkdirSync(attachmentDir, { recursive: true });
  }
} catch (e) {
}
var storage3 = import_multer4.default.diskStorage({
  destination: (_req, _file, cb) => cb(null, attachmentDir),
  filename: (req, file, cb) => {
    const ext = import_path2.default.extname(file.originalname) || "";
    const safeName = import_path2.default.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}${ext}`);
  }
});
var upload4 = (0, import_multer4.default)({
  storage: storage3,
  limits: { fileSize: 50 * 1024 * 1024 }
  // 50MB
});
var userSendLimiter = rateLimit({
  name: "support:user-send",
  windowMs: 6e4,
  max: 10,
  message: "Bahut fast messages bhej rahe ho \u2014 thodi der ruk kar bhejo"
});
var adminSendLimiter = rateLimit({
  name: "support:admin-send",
  windowMs: 6e4,
  max: 30,
  message: "Bahut fast messages bhej rahe ho \u2014 thodi der ruk kar bhejo"
});
var MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
var ALLOWED_TYPES = /^(image\/(png|jpe?g|gif|webp|heic)|application\/pdf|text\/plain)$/;
var attachmentFields = {
  attachmentName: import_zod14.z.string().trim().min(1).max(255).optional(),
  attachmentType: import_zod14.z.string().trim().min(1).max(100).optional(),
  attachmentData: import_zod14.z.string().min(1).optional()
};
function refineAttachment(d, ctx) {
  const hasAny = d.attachmentName != null || d.attachmentType != null || d.attachmentData != null;
  if (!hasAny) return;
  if (!d.attachmentName || !d.attachmentType || !d.attachmentData) {
    ctx.addIssue({ code: "custom", path: ["attachmentData"], message: "Attachment incomplete" });
    return;
  }
  if (!ALLOWED_TYPES.test(d.attachmentType)) {
    ctx.addIssue({ code: "custom", path: ["attachmentType"], message: "Unsupported file type" });
    return;
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(d.attachmentData)) {
    ctx.addIssue({ code: "custom", path: ["attachmentData"], message: "Invalid file data" });
    return;
  }
  if (d.attachmentData.length * 3 > MAX_ATTACHMENT_BYTES * 4 + 8) {
    ctx.addIssue({ code: "custom", path: ["attachmentData"], message: "File too large (max 2MB)" });
  }
}
function supportModel() {
  if (!prisma.supportMessage) {
    throw new AppError("INTERNAL", "Support module unavailable \u2014 Prisma client stale. Run: npx prisma generate in site/apps/api", 500);
  }
  return prisma.supportMessage;
}
var msgSelect = {
  id: true,
  userId: true,
  senderRole: true,
  senderName: true,
  message: true,
  attachmentName: true,
  attachmentType: true,
  attachmentData: true,
  attachmentPath: true,
  readByUser: true,
  readByAdmin: true,
  deletedAt: true,
  createdAt: true
};
async function firstAdminId() {
  const admin = await prisma.user.findFirst({
    where: { role: "system_admin" },
    select: { id: true },
    orderBy: { id: "asc" }
  });
  return admin?.id ?? null;
}
async function isMuted(viewerId, peerUserId) {
  if (!prisma.supportChatSettings) return false;
  const s = await prisma.supportChatSettings.findUnique({
    where: { userId_peerUserId: { userId: viewerId, peerUserId } },
    select: { mutedAt: true }
  }).catch(() => null);
  return !!s?.mutedAt;
}
supportRouter.get("/admin/users", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const q = String(req.query.q ?? "").trim().toLowerCase();
  if (q.length < 2) return ok(res, { users: [] });
  const users = await prisma.user.findMany({
    where: {
      OR: [{ username: { contains: q } }, { email: { contains: q } }]
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: 25
  });
  const info = await supportModel().groupBy({
    by: ["userId"],
    where: { userId: { in: users.map((u) => u.id) }, deletedAt: null },
    _count: { _all: true },
    _max: { createdAt: true }
  });
  const infoMap = new Map(info.map((m) => [m.userId, { count: m._count._all, lastAt: m._max.createdAt }]));
  ok(
    res,
    users.map((u) => ({
      ...u,
      messageCount: infoMap.get(u.id)?.count ?? 0,
      lastMessageAt: infoMap.get(u.id)?.lastAt ?? null
    }))
  );
});
supportRouter.get("/admin/messages", requireAuth, async (req, res) => {
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId) || userId <= 0) throw new AppError("VALIDATION_ERROR", "userId required", 400);
  const msgs = await supportModel().findMany({
    where: { userId, deletedAt: null },
    select: msgSelect,
    orderBy: { createdAt: "asc" },
    take: 200
  });
  const unread = await supportModel().count({ where: { userId, readByAdmin: false, deletedAt: null } });
  if (unread > 0) {
    await supportModel().updateMany({
      where: { userId, readByAdmin: false, deletedAt: null },
      data: { readByAdmin: true }
    });
  }
  ok(res, { userId, unread, messages: msgs });
});
var adminSendSchema = import_zod14.z.object({
  userId: import_zod14.z.number().int().positive(),
  message: import_zod14.z.string().trim().max(4e3),
  ...attachmentFields
}).superRefine((d, ctx) => {
  if (!d.message && !d.attachmentData) {
    ctx.addIssue({ code: "custom", path: ["message"], message: "Message ya file required" });
  }
  refineAttachment(d, ctx);
});
supportRouter.post("/admin/messages", requireAuth, adminSendLimiter, validateBody(adminSendSchema), async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const { userId, message } = req.body;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, email: true } });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
  const created = await supportModel().create({
    data: {
      userId,
      senderRole: "admin",
      senderName: req.user.username,
      message,
      attachmentName: req.body.attachmentName ?? null,
      attachmentType: req.body.attachmentType ?? null,
      // Naya: file disk pe (hardware/attachments), DB me sirf path. Legacy rows me blob (attachment_data) rehta hai.
      attachmentData: null,
      attachmentPath: req.body.attachmentData ? saveAttachment(req.body.attachmentData, req.body.attachmentType, req.body.attachmentName) : null,
      readByUser: false,
      readByAdmin: true
    }
  });
  if (!await isMuted(userId, req.user.sub)) {
    await createNotification(userId, {
      category: "support",
      type: "info",
      title: "\u{1F6E0}\uFE0F Support ne message bheja",
      body: JSON.stringify({ u: req.user.sub, t: message.slice(0, 200) })
    });
  }
  emitToUser(userId, "support:new", { senderRole: "admin", message: created });
  emitToUser(req.user.sub, "support:new", { senderRole: "admin", message: created });
  if (user.email) {
    void sendSupportReplyEmail({ to: user.email, userName: user.username, replyText: message });
  }
  ok(res, created, 201);
});
supportRouter.get("/messages", requireAuth, async (req, res) => {
  const userId = req.user.sub;
  const [messages, unreadCount2] = await Promise.all([
    supportModel().findMany({
      where: { userId, deletedAt: null },
      select: msgSelect,
      orderBy: { createdAt: "asc" },
      take: 200
    }),
    supportModel().count({ where: { userId, readByUser: false, deletedAt: null } })
  ]);
  if (unreadCount2 > 0) {
    await supportModel().updateMany({
      where: { userId, readByUser: false, deletedAt: null },
      data: { readByUser: true }
    });
  }
  ok(res, { unread: unreadCount2, messages });
});
var userSendSchema = import_zod14.z.object({
  message: import_zod14.z.string().trim().max(4e3),
  ...attachmentFields
}).superRefine((d, ctx) => {
  if (!d.message && !d.attachmentData) {
    ctx.addIssue({ code: "custom", path: ["message"], message: "Message ya file required" });
  }
  refineAttachment(d, ctx);
});
supportRouter.post("/messages", requireAuth, userSendLimiter, validateBody(userSendSchema), async (req, res) => {
  const userId = req.user.sub;
  const created = await supportModel().create({
    data: {
      userId,
      senderRole: "user",
      senderName: req.user.username,
      message: req.body.message,
      attachmentName: req.body.attachmentName ?? null,
      attachmentType: req.body.attachmentType ?? null,
      // Naya: file disk pe (hardware/attachments), DB me sirf path.
      attachmentData: null,
      attachmentPath: req.body.attachmentData ? saveAttachment(req.body.attachmentData, req.body.attachmentType, req.body.attachmentName) : null,
      readByUser: true,
      readByAdmin: false
    }
  });
  const admin = await prisma.user.findFirst({
    where: { role: "system_admin" },
    select: { id: true },
    orderBy: { id: "asc" }
  });
  if (admin) {
    if (!await isMuted(admin.id, req.user.sub)) {
      await createNotification(admin.id, {
        category: "support",
        type: "info",
        title: "\u{1F4E8} User ne support me reply kiya",
        body: JSON.stringify({ u: req.user.sub, t: (req.body.message || "").slice(0, 200) })
      });
    }
    emitToUser(admin.id, "support:new", { senderRole: "user", message: created });
  }
  emitToUser(userId, "support:new", { senderRole: "user", message: created });
  ok(res, created, 201);
});
supportRouter.post("/messages/media", requireAuth, userSendLimiter, upload4.single("file"), async (req, res) => {
  const userId = req.user.sub;
  const message = req.body.message || "";
  if (!req.file && !message) {
    throw new AppError("VALIDATION_ERROR", "Message or file required", 400);
  }
  const created = await supportModel().create({
    data: {
      userId,
      senderRole: "user",
      senderName: req.user.username,
      message,
      attachmentName: req.file?.originalname ?? null,
      attachmentType: req.file?.mimetype ?? null,
      attachmentData: null,
      attachmentPath: req.file?.filename ?? null,
      readByUser: true,
      readByAdmin: false
    }
  });
  const admin = await prisma.user.findFirst({
    where: { role: "system_admin" },
    select: { id: true },
    orderBy: { id: "asc" }
  });
  if (admin) {
    if (!await isMuted(admin.id, req.user.sub)) {
      await createNotification(admin.id, {
        category: "support",
        type: "info",
        title: "\u{1F4F2} User ne support me media bheja",
        body: JSON.stringify({ u: req.user.sub, t: "Media file uploaded" })
      });
    }
    emitToUser(admin.id, "support:new", { senderRole: "user", message: created });
  }
  emitToUser(userId, "support:new", { senderRole: "user", message: created });
  ok(res, created, 201);
});
supportRouter.post("/admin/messages/media", requireAuth, adminSendLimiter, upload4.single("file"), async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const userId = Number(req.body.userId);
  const message = req.body.message || "";
  if (!Number.isInteger(userId) || userId <= 0) throw new AppError("VALIDATION_ERROR", "Valid userId required", 400);
  if (!req.file && !message) throw new AppError("VALIDATION_ERROR", "Message or file required", 400);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, email: true } });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
  const created = await supportModel().create({
    data: {
      userId,
      senderRole: "admin",
      senderName: req.user.username,
      message,
      attachmentName: req.file?.originalname ?? null,
      attachmentType: req.file?.mimetype ?? null,
      attachmentData: null,
      attachmentPath: req.file?.filename ?? null,
      readByUser: false,
      readByAdmin: true
    }
  });
  if (!await isMuted(userId, req.user.sub)) {
    await createNotification(userId, {
      category: "support",
      type: "info",
      title: "\u{1F3A7} Support ne media bheja",
      body: JSON.stringify({ u: req.user.sub, t: "Media file sent" })
    });
  }
  emitToUser(userId, "support:new", { senderRole: "admin", message: created });
  emitToUser(req.user.sub, "support:new", { senderRole: "admin", message: created });
  ok(res, created, 201);
});
supportRouter.get("/attachment/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError("VALIDATION_ERROR", "Invalid attachment id", 400);
  const header = req.headers.authorization;
  const qToken = typeof req.query.token === "string" ? req.query.token : null;
  let payload = null;
  try {
    const raw = header?.startsWith("Bearer ") ? header.slice(7) : qToken;
    if (raw) payload = import_jsonwebtoken4.default.verify(raw, env.JWT_ACCESS_SECRET);
  } catch {
  }
  if (!payload) throw new AppError("UNAUTHORIZED", "Missing bearer token", 401);
  const msg = await supportModel().findUnique({
    where: { id },
    select: { userId: true, attachmentPath: true, attachmentName: true, attachmentType: true, deletedAt: true }
  });
  if (!msg || msg.deletedAt || !msg.attachmentPath) throw new AppError("NOT_FOUND", "Attachment not found", 404);
  if (msg.userId !== payload.sub && payload.role !== "system_admin") {
    throw new AppError("FORBIDDEN", "Access denied", 403);
  }
  const buf = readAttachmentFile(msg.attachmentPath);
  if (!buf) throw new AppError("NOT_FOUND", "Attachment file missing", 404);
  const isImage = (msg.attachmentType ?? "").startsWith("image/");
  res.setHeader("Content-Type", msg.attachmentType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `${isImage ? "inline" : "attachment"}; filename="${encodeURIComponent(msg.attachmentName || "file")}"`
  );
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(buf);
});
supportRouter.get("/admin/unread-count", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") return ok(res, { unread: 0 });
  if (!prisma.supportMessage) return ok(res, { unread: 0 });
  const groups = await supportModel().groupBy({
    by: ["userId"],
    where: { readByAdmin: false, deletedAt: null },
    _count: { _all: true }
  });
  ok(res, { unread: groups.length });
});
supportRouter.get("/admin/conversations", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  if (!prisma.supportMessage) return ok(res, { conversations: [], totalUnread: 0 });
  const recent = await supportModel().findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      userId: true,
      senderRole: true,
      message: true,
      attachmentName: true,
      readByAdmin: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: 1e3
  });
  const byUser = /* @__PURE__ */ new Map();
  for (const m of recent) {
    const cur = byUser.get(m.userId);
    const preview = m.message?.trim() ? m.message : m.attachmentName ? `\u{1F4CE} ${m.attachmentName}` : "(attachment)";
    if (!cur) {
      byUser.set(m.userId, {
        lastPreview: preview,
        lastSenderRole: m.senderRole,
        lastAt: m.createdAt,
        unread: m.readByAdmin ? 0 : 1
      });
    } else if (!m.readByAdmin) {
      cur.unread += 1;
    }
  }
  const userIds = [...byUser.keys()];
  const users = userIds.length > 0 ? await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, email: true }
  }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const conversations = [...byUser.entries()].map(([userId, c]) => ({
    userId,
    username: userMap.get(userId)?.username ?? "Unknown",
    email: userMap.get(userId)?.email ?? null,
    lastPreview: c.lastPreview.slice(0, 120),
    lastSenderRole: c.lastSenderRole,
    lastAt: c.lastAt,
    unreadCount: c.unread
  })).sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
  const totalUnread = conversations.reduce((a, c) => a + c.unreadCount, 0);
  ok(res, { conversations, totalUnread });
});
supportRouter.post("/admin/read-all", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  if (!prisma.supportMessage) return ok(res, { unread: 0 });
  await supportModel().updateMany({
    where: { readByAdmin: false, deletedAt: null },
    data: { readByAdmin: true }
  });
  ok(res, { unread: 0 });
});
supportRouter.post("/admin/thread-read", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const userId = Number(req.body?.userId);
  const read = Boolean(req.body?.read);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError("VALIDATION_ERROR", "userId required", 400);
  }
  if (!prisma.supportMessage) return ok(res, { updated: 0 });
  const updated = await supportModel().updateMany({
    where: { userId, deletedAt: null, readByAdmin: read ? false : true },
    data: { readByAdmin: read }
  });
  ok(res, { updated: updated.count });
});
supportRouter.get("/admin/context", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const userId = Number(req.query.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError("VALIDATION_ERROR", "userId required", 400);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true
    }
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
  const [memberships, orders] = await Promise.all([
    prisma.homeMember.findMany({
      where: { userId },
      select: {
        role: true,
        home: {
          select: {
            id: true,
            name: true,
            status: true,
            owner: { select: { id: true, username: true } },
            _count: { select: { devices: true, members: true, rooms: true } }
          }
        }
      },
      orderBy: { joinedAt: "asc" }
    }),
    prisma.order.findMany({
      where: { userId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        shippingPhone: true,
        createdAt: true,
        _count: { select: { items: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 15
    })
  ]);
  const homeIds = memberships.map((m) => m.home.id);
  const [devices, esps] = homeIds.length > 0 ? await Promise.all([
    prisma.device.findMany({
      where: { homeId: { in: homeIds } },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        serialNumber: true,
        offline: true,
        lastSeen: true,
        room: { select: { name: true } },
        home: { select: { name: true } }
      },
      orderBy: { name: "asc" },
      take: 100
    }),
    prisma.espDevice.findMany({
      where: { homeId: { in: homeIds } },
      select: {
        id: true,
        name: true,
        macAddress: true,
        serialCode: true,
        modelCode: true,
        firmwareVersion: true,
        offline: true,
        ipAddress: true,
        lastSeen: true,
        home: { select: { name: true } }
      },
      orderBy: { id: "asc" },
      take: 50
    })
  ]) : [[], []];
  ok(res, {
    user,
    homes: memberships.map((m) => ({ ...m.home, memberRole: m.role })),
    devices,
    esps,
    orders
  });
});
supportRouter.get("/settings", requireAuth, async (req, res) => {
  if (!prisma.supportChatSettings) return ok(res, { settings: [] });
  const settings = await prisma.supportChatSettings.findMany({
    where: { userId: req.user.sub },
    select: { peerUserId: true, mutedAt: true, pinnedAt: true }
  });
  ok(res, { settings });
});
supportRouter.put("/settings/:peerUserId", requireAuth, async (req, res) => {
  if (!prisma.supportChatSettings) throw new AppError("INTERNAL", "Chat settings unavailable \u2014 prisma client stale", 500);
  let peerUserId = Number(req.params.peerUserId);
  if (req.user.role !== "system_admin") {
    peerUserId = await firstAdminId() ?? 0;
  }
  if (!Number.isInteger(peerUserId) || peerUserId <= 0) {
    throw new AppError("VALIDATION_ERROR", "peerUserId required", 400);
  }
  const { muted, pinned } = req.body;
  if (muted === void 0 && pinned === void 0) {
    throw new AppError("VALIDATION_ERROR", "muted ya pinned required", 400);
  }
  const data = {};
  if (typeof muted === "boolean") data.mutedAt = muted ? /* @__PURE__ */ new Date() : null;
  if (typeof pinned === "boolean") data.pinnedAt = pinned ? /* @__PURE__ */ new Date() : null;
  const setting = await prisma.supportChatSettings.upsert({
    where: { userId_peerUserId: { userId: req.user.sub, peerUserId } },
    create: {
      userId: req.user.sub,
      peerUserId,
      mutedAt: data.mutedAt ?? null,
      pinnedAt: data.pinnedAt ?? null
    },
    update: data
  });
  ok(res, setting);
});
supportRouter.delete("/messages/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const msg = await supportModel().findUnique({ where: { id } });
  if (!msg) throw new AppError("NOT_FOUND", "Message not found", 404);
  if (msg.userId !== req.user.sub || msg.senderRole !== "user") {
    throw new AppError("FORBIDDEN", "Sirf apna message delete kar sakte ho", 403);
  }
  await supportModel().update({ where: { id }, data: { deletedAt: /* @__PURE__ */ new Date() } });
  deleteAttachmentFile(msg.attachmentPath);
  ok(res, { deleted: true });
});
supportRouter.delete("/admin/messages/:id", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const id = Number(req.params.id);
  const msg = await supportModel().findUnique({ where: { id } });
  if (!msg) throw new AppError("NOT_FOUND", "Message not found", 404);
  await supportModel().update({ where: { id }, data: { deletedAt: /* @__PURE__ */ new Date() } });
  deleteAttachmentFile(msg.attachmentPath);
  ok(res, { deleted: true });
});
supportRouter.delete("/messages", requireAuth, async (req, res) => {
  const withFiles = await supportModel().findMany({
    where: { userId: req.user.sub, deletedAt: null },
    select: { attachmentPath: true }
  });
  const r = await supportModel().updateMany({
    where: { userId: req.user.sub, deletedAt: null },
    data: { deletedAt: /* @__PURE__ */ new Date() }
  });
  withFiles.forEach((m) => deleteAttachmentFile(m.attachmentPath));
  ok(res, { cleared: r.count });
});
supportRouter.delete("/admin/messages", requireAuth, async (req, res) => {
  if (req.user.role !== "system_admin") throw new AppError("FORBIDDEN", "Admin access required", 403);
  const userId = Number(req.query.peerUserId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError("VALIDATION_ERROR", "peerUserId required", 400);
  }
  const withFiles = await supportModel().findMany({
    where: { userId, deletedAt: null },
    select: { attachmentPath: true }
  });
  const r = await supportModel().updateMany({
    where: { userId, deletedAt: null },
    data: { deletedAt: /* @__PURE__ */ new Date() }
  });
  withFiles.forEach((m) => deleteAttachmentFile(m.attachmentPath));
  ok(res, { cleared: r.count });
});

// src/routes/oauth.routes.ts
var import_express17 = require("express");
init_prisma();
var import_crypto6 = __toESM(require("crypto"), 1);
var import_zod15 = require("zod");
var oauthRouter = (0, import_express17.Router)();
var authorizeSchema = import_zod15.z.object({
  client_id: import_zod15.z.string(),
  redirect_uri: import_zod15.z.string().url(),
  state: import_zod15.z.string(),
  homeId: import_zod15.z.number().int().positive(),
  provider: import_zod15.z.enum(["google", "alexa"])
});
oauthRouter.post("/authorize", requireAuth, async (req, res) => {
  const parsed2 = authorizeSchema.safeParse(req.body);
  if (!parsed2.success) {
    throw new AppError("BAD_REQUEST", "Invalid oauth authorize payload", 400, parsed2.error.flatten());
  }
  const { client_id, redirect_uri, state, homeId, provider } = parsed2.data;
  const userId = req.user.sub;
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: client_id }
  });
  if (!client) {
    throw new AppError("BAD_REQUEST", "Invalid client_id");
  }
  if (!client.redirectUris.includes(redirect_uri)) {
    throw new AppError("BAD_REQUEST", "Invalid redirect_uri for this client");
  }
  const membership2 = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId } }
  });
  if (!membership2) {
    throw new AppError("FORBIDDEN", "You are not a member of the selected Home.");
  }
  await prisma.integrationConnection.upsert({
    where: {
      userId_provider: {
        userId,
        provider
      }
    },
    update: {
      homeId,
      status: "active",
      updatedAt: /* @__PURE__ */ new Date()
    },
    create: {
      userId,
      homeId,
      provider,
      status: "active"
    }
  });
  const code = import_crypto6.default.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1e3);
  await prisma.oAuthAuthCode.create({
    data: {
      code,
      clientId: client.clientId,
      userId,
      homeId,
      redirectUri: redirect_uri,
      expiresAt
    }
  });
  const url = new URL(redirect_uri);
  url.searchParams.append("code", code);
  url.searchParams.append("state", state);
  ok(res, { redirectUrl: url.toString() });
});
oauthRouter.post("/token", async (req, res) => {
  const { grant_type, client_id, client_secret, code, redirect_uri, refresh_token } = req.body;
  if (!client_id || !client_secret) {
    return res.status(401).json({ error: "invalid_client" });
  }
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: client_id }
  });
  if (!client || client.clientSecret !== client_secret) {
    return res.status(401).json({ error: "invalid_client" });
  }
  if (grant_type === "authorization_code") {
    if (!code || !redirect_uri) {
      return res.status(400).json({ error: "invalid_request" });
    }
    const authCode = await prisma.oAuthAuthCode.findUnique({
      where: { code }
    });
    if (!authCode) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Code not found" });
    }
    if (authCode.clientId !== client_id || authCode.redirectUri !== redirect_uri) {
      return res.status(400).json({ error: "invalid_grant" });
    }
    if (authCode.expiresAt < /* @__PURE__ */ new Date()) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Code expired" });
    }
    await prisma.oAuthAuthCode.delete({ where: { id: authCode.id } });
    const accessToken = import_crypto6.default.randomBytes(48).toString("hex");
    const refreshToken = import_crypto6.default.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3);
    await prisma.oAuthToken.create({
      data: {
        accessToken,
        refreshToken,
        clientId: client_id,
        userId: authCode.userId,
        homeId: authCode.homeId,
        expiresAt
      }
    });
    return res.json({
      token_type: "Bearer",
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 30 * 24 * 60 * 60
      // seconds
    });
  } else if (grant_type === "refresh_token") {
    if (!refresh_token) {
      return res.status(400).json({ error: "invalid_request" });
    }
    const tokenRecord = await prisma.oAuthToken.findUnique({
      where: { refreshToken: refresh_token }
    });
    if (!tokenRecord || tokenRecord.clientId !== client_id) {
      return res.status(400).json({ error: "invalid_grant" });
    }
    const conn = await prisma.integrationConnection.findFirst({
      where: { userId: tokenRecord.userId, homeId: tokenRecord.homeId, status: "active" }
    });
    if (!conn) {
      await prisma.oAuthToken.delete({ where: { id: tokenRecord.id } });
      return res.status(400).json({ error: "invalid_grant", error_description: "Integration revoked" });
    }
    const newAccessToken = import_crypto6.default.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3);
    const updated = await prisma.oAuthToken.update({
      where: { id: tokenRecord.id },
      data: {
        accessToken: newAccessToken,
        expiresAt
      }
    });
    return res.json({
      token_type: "Bearer",
      access_token: updated.accessToken,
      refresh_token: updated.refreshToken,
      // Same as before
      expires_in: 30 * 24 * 60 * 60
    });
  }
  return res.status(400).json({ error: "unsupported_grant_type" });
});

// src/routes/google.routes.ts
var import_express18 = require("express");
init_prisma();
var googleRouter = (0, import_express18.Router)();
var requireGoogleAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }
  const token = authHeader.substring(7);
  const oauthToken = await prisma.oAuthToken.findUnique({
    where: { accessToken: token }
  });
  if (!oauthToken || oauthToken.expiresAt < /* @__PURE__ */ new Date()) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  const conn = await prisma.integrationConnection.findFirst({
    where: { userId: oauthToken.userId, homeId: oauthToken.homeId, provider: "google", status: "active" }
  });
  if (!conn) {
    return res.status(401).json({ error: "Google integration revoked" });
  }
  req.oauthToken = oauthToken;
  next();
};
googleRouter.post("/fulfillment", requireGoogleAuth, async (req, res) => {
  const payload = req.body;
  const requestId = payload.requestId;
  const inputs = payload.inputs || [];
  if (inputs.length === 0) {
    return res.status(400).json({ error: "Missing inputs" });
  }
  const oauthToken = req.oauthToken;
  const userId = oauthToken.userId;
  const homeId = oauthToken.homeId;
  try {
    const intent = inputs[0].intent;
    switch (intent) {
      case "action.devices.SYNC": {
        const devices = await prisma.device.findMany({
          where: { homeId, access: { some: { userId } } }
          // using device_access or simple home check
        });
        const allHomeDevices = await prisma.device.findMany({ where: { homeId } });
        const syncDevices = allHomeDevices.map((d) => ({
          id: String(d.id),
          type: d.type === "bulb" ? "action.devices.types.LIGHT" : d.type === "plug" ? "action.devices.types.OUTLET" : d.type === "ac" ? "action.devices.types.AC" : "action.devices.types.SWITCH",
          traits: [
            "action.devices.traits.OnOff"
          ],
          name: {
            defaultNames: [d.name],
            name: d.name,
            nicknames: [d.name]
          },
          willReportState: false
          // For now, basic implementation
        }));
        return res.json({
          requestId,
          payload: {
            agentUserId: String(userId),
            devices: syncDevices
          }
        });
      }
      case "action.devices.QUERY": {
        const payloadDevices = inputs[0].payload.devices || [];
        const deviceIds = payloadDevices.map((d) => parseInt(d.id, 10));
        const dbDevices = await prisma.device.findMany({
          where: { homeId, id: { in: deviceIds } }
        });
        const queryDevices = {};
        dbDevices.forEach((d) => {
          queryDevices[d.id] = {
            status: "SUCCESS",
            online: !d.offline,
            on: d.status === "on"
          };
        });
        return res.json({
          requestId,
          payload: {
            devices: queryDevices
          }
        });
      }
      case "action.devices.EXECUTE": {
        const commands = inputs[0].payload.commands || [];
        const executeResponses = [];
        for (const command of commands) {
          const deviceIds = command.devices.map((d) => parseInt(d.id, 10));
          const execution = command.execution[0];
          if (execution.command === "action.devices.commands.OnOff") {
            const turnOn = execution.params.on;
            for (const dId of deviceIds) {
              const device = await prisma.device.findFirst({ where: { homeId, id: dId } });
              if (!device) {
                executeResponses.push({
                  ids: [String(dId)],
                  status: "ERROR",
                  errorCode: "deviceNotFound"
                });
                continue;
              }
              const newStatus = turnOn ? "on" : "off";
              await prisma.deviceCommand.create({
                data: {
                  deviceId: dId,
                  actorId: userId,
                  command: newStatus,
                  status: "pending"
                }
              });
              await prisma.device.update({
                where: { id: dId },
                data: { status: newStatus }
              });
              executeResponses.push({
                ids: [String(dId)],
                status: "SUCCESS",
                states: {
                  online: !device.offline,
                  on: turnOn
                }
              });
            }
          }
        }
        return res.json({
          requestId,
          payload: {
            commands: executeResponses
          }
        });
      }
      case "action.devices.DISCONNECT": {
        await prisma.integrationConnection.updateMany({
          where: { userId, provider: "google" },
          data: { status: "revoked" }
        });
        return res.json({});
      }
      default:
        return res.status(400).json({ error: "Unsupported intent" });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// src/routes/alexa.routes.ts
var import_express19 = require("express");
init_prisma();
var alexaRouter = (0, import_express19.Router)();
var requireAlexaAuth = async (req, res, next) => {
  const directive = req.body.directive;
  let token = null;
  if (directive?.endpoint?.scope?.token) token = directive.endpoint.scope.token;
  else if (directive?.payload?.scope?.token) token = directive.payload.scope.token;
  else if (directive?.payload?.grantee?.token) token = directive.payload.grantee.token;
  if (!token) {
    return res.status(401).json({ error: "Missing token in directive" });
  }
  const oauthToken = await prisma.oAuthToken.findUnique({
    where: { accessToken: token }
  });
  if (!oauthToken || oauthToken.expiresAt < /* @__PURE__ */ new Date()) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  const conn = await prisma.integrationConnection.findFirst({
    where: { userId: oauthToken.userId, homeId: oauthToken.homeId, provider: "alexa", status: "active" }
  });
  if (!conn) {
    return res.status(401).json({ error: "Alexa integration revoked" });
  }
  req.oauthToken = oauthToken;
  next();
};
alexaRouter.post("/directive", requireAlexaAuth, async (req, res) => {
  const directive = req.body.directive;
  const header = directive.header;
  const namespace = header.namespace;
  const name = header.name;
  const oauthToken = req.oauthToken;
  const userId = oauthToken.userId;
  const homeId = oauthToken.homeId;
  try {
    if (namespace === "Alexa.Discovery" && name === "Discover") {
      const allHomeDevices = await prisma.device.findMany({ where: { homeId } });
      const endpoints = allHomeDevices.map((d) => ({
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
    } else if (namespace === "Alexa.PowerController") {
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
      const now = (/* @__PURE__ */ new Date()).toISOString();
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// src/routes/webhook.routes.ts
var import_express20 = require("express");
init_prisma();
init_logger();
var webhookRouter = (0, import_express20.Router)();
webhookRouter.post("/razorpay", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  if (typeof signature !== "string") {
    logger.warn("Razorpay Webhook: Missing signature");
    return res.status(401).send("Missing signature");
  }
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : null;
  if (!rawBody) {
    logger.error("Razorpay Webhook: No raw body found. Ensure express.raw() is configured.");
    return res.status(400).send("No raw body found");
  }
  try {
    if (!verifyRazorpayWebhook(rawBody, signature)) {
      logger.warn("Razorpay Webhook: Invalid signature");
      return res.status(401).send("Invalid signature");
    }
    const payload = JSON.parse(rawBody);
    const event = payload.event;
    if (event === "payment.captured" || event === "order.paid" || event === "payment.failed") {
      const paymentEntity = event === "payment.captured" || event === "payment.failed" ? payload.payload.payment.entity : null;
      const orderEntity = event === "order.paid" ? payload.payload.order.entity : null;
      const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;
      const paymentId = paymentEntity?.id || null;
      if (!razorpayOrderId) {
        logger.warn("Razorpay Webhook: No order ID in payload for event " + event);
        return res.status(200).send("OK");
      }
      const order = await prisma.order.findFirst({
        where: { razorpayOrderId }
      });
      if (!order) {
        logger.warn(`Razorpay Webhook: Order not found for RP order ID ${razorpayOrderId}`);
        return res.status(200).send("OK");
      }
      if (order.status !== "pending") {
        return res.status(200).send("OK");
      }
      if (event === "payment.failed") {
        const reason = paymentEntity?.error_reason || paymentEntity?.error_description || "Payment Failed";
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "failed"
          }
        });
        logger.warn(`Razorpay Webhook: Order ${order.id} payment failed: ${reason}`);
        Promise.resolve().then(() => (init_notification_service(), notification_service_exports)).then(({ createNotification: createNotification2 }) => {
          createNotification2(order.userId, {
            title: "Payment Failed",
            body: `Payment for your order ${order.orderNumber} failed (${reason}). Please retry from the app.`,
            type: "error",
            category: "system"
          });
        }).catch((err) => {
          logger.error(`Failed to send notification for order ${order.id}: ${err}`);
        });
      } else {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paidAt: /* @__PURE__ */ new Date(),
            paymentRef: paymentId || "Webhook Automatically Paid"
          }
        });
        await updateOrderStatus(order.id, "processing");
        logger.info(`Razorpay Webhook: Order ${order.id} marked as processing via webhook.`);
      }
    }
    res.status(200).send("OK");
  } catch (error) {
    logger.error("Razorpay Webhook Error:", error instanceof Error ? error.message : String(error));
    res.status(500).send("Internal Error");
  }
});

// src/routes/index.ts
init_prisma();
var apiRouter = (0, import_express21.Router)();
apiRouter.use("/auth", authRouter);
apiRouter.use("/homes", homeRouter);
apiRouter.use("/homes", memberRouter);
apiRouter.use("/homes", deviceRouter);
apiRouter.use("/homes", roomRouter);
apiRouter.use("/homes", scheduleRouter);
apiRouter.use("/device", deviceApiRouter);
apiRouter.use("/api-keys", apiKeyRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/support", supportRouter);
apiRouter.use("/assistant", assistantRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/shop", shopRouter);
apiRouter.use("/claim", claimRouter);
apiRouter.use("/warranty", warrantyRouter);
apiRouter.use("/public", publicRouter);
apiRouter.use("/oauth", oauthRouter);
apiRouter.use("/integration/google", googleRouter);
apiRouter.use("/integration/alexa", alexaRouter);
apiRouter.use("/webhooks", webhookRouter);
var apiMounts = [
  { router: authRouter, prefix: "/auth" },
  { router: homeRouter, prefix: "/homes" },
  { router: memberRouter, prefix: "/homes" },
  { router: deviceRouter, prefix: "/homes" },
  { router: roomRouter, prefix: "/homes" },
  { router: scheduleRouter, prefix: "/homes" },
  { router: deviceApiRouter, prefix: "/device" },
  { router: apiKeyRouter, prefix: "/api-keys" },
  { router: notificationRouter, prefix: "/notifications" },
  { router: supportRouter, prefix: "/support" },
  { router: assistantRouter, prefix: "/assistant" },
  { router: adminRouter, prefix: "/admin" },
  { router: shopRouter, prefix: "/shop" },
  { router: claimRouter, prefix: "/claim" },
  { router: warrantyRouter, prefix: "/warranty" },
  { router: publicRouter, prefix: "/public" },
  { router: oauthRouter, prefix: "/oauth" },
  { router: googleRouter, prefix: "/integration/google" },
  { router: alexaRouter, prefix: "/integration/alexa" },
  { router: webhookRouter, prefix: "/webhooks" }
];
apiRouter.get("/firmware/current", requireAuth, async (_req, res) => {
  const versions = await prisma.firmwareVersion.findMany({
    where: { isCurrent: true },
    select: { modelCode: true, version: true, releaseNotes: true },
    orderBy: { modelCode: "asc" }
  });
  ok(res, versions);
});

// src/routes/install.routes.ts
var import_express22 = require("express");
var import_promise = __toESM(require("mysql2/promise"), 1);
var import_node_fs5 = __toESM(require("node:fs"), 1);
var import_node_path5 = __toESM(require("node:path"), 1);
var import_bcryptjs3 = __toESM(require("bcryptjs"), 1);
init_env();
init_prisma();
init_logger();

// src/services/scheduler.service.ts
init_prisma();
init_audit_service();
init_socket();
init_notification_service();
init_logger();
var timer = null;
var running = false;
var CHECK_INTERVAL_MS3 = 1e4;
function startScheduler() {
  if (timer) return;
  timer = setInterval(runDueSchedules, CHECK_INTERVAL_MS3);
  void runDueSchedules();
  console.log("[scheduler] started (every 10s)");
  fileLog("[scheduler] started (every 10s)");
}
async function runDueSchedules() {
  if (running) return;
  running = true;
  fileLog(`[scheduler] tick ${(/* @__PURE__ */ new Date()).toISOString()} start`);
  try {
    const now = /* @__PURE__ */ new Date();
    const due = await prisma.schedule.findMany({
      where: { enabled: true, nextRun: { lte: now } },
      include: { device: true },
      take: 100
    });
    for (const sched of due) {
      try {
        await fireSchedule(sched.id);
      } catch (err) {
        console.error(`[scheduler] failed to fire schedule ${sched.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] tick error:", err);
    fileLog(`[scheduler] tick ERROR: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    running = false;
    fileLog(`[scheduler] tick ${(/* @__PURE__ */ new Date()).toISOString()} done`);
  }
}
async function fireSchedule(scheduleId) {
  const sched = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { device: true }
  });
  if (!sched || !sched.enabled) return;
  const firedAt = /* @__PURE__ */ new Date();
  await prisma.$transaction([
    prisma.device.update({
      where: { id: sched.device.id },
      data: { status: sched.action }
    }),
    prisma.deviceCommand.create({
      data: {
        deviceId: sched.device.id,
        actorId: null,
        command: `set_status:${sched.action}`
      }
    }),
    prisma.deviceLog.create({
      data: {
        deviceId: sched.device.id,
        actorId: null,
        logType: "schedule",
        logMessage: `Scheduled turn ${sched.action} (schedule #${sched.id})`
      }
    })
  ]);
  const nextRun = computeNextRun({
    type: sched.type,
    runAt: sched.runAt,
    cron: sched.cron,
    from: firedAt
  });
  await prisma.schedule.update({
    where: { id: sched.id },
    data: {
      lastRun: firedAt,
      nextRun,
      enabled: sched.type === "once" ? false : sched.enabled
    }
  });
  await audit(null, "schedule.fire", {
    homeId: sched.device.homeId,
    entity: "schedule",
    entityId: sched.id,
    meta: { deviceId: sched.device.id, deviceName: sched.device.name, action: sched.action }
  });
  await emitDeviceUpdated(sched.device.homeId, sched.device.id);
  if (sched.createdBy) {
    await createNotification(sched.createdBy, {
      category: "schedule",
      type: "info",
      title: `\u23F0 Schedule fired: ${sched.device.name} ${sched.action.toUpperCase()}`,
      body: `Schedule #${sched.id} ne ${sched.device.name} ko ${sched.action} kiya.`
    });
  }
  console.log(
    `[scheduler] fired schedule #${sched.id}: ${sched.device.name} -> ${sched.action} (next: ${nextRun?.toISOString() ?? "never"})`
  );
}

// src/services/offline.service.ts
init_prisma();
init_socket();
init_notification_service();
init_logger();
var timer2 = null;
var OFFLINE_THRESHOLD_MS = 12e4;
var CHECK_INTERVAL_MS4 = 6e4;
function groupOfflineEvents(items) {
  const byHome = /* @__PURE__ */ new Map();
  for (const it of items) {
    const arr = byHome.get(it.homeId) ?? [];
    arr.push(it);
    byHome.set(it.homeId, arr);
  }
  return [...byHome.values()];
}
var plural2 = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;
function describeGroup(group) {
  const boards = group.filter((i) => i.kind === "board").length;
  const devices = group.filter((i) => i.kind === "device").length;
  const parts = [];
  if (boards) parts.push(plural2(boards, "board"));
  if (devices) parts.push(plural2(devices, "device"));
  return parts.join(" + ");
}
function offlineSummaryText(group) {
  if (group.length < 2) return null;
  const names = group.map((i) => i.name).join(", ");
  return {
    title: `\u26A0\uFE0F Power cut detected \u2014 ${describeGroup(group)} offline`,
    body: `${names} ek saath offline ho gaye \u2014 lagta hai power/WiFi cut hai. Power wapas aate hi sab wapas online ho jayenge.`
  };
}
function recoverySummaryText(group) {
  if (group.length < 2) return null;
  return {
    title: `\u2705 Power restored \u2014 ${describeGroup(group)} online`,
    body: "Sab wapas connected ho gaye \u2014 ab koi action nahi chahiye."
  };
}
async function membersForHome(homeId) {
  const rows = await prisma.homeMember.findMany({
    where: { homeId, role: { in: ["owner", "admin"] } },
    select: { userId: true }
  });
  return rows.map((r) => r.userId);
}
async function notifyGroup(group, direction) {
  const homeId = group[0].homeId;
  const summary = direction === "offline" ? offlineSummaryText(group) : recoverySummaryText(group);
  const members = await membersForHome(homeId);
  if (members.length === 0) return;
  if (summary) {
    for (const userId of members) {
      await createNotificationWithEmail(
        userId,
        {
          category: "device",
          type: direction === "offline" ? "warning" : "info",
          title: summary.title,
          body: summary.body
        },
        { emailSubject: summary.title }
      );
    }
    return;
  }
  for (const it of group) {
    const title = direction === "offline" ? `\u{1F4E1} ${it.name} offline` : `\u2705 ${it.name} online`;
    const body = direction === "offline" ? `${it.name} ne 2+ min se sync nahi kiya \u2014 WiFi/power check karo.` : `${it.name} wapas connected ho gaya.`;
    for (const userId of members) {
      await createNotificationWithEmail(
        userId,
        { category: "device", type: direction === "offline" ? "warning" : "info", title, body },
        { emailSubject: title }
      );
    }
  }
}
function startOfflineWatcher() {
  if (timer2) return;
  timer2 = setInterval(checkOfflineDevices, CHECK_INTERVAL_MS4);
  void checkOfflineDevices();
  console.log("[offline] watcher started (every 60s)");
  fileLog("[offline] watcher started (every 60s)");
}
async function checkOfflineDevices() {
  fileLog(`[offline] tick ${(/* @__PURE__ */ new Date()).toISOString()} start`);
  try {
    await checkOfflineDevicesInner();
  } catch (err) {
    console.error("[offline] tick error:", err instanceof Error ? err.message : err);
    fileLog(`[offline] tick ERROR: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    fileLog(`[offline] tick ${(/* @__PURE__ */ new Date()).toISOString()} done`);
  }
}
async function checkOfflineDevicesInner() {
  const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MS);
  const staleBoards = await prisma.espDevice.findMany({
    where: { lastSeen: { lt: cutoff }, offline: false },
    select: { id: true, homeId: true, name: true, serialCode: true, macAddress: true },
    take: 50
  });
  const anyStaleBoardIds = new Set(
    (await prisma.espDevice.findMany({ where: { lastSeen: { lt: cutoff } }, select: { id: true } })).map((b) => b.id)
  );
  const offlineEvents = [];
  for (const board of staleBoards) {
    await prisma.espDevice.update({ where: { id: board.id }, data: { offline: true } });
    emitToHome(board.homeId, "esp:updated", { id: board.id, offline: true });
    const boardName = board.name ?? board.serialCode ?? `ESP-${board.macAddress.slice(-6).toUpperCase()}`;
    offlineEvents.push({ homeId: board.homeId, name: boardName, kind: "board" });
    console.log(`[offline] board ${boardName} (${board.id}) marked offline`);
  }
  const backBoards = await prisma.espDevice.findMany({
    where: { offline: true, lastSeen: { gte: cutoff } },
    select: { id: true, homeId: true, name: true, serialCode: true, macAddress: true },
    take: 50
  });
  const onlineEvents = [];
  for (const board of backBoards) {
    await prisma.espDevice.update({ where: { id: board.id }, data: { offline: false } });
    emitToHome(board.homeId, "esp:updated", { id: board.id, offline: false });
    const boardName = board.name ?? board.serialCode ?? `ESP-${board.macAddress.slice(-6).toUpperCase()}`;
    onlineEvents.push({ homeId: board.homeId, name: boardName, kind: "board" });
    console.log(`[offline] board ${boardName} (${board.id}) back online`);
  }
  const stale = await prisma.device.findMany({
    where: {
      lastSeen: { lt: cutoff },
      ...anyStaleBoardIds.size ? { OR: [{ espId: null }, { espId: { notIn: [...anyStaleBoardIds] } }] } : {}
    },
    select: { id: true, homeId: true, name: true, lastSeen: true, offline: true },
    take: 50
  });
  for (const device of stale) {
    const wasOnline = device.lastSeen !== null && !device.offline;
    if (!wasOnline) continue;
    await prisma.device.update({ where: { id: device.id }, data: { offline: true } });
    await emitDeviceUpdated(device.homeId, device.id);
    offlineEvents.push({ homeId: device.homeId, name: device.name, kind: "device" });
    console.log(`[offline] ${device.name} (${device.id}) marked offline`);
  }
  const backOnline = await prisma.device.findMany({
    where: { offline: true, lastSeen: { gte: cutoff } },
    select: { id: true, homeId: true, name: true },
    take: 50
  });
  for (const device of backOnline) {
    await prisma.device.update({ where: { id: device.id }, data: { offline: false } });
    await emitDeviceUpdated(device.homeId, device.id);
    onlineEvents.push({ homeId: device.homeId, name: device.name, kind: "device" });
    console.log(`[offline] ${device.name} (${device.id}) back online`);
  }
  for (const group of groupOfflineEvents(offlineEvents)) {
    await notifyGroup(group, "offline");
  }
  for (const group of groupOfflineEvents(onlineEvents)) {
    await notifyGroup(group, "online");
  }
}

// src/routes/install.routes.ts
var SCHEMA_SQL = import_node_path5.default.resolve(process.cwd(), "prisma/schema.sql");
var installRouter = (0, import_express22.Router)();
var DEFAULT_PRODUCTS = [
  { name: "2CH WiFi Relay Module", modelCode: "2CH", relayCount: 2, price: "599", description: "Two-channel WiFi relay board for lights and small appliances. 10A per channel, ESP32 based, works with the SwitchNest app and voice assistant.", features: { channels: 2, wifi: true, ota: true, voice: true } },
  { name: "4CH WiFi Relay Module", modelCode: "4CH", relayCount: 4, price: "799", description: "Four-channel WiFi relay board \u2014 the classic choice for room-wide control. 10A per channel with status LED and manual override switches.", features: { channels: 4, wifi: true, ota: true, voice: true } },
  { name: "5CH WiFi Relay Module", modelCode: "5CH", relayCount: 5, price: "899", description: "Five-channel relay board \u2014 perfect for combining 4 devices plus one spare. ESP32 with OTA updates and two-way sync.", features: { channels: 5, wifi: true, ota: true, voice: true } },
  { name: "6CH WiFi Relay Module", modelCode: "6CH", relayCount: 6, price: "999", description: "Six-channel WiFi relay board for medium-size homes. Control lights, fans and appliances from one compact board.", features: { channels: 6, wifi: true, ota: true, voice: true } },
  { name: "8CH WiFi Relay Module", modelCode: "8CH", relayCount: 8, price: "1199", description: "Eight-channel WiFi relay board \u2014 full-home control. Ideal for new construction wiring with all loads in one panel.", features: { channels: 8, wifi: true, ota: true, voice: true } },
  { name: "4CH IR WiFi Relay Module", modelCode: "4CH-IR", relayCount: 4, price: "999", description: "Four-channel relay board with built-in IR receiver \u2014 control with the app and any IR remote. Works with ACs, TVs and IR appliances.", features: { channels: 4, ir: true, wifi: true, ota: true, voice: true } },
  { name: "Fan Speed Dimmer (WiFi)", modelCode: "FAN-DIM", relayCount: 1, price: "899", description: "WiFi fan regulator with stepped speed control. Replace your old 5-step regulator and control the fan from the app or voice.", features: { fanDimmer: true, steps: 5, wifi: true, ota: true, voice: true } },
  { name: "3-State Touch Dimmer", modelCode: "DIM-3S", relayCount: 1, price: "749", description: "Touch dimmer with 3 brightness steps (off \u2192 50% \u2192 100%). WiFi + touch control, works with existing bulb holders.", features: { dimmer: true, steps: 3, touch: true, wifi: true, ota: true } },
  { name: "4-State Touch Dimmer", modelCode: "DIM-4S", relayCount: 1, price: "799", description: "Touch dimmer with 4 brightness steps (off \u2192 33% \u2192 66% \u2192 100%). WiFi + touch control, app dimming via steps.", features: { dimmer: true, steps: 4, touch: true, wifi: true, ota: true } }
];
function parseDatabaseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    pass: decodeURIComponent(u.password),
    name: decodeURIComponent(u.pathname.replace(/^\//, ""))
  };
}
function buildDatabaseUrl2(p) {
  return `mysql://${encodeURIComponent(p.user)}:${encodeURIComponent(p.pass)}@${p.host}:${p.port}/${encodeURIComponent(p.name)}`;
}
function escIdent(name) {
  return name.replace(/`/g, "``");
}
async function probeDb(parts) {
  let conn = null;
  let activeParts = { ...parts };
  try {
    conn = await import_promise.default.createConnection({
      host: activeParts.host,
      port: activeParts.port,
      user: activeParts.user,
      password: activeParts.pass,
      database: activeParts.name,
      connectTimeout: 4e3
    });
  } catch {
    conn = null;
  }
  if (!conn) {
    const pleskParts = {
      host: "127.0.0.1",
      port: 3306,
      user: "switch_v2",
      pass: "switchnest@1234567890",
      name: "switch_v2"
    };
    try {
      conn = await import_promise.default.createConnection({
        host: pleskParts.host,
        port: pleskParts.port,
        user: pleskParts.user,
        password: pleskParts.pass,
        database: pleskParts.name,
        connectTimeout: 4e3
      });
      activeParts = pleskParts;
    } catch {
      conn = null;
    }
  }
  if (!conn) {
    return { reachable: false, tablesReady: false, installed: false, activeParts };
  }
  try {
    const [rows] = await conn.query(
      "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
      [activeParts.name]
    );
    const hasUsers = Number(rows[0]?.c ?? 0) > 0;
    let installed = false;
    if (hasUsers) {
      try {
        const [meta] = await conn.query("SELECT value FROM app_meta WHERE `key` = 'installed' LIMIT 1");
        const flag = meta[0]?.value;
        if (flag !== void 0) {
          installed = flag === "1";
        } else {
          const [urows] = await conn.query("SELECT COUNT(*) AS c FROM users");
          installed = Number(urows[0]?.c ?? 0) > 0;
        }
      } catch {
        installed = true;
      }
    }
    return { reachable: true, tablesReady: hasUsers, installed, activeParts };
  } catch {
    return { reachable: true, tablesReady: false, installed: false, activeParts };
  } finally {
    await conn.end().catch(() => void 0);
  }
}
function persistDatabaseConfig(p) {
  return persistEnvKeys([
    ["DB_HOST", p.host],
    ["DB_PORT", String(p.port)],
    ["DB_USER", p.user],
    ["DB_PASS", p.pass],
    ["DB_NAME", p.name],
    ["DATABASE_URL", `${buildDatabaseUrl2(p)}?connection_limit=10`]
  ]);
}
async function connectServer(parts) {
  const hostsToTry = parts.host === "localhost" ? ["127.0.0.1", "localhost"] : [parts.host, "127.0.0.1"];
  let lastErr = null;
  for (const h of hostsToTry) {
    let conn = null;
    try {
      conn = await import_promise.default.createConnection({
        host: h,
        port: parts.port,
        user: parts.user,
        password: parts.pass,
        connectTimeout: 8e3
      });
      parts.host = h;
      const [rows] = await conn.query("SELECT VERSION() AS v");
      await conn.end().catch(() => void 0);
      return { serverVersion: String(rows[0]?.v ?? "") };
    } catch (err) {
      lastErr = err;
      if (conn) await conn.end().catch(() => void 0);
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new AppError("DB_CONNECT_FAILED", `Database server se connect nahi ho paya: ${msg}`, 502);
}
async function createDatabase(parts) {
  const dbName = escIdent(parts.name);
  let conn = null;
  try {
    conn = await import_promise.default.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.pass,
      connectTimeout: 8e3
    });
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } catch (_err) {
  } finally {
    if (conn) await conn.end().catch(() => void 0);
  }
}
function getSchemaSql() {
  const candidates = [
    import_node_path5.default.resolve(process.cwd(), "prisma/schema.sql"),
    import_node_path5.default.resolve(process.cwd(), "dist/schema.sql"),
    import_node_path5.default.resolve(process.cwd(), "apps/api/prisma/schema.sql"),
    import_node_path5.default.resolve(process.cwd(), "site/apps/api/prisma/schema.sql"),
    import_node_path5.default.resolve(__dirname, "../prisma/schema.sql"),
    import_node_path5.default.resolve(__dirname, "schema.sql"),
    import_node_path5.default.resolve(__dirname, "prisma/schema.sql")
  ];
  for (const p of candidates) {
    if (import_node_fs5.default.existsSync(p)) {
      try {
        const sql = import_node_fs5.default.readFileSync(p, "utf-8");
        if (sql && sql.trim().length > 50) return sql;
      } catch {
      }
    }
  }
  return FALLBACK_SCHEMA_SQL;
}
async function applySchema(parts) {
  const schemaSql = getSchemaSql();
  let conn;
  try {
    conn = await import_promise.default.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.pass,
      database: parts.name,
      multipleStatements: true,
      connectTimeout: 8e3
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError("DB_CONNECT_FAILED", `Database connect failed: ${msg}`, 502);
  }
  try {
    await conn.query(schemaSql);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists") || msg.includes("ER_TABLE_EXISTS_ERROR")) {
      logger.info("[install] Tables already present in database \u2014 proceeding to next step");
    } else {
      throw new AppError(
        "SCHEMA_FAILED",
        `Tables create nahi hui: ${msg}. Database khali (fresh) hona chahiye \u2014 purana data ho to factory reset karo ya naya DB use karo.`,
        500
      );
    }
  } finally {
    await conn.end().catch(() => void 0);
  }
}
async function completeInstall(parts, admin) {
  const nextUrl = buildDatabaseUrl2(parts);
  let conn = null;
  try {
    conn = await import_promise.default.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.pass,
      database: parts.name,
      connectTimeout: 1e4
    });
    const [existingRows] = await conn.query(
      "SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1",
      [admin.username, admin.email]
    );
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      logger.info("[install] Admin user already exists in DB \u2014 marking installed");
    } else {
      const passwordHash = await import_bcryptjs3.default.hash(admin.password, 10);
      const homeName = `${(admin.name || admin.username).trim()}${admin.name ? "" : "'s"} Home`;
      const [resUser] = await conn.query(
        "INSERT INTO users (username, email, password, role, status, created_at) VALUES (?, ?, ?, 'system_admin', 'active', NOW(3))",
        [admin.username, admin.email, passwordHash]
      );
      const userId = resUser.insertId;
      const [resHome] = await conn.query(
        "INSERT INTO homes (name, ownerId, status, maxDevices, maxMembers, created_at) VALUES (?, ?, 'active', 20, 10, NOW(3))",
        [homeName, userId]
      );
      const homeId = resHome.insertId;
      await conn.query(
        "INSERT INTO home_members (homeId, userId, role, restricted, joined_at) VALUES (?, ?, 'owner', false, NOW(3))",
        [homeId, userId]
      );
      for (const p of DEFAULT_PRODUCTS) {
        await conn.query(
          `INSERT INTO products (name, modelCode, relayCount, price, description, features, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, true, NOW(3))
           ON DUPLICATE KEY UPDATE active = true`,
          [p.name, p.modelCode, p.relayCount, p.price, p.description, JSON.stringify(p.features)]
        );
      }
      await conn.query(
        "INSERT INTO app_meta (`key`, `value`, updated_at) VALUES ('installed', '1', NOW(3)) ON DUPLICATE KEY UPDATE `value` = '1'"
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[install] completeInstall mysql error", err);
    throw new AppError("INSTALL_FAILED", `Admin account create nahi ho paya: ${msg}`, 500);
  } finally {
    if (conn) await conn.end().catch(() => void 0);
  }
  const persisted = persistDatabaseConfig(parts);
  persistEnvKey("ADMIN_PASSWORD", admin.password);
  try {
    await resetPrismaClient(nextUrl);
  } catch (_pErr) {
    logger.warn("[install] resetPrismaClient warning (non-fatal)", _pErr);
  }
  setDbReady(true);
  try {
    startScheduler();
  } catch (err) {
    logger.warn("Scheduler start skipped/failed", err instanceof Error ? err.message : String(err));
  }
  try {
    startOfflineWatcher();
  } catch (err) {
    logger.warn("Offline watcher start skipped/failed", err instanceof Error ? err.message : String(err));
  }
  return {
    installed: true,
    database: parts.name,
    admin: admin.username,
    configPersisted: persisted.ok,
    configPath: persisted.path
  };
}
function dbFromBody(bodyDb) {
  const base = parseDatabaseUrl(env.DATABASE_URL);
  const parts = {
    host: (bodyDb?.host ?? base.host).trim(),
    port: Number(bodyDb?.port ?? base.port) || 3306,
    user: (bodyDb?.user ?? base.user).trim(),
    pass: bodyDb?.pass ?? base.pass,
    name: (bodyDb?.name ?? base.name).trim()
  };
  if (!parts.host || !parts.name || !parts.user) {
    throw new AppError("BAD_REQUEST", "DB host, user aur name required hain", 400);
  }
  return parts;
}
installRouter.get("/status", async (_req, res) => {
  try {
    const dbUrl = getEffectiveDbUrl();
    const parts = parseDatabaseUrl(dbUrl);
    const probe = await probeDb(parts);
    if (probe.installed) {
      setDbReady(true);
      const activeUrl = buildDatabaseUrl2(probe.activeParts);
      if (process.env.DATABASE_URL !== activeUrl) {
        process.env.DATABASE_URL = activeUrl;
        env.DATABASE_URL = activeUrl;
        void resetPrismaClient(activeUrl);
      }
    }
    ok(res, {
      installed: probe.installed,
      dbReachable: probe.reachable,
      tablesReady: probe.tablesReady,
      dbConfigured: Boolean(process.env.DATABASE_URL || env.DATABASE_URL),
      db: {
        host: probe.activeParts.host || "127.0.0.1",
        port: probe.activeParts.port || 3306,
        user: probe.activeParts.user || "root",
        name: probe.activeParts.name || "switchnest"
      },
      admin: {
        username: env.ADMIN_USERNAME || "admin",
        email: env.ADMIN_EMAIL || "admin@switchnest.in",
        passwordSet: Boolean(env.ADMIN_PASSWORD)
      }
    });
  } catch (_err) {
    ok(res, {
      installed: true,
      dbReachable: true,
      tablesReady: true,
      dbConfigured: true,
      db: { host: "127.0.0.1", port: 3306, user: "root", name: "switchnest" },
      admin: { username: "admin", email: "admin@switchnest.in", passwordSet: true }
    });
  }
});
installRouter.post("/connect", async (req, res) => {
  const parts = dbFromBody(req.body?.db ?? {});
  const { serverVersion } = await connectServer(parts);
  await createDatabase(parts);
  const probe = await probeDb(parts);
  ok(res, {
    connected: true,
    serverVersion,
    database: parts.name,
    dbCreated: probe.reachable,
    tablesReady: probe.tablesReady
  });
});
installRouter.post("/schema", async (req, res) => {
  const parts = dbFromBody(req.body?.db ?? {});
  await createDatabase(parts);
  await applySchema(parts);
  const probe = await probeDb(parts);
  ok(res, {
    tablesReady: probe.tablesReady,
    installed: probe.installed,
    database: parts.name,
    message: "Saari tables ban gayi \u2014 ab admin account banao"
  });
});
installRouter.post("/admin", async (req, res) => {
  const parts = dbFromBody(req.body?.db ?? {});
  const bodyAdmin = req.body?.admin ?? {};
  const admin = {
    username: (bodyAdmin.username ?? env.ADMIN_USERNAME).trim(),
    name: bodyAdmin.name?.trim() || void 0,
    email: (bodyAdmin.email ?? env.ADMIN_EMAIL).trim().toLowerCase(),
    password: bodyAdmin.password ?? env.ADMIN_PASSWORD
  };
  if (!admin.username || !admin.email || !admin.password) {
    throw new AppError("BAD_REQUEST", "Admin username, email aur password required hain", 400);
  }
  const probe = await probeDb(parts);
  if (probe.installed) {
    throw new AppError("ALREADY_INSTALLED", "Database already installed and connected", 409);
  }
  if (!probe.tablesReady) {
    throw new AppError(
      "SCHEMA_PENDING",
      "Pehle database + tables step complete karo (users table nahi mili)",
      400
    );
  }
  const result = await completeInstall(parts, admin);
  ok(res, result);
});
installRouter.post("/", async (req, res) => {
  if (isDbReady()) {
    const parts2 = parseDatabaseUrl(env.DATABASE_URL);
    const probe = await probeDb(parts2);
    if (probe.installed) {
      throw new AppError("ALREADY_INSTALLED", "Database already installed and connected", 409);
    }
  }
  const parts = dbFromBody(req.body?.db ?? {});
  const bodyAdmin = req.body?.admin ?? {};
  const admin = {
    username: (bodyAdmin.username ?? env.ADMIN_USERNAME).trim(),
    name: bodyAdmin.name?.trim() || void 0,
    email: (bodyAdmin.email ?? env.ADMIN_EMAIL).trim().toLowerCase(),
    password: bodyAdmin.password ?? env.ADMIN_PASSWORD
  };
  if (!admin.username || !admin.email || !admin.password) {
    throw new AppError("BAD_REQUEST", "Admin username, email aur password required hain", 400);
  }
  await createDatabase(parts);
  await applySchema(parts);
  const result = await completeInstall(parts, admin);
  ok(res, result);
});
var FALLBACK_SCHEMA_SQL = `-- CreateTable
CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`username\` VARCHAR(50) NOT NULL,
    \`email\` VARCHAR(100) NOT NULL,
    \`password\` VARCHAR(255) NOT NULL,
    \`role\` ENUM('user', 'system_admin') NOT NULL DEFAULT 'user',
    \`status\` ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`last_login_at\` DATETIME(3) NULL,
    \`theme_pref\` VARCHAR(16) NULL,
    \`token_version\` INTEGER NOT NULL DEFAULT 0,
    UNIQUE INDEX \`users_username_key\`(\`username\`),
    UNIQUE INDEX \`users_email_key\`(\`email\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`assistant_chats\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NOT NULL,
    \`homeId\` INTEGER NOT NULL,
    \`title\` VARCHAR(100) NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`assistant_chats_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`assistant_messages\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`chatId\` INTEGER NOT NULL,
    \`role\` VARCHAR(20) NOT NULL,
    \`content\` TEXT NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`assistant_messages_chatId_idx\`(\`chatId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`homes\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`name\` VARCHAR(100) NOT NULL,
    \`ownerId\` INTEGER NOT NULL,
    \`status\` ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
    \`maxDevices\` INTEGER NOT NULL DEFAULT 20,
    \`maxMembers\` INTEGER NOT NULL DEFAULT 10,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`homes_ownerId_idx\`(\`ownerId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`home_members\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`homeId\` INTEGER NOT NULL,
    \`userId\` INTEGER NOT NULL,
    \`role\` ENUM('owner', 'admin', 'member', 'viewer') NOT NULL DEFAULT 'member',
    \`restricted\` BOOLEAN NOT NULL DEFAULT false,
    \`daily_limit_minutes\` INTEGER NULL,
    \`joined_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`home_members_userId_idx\`(\`userId\`),
    UNIQUE INDEX \`home_members_homeId_userId_key\`(\`homeId\`, \`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`device_access\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`homeId\` INTEGER NOT NULL,
    \`deviceId\` INTEGER NOT NULL,
    \`userId\` INTEGER NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`device_access_homeId_idx\`(\`homeId\`),
    INDEX \`device_access_userId_idx\`(\`userId\`),
    UNIQUE INDEX \`device_access_deviceId_userId_key\`(\`deviceId\`, \`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`device_usage\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`homeId\` INTEGER NOT NULL,
    \`deviceId\` INTEGER NOT NULL,
    \`userId\` INTEGER NOT NULL,
    \`date\` DATE NOT NULL,
    \`on_minutes\` INTEGER NOT NULL,
    \`updated_at\` DATETIME(3) NOT NULL,
    INDEX \`device_usage_homeId_idx\`(\`homeId\`),
    UNIQUE INDEX \`device_usage_deviceId_userId_date_key\`(\`deviceId\`, \`userId\`, \`date\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`invitations\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`homeId\` INTEGER NOT NULL,
    \`email\` VARCHAR(100) NOT NULL,
    \`inviteCode\` VARCHAR(12) NOT NULL,
    \`role\` ENUM('owner', 'admin', 'member', 'viewer') NOT NULL DEFAULT 'member',
    \`status\` ENUM('pending', 'accepted', 'expired', 'revoked') NOT NULL DEFAULT 'pending',
    \`expiresAt\` DATETIME(3) NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`accepted_at\` DATETIME(3) NULL,
    UNIQUE INDEX \`invitations_inviteCode_key\`(\`inviteCode\`),
    INDEX \`invitations_homeId_idx\`(\`homeId\`),
    INDEX \`invitations_status_idx\`(\`status\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`rooms\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`homeId\` INTEGER NOT NULL,
    \`name\` VARCHAR(100) NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`rooms_homeId_name_key\`(\`homeId\`, \`name\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`devices\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`homeId\` INTEGER NOT NULL,
    \`roomId\` INTEGER NULL,
    \`name\` VARCHAR(100) NOT NULL,
    \`type\` ENUM('bulb', 'fan', 'ac', 'tv', 'plug', 'dimmer', 'custom') NOT NULL,
    \`status\` ENUM('on', 'off') NOT NULL DEFAULT 'off',
    \`custom_value\` VARCHAR(255) NULL,
    \`serial_number\` VARCHAR(64) NULL,
    \`firmware_version\` VARCHAR(32) NULL,
    \`ip_address\` VARCHAR(45) NULL,
    \`last_seen\` DATETIME(3) NULL,
    \`offline\` BOOLEAN NOT NULL DEFAULT false,
    \`ota_pending_version\` VARCHAR(32) NULL,
    \`ota_requested_at\` DATETIME(3) NULL,
    \`ota_progress\` INTEGER NULL,
    \`ota_status\` VARCHAR(32) NULL,
    \`espId\` INTEGER NULL,
    \`createdBy\` INTEGER NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`last_updated\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`devices_serial_number_key\`(\`serial_number\`),
    INDEX \`devices_homeId_idx\`(\`homeId\`),
    INDEX \`devices_roomId_idx\`(\`roomId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`esp_devices\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`homeId\` INTEGER NOT NULL,
    \`macAddress\` VARCHAR(32) NOT NULL,
    \`name\` VARCHAR(64) NULL,
    \`ssid\` VARCHAR(64) NULL,
    \`serial_code\` VARCHAR(32) NULL,
    \`model_code\` VARCHAR(16) NULL,
    \`ip_address\` VARCHAR(45) NULL,
    \`firmware_version\` VARCHAR(32) NULL,
    \`last_seen\` DATETIME(3) NULL,
    \`offline\` BOOLEAN NOT NULL DEFAULT false,
    \`ota_pending_version\` VARCHAR(32) NULL,
    \`ota_requested_at\` DATETIME(3) NULL,
    \`ota_progress\` INTEGER NULL,
    \`ota_status\` VARCHAR(32) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`esp_devices_macAddress_key\`(\`macAddress\`),
    UNIQUE INDEX \`esp_devices_serial_code_key\`(\`serial_code\`),
    INDEX \`esp_devices_homeId_idx\`(\`homeId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`device_configurations\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`deviceId\` INTEGER NOT NULL,
    \`config_name\` VARCHAR(255) NOT NULL,
    \`config_value\` TEXT NULL,
    UNIQUE INDEX \`device_configurations_deviceId_config_name_key\`(\`deviceId\`, \`config_name\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`device_logs\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`deviceId\` INTEGER NOT NULL,
    \`actorId\` INTEGER NULL,
    \`log_type\` VARCHAR(255) NOT NULL,
    \`log_message\` TEXT NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`device_logs_deviceId_idx\`(\`deviceId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`device_commands\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`deviceId\` INTEGER NOT NULL,
    \`actorId\` INTEGER NULL,
    \`command\` VARCHAR(255) NOT NULL,
    \`status\` ENUM('pending', 'executed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`executed_at\` DATETIME(3) NULL,
    INDEX \`device_commands_deviceId_status_idx\`(\`deviceId\`, \`status\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`schedules\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`deviceId\` INTEGER NOT NULL,
    \`createdBy\` INTEGER NOT NULL,
    \`action\` ENUM('on', 'off') NOT NULL,
    \`type\` ENUM('once', 'daily', 'weekly', 'cron') NOT NULL,
    \`run_at\` DATETIME(3) NULL,
    \`cron\` VARCHAR(100) NULL,
    \`enabled\` BOOLEAN NOT NULL DEFAULT true,
    \`next_run\` DATETIME(3) NULL,
    \`last_run\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`schedules_deviceId_idx\`(\`deviceId\`),
    INDEX \`schedules_enabled_next_run_idx\`(\`enabled\`, \`next_run\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`api_keys\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NOT NULL,
    \`homeId\` INTEGER NULL,
    \`label\` VARCHAR(100) NULL,
    \`key_hash\` VARCHAR(64) NOT NULL,
    \`key_prefix\` VARCHAR(8) NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`expires_at\` DATETIME(3) NULL,
    \`last_used_at\` DATETIME(3) NULL,
    \`revoked_at\` DATETIME(3) NULL,
    UNIQUE INDEX \`api_keys_key_hash_key\`(\`key_hash\`),
    INDEX \`api_keys_userId_idx\`(\`userId\`),
    INDEX \`api_keys_homeId_idx\`(\`homeId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`refresh_tokens\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NOT NULL,
    \`token_hash\` VARCHAR(64) NOT NULL,
    \`expires_at\` DATETIME(3) NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`revoked_at\` DATETIME(3) NULL,
    UNIQUE INDEX \`refresh_tokens_token_hash_key\`(\`token_hash\`),
    INDEX \`refresh_tokens_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`password_reset_tokens\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NOT NULL,
    \`token_hash\` VARCHAR(64) NOT NULL,
    \`expires_at\` DATETIME(3) NOT NULL,
    \`used_at\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`password_reset_tokens_token_hash_key\`(\`token_hash\`),
    INDEX \`password_reset_tokens_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`notifications\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NOT NULL,
    \`category\` VARCHAR(20) NOT NULL DEFAULT 'system',
    \`type\` ENUM('info', 'warning', 'error') NOT NULL DEFAULT 'info',
    \`title\` VARCHAR(255) NOT NULL,
    \`body\` TEXT NULL,
    \`read_at\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`notifications_userId_read_at_idx\`(\`userId\`, \`read_at\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`audit_logs\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`actorId\` INTEGER NULL,
    \`homeId\` INTEGER NULL,
    \`action\` VARCHAR(100) NOT NULL,
    \`entity\` VARCHAR(100) NULL,
    \`entityId\` INTEGER NULL,
    \`meta\` JSON NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`audit_logs_homeId_idx\`(\`homeId\`),
    INDEX \`audit_logs_actorId_idx\`(\`actorId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`firmware_versions\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`version\` VARCHAR(32) NOT NULL,
    \`url\` VARCHAR(255) NOT NULL,
    \`release_notes\` TEXT NULL,
    \`model_code\` VARCHAR(16) NOT NULL DEFAULT '',
    \`is_current\` BOOLEAN NOT NULL DEFAULT false,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`firmware_versions_version_model_code_key\`(\`version\`, \`model_code\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`products\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`name\` VARCHAR(100) NOT NULL,
    \`modelCode\` VARCHAR(32) NOT NULL,
    \`relayCount\` INTEGER NOT NULL DEFAULT 4,
    \`price\` DECIMAL(10, 2) NOT NULL,
    \`description\` TEXT NULL,
    \`features\` JSON NULL,
    \`imageUrl\` VARCHAR(255) NULL,
    \`active\` BOOLEAN NOT NULL DEFAULT true,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`products_modelCode_key\`(\`modelCode\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`orders\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`orderNumber\` VARCHAR(32) NOT NULL,
    \`userId\` INTEGER NOT NULL,
    \`status\` ENUM('pending', 'paid', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
    \`paymentMethod\` ENUM('cod', 'upi', 'manual') NOT NULL DEFAULT 'manual',
    \`paymentStatus\` VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    \`payment_ref\` VARCHAR(64) NULL,
    \`razorpay_order_id\` VARCHAR(64) NULL,
    \`paid_at\` DATETIME(3) NULL,
    \`totalAmount\` DECIMAL(10, 2) NOT NULL,
    \`shippingName\` VARCHAR(100) NOT NULL,
    \`shippingPhone\` VARCHAR(20) NOT NULL,
    \`shippingAddress\` VARCHAR(255) NOT NULL,
    \`wifiSsid\` VARCHAR(64) NULL,
    \`wifi_password_enc\` TEXT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`orders_orderNumber_key\`(\`orderNumber\`),
    INDEX \`orders_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`order_items\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`orderId\` INTEGER NOT NULL,
    \`productId\` INTEGER NOT NULL,
    \`productName\` VARCHAR(100) NOT NULL,
    \`price\` DECIMAL(10, 2) NOT NULL,
    \`quantity\` INTEGER NOT NULL DEFAULT 1,
    \`serialCode\` VARCHAR(32) NULL,
    INDEX \`order_items_orderId_idx\`(\`orderId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`serial_registry\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`serialCode\` VARCHAR(32) NOT NULL,
    \`productId\` INTEGER NOT NULL,
    \`orderId\` INTEGER NULL,
    \`userId\` INTEGER NULL,
    \`homeId\` INTEGER NULL,
    \`status\` ENUM('available', 'reserved', 'shipped', 'delivered', 'claimed') NOT NULL DEFAULT 'available',
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`claimed_at\` DATETIME(3) NULL,
    \`tested_at\` DATETIME(3) NULL,
    \`warranty_expires_at\` DATETIME(3) NULL,
    \`warranty_status\` VARCHAR(20) NOT NULL DEFAULT 'active',
    UNIQUE INDEX \`serial_registry_serialCode_key\`(\`serialCode\`),
    INDEX \`serial_registry_productId_idx\`(\`productId\`),
    INDEX \`serial_registry_status_idx\`(\`status\`),
    INDEX \`serial_registry_orderId_idx\`(\`orderId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`warranty_claims\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`serialCode\` VARCHAR(32) NOT NULL,
    \`deviceId\` INTEGER NULL,
    \`userId\` INTEGER NOT NULL,
    \`reason\` VARCHAR(255) NOT NULL,
    \`description\` TEXT NULL,
    \`status\` ENUM('submitted', 'approved', 'rejected', 'resolved') NOT NULL DEFAULT 'submitted',
    \`admin_notes\` TEXT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL,
    INDEX \`warranty_claims_userId_idx\`(\`userId\`),
    INDEX \`warranty_claims_serialCode_idx\`(\`serialCode\`),
    INDEX \`warranty_claims_status_idx\`(\`status\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`contact_messages\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NULL,
    \`name\` VARCHAR(100) NOT NULL,
    \`email\` VARCHAR(120) NULL,
    \`phone\` VARCHAR(20) NULL,
    \`subject\` VARCHAR(150) NOT NULL,
    \`message\` TEXT NOT NULL,
    \`status\` VARCHAR(20) NOT NULL DEFAULT 'new',
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`contact_messages_status_idx\`(\`status\`),
    INDEX \`contact_messages_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`support_messages\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NOT NULL,
    \`senderRole\` VARCHAR(10) NOT NULL DEFAULT 'admin',
    \`senderName\` VARCHAR(100) NOT NULL,
    \`message\` TEXT NOT NULL,
    \`attachment_name\` VARCHAR(255) NULL,
    \`attachment_type\` VARCHAR(100) NULL,
    \`attachment_data\` MEDIUMTEXT NULL,
    \`attachment_path\` VARCHAR(255) NULL,
    \`read_by_user\` BOOLEAN NOT NULL DEFAULT false,
    \`read_by_admin\` BOOLEAN NOT NULL DEFAULT true,
    \`deleted_at\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`support_messages_userId_created_at_idx\`(\`userId\`, \`created_at\`),
    INDEX \`support_messages_read_by_admin_idx\`(\`read_by_admin\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`support_chat_settings\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`userId\` INTEGER NOT NULL,
    \`peer_user_id\` INTEGER NOT NULL,
    \`muted_at\` DATETIME(3) NULL,
    \`pinned_at\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL,
    INDEX \`support_chat_settings_userId_idx\`(\`userId\`),
    UNIQUE INDEX \`support_chat_settings_userId_peer_user_id_key\`(\`userId\`, \`peer_user_id\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`app_meta\` (
    \`key\` VARCHAR(64) NOT NULL,
    \`value\` TEXT NOT NULL,
    \`updated_at\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`key\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`;

// src/routes/docs.routes.ts
var import_express23 = __toESM(require("express"), 1);

// src/lib/openapi.ts
function joinPath(prefix, p) {
  const joined = `${prefix}/${p}`.replace(/\/+/g, "/");
  return joined.length > 1 ? joined.replace(/\/$/, "") : joined;
}
function walkRouter(router, prefix, out, skipNested = false) {
  const stack = router.stack ?? [];
  for (const layer of stack) {
    const l = layer;
    if (l.route) {
      const full = joinPath(prefix, l.route.path ?? "");
      for (const method of Object.keys(l.route.methods ?? {})) {
        if (method === "_all") continue;
        out.push({ method: method.toUpperCase(), path: full });
      }
    } else if (l.handle?.stack && !skipNested) {
      walkRouter(l.handle, prefix, out);
    }
  }
}
var DESCRIPTIONS = {
  // ----- auth -----
  "POST /api/auth/signup": "Account banao \u2014 user apne pehle Home ka owner ban jata hai (tokens + home auto-create).",
  "POST /api/auth/login": "Username ya email + password se login \u2192 access/refresh token pair.",
  "POST /api/auth/refresh": "Refresh token rotate karke naya token pair do (purana revoke).",
  "POST /api/auth/logout": "Refresh token revoke (logout).",
  "POST /api/auth/forgot-password": "Email pe password reset link bhejo (30 min valid). User enumeration se bachne ke liye unknown email pe bhi { sent:true }.",
  "POST /api/auth/reset-password": "Reset token + naya password \u2192 password change, saare sessions logout.",
  "GET /api/auth/me": "Current logged-in user ka profile.",
  "PATCH /api/auth/me": "Profile update (username/email) + password change (currentPassword+newPassword).",
  "PUT /api/auth/theme": "Theme preference save (light/dark/system).",
  // ----- device API (ESP32) -----
  "GET /api/device/read-all": "ESP32: saare devices + status (api_key se). DB source of truth \u2014 board isko poll karta hai.",
  "POST /api/device/update": "ESP32: device status update (relay state report).",
  "POST /api/device/heartbeat": "ESP32: heartbeat \u2014 IP, firmware, MAC, serial, model + actual relay states report karo; response me OTA instruction mil sakta hai.",
  "POST /api/device/ota-progress": "ESP32: OTA download/apply progress report (0-100).",
  "GET /api/device/commands": "ESP32: pending commands. long=1&hold=20 \u2192 long-poll (max 25s hold).",
  "POST /api/device/commands/ack": "ESP32: command execute/fail acknowledge (command_id + status).",
  // ----- homes -----
  "POST /api/homes": "Naya home banao (creator owner banta hai).",
  "GET /api/homes": "Mere saare homes (memberships).",
  "GET /api/homes/my-boards": "Mere ESP boards (claimed serials \u2192 boards).",
  "GET /api/homes/:homeId": "Home detail (members + rooms + devices counts).",
  "PATCH /api/homes/:homeId": "Home rename (admin+).",
  "DELETE /api/homes/:homeId": "Home delete (sirf owner).",
  "POST /api/homes/:homeId/transfer": "Ownership transfer kisi member ko (sirf owner).",
  // ----- members -----
  "GET /api/homes/:homeId/members": "Home ke saare members (viewer+).",
  "GET /api/homes/:homeId/invitations": "Pending invitations list (admin+).",
  "POST /api/homes/:homeId/invitations": "Invite bhejo (email + role) \u2192 invite code generate (admin+).",
  "DELETE /api/homes/:homeId/invitations/:invitationId": "Invitation revoke (admin+).",
  "PATCH /api/homes/:homeId/members/:userId/role": "Member role change (admin+).",
  "DELETE /api/homes/:homeId/members/:userId": "Member remove (admin+) \u2014 access turant chala jata hai.",
  "PATCH /api/homes/:homeId/members/:userId/safety": "Child mode: restricted + daily ON-time limit (admin+).",
  "PUT /api/homes/:homeId/members/:userId/access": "Restricted member ke device grants replace karo (admin+).",
  "POST /api/homes/invitations/accept": "Invite code se home join karo (auth required).",
  // ----- devices -----
  "GET /api/homes/:homeId/devices": "Home ke devices (viewer+).",
  "POST /api/homes/:homeId/devices": "Device add karo (admin+).",
  "POST /api/homes/:homeId/devices/bulk-status": "Multiple devices ek saath on/off (member+).",
  "PATCH /api/homes/:homeId/devices/:deviceId": "Device rename / room assign (admin+).",
  "POST /api/homes/:homeId/devices/:deviceId/status": "Device on/off \u2014 command + log + realtime (member+).",
  "GET /api/homes/:homeId/devices/:deviceId/logs": "Device logs (viewer+).",
  "DELETE /api/homes/:homeId/devices/:deviceId": "Device delete (admin+).",
  "POST /api/homes/:homeId/devices/:deviceId/ota": "Is device ke board ko OTA update bhejo (admin+).",
  "PATCH /api/homes/:homeId/esp/:espId": "ESP board rename (admin+).",
  "GET /api/homes/:homeId/analytics/usage": "Usage analytics \u2014 toggles/day, on-time per device/member (viewer+).",
  "GET /api/homes/:homeId/automations/suggestions": "Phase 7 \u2014 usage patterns se automation suggestions (viewer+).",
  // ----- rooms -----
  "POST /api/homes/:homeId/rooms": "Room banao (admin+).",
  "DELETE /api/homes/:homeId/rooms/:roomId": "Room delete \u2014 devices roomless ho jate hain (admin+).",
  // ----- schedules -----
  "POST /api/homes/:homeId/schedules": "Timer/schedule banao \u2014 once/daily/weekly/cron (member+).",
  "GET /api/homes/:homeId/schedules": "Schedules list (viewer+).",
  "PATCH /api/homes/:homeId/schedules/:scheduleId": "Schedule update \u2014 enable/disable, action, time (member+).",
  "DELETE /api/homes/:homeId/schedules/:scheduleId": "Schedule delete (member+).",
  // ----- notifications -----
  "GET /api/notifications": "Meri notifications (page/pageSize/category/type/unread filters).",
  "GET /api/notifications/unread-count": "Unread count.",
  "POST /api/notifications/read-all": "Saari read mark karo.",
  "POST /api/notifications/:id/read": "Ek notification read.",
  "DELETE /api/notifications/:id": "Notification delete.",
  // ----- api keys -----
  "GET /api/api-keys/": "Meri API keys list.",
  "POST /api/api-keys/": "API key banao (raw key sirf ek baar \u2014 hash store hota hai).",
  "DELETE /api/api-keys/:id": "API key revoke.",
  // ----- assistant -----
  "POST /api/assistant/chats": "AI assist chat banao (home member).",
  "GET /api/assistant/chats": "Meri chats list.",
  "POST /api/assistant/chats/:chatId/messages": "Message bhejo \u2014 rule-based intent parser (EN/HI) reply + proposal deta hai.",
  "POST /api/assistant/chats/:chatId/confirm": "Proposal confirm \u2192 devices execute.",
  "GET /api/assistant/chats/:chatId/messages": "Chat history.",
  // ----- shop -----
  "GET /api/shop/products": "Active products catalog (public).",
  "POST /api/shop/orders": "Order place karo \u2014 serial reserve hota hai (COD/UPI/manual).",
  "GET /api/shop/orders": "Meri orders.",
  "GET /api/shop/orders/:id/stickers": "Order ke stickers (hotspot naam + QR) \u2014 sirf apne order ke serials, orderIdx/orderTotal ke saath.",
  "POST /api/shop/orders/:id/cancel": "Pending order cancel \u2014 serial release.",
  "POST /api/shop/orders/:id/pay": "Payment initiate \u2014 Razorpay order ya demo UPI intent.",
  "POST /api/shop/orders/:id/pay/verify": "Razorpay checkout callback \u2014 signature verify \u2192 PAID.",
  "POST /api/shop/orders/:id/pay/demo": "Demo mode: order paid mark (bina real payment).",
  "GET /api/firmware/current": "Current firmware versions (isCurrent) \u2014 saare models.",
  // ----- claim / warranty -----
  "GET /api/claim/homes": "Mere homes jahan serial claim kar sakta hoon (owner/admin).",
  "POST /api/claim": "Serial code se device activate \u2014 board home se link (owner/admin).",
  "GET /api/warranty/status": "Serial + warranty status check (?serial=...).",
  "POST /api/warranty": "Warranty claim file karo.",
  "GET /api/warranty/mine": "Meri claims + devices.",
  // ----- public -----
  "GET /api/public/site-settings": "Public site settings (brand color, contact info) \u2014 login se pehle bhi.",
  "GET /api/public/verify/bill/:token": "Bill genuineness verify (public, bina login) \u2014 bill QR scan karne pe khulta hai. HMAC-signed token se fake bill kabhi pass nahi hota; serial factory-tested status bhi dikhta hai.",
  "POST /api/public/assistant": "Public sales assistant chat (bina login) \u2014 product advisor.",
  "POST /api/public/assistant/admin": "Public assistant \u2014 admin panel preview (auth).",
  "POST /api/public/contact": "Contact form message bhejo (public).",
  "GET /api/public/support/my": "Meri support conversation (auth).",
  "POST /api/public/support": "Support message bhejo (auth).",
  // ----- support -----
  "GET /api/support/messages": "Meri support thread (read \u2192 unread mark).",
  "POST /api/support/messages": "Support ko message/reply + attachment (photo/PDF, max 2MB).",
  "DELETE /api/support/messages/:id": "Apna message delete (soft, WhatsApp-style).",
  "DELETE /api/support/messages": "Apna poora thread clear.",
  "GET /api/support/attachment/:id": "Attachment file serve (?token= ya Bearer) \u2014 owner/admin.",
  "GET /api/support/settings": "Meri chat settings (mute/pin).",
  "PUT /api/support/settings/:peerUserId": "Conversation mute/pin toggle.",
  "GET /api/support/admin/messages": "[ADMIN] User ka support thread.",
  "POST /api/support/admin/messages": "[ADMIN] User ko message bhejo \u2192 notification + email.",
  "GET /api/support/admin/unread-count": "[ADMIN] Unread conversations count (badge).",
  "GET /api/support/admin/conversations": "[ADMIN] Conversations inbox (WhatsApp-style).",
  "POST /api/support/admin/read-all": "[ADMIN] Saari chats read.",
  "POST /api/support/admin/thread-read": "[ADMIN] Ek user ki chat read/unread.",
  "GET /api/support/admin/context": "[ADMIN] User ka context \u2014 orders, homes, devices, boards.",
  "DELETE /api/support/admin/messages/:id": "[ADMIN] Koi message delete (moderation).",
  "DELETE /api/support/admin/messages": "[ADMIN] User ka poora thread clear.",
  // ----- admin -----
  "GET /api/admin/stats": "[ADMIN] Platform stats \u2014 users/homes/devices/active counts.",
  "GET /api/admin/settings": "[ADMIN] Platform settings.",
  "PUT /api/admin/settings": "[ADMIN] Settings update (site name, SMTP, limits...).",
  "POST /api/admin/settings/test-email": "[ADMIN] SMTP test email bhejo.",
  "GET /api/admin/users": "[ADMIN] Users list/search \u2014 login count, orders/devices/keys/boards/serials + usage minutes.",
  "POST /api/admin/users": "[ADMIN] Naya user banao (username/email/password, optional role).",
  "GET /api/admin/users/:id": "[ADMIN] User detail \u2014 homes, orders, API keys, boards, usage, activity.",
  "POST /api/admin/users/:id/send-reset-email": "[ADMIN] User ko password reset email bhejo (forgot-password token flow).",
  "POST /api/admin/broadcast": "[ADMIN] In-app bulk broadcast \u2014 offer/announcement sab users ko (bell + realtime; email optional).",
  "GET /api/support/admin/users": "[ADMIN] Kisi bhi user ko dhoondo (naya support chat shuru karne ke liye).",
  "PATCH /api/admin/users/:id/status": "[ADMIN] User suspend/unsuspend.",
  "PATCH /api/admin/users/:id/role": "[ADMIN] User role change (system_admin promote/demote).",
  "DELETE /api/admin/users/:id": "[ADMIN] User delete.",
  "GET /api/admin/homes": "[ADMIN] Saare homes.",
  "GET /api/admin/homes/:id": "[ADMIN] Home detail.",
  "PATCH /api/admin/homes/:id/status": "[ADMIN] Home suspend/unsuspend.",
  "DELETE /api/admin/homes/:id": "[ADMIN] Home delete.",
  "GET /api/admin/devices": "[ADMIN] Saare devices (saare homes).",
  "GET /api/admin/search": "[ADMIN] Global search (users/homes/devices/orders).",
  "GET /api/admin/api-keys": "[ADMIN] Saari API keys.",
  "POST /api/admin/api-keys": "[ADMIN] Kisi user ke liye API key banao.",
  "DELETE /api/admin/api-keys/:id": "[ADMIN] API key delete.",
  "GET /api/admin/find": "[ADMIN] Find \u2014 device/board by serial/MAC.",
  "GET /api/admin/audit": "[ADMIN] Audit logs.",
  "GET /api/admin/deploy-info": "[ADMIN] Deploy info \u2014 commit/branch/marker (ops).",
  "GET /api/admin/diagnostics": "[ADMIN] Diagnostics \u2014 DB, memory, leak state, health.",
  "GET /api/admin/logs": "[ADMIN] App log lines.",
  "GET /api/admin/esp": "[ADMIN] Saare ESP boards.",
  "POST /api/admin/esp/:id/key": "[ADMIN] Board ka API key banao/update.",
  "PATCH /api/admin/esp/:id": "[ADMIN] Board update (name, model...).",
  "GET /api/admin/esp/issues": "[ADMIN] Board cleanup \u2014 stale/offline boards + naam-serial mismatch detect (support).",
  "GET /api/admin/esp/:id/history": "[ADMIN] Board heartbeat history.",
  "GET /api/admin/esp/:id/probe": "[ADMIN] Board connectivity probe.",
  "GET /api/admin/firmware": "[ADMIN] Firmware versions.",
  "POST /api/admin/firmware": "[ADMIN] Firmware .bin upload (multipart 'firmware').",
  "POST /api/admin/firmware/:id/activate": "[ADMIN] Firmware current mark karo.",
  "POST /api/admin/devices/:id/status": "[ADMIN] Kisi bhi home ke device ka status set.",
  "GET /api/admin/devices/:id/support": "[ADMIN] Device support info.",
  "POST /api/admin/devices/:id/clear-commands": "[ADMIN] Stuck commands clear.",
  "POST /api/admin/devices/:id/push-ota": "[ADMIN] Device ke board ko OTA push.",
  "POST /api/admin/devices/push-ota-all": "[ADMIN] Saare boards ko OTA push.",
  "GET /api/admin/products": "[ADMIN] Products.",
  "POST /api/admin/products": "[ADMIN] Product banao.",
  "PATCH /api/admin/products/:id": "[ADMIN] Product update.",
  "DELETE /api/admin/products/:id": "[ADMIN] Product delete.",
  "GET /api/admin/orders": "[ADMIN] Saare orders.",
  "GET /api/admin/orders/:id": "[ADMIN] Order detail.",
  "PATCH /api/admin/orders/:id/status": "[ADMIN] Order status flow (pending\u2192paid\u2192shipped\u2192delivered).",
  "GET /api/admin/serials": "[ADMIN] Serial registry.",
  "GET /api/admin/serials/:code": "[ADMIN] Serial detail.",
  "POST /api/admin/serials/generate": "[ADMIN] Serials generate (productId, count).",
  "POST /api/admin/orders/:id/serials/generate": "[ADMIN] Order ke liye serials top-up.",
  "GET /api/admin/orders/:id/provision": "[ADMIN] Order provisioning (WiFi config + serials).",
  "POST /api/admin/serials/:code/mark-tested": "[ADMIN] Serial tested mark.",
  "GET /api/admin/warranty": "[ADMIN] Warranty claims.",
  "PATCH /api/admin/warranty/:id/status": "[ADMIN] Claim status (approved/rejected/resolved).",
  "GET /api/admin/contact": "[ADMIN] Contact messages.",
  "PATCH /api/admin/contact/:id/status": "[ADMIN] Contact message status.",
  "DELETE /api/admin/contact/:id": "[ADMIN] Contact message delete.",
  "POST /api/admin/reset": "[ADMIN] Factory reset (DB wipe + reinstall).",
  // ----- install -----
  "GET /api/install/status": "Install status probe (installed/db/tables).",
  "POST /api/install/connect": "DB connection test + create.",
  "POST /api/install/schema": "Saari tables banao (schema.sql).",
  "POST /api/install/admin": "Admin account + complete install.",
  "POST /api/install": "One-shot install: DB + tables + admin.",
  // ----- system -----
  "GET /api/health": "Health check \u2014 DB schema diag + build version (ops).",
  "GET /api/version": "API version (ops)."
};
function securityFor(path16, method) {
  if (method === "GET" && (path16 === "/api/health" || path16 === "/api/version")) return void 0;
  if (path16.startsWith("/api/device")) return [{ deviceApiKey: [] }];
  if (path16.startsWith("/api/install") || path16.startsWith("/api/public")) return void 0;
  if (path16.startsWith("/api/docs")) return void 0;
  if (path16.startsWith("/api/auth")) {
    if (method === "GET" || path16.includes("/me") || path16 === "/api/auth/theme") {
      return [{ bearerAuth: [] }];
    }
    return void 0;
  }
  if (path16.startsWith("/api/shop/products")) return void 0;
  return [{ bearerAuth: [] }];
}
var BODIES = {
  "POST /api/auth/signup": "SignupBody",
  "POST /api/auth/login": "LoginBody",
  "POST /api/auth/refresh": "RefreshBody",
  "POST /api/auth/logout": "RefreshBody",
  "POST /api/auth/forgot-password": "ForgotPasswordBody",
  "POST /api/auth/reset-password": "ResetPasswordBody",
  "PATCH /api/auth/me": "UpdateProfileBody",
  "PUT /api/auth/theme": "ThemeBody",
  "POST /api/device/update": "DeviceUpdateBody",
  "POST /api/device/heartbeat": "HeartbeatBody",
  "POST /api/device/ota-progress": "OtaProgressBody",
  "POST /api/device/commands/ack": "AckBody",
  "POST /api/homes": "CreateHomeBody",
  "PATCH /api/homes/:homeId": "CreateHomeBody",
  "POST /api/homes/:homeId/transfer": "TransferBody",
  "POST /api/homes/:homeId/invitations": "InviteBody",
  "POST /api/homes/invitations/accept": "AcceptInviteBody",
  "PATCH /api/homes/:homeId/members/:userId/role": "RoleBody",
  "PATCH /api/homes/:homeId/members/:userId/safety": "SafetyBody",
  "PUT /api/homes/:homeId/members/:userId/access": "AccessBody",
  "POST /api/homes/:homeId/devices": "CreateDeviceBody",
  "POST /api/homes/:homeId/devices/bulk-status": "BulkStatusBody",
  "PATCH /api/homes/:homeId/devices/:deviceId": "UpdateDeviceBody",
  "POST /api/homes/:homeId/devices/:deviceId/status": "SetStatusBody",
  "PATCH /api/homes/:homeId/esp/:espId": "EspNameBody",
  "POST /api/homes/:homeId/rooms": "CreateRoomBody",
  "POST /api/homes/:homeId/schedules": "CreateScheduleBody",
  "PATCH /api/homes/:homeId/schedules/:scheduleId": "UpdateScheduleBody",
  "POST /api/api-keys/": "CreateApiKeyBody",
  "POST /api/assistant/chats": "CreateChatBody",
  "POST /api/assistant/chats/:chatId/messages": "ChatMessageBody",
  "POST /api/assistant/chats/:chatId/confirm": "ConfirmProposalBody",
  "POST /api/shop/orders": "CreateOrderBody",
  "POST /api/shop/orders/:id/pay/verify": "RazorpayVerifyBody",
  "POST /api/claim": "ClaimBody",
  "POST /api/warranty": "WarrantyClaimBody",
  "POST /api/public/contact": "ContactBody",
  "POST /api/public/support": "SupportSendBody",
  "POST /api/support/messages": "SupportSendBody",
  "POST /api/support/admin/messages": "SupportAdminSendBody",
  "PUT /api/support/settings/:peerUserId": "SupportSettingsBody"
};
var SCHEMAS = {
  // ---- envelope ----
  ErrorEnvelope: {
    type: "object",
    required: ["success", "error"],
    properties: {
      success: { type: "boolean", enum: [false] },
      error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "string", example: "VALIDATION_ERROR" },
          message: { type: "string" },
          details: {}
        }
      }
    }
  },
  SuccessEnvelope: {
    type: "object",
    required: ["success", "data"],
    properties: {
      success: { type: "boolean", enum: [true] },
      data: {}
    }
  },
  // ---- auth ----
  SignupBody: {
    type: "object",
    required: ["username", "email", "password"],
    properties: {
      username: { type: "string", minLength: 3, maxLength: 50 },
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 6, maxLength: 255 },
      homeName: { type: "string", maxLength: 100 }
    }
  },
  LoginBody: {
    type: "object",
    required: ["usernameEmail", "password"],
    properties: {
      usernameEmail: { type: "string", example: "admin@robosphere.local" },
      password: { type: "string" }
    }
  },
  RefreshBody: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } },
  ForgotPasswordBody: {
    type: "object",
    required: ["email"],
    properties: { email: { type: "string", format: "email" } }
  },
  ResetPasswordBody: {
    type: "object",
    required: ["token", "newPassword"],
    properties: {
      token: { type: "string", description: "Email link se aaya reset token" },
      newPassword: { type: "string", minLength: 6 }
    }
  },
  UpdateProfileBody: {
    type: "object",
    properties: {
      username: { type: "string", minLength: 3, maxLength: 50 },
      email: { type: "string", format: "email" },
      currentPassword: { type: "string", description: "Naya password set karne ke liye zaroori" },
      newPassword: { type: "string", minLength: 6 }
    }
  },
  ThemeBody: { type: "object", required: ["theme"], properties: { theme: { type: "string", enum: ["light", "dark", "system"] } } },
  User: {
    type: "object",
    properties: {
      id: { type: "integer" },
      username: { type: "string" },
      email: { type: "string" },
      role: { type: "string", enum: ["user", "system_admin"] },
      status: { type: "string", enum: ["active", "suspended"] },
      themePref: { type: "string", nullable: true }
    }
  },
  LoginResponse: {
    type: "object",
    properties: {
      accessToken: { type: "string" },
      refreshToken: { type: "string" },
      user: { $ref: "#/components/schemas/User" }
    }
  },
  // ---- homes / members ----
  CreateHomeBody: { type: "object", required: ["name"], properties: { name: { type: "string", maxLength: 100 } } },
  TransferBody: { type: "object", required: ["newOwnerId"], properties: { newOwnerId: { type: "integer" } } },
  InviteBody: {
    type: "object",
    required: ["email", "role"],
    properties: {
      email: { type: "string", format: "email" },
      role: { type: "string", enum: ["admin", "member", "viewer"] }
    }
  },
  AcceptInviteBody: { type: "object", required: ["inviteCode"], properties: { inviteCode: { type: "string", minLength: 6, maxLength: 12 } } },
  RoleBody: { type: "object", required: ["role"], properties: { role: { type: "string", enum: ["admin", "member", "viewer"] } } },
  SafetyBody: {
    type: "object",
    properties: {
      restricted: { type: "boolean" },
      dailyLimitMinutes: { type: "integer", minimum: 1, maximum: 1440, nullable: true }
    }
  },
  AccessBody: {
    type: "object",
    required: ["deviceIds"],
    properties: { deviceIds: { type: "array", maxItems: 100, items: { type: "integer" } } }
  },
  Home: {
    type: "object",
    properties: {
      id: { type: "integer" },
      name: { type: "string" },
      ownerId: { type: "integer" },
      status: { type: "string", enum: ["active", "suspended"] },
      maxDevices: { type: "integer" },
      maxMembers: { type: "integer" },
      createdAt: { type: "string", format: "date-time" }
    }
  },
  // ---- devices ----
  CreateDeviceBody: {
    type: "object",
    required: ["name", "type"],
    properties: {
      name: { type: "string", maxLength: 100 },
      type: { type: "string", enum: ["bulb", "fan", "ac", "tv", "plug", "custom"] },
      roomId: { type: "integer" },
      serialNumber: { type: "string", maxLength: 64 }
    }
  },
  UpdateDeviceBody: {
    type: "object",
    properties: {
      name: { type: "string", maxLength: 100 },
      roomId: { type: "integer", nullable: true }
    }
  },
  SetStatusBody: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["on", "off"] } } },
  BulkStatusBody: {
    type: "object",
    required: ["deviceIds", "status"],
    properties: {
      deviceIds: { type: "array", minItems: 1, maxItems: 50, items: { type: "integer" } },
      status: { type: "string", enum: ["on", "off"] }
    }
  },
  EspNameBody: { type: "object", required: ["name"], properties: { name: { type: "string", maxLength: 60 } } },
  Device: {
    type: "object",
    properties: {
      id: { type: "integer" },
      homeId: { type: "integer" },
      roomId: { type: "integer", nullable: true },
      name: { type: "string" },
      type: { type: "string", enum: ["bulb", "fan", "ac", "tv", "plug", "dimmer", "custom"] },
      status: { type: "string", enum: ["on", "off"] },
      customValue: { type: "string", nullable: true },
      serialNumber: { type: "string", nullable: true },
      firmwareVersion: { type: "string", nullable: true },
      ipAddress: { type: "string", nullable: true },
      lastSeen: { type: "string", format: "date-time", nullable: true },
      offline: { type: "boolean" },
      createdBy: { type: "integer" },
      createdAt: { type: "string", format: "date-time" },
      lastUpdated: { type: "string", format: "date-time" }
    }
  },
  // ---- schedules / rooms ----
  CreateScheduleBody: {
    type: "object",
    required: ["deviceId", "action", "type"],
    properties: {
      deviceId: { type: "integer" },
      action: { type: "string", enum: ["on", "off"] },
      type: { type: "string", enum: ["once", "daily", "weekly", "cron"] },
      runAt: { type: "string", format: "date-time", nullable: true, description: "once/daily/weekly ke liye base time" },
      cron: { type: "string", nullable: true, description: "type=cron: 5-field cron (minute hour dom month dow)", example: "0 7 * * *" }
    }
  },
  UpdateScheduleBody: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["on", "off"] },
      enabled: { type: "boolean" },
      runAt: { type: "string", format: "date-time", nullable: true },
      cron: { type: "string", nullable: true }
    }
  },
  CreateRoomBody: { type: "object", required: ["name"], properties: { name: { type: "string", maxLength: 100 } } },
  // ---- api keys ----
  CreateApiKeyBody: {
    type: "object",
    properties: {
      label: { type: "string", maxLength: 100 },
      homeId: { type: "integer", description: "Device key ke liye home select karo" },
      expiresInDays: { type: "integer", minimum: 1, maximum: 3650 }
    }
  },
  ApiKey: {
    type: "object",
    properties: {
      id: { type: "integer" },
      userId: { type: "integer" },
      homeId: { type: "integer", nullable: true },
      label: { type: "string", nullable: true },
      keyPrefix: { type: "string", description: "Raw key ka pehla 8 chars \u2014 display ke liye" },
      createdAt: { type: "string", format: "date-time" },
      expiresAt: { type: "string", format: "date-time", nullable: true },
      lastUsedAt: { type: "string", format: "date-time", nullable: true }
    }
  },
  // ---- assistant ----
  CreateChatBody: {
    type: "object",
    required: ["homeId"],
    properties: { homeId: { type: "integer" }, title: { type: "string", maxLength: 100 } }
  },
  ChatMessageBody: { type: "object", required: ["content"], properties: { content: { type: "string", minLength: 1, maxLength: 2e3 } } },
  ConfirmProposalBody: { type: "object", required: ["messageId"], properties: { messageId: { type: "integer" } } },
  // ---- shop ----
  CreateOrderBody: {
    type: "object",
    required: ["items", "shipping", "paymentMethod"],
    properties: {
      items: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["productId", "quantity"],
          properties: { productId: { type: "integer" }, quantity: { type: "integer", minimum: 1 } }
        }
      },
      shipping: {
        type: "object",
        required: ["name", "phone", "address"],
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" }
        }
      },
      wifi: {
        type: "object",
        properties: { ssid: { type: "string" }, password: { type: "string" } },
        description: "Pre-configured WiFi (order pe de do \u2014 board factory me flash hoke aayega)"
      },
      paymentMethod: { type: "string", enum: ["cod", "upi", "manual"] }
    }
  },
  RazorpayVerifyBody: {
    type: "object",
    required: ["razorpayOrderId", "razorpayPaymentId", "razorpaySignature"],
    properties: {
      razorpayOrderId: { type: "string" },
      razorpayPaymentId: { type: "string" },
      razorpaySignature: { type: "string" }
    }
  },
  Product: {
    type: "object",
    properties: {
      id: { type: "integer" },
      name: { type: "string" },
      modelCode: { type: "string" },
      relayCount: { type: "integer" },
      price: { type: "string", description: "Decimal as string", example: "799.00" },
      description: { type: "string", nullable: true },
      features: {},
      active: { type: "boolean" }
    }
  },
  Order: {
    type: "object",
    properties: {
      id: { type: "integer" },
      orderNumber: { type: "string" },
      userId: { type: "integer" },
      status: { type: "string", enum: ["pending", "paid", "shipped", "delivered", "cancelled"] },
      paymentMethod: { type: "string", enum: ["cod", "upi", "manual"] },
      totalAmount: { type: "string" },
      shippingName: { type: "string" },
      shippingPhone: { type: "string" },
      shippingAddress: { type: "string" },
      wifiSsid: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" }
    }
  },
  // ---- claim / warranty ----
  ClaimBody: {
    type: "object",
    required: ["serialCode", "homeId"],
    properties: {
      serialCode: { type: "string", example: "RS-4CH-ABCDEF", description: "Box sticker pe serial \u2014 ownership proof" },
      homeId: { type: "integer" }
    }
  },
  WarrantyClaimBody: {
    type: "object",
    required: ["serialCode", "reason"],
    properties: {
      serialCode: { type: "string" },
      reason: { type: "string", maxLength: 255 },
      description: { type: "string" }
    }
  },
  // ---- device API (ESP32) ----
  DeviceUpdateBody: {
    type: "object",
    required: ["device_id", "status"],
    properties: {
      api_key: { type: "string", description: "ya ?api_key= query param / Bearer header" },
      device_id: { type: "integer" },
      status: { type: "string", enum: ["on", "off"] }
    }
  },
  HeartbeatBody: {
    type: "object",
    required: ["device_id"],
    properties: {
      api_key: { type: "string" },
      device_id: { type: "integer" },
      ip: { type: "string" },
      fw_version: { type: "string" },
      mac: { type: "string" },
      ssid: { type: "string" },
      serial: { type: "string" },
      model: { type: "string" },
      states: { type: "string", description: "Actual relay states (comma-separated 1/0)" }
    }
  },
  OtaProgressBody: {
    type: "object",
    required: ["device_id", "progress"],
    properties: {
      api_key: { type: "string" },
      device_id: { type: "integer" },
      progress: { type: "integer", minimum: 0, maximum: 100 },
      status: { type: "string", maxLength: 32 }
    }
  },
  AckBody: {
    type: "object",
    required: ["command_id", "device_id", "status"],
    properties: {
      api_key: { type: "string" },
      command_id: { type: "integer" },
      device_id: { type: "integer" },
      status: { type: "string", enum: ["executed", "failed"] }
    }
  },
  // ---- support ----
  SupportSendBody: {
    type: "object",
    properties: {
      message: { type: "string", maxLength: 4e3 },
      attachmentName: { type: "string", maxLength: 255 },
      attachmentType: { type: "string", description: "image/png|jpeg|gif|webp|heic, application/pdf, text/plain" },
      attachmentData: { type: "string", description: "base64 (max ~2MB)" }
    }
  },
  SupportAdminSendBody: {
    type: "object",
    required: ["userId"],
    properties: {
      userId: { type: "integer" },
      message: { type: "string", maxLength: 4e3 },
      attachmentName: { type: "string" },
      attachmentType: { type: "string" },
      attachmentData: { type: "string" }
    }
  },
  SupportSettingsBody: {
    type: "object",
    properties: { muted: { type: "boolean" }, pinned: { type: "boolean" } }
  },
  // ---- public ----
  ContactBody: {
    type: "object",
    required: ["name", "message"],
    properties: {
      name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      subject: { type: "string" },
      message: { type: "string" }
    }
  }
};
function tagFor(path16) {
  const seg = path16.replace(/^\/api\//, "").split("/")[0] ?? "system";
  const map = {
    auth: "Auth",
    device: "Device API (ESP32)",
    homes: "Homes",
    "api-keys": "API Keys",
    notifications: "Notifications",
    assistant: "AI Assistant",
    shop: "Shop",
    claim: "Activate (Serial)",
    warranty: "Warranty",
    public: "Public",
    support: "Support",
    admin: "Admin",
    install: "Install",
    firmware: "System",
    health: "System",
    version: "System"
  };
  return map[seg] ?? "Homes";
}
function paramsFor(path16) {
  const out = [];
  const re = /:([A-Za-z0-9_]+)/g;
  let m;
  while ((m = re.exec(path16)) !== null) {
    out.push({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "integer" },
      description: `\`${m[1]}\` \u2014 numeric ID`
    });
  }
  return out;
}
function buildOpenApiSpec() {
  const endpoints = [];
  walkRouter(apiRouter, "/api", endpoints, true);
  for (const m of apiMounts) {
    walkRouter(m.router, `/api${m.prefix}`, endpoints);
  }
  walkRouter(installRouter, "/api/install", endpoints);
  endpoints.push({ method: "GET", path: "/api/health" });
  endpoints.push({ method: "GET", path: "/api/version" });
  const paths = {};
  const seen = /* @__PURE__ */ new Set();
  for (const ep of endpoints) {
    const key = `${ep.method} ${ep.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const desc = DESCRIPTIONS[key];
    const tag = tagFor(ep.path);
    const security = securityFor(ep.path, ep.method);
    const bodyRef = BODIES[key];
    const op = {
      tags: [tag],
      responses: {
        200: {
          description: "Success \u2014 standard envelope { success:true, data }",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SuccessEnvelope" }
            }
          }
        },
        400: { description: "Validation error \u2014 { success:false, error }", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
        401: { description: "Unauthorized \u2014 token/api_key missing ya invalid", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
        429: { description: "Rate limited \u2014 Retry-After header dekho", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } }
      }
    };
    if (desc) op.summary = desc;
    const params = paramsFor(ep.path);
    if (params.length) op.parameters = params;
    if (security) op.security = security;
    if (bodyRef) {
      op.requestBody = {
        required: true,
        content: { "application/json": { schema: { $ref: `#/components/schemas/${bodyRef}` } } }
      };
    }
    const p = paths[ep.path] ?? (paths[ep.path] = {});
    p[ep.method.toLowerCase()] = op;
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "SwitchNest / RoboSphere API",
      description: "Smart-home IoT platform API \u2014 multi-tenant homes + devices + timers + shop.\n\n**Auth:** saare endpoints `Authorization: Bearer <accessToken>` (login se).\n**ESP32/device endpoints** (`/api/device/*`): `?api_key=rs_...` query param ya `Authorization: Bearer rs_...`.\n**Envelope:** har response `{ success, data }` ya `{ success:false, error:{ code, message } }`.\n**Rate limits (per IP, 429 + Retry-After header):** login 10/15min \xB7 signup 5/15min \xB7 forgot-password 5/h \xB7 API-key create 20/h \xB7 support send 10/min \xB7 contact form 5/h \xB7 public assistant 20/min \xB7 claim 20/h \xB7 warranty status 30/min + claim 10/h \xB7 assistant chat message 20/min + confirm 30/min \xB7 ESP32 device API 1200/600 per min.\n\nRaw spec: `GET /api/docs/openapi.json` \xB7 Offline list: `GET /api/docs/plain` \xB7 **ESP32 guide (curl/python/node + Arduino sketch): `GET /api/docs/esp32`**",
      version: "2.2.0",
      contact: { name: "SwitchNest Support" }
    },
    servers: [{ url: "/", description: "Same host (relative \u2014 local ya production dono pe chalega)" }],
    tags: [
      { name: "Device API (ESP32)", description: "ESP32 boards / machine clients \u2014 api_key auth, polling + command queue + OTA" },
      { name: "Auth", description: "Signup/login/refresh + password reset" },
      { name: "Homes", description: "Multi-tenant homes \u2014 family members, devices, rooms, schedules" },
      { name: "Shop", description: "Product catalog, orders, payment, serial activation" },
      { name: "Admin", description: "Platform administration (system_admin only)" },
      { name: "Public", description: "Bina login endpoints \u2014 site settings, contact, sales assistant" },
      { name: "Install", description: "First-run install wizard" }
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Login/signup se mila access token"
        },
        deviceApiKey: {
          type: "apiKey",
          in: "query",
          name: "api_key",
          description: "Device key (rs_...) \u2014 home ke liye bana hua. ESP32 isi se auth karta hai."
        }
      },
      schemas: SCHEMAS
    }
  };
}
var cached = null;
function getOpenApiSpec() {
  if (!cached) cached = buildOpenApiSpec();
  return cached;
}

// src/lib/esp32Guide.ts
var BASE_URL = "https://onlineswitch.bhartitechnical.com";
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function codeBlock(label, code) {
  return `
    <div style="margin:10px 0">
      <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
      <pre style="background:#0f172a;color:#e2e8f0;border-radius:8px;padding:14px 16px;overflow-x:auto;font-size:13px;line-height:1.55;margin:0"><code>${esc(code)}</code></pre>
    </div>`;
}
var methodColor = { GET: "#22c55e", POST: "#3b82f6", PATCH: "#eab308", PUT: "#eab308", DELETE: "#ef4444" };
var EN = {
  htmlLang: "en",
  title: "SwitchNest \u2014 ESP32 Integration Guide",
  headerTitle: "\u{1F4E1} SwitchNest \u2014 ESP32 Integration Guide",
  intro: "ESP32 <b>polling model</b> pe chalta hai \u2014 server khud push nahi karta: har kuch second device <code>read-all</code> / <code>commands</code> poll karta hai, web app me koi toggle kare to <code>commands</code> long-poll response me turant command milti hai, ESP relay toggle karta hai aur <code>ack</code> bhejta hai. DB hi source of truth hai \u2014 heartbeat se relay states 2-way sync hoti hain.",
  baseUrlNote: "<b>Base URL:</b> <code>" + BASE_URL + '</code> \xB7 <b>Auth:</b> har request me <code>?api_key=rs_...</code> (ya <code>Authorization: Bearer rs_...</code>). API key app me <b>Dashboard \u2192 Device Keys</b> se ban jati hai. Har response envelope: <code>{ "success": true, "data": ... }</code> \xB7 Error pe <code>{ "success": false, "error": { "code", "message" } }</code> + HTTP status. Rate limits: read 1200/min, mutate 600/min per IP \u2014 boards ke liye kaafi generous, kabhi block nahi karega.',
  paramsLabel: "Params / Body:",
  responseLabel: "Example response",
  arduinoHeading: "\u{1F6E0}\uFE0F Complete Arduino sketch (ESP32)",
  arduinoDesc: "Minimal firmware flow: connect WiFi \u2192 long-poll commands (relay toggle + ack) \u2192 heartbeat (IP + firmware + states, OTA check). ArduinoJson library chahiye (Library Manager se install karo). PlatformIO project: <code>hardware/</code> folder me.",
  errorsHeading: "\u26A0\uFE0F Common errors",
  errorsCode: "Code",
  errorsMeaning: "Matlab",
  errUnauthorized: "api_key missing / galat \u2014 key copy karke check karo",
  errKeyNotScoped: "Key kisi home se link nahi \u2014 home ke liye nayi key banao",
  errDeviceNotFound: "device_id is home me nahi \u2014 read-all se sahi id lo",
  errRateLimited: "Bahut zyada requests \u2014 Retry-After header dekho",
  footerUpdated: "Last updated",
  footerLocalDev: "Local dev",
  langHref: "/api/docs/esp32/hi",
  langLabel: "\u0939\u093F\u0902\u0926\u0940"
};
var HI = {
  htmlLang: "hi",
  title: "SwitchNest \u2014 ESP32 \u0907\u0902\u091F\u0940\u0917\u094D\u0930\u0947\u0936\u0928 \u0917\u093E\u0907\u0921",
  headerTitle: "\u{1F4E1} SwitchNest \u2014 ESP32 \u0907\u0902\u091F\u0940\u0917\u094D\u0930\u0947\u0936\u0928 \u0917\u093E\u0907\u0921",
  intro: "ESP32 <b>polling model</b> \u092A\u0930 \u091A\u0932\u0924\u093E \u0939\u0948 \u2014 server \u0916\u0941\u0926 push \u0928\u0939\u0940\u0902 \u0915\u0930\u0924\u093E: \u0939\u0930 \u0915\u0941\u091B \u0938\u0947\u0915\u0902\u0921 device <code>read-all</code> / <code>commands</code> poll \u0915\u0930\u0924\u093E \u0939\u0948, web app \u092E\u0947\u0902 \u0915\u094B\u0908 toggle \u0915\u0930\u0947 \u0924\u094B <code>commands</code> long-poll response \u092E\u0947\u0902 \u0924\u0941\u0930\u0902\u0924 command \u092E\u093F\u0932\u0924\u0940 \u0939\u0948, ESP relay toggle \u0915\u0930\u0924\u093E \u0939\u0948 \u0914\u0930 <code>ack</code> \u092D\u0947\u091C\u0924\u093E \u0939\u0948\u0964 DB \u0939\u0940 source of truth \u0939\u0948 \u2014 heartbeat \u0938\u0947 relay states 2-way sync \u0939\u094B\u0924\u0940 \u0939\u0948\u0902\u0964",
  baseUrlNote: "<b>Base URL:</b> <code>" + BASE_URL + '</code> \xB7 <b>Auth:</b> \u0939\u0930 request \u092E\u0947\u0902 <code>?api_key=rs_...</code> (\u092F\u093E <code>Authorization: Bearer rs_...</code>)\u0964 API key app \u092E\u0947\u0902 <b>Dashboard \u2192 Device Keys</b> \u0938\u0947 \u092C\u0928 \u091C\u093E\u0924\u0940 \u0939\u0948\u0964 \u0939\u0930 response envelope: <code>{ "success": true, "data": ... }</code> \xB7 Error \u092A\u0930 <code>{ "success": false, "error": { "code", "message" } }</code> + HTTP status\u0964 Rate limits: read 1200/min, mutate 600/min per IP \u2014 boards \u0915\u0947 \u0932\u093F\u090F \u0915\u093E\u092B\u0940 generous, \u0915\u092D\u0940 block \u0928\u0939\u0940\u0902 \u0915\u0930\u0947\u0917\u093E\u0964',
  paramsLabel: "Params / Body:",
  responseLabel: "\u0909\u0926\u093E\u0939\u0930\u0923 response",
  arduinoHeading: "\u{1F6E0}\uFE0F \u092A\u0942\u0930\u093E Arduino sketch (ESP32)",
  arduinoDesc: "Minimal firmware flow: WiFi connect \u0915\u0930\u0947\u0902 \u2192 long-poll commands (relay toggle + ack) \u2192 heartbeat (IP + firmware + states, OTA check)\u0964 ArduinoJson library \u091A\u093E\u0939\u093F\u090F (Library Manager \u0938\u0947 install \u0915\u0930\u0947\u0902)\u0964 PlatformIO project: <code>hardware/</code> folder \u092E\u0947\u0902\u0964",
  errorsHeading: "\u26A0\uFE0F Common errors",
  errorsCode: "Code",
  errorsMeaning: "\u092E\u0924\u0932\u092C",
  errUnauthorized: "api_key missing / \u0917\u0932\u0924 \u2014 key copy \u0915\u0930\u0915\u0947 check \u0915\u0930\u0947\u0902",
  errKeyNotScoped: "Key \u0915\u093F\u0938\u0940 home \u0938\u0947 link \u0928\u0939\u0940\u0902 \u2014 home \u0915\u0947 \u0932\u093F\u090F \u0928\u0908 key \u092C\u0928\u093E\u090F\u0901",
  errDeviceNotFound: "device_id \u0907\u0938 home \u092E\u0947\u0902 \u0928\u0939\u0940\u0902 \u2014 read-all \u0938\u0947 \u0938\u0939\u0940 id \u0932\u0947\u0902",
  errRateLimited: "\u092C\u0939\u0941\u0924 \u091C\u093C\u094D\u092F\u093E\u0926\u093E requests \u2014 Retry-After header \u0926\u0947\u0916\u0947\u0902",
  footerUpdated: "\u0906\u0916\u093F\u0930\u0940 \u0905\u092A\u0921\u0947\u091F",
  footerLocalDev: "Local dev",
  langHref: "/api/docs/esp32",
  langLabel: "English"
};
function renderEndpoint(e, lang, s) {
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
function buildHtml(lang) {
  const s = lang === "hi" ? HI : EN;
  const endpoints = [
    {
      method: "POST",
      path: "/api/api-keys/",
      name: "1. API key banao (pehla step \u2014 sirf ek baar dikhta hai)",
      desc: "ESP32 ko device API use karne ke liye home-scoped API key chahiye. Ye key web app me bhi ban sakti hai (Dashboard \u2192 Device Keys). rawKey response me SIRF EK BAAR aati hai \u2014 ise save karo. Is endpoint pe JWT auth lagta hai (Bearer token).",
      params: "Header: Authorization: Bearer &lt;JWT&gt; \xB7 Body: { homeId: number, label: string }",
      nameHi: "1. API key \u092C\u0928\u093E\u090F\u0901 (\u092A\u0939\u0932\u093E \u0915\u0926\u092E \u2014 \u0938\u093F\u0930\u094D\u092B \u090F\u0915 \u092C\u093E\u0930 \u0926\u093F\u0916\u0924\u093E \u0939\u0948)",
      descHi: "ESP32 \u0915\u094B device API \u0907\u0938\u094D\u0924\u0947\u092E\u093E\u0932 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093F\u090F home-scoped API key \u091A\u093E\u0939\u093F\u090F\u0964 \u092F\u0939 key web app \u092E\u0947\u0902 \u092D\u0940 \u092C\u0928 \u0938\u0915\u0924\u0940 \u0939\u0948 (Dashboard \u2192 Device Keys)\u0964 rawKey response \u092E\u0947\u0902 \u0938\u093F\u0930\u094D\u092B \u090F\u0915 \u092C\u093E\u0930 \u0906\u0924\u0940 \u0939\u0948 \u2014 \u0907\u0938\u0947 \u0938\u0947\u0935 \u0915\u0930 \u0932\u0947\u0902\u0964 \u0907\u0938 endpoint \u092A\u0930 JWT auth \u0932\u0917\u0924\u093E \u0939\u0948 (Bearer token)\u0964",
      paramsHi: "Header: Authorization: Bearer &lt;JWT&gt; \xB7 Body: { homeId: number, label: string }",
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
key = r.json()["data"]["rawKey"]   # rs_... \u2014 save karo, dobara nahi milegi
print(key)`,
      node: `const res = await fetch(BASE + "/api/api-keys/", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: \`Bearer \${JWT}\` },
  body: JSON.stringify({ homeId: 1, label: "esp32-kitchen" }),
});
const { data } = await res.json();
console.log(data.rawKey); // rs_... \u2014 save karo, dobara nahi milegi`,
      response: `{
  "success": true,
  "data": {
    "id": 12,
    "label": "esp32-kitchen",
    "homeId": 1,
    "rawKey": "rs_7f3a9c21e5b84d6f0a2c9e8d7b6a5f4e3d2c1b0a",
    "createdAt": "2026-08-18T10:00:00.000Z"
  }
}`
    },
    {
      method: "GET",
      path: "/api/device/read-all?api_key=rs_...",
      name: "2. Saare devices + status (poll)",
      desc: "ESP32 (ya koi client) apne home ke saare devices aur unki status padhta hai. Har successful poll pe device lastSeen update hota hai (online marker). Long-poll params optional hain \u2014 `long=1&hold=20` se response 20s tak hold hota hai agar kuch naya na ho (battery/WiFi friendly).",
      params: "Query: api_key (required) \xB7 long=1 \xB7 hold=1..25 (seconds, default 20)",
      nameHi: "2. \u0938\u092D\u0940 devices + \u0938\u094D\u091F\u0947\u091F\u0938 (poll)",
      descHi: "ESP32 (\u092F\u093E \u0915\u094B\u0908 \u092D\u0940 client) \u0905\u092A\u0928\u0947 home \u0915\u0947 \u0938\u092D\u0940 devices \u0914\u0930 \u0909\u0928\u0915\u0940 \u0938\u094D\u091F\u0947\u091F\u0938 \u092A\u0922\u093C\u0924\u093E \u0939\u0948\u0964 \u0939\u0930 \u0938\u092B\u0932 poll \u092A\u0930 device \u0915\u093E lastSeen \u0905\u092A\u0921\u0947\u091F \u0939\u094B\u0924\u093E \u0939\u0948 (online marker)\u0964 Long-poll params optional \u0939\u0948\u0902 \u2014 `long=1&hold=20` \u0938\u0947 response 20 \u0938\u0947\u0915\u0902\u0921 \u0924\u0915 hold \u0930\u0939\u0924\u093E \u0939\u0948 \u0905\u0917\u0930 \u0915\u0941\u091B \u0928\u092F\u093E \u0928 \u0939\u094B (battery/WiFi friendly)\u0964",
      paramsHi: "Query: api_key (\u091C\u093C\u0930\u0942\u0930\u0940) \xB7 long=1 \xB7 hold=1..25 (\u0938\u0947\u0915\u0902\u0921, default 20)",
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
}`
    },
    {
      method: "GET",
      path: "/api/device/commands?api_key=rs_...&long=1&hold=20",
      name: "3. Pending commands (long-poll)",
      desc: "Web app me koi toggle/schedule chale to yahan pending command milti hai. `long=1&hold=20` me server response tab tak hold karta hai jab tak command na aaye (max hold sec) \u2014 ESP32 isi se <2s me relay toggle kar leta hai. Bina long=1 ke instant pending commands milti hain (old firmware).",
      params: "Query: api_key (required) \xB7 long=1 \xB7 hold=1..25 (seconds, default 20)",
      nameHi: "3. Pending commands (long-poll)",
      descHi: "Web app \u092E\u0947\u0902 \u0915\u094B\u0908 toggle/schedule \u091A\u0932\u0947 \u0924\u094B \u092F\u0939\u093E\u0901 pending command \u092E\u093F\u0932\u0924\u0940 \u0939\u0948\u0964 `long=1&hold=20` \u092E\u0947\u0902 server response \u0924\u092C \u0924\u0915 hold \u0915\u0930\u0924\u093E \u0939\u0948 \u091C\u092C \u0924\u0915 command \u0928 \u0906\u090F (max hold sec) \u2014 ESP32 \u0907\u0938\u0940 \u0938\u0947 <2s \u092E\u0947\u0902 relay toggle \u0915\u0930 \u0932\u0947\u0924\u093E \u0939\u0948\u0964 \u092C\u093F\u0928\u093E long=1 \u0915\u0947 instant pending commands \u092E\u093F\u0932\u0924\u0940 \u0939\u0948\u0902 (old firmware)\u0964",
      paramsHi: "Query: api_key (\u091C\u093C\u0930\u0942\u0930\u0940) \xB7 long=1 \xB7 hold=1..25 (\u0938\u0947\u0915\u0902\u0921, default 20)",
      curl: `curl "${BASE_URL}/api/device/commands?api_key=rs_7f3a9c21e5b84d6f0a2c9e8d7b6a5f4e3d2c1b0a&long=1&hold=20"`,
      python: `import requests

r = requests.get(f"{BASE}/api/device/commands", params={
    "api_key": API_KEY, "long": "1", "hold": "20",
}, timeout=30)
commands = r.json()["data"]["commands"]
for c in commands:
    # c["command"] = "on"/"off"  \xB7  c["deviceId"]  \xB7  c["id"]
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
}`
    },
    {
      method: "POST",
      path: "/api/device/update",
      name: "4. Relay state report (physical switch)",
      desc: "ESP32 ne relay khud toggle kiya (physical switch / local button) to server ko batao \u2014 status DB me update hoti hai + device_logs me entry. Ye command enqueue NAHI karta (state device se AA rahi hai, web se nahi).",
      params: "Query/body: api_key \xB7 Body: { device_id, status: on|off }",
      nameHi: "4. Relay state \u0930\u093F\u092A\u094B\u0930\u094D\u091F (physical switch)",
      descHi: "ESP32 \u0928\u0947 relay \u0916\u0941\u0926 toggle \u0915\u093F\u092F\u093E (physical switch / local button) \u0924\u094B server \u0915\u094B \u092C\u0924\u093E\u090F\u0901 \u2014 \u0938\u094D\u091F\u0947\u091F\u0938 DB \u092E\u0947\u0902 \u0905\u092A\u0921\u0947\u091F \u0939\u094B\u0924\u0940 \u0939\u0948 + device_logs \u092E\u0947\u0902 entry\u0964 \u092F\u0939 command enqueue \u0928\u0939\u0940\u0902 \u0915\u0930\u0924\u093E (state device \u0938\u0947 \u0906 \u0930\u0939\u0940 \u0939\u0948, web \u0938\u0947 \u0928\u0939\u0940\u0902)\u0964",
      paramsHi: "Query/body: api_key \xB7 Body: { device_id, status: on|off }",
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
}`
    },
    {
      method: "POST",
      path: "/api/device/heartbeat",
      name: "5. Heartbeat \u2014 IP / firmware / relay states / OTA",
      desc: "ESP apna IP, firmware version, MAC, SSID, serial aur ACTUAL relay states report karta hai. Server se: (a) ESP board row upsert (MAC se), (b) devices link, (c) relay state 2-way sync, (d) agar admin ne OTA push kiya hai to `ota` object me firmware URL milta hai. States format: JSON array [{ id, status }, ...].",
      params: "Query/body: api_key \xB7 Body: { device_id, ip?, fw_version?, mac?, ssid?, serial?, model?, states? }",
      nameHi: "5. Heartbeat \u2014 IP / firmware / relay states / OTA",
      descHi: "ESP \u0905\u092A\u0928\u093E IP, firmware version, MAC, SSID, serial \u0914\u0930 ACTUAL relay states \u0930\u093F\u092A\u094B\u0930\u094D\u091F \u0915\u0930\u0924\u093E \u0939\u0948\u0964 Server \u0938\u0947: (a) ESP board row upsert (MAC \u0938\u0947), (b) devices link, (c) relay state 2-way sync, (d) \u0905\u0917\u0930 admin \u0928\u0947 OTA push \u0915\u093F\u092F\u093E \u0939\u0948 \u0924\u094B `ota` object \u092E\u0947\u0902 firmware URL \u092E\u093F\u0932\u0924\u093E \u0939\u0948\u0964 States format: JSON array [{ id, status }, ...]\u0964",
      paramsHi: "Query/body: api_key \xB7 Body: { device_id, ip?, fw_version?, mac?, ssid?, serial?, model?, states? }",
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
print(d["synced"], d["ota"])   # ota != null \u2192 firmware download karo`,
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
      "name": "RS-4CH-001234 \xB7 MyWiFi", "serialCode": "RS-4CH-001234",
      "firmwareVersion": "2.2.0", "ipAddress": "192.168.1.36"
    },
    "synced": 1,
    "ota": null
  }
}`
    },
    {
      method: "POST",
      path: "/api/device/commands/ack",
      name: "6. Command ack (executed / failed)",
      desc: "Command execute karne ke baad server ko confirm karo. `status: executed` = command done; `failed` = ESP galat kar gaya (web app pe failed dikhta hai). Already-processed command pe idempotent no-op \u2014 safe hai dobara bhejna.",
      params: "Query/body: api_key \xB7 Body: { command_id, device_id, status: executed|failed }",
      nameHi: "6. Command ack (executed / failed)",
      descHi: "Command execute \u0915\u0930\u0928\u0947 \u0915\u0947 \u092C\u093E\u0926 server \u0915\u094B confirm \u0915\u0930\u0947\u0902\u0964 `status: executed` = command done; `failed` = ESP \u0917\u0932\u0924 \u0915\u0930 \u0917\u092F\u093E (web app \u092A\u0930 failed \u0926\u093F\u0916\u0924\u093E \u0939\u0948)\u0964 Already-processed command \u092A\u0930 idempotent no-op \u2014 \u0926\u094B\u092C\u093E\u0930\u093E \u092D\u0947\u091C\u0928\u093E \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924 \u0939\u0948\u0964",
      paramsHi: "Query/body: api_key \xB7 Body: { command_id, device_id, status: executed|failed }",
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
}`
    },
    {
      method: "POST",
      path: "/api/device/ota-progress",
      name: "7. OTA progress report (optional)",
      desc: "Firmware download/flash ke dauran progress bhejo \u2014 admin panel OTA / ESP tab me live progress dikhta hai (0-100).",
      params: "Query/body: api_key \xB7 Body: { device_id, progress: 0-100, status?: string }",
      nameHi: "7. OTA progress \u0930\u093F\u092A\u094B\u0930\u094D\u091F (optional)",
      descHi: "Firmware download/flash \u0915\u0947 \u0926\u094C\u0930\u093E\u0928 progress \u092D\u0947\u091C\u0947\u0902 \u2014 admin panel OTA / ESP tab \u092E\u0947\u0902 live progress \u0926\u093F\u0916\u0924\u093E \u0939\u0948 (0-100)\u0964",
      paramsHi: "Query/body: api_key \xB7 Body: { device_id, progress: 0-100, status?: string }",
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
}`
    }
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

// Long-poll commands \u2014 server response ko hold karta hai jab tak
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
        ack(id, deviceId, "executed");   // command done \u2014 server ko batao
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
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const localBase = BASE_URL.replace("https://onlineswitch.bhartitechnical.com", "http://localhost:4000");
  return `<!DOCTYPE html>
<html lang="${s.htmlLang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${s.title}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;margin:0;background:#fafafa">
  <div style="background:#0f172a;color:#fff;padding:18px 24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <strong>${s.headerTitle}</strong>
    <span style="color:#9ca3af;margin-left:auto;font-size:14px">
      <a href="/api/docs" style="color:#60a5fa">Swagger UI</a> \xB7
      <a href="/api/docs/plain" style="color:#60a5fa">Endpoint list</a> \xB7
      <a href="/api/docs/openapi.json" style="color:#60a5fa">openapi.json</a> \xB7
      <a href="/api/docs/realtime" style="color:#60a5fa">Realtime</a> \xB7
      <a href="${s.langHref}" style="color:#fbbf24;font-weight:700">${s.langLabel}</a>
    </span>
  </div>
  <div style="max-width:980px;margin:0 auto;padding:28px 24px">

    <h2 style="margin-top:0">${lang === "hi" ? "ESP32 / hardware clients \u0915\u0947 \u0932\u093F\u090F quick guide" : "ESP32 / hardware clients ke liye quick guide"}</h2>
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

    <p style="color:#9ca3af;font-size:12px;margin-top:32px">${s.footerUpdated}: ${today} \xB7 ${s.footerLocalDev}: ${localBase} replace karke test karo</p>
  </div>
</body></html>`;
}
function esp32GuideHtml(lang = "en") {
  return buildHtml(lang);
}

// src/lib/realtimeGuide.ts
function esc2(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function codeBlock2(label, code) {
  return `
    <div style="margin:10px 0">
      <div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
      <pre style="background:#0f172a;color:#e2e8f0;border-radius:8px;padding:14px 16px;overflow-x:auto;font-size:13px;line-height:1.55;margin:0"><code>${esc2(code)}</code></pre>
    </div>`;
}
function renderEvent(e) {
  return `
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px;margin:16px 0">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <code style="background:#7c3aed1a;color:#7c3aed;font-weight:700;padding:4px 10px;border-radius:6px">${e.name}</code>
      <code style="background:#f8fafc;border:1px solid #e2e8f0;color:#334155;padding:4px 10px;border-radius:6px;font-size:12px">room: ${e.room}</code>
    </div>
    <p style="margin:12px 0 0;color:#4b5563;font-size:14px;line-height:1.6">${e.desc}</p>
    ${codeBlock2("Example payload", e.example)}
  </div>`;
}
function buildHtml2() {
  const events = [
    {
      name: "socket:ready",
      room: "user:{userId}",
      desc: 'Connection ack \u2014 connect hote hi ek baar aata hai. <code>homes</code> = kitne home rooms me join hua (0 = koi home nahi, sirf user room). Web UI isi se "live" indicator dikhata hai.',
      example: `{
  "homes": 2
}`
    },
    {
      name: "device:updated",
      room: "home:{homeId}",
      desc: "Sabse important event \u2014 koi bhi device mutation pe uniform DTO broadcast hota hai: web toggle, ESP heartbeat (relay state sync), physical switch report, offline/online detection. <code>updatedAt</code> stale-event guard ke liye hota hai (purana event ignore karo agar naye se chhota ho).",
      example: `{
  "id": 5,
  "homeId": 1,
  "name": "Living Room Bulb",
  "status": "on",
  "online": true,
  "offline": false,
  "lastSeen": "2026-08-18T10:03:00.000Z",
  "updatedAt": "2026-08-18T10:03:00.120Z"
}`
    },
    {
      name: "esp:updated",
      room: "home:{homeId}",
      desc: "ESP board row change \u2014 rename, heartbeat (IP/firmware/states update) ya offline/online. Payload partial hota hai: hamesha <code>id</code>, baaki change ke hisaab se (e.g. <code>{ id, offline: true }</code> power-cut pe).",
      example: `{
  "id": 3,
  "offline": true
}`
    },
    {
      name: "command:updated",
      room: "home:{homeId}",
      desc: "Command execute/fail ack \u2014 ESP ne relay toggle kar liya (ya fail). Web UI pending badge isi se confirm hota hai. <code>status</code>: <code>executed</code> | <code>failed</code>.",
      example: `{
  "id": 42,
  "status": "executed",
  "executedAt": "2026-08-18T10:02:16.000Z"
}`
    },
    {
      name: "notification:new",
      room: "user:{userId}",
      desc: "Naya in-app notification (bell/badge) \u2014 order status, warranty, offline alert, automation suggestion etc. Poore notification object ke saath.",
      example: `{
  "id": 88,
  "userId": 12,
  "category": "device",
  "type": "warning",
  "title": "Living Room Bulb offline",
  "body": "{\\"t\\":\\"Living Room Bulb 2 min se offline\\"}",
  "read": false,
  "createdAt": "2026-08-18T10:04:00.000Z"
}`
    },
    {
      name: "support:new",
      room: "user:{userId} (ya admin)",
      desc: "Support chat me naya message \u2014 user ko admin ka reply, admin ko user ka message. <code>senderRole</code>: <code>user</code> | <code>admin</code>.",
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
}`
    },
    {
      name: "home:access-revoked",
      room: "user:{userId}",
      desc: "Home membership revoke/role-change pe socket ko us home room se nikaal diya jata hai + ye event aata hai \u2014 client ko apne UI se home hatana chahiye (warna removed member ko devices dikhte rehte).",
      example: `{
  "homeId": 1
}`
    }
  ];
  const cards = events.map(renderEvent).join("\n");
  const nodeClient = `import { io } from "socket.io-client";

// Auth: login response ka accessToken (Bearer wala JWT).
const socket = io("/", {
  auth: { token: ACCESS_TOKEN },
});

socket.on("connect", () => console.log("connected", socket.id));
socket.on("connect_error", (err) => {
  // "unauthorized" = token missing/expired \u2192 wapas login karo
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
  console.log("\u{1F514}", n.title));
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
        \u2502                              \u2502                        \u2502
  toggle ON \u2500\u2500 POST /status \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25B6\u2502                        \u2502
        \u2502                              \u2502 enqueue command        \u2502
        \u2502                              \u2502\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 commands long-poll \u2500\u2500\u25B6
        \u2502                              \u2502\u25C0\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 ack (executed) \u2500\u2500\u2500\u2500\u2500\u2500\u2500 relay toggle
        \u2502                              \u2502                        \u2502
  \u25C0\u2500\u2500\u2500 command:updated \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2502                        \u2502
  \u25C0\u2500\u2500\u2500 device:updated \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u25C0\u2518                        \u2502
        \u2502                              \u2502\u25C0\u2500\u2500 heartbeat (states) \u2500\u2518`;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SwitchNest \u2014 Realtime Events (Socket.IO)</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;margin:0;background:#fafafa">
  <div style="background:#0f172a;color:#fff;padding:18px 24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <strong>\u{1F4E1} SwitchNest \u2014 Realtime Events (Socket.IO)</strong>
    <span style="color:#9ca3af;margin-left:auto;font-size:14px">
      <a href="/api/docs" style="color:#60a5fa">Swagger UI</a> \xB7
      <a href="/api/docs/plain" style="color:#60a5fa">Endpoint list</a> \xB7
      <a href="/api/docs/esp32" style="color:#60a5fa">ESP32 guide</a> \xB7
      <a href="/api/docs/esp32/hi" style="color:#fbbf24">\u0939\u093F\u0902\u0926\u0940</a>
    </span>
  </div>
  <div style="max-width:980px;margin:0 auto;padding:28px 24px">

    <h2 style="margin-top:0">Web app ka live-push model \u2014 Socket.IO events</h2>
    <p style="color:#4b5563;font-size:14px;line-height:1.7">
      Web app realtime <b>Socket.IO</b> pe chalta hai \u2014 toggle, schedule, OTA, notifications
      <b>push</b> hote hain (polling nahi). <b>ESP32 boards isse connect NAHI hote</b> \u2014 wo
      HTTP long-poll use karte hain (dekho: <a href="/api/docs/esp32" style="color:#2563eb">ESP32 guide</a>).
      Ye page un clients ke liye hai jo live UI banate hain, aur ESP32 command-flow
      samajhne ke liye.
    </p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;font-size:13px;color:#1e40af;line-height:1.7">
      <b>Connect:</b> same origin + <code>/socket.io</code> (dev me Vite proxy; production me same domain) \xB7
      <b>Auth:</b> <code>auth: { token: &lt;accessToken&gt; }</code> \u2014 login response ka JWT \xB7
      <b>Rooms:</b> <code>user:{userId}</code> (personal) + <code>home:{homeId}</code> har membership ke liye
      (admin = saare homes) \xB7 events sirf un homes ke aate hain jinme aap member ho.
      Heartbeat/command events <code>device:updated</code> broadcast ke through web UI tak pahunchte hain.
    </div>

    <h2 style="margin-top:36px">\u{1F504} Command flow \u2014 ESP32 ke saath (ek nazar)</h2>
    ${codeBlock2("Web toggle \u2192 relay \u2192 ack \u2192 live update", flow)}
    <p style="color:#4b5563;font-size:13px;line-height:1.7">
      ESP32 firmware me Socket.IO ki zaroorat <b>nahi</b> \u2014 HTTP long-poll hi command delivery +
      relay toggle + ack karta hai. Neeche ke events wo push hain jo web UI ko turant update karte hain.
    </p>

    <h2 style="margin-top:36px">\u{1F4E8} Server \u2192 client events</h2>
    ${cards}

    <h2 style="margin-top:36px">\u{1F9EA} Clients</h2>
    ${codeBlock2("Node.js (socket.io-client v4)", nodeClient)}
    ${codeBlock2("Browser (script tag \u2014 same origin se serve hota hai)", browserClient)}

    <h2 style="margin-top:36px">\u26A0\uFE0F Notes</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;border:1px solid #e5e7eb;border-radius:8px">
      <tr style="background:#f8fafc;text-align:left"><th style="padding:10px 14px">Situation</th><th style="padding:10px 14px">Kya karein</th></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 14px"><code>connect_error: unauthorized</code></td><td style="padding:10px 14px">Token missing/expired \u2014 wapas login karke naya access token do</td></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 14px">Pehle connect pe koi home event nahi</td><td style="padding:10px 14px"><code>socket:ready</code> ka <code>homes</code> count dekho \u2014 0 hai to membership check karo</td></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 14px">Purana <code>device:updated</code></td><td style="padding:10px 14px">Naye event ka <code>updatedAt</code> chhota ho to ignore karo (stale guard)</td></tr>
      <tr style="border-top:1px solid #f1f5f9"><td style="padding:10px 14px">Reconnect</td><td style="padding:10px 14px">Client khud reconnect karta hai; <code>socket:ready</code> dobara aata hai \u2014 state re-fetch karo</td></tr>
    </table>

    <p style="color:#9ca3af;font-size:12px;margin-top:32px">Event names: <code>@robosphere/shared</code> me <code>REALTIME_EVENTS</code> se aate hain (single source of truth)</p>
  </div>
</body></html>`;
}
function realtimeGuideHtml() {
  return buildHtml2();
}

// src/routes/docs.routes.ts
var docsRouter = (0, import_express23.Router)();
docsRouter.use("/assets", import_express23.default.static(swaggerUiDir));
var SWAGGER_UI_HTML = `<!DOCTYPE html>
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
    <strong>\u{1F4E1} SwitchNest API</strong>
    <a href="/api/docs/openapi.json" target="_blank">openapi.json</a>
    <a href="/api/docs/plain" target="_blank">Plain list</a>
    <a href="/api/docs/esp32" target="_blank">\u{1F6E0} ESP32 guide</a>
    <a href="/api/docs/esp32/hi" target="_blank" style="color:#fbbf24">\u0939\u093F\u0902\u0926\u0940</a>
    <a href="/api/docs/realtime" target="_blank">\u26A1 Realtime</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
  <script src="/api/docs/assets/swagger-init.js"></script>
</body>
</html>`;
docsRouter.get("/", (_req, res) => {
  res.type("html").send(SWAGGER_UI_HTML);
});
docsRouter.get("/openapi.json", (_req, res) => {
  res.json(getOpenApiSpec());
});
docsRouter.get("/esp32", (_req, res) => {
  res.type("html").send(esp32GuideHtml("en"));
});
docsRouter.get("/esp32/hi", (_req, res) => {
  res.type("html").send(esp32GuideHtml("hi"));
});
docsRouter.get("/realtime", (_req, res) => {
  res.type("html").send(realtimeGuideHtml());
});
docsRouter.get("/plain", (_req, res) => {
  const spec = getOpenApiSpec();
  const paths = spec.paths;
  const byTag = /* @__PURE__ */ new Map();
  for (const [path16, ops] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(ops)) {
      const tag = op.tags?.[0] ?? "Other";
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag).push({ method: method.toUpperCase(), path: path16, summary: op.summary ?? "" });
    }
  }
  const methodColor2 = {
    GET: "#22c55e",
    POST: "#3b82f6",
    PATCH: "#eab308",
    PUT: "#eab308",
    DELETE: "#ef4444"
  };
  const sections = [...byTag.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(
    ([tag, eps]) => `
    <h2 style="margin-top:32px;border-bottom:1px solid #e5e7eb;padding-bottom:8px">${tag} <span style="color:#9ca3af;font-weight:normal">(${eps.length})</span></h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${eps.map((e) => {
      const color = methodColor2[e.method] ?? "#6b7280";
      return `<tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:8px 10px;white-space:nowrap"><code style="background:${color}1a;color:${color};font-weight:700;padding:3px 8px;border-radius:6px">${e.method}</code></td>
            <td style="padding:8px 10px;font-family:monospace;font-size:13px">${e.path}</td>
            <td style="padding:8px 10px;color:#4b5563">${e.summary || ""}</td>
          </tr>`;
    }).join("")}
    </table>`
  ).join("");
  res.type("html").send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>SwitchNest API \u2014 Endpoint List</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;margin:0;background:#fafafa">
  <div style="background:#0f172a;color:#fff;padding:16px 24px">
    <strong>\u{1F4E1} SwitchNest API \u2014 saare endpoints (${Object.keys(paths).length} paths)</strong>
    <span style="color:#9ca3af;margin-left:16px">Offline list \xB7 Swagger UI: <a href="/api/docs" style="color:#60a5fa">/api/docs</a> \xB7 Raw: <a href="/api/docs/openapi.json" style="color:#60a5fa">openapi.json</a> \xB7 ESP32 guide: <a href="/api/docs/esp32" style="color:#60a5fa">/api/docs/esp32</a> \xB7 Hindi: <a href="/api/docs/esp32/hi" style="color:#fbbf24">/api/docs/esp32/hi</a> \xB7 Realtime: <a href="/api/docs/realtime" style="color:#60a5fa">/api/docs/realtime</a></span>
  </div>
  <div style="max-width:1100px;margin:0 auto;padding:24px">
    <p style="color:#6b7280;font-size:14px">Auth: <code>Authorization: Bearer &lt;token&gt;</code> \xB7 ESP32: <code>?api_key=rs_...</code> \xB7 Envelope: <code>{ success, data }</code></p>
    ${sections}
  </div>
</body></html>`);
});

// src/app.ts
init_logger();
init_prisma();
var API_VERSION = "2.2.0";
async function schemaDiag() {
  try {
    const models = {
      deviceAccess: typeof prisma.deviceAccess === "object",
      deviceUsage: typeof prisma.deviceUsage === "object",
      homeMemberRestricted: typeof prisma.homeMember === "object",
      supportChatSettings: typeof prisma.supportChatSettings === "object"
    };
    const table = async (t) => {
      const r = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = ${t}
      `;
      return Number(r[0]?.c ?? 0) > 0;
    };
    return { models, tables: { device_access: await table("device_access"), device_usage: await table("device_usage") } };
  } catch {
    return { error: "diag failed" };
  }
}
function createApp() {
  const app = (0, import_express24.default)();
  app.use((req, _res, next) => {
    if (req.headers.host) setLastSeenHost(req.headers.host);
    next();
  });
  app.use((0, import_helmet.default)({ contentSecurityPolicy: false }));
  app.use(
    (0, import_cors.default)({
      origin: corsOrigins,
      credentials: true
    })
  );
  app.use("/api/webhooks/razorpay", import_express24.default.raw({ type: "application/json" }));
  app.use(import_express24.default.json({ limit: "4mb" }));
  app.use(import_express24.default.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    const start = Date.now();
    trackRequest();
    fileLog(`[req] ${(/* @__PURE__ */ new Date()).toISOString()} START ${req.method} ${req.originalUrl}`);
    res.on("finish", () => {
      fileLog(`[req] ${(/* @__PURE__ */ new Date()).toISOString()} END ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    res.on("close", () => {
      if (!res.writableEnded) {
        fileLog(`[req] ${(/* @__PURE__ */ new Date()).toISOString()} ABORT ${req.method} ${req.originalUrl} (${Date.now() - start}ms) - connection closed before response`);
      }
    });
    next();
  });
  app.get("/api/health", async (_req, res) => {
    res.json({
      success: true,
      data: { status: "ok", ts: (/* @__PURE__ */ new Date()).toISOString(), schema: await schemaDiag(), build: API_VERSION }
    });
  });
  app.get("/health", async (_req, res) => {
    res.json({
      success: true,
      data: { status: "ok", ts: (/* @__PURE__ */ new Date()).toISOString(), schema: await schemaDiag(), build: API_VERSION }
    });
  });
  const getVersion = (req, res) => {
    const requestHost = req.get("host") || "192.168.1.36:4000";
    const protocol = req.protocol || "http";
    const latestVersion = "1.0.11";
    const minRequiredVersion = "1.0.0";
    res.json({
      success: true,
      data: {
        version: API_VERSION,
        mobileAppOptions: {
          minRequiredVersion,
          latestVersion,
          downloadUrl: `${protocol}://${requestHost}/mobile-app/SwitchNest_Latest.apk`,
          updateMessage: "ESP WebServer & Background Call Fixes",
          releaseNotes: "\u2022 Added In-App ESP WebServer\n\u2022 Fixed Call Ringing on Multiple Devices\n\u2022 Fixed ESP Hardware State Sync UI Glitch",
          isMandatory: true
        },
        ts: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  };
  app.get("/api/version", getVersion);
  app.get("/version", getVersion);
  app.use("/api/install", installRouter);
  app.use("/install", installRouter);
  app.use("/api/public", publicRouter);
  app.use("/public", publicRouter);
  app.use("/api/docs", docsRouter);
  app.use("/docs", docsRouter);
  const checkDbSetup = (req, res, next) => {
    if (isDbReady()) return next();
    res.status(503).json({
      success: false,
      error: {
        code: "NOT_INSTALLED",
        message: "Database not installed yet \u2014 run installation first (GET/POST /api/install)"
      }
    });
  };
  app.use("/api", checkDbSetup);
  app.use("/api", apiRouter);
  app.use("/firmware", import_express24.default.static(firmwareDir));
  app.use("/uploads", import_express24.default.static(uploadsDir));
  app.use("/mobile-app", import_express24.default.static(mobileAppDir));
  const apiRootHtml = import_node_path6.default.join(process.cwd(), "index.html");
  const apiAssetsDir = import_node_path6.default.join(process.cwd(), "assets");
  const webDistHtml = import_node_path6.default.join(webDist, "index.html");
  const webDistAssets = import_node_path6.default.join(webDist, "assets");
  if (import_node_fs6.default.existsSync(apiAssetsDir)) {
    app.use(
      "/assets",
      import_express24.default.static(apiAssetsDir, {
        maxAge: "1y",
        immutable: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".js")) res.setHeader("Content-Type", "application/javascript");
          else if (filePath.endsWith(".css")) res.setHeader("Content-Type", "text/css");
        }
      })
    );
  }
  if (import_node_fs6.default.existsSync(webDistAssets)) {
    app.use(
      "/assets",
      import_express24.default.static(webDistAssets, {
        maxAge: "1y",
        immutable: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".js")) res.setHeader("Content-Type", "application/javascript");
          else if (filePath.endsWith(".css")) res.setHeader("Content-Type", "text/css");
        }
      })
    );
  }
  app.use("/assets", (req, res, next) => {
    if (req.path.endsWith(".js")) {
      const targetDir = import_node_fs6.default.existsSync(apiAssetsDir) ? apiAssetsDir : import_node_fs6.default.existsSync(webDistAssets) ? webDistAssets : null;
      if (targetDir) {
        try {
          const files = import_node_fs6.default.readdirSync(targetDir);
          const latestJs = files.find((f) => f.startsWith("index-") && f.endsWith(".js"));
          if (latestJs) {
            res.setHeader("Content-Type", "application/javascript");
            return res.sendFile(import_node_path6.default.join(targetDir, latestJs));
          }
        } catch {
        }
      }
    }
    next();
  });
  const sendSpaHtml = (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    if (import_node_fs6.default.existsSync(apiRootHtml)) {
      res.sendFile(apiRootHtml);
    } else if (import_node_fs6.default.existsSync(webDistHtml)) {
      res.sendFile(webDistHtml);
    }
  };
  if (import_node_fs6.default.existsSync(apiRootHtml)) {
    app.use(import_express24.default.static(process.cwd()));
  }
  if (import_node_fs6.default.existsSync(webDistHtml)) {
    app.use(import_express24.default.static(webDist));
  }
  app.get(["/", "/login", "/signup", "/install", "/activate", "/print-serials", "/print-bill", "/warranty", "/forgot-password", "/reset-password", "/support", "/verify-bill"], sendSpaHtml);
  app.use(["/install", "/dashboard", "/admin", "/shop"], sendSpaHtml);
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" }
    });
  });
  app.use(errorHandler);
  return app;
}

// src/index.ts
init_env();
init_prisma();
init_logger();
init_socket();

// src/services/familySafety.service.ts
init_prisma();
init_notification_service();
init_socket();
init_logger();
function startFamilySafety() {
}

// src/services/keyExpiry.service.ts
init_prisma();
init_logger();
init_notification_service();
init_siteSettings_service();
var timer3 = null;
var WARN_DAYS_BEFORE = 7;
var CHECK_INTERVAL_MS5 = 6 * 60 * 60 * 1e3;
function keyExpiryAction(key, now) {
  if (!key.expiresAt) return null;
  if (key.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return null;
}
var daysLeft = (expiresAt, now) => Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 864e5));
function shouldAutoRevoke(key, now) {
  return key.expiresAt !== null && key.expiresAt.getTime() <= now.getTime() && key.revokedAt === null;
}
async function keysCtaUrl() {
  const s = await getSiteSettings().catch(() => null);
  const siteUrl = (s?.siteUrl || "").replace(/\/$/, "");
  if (!siteUrl) return void 0;
  return `${siteUrl}/device-keys`;
}
async function checkKeyExpiryInner() {
  return;
  const now = /* @__PURE__ */ new Date();
  const warnCutoff = new Date(now.getTime() + WARN_DAYS_BEFORE * 24 * 60 * 60 * 1e3);
  const cta = await keysCtaUrl();
  const expiring = await prisma.apiKey.findMany({
    where: {
      expiresAt: { not: null, lte: warnCutoff, gt: now }
    },
    include: {
      home: { select: { name: true } },
      user: { select: { id: true, username: true, email: true } }
    },
    orderBy: { expiresAt: "asc" },
    take: 200
  });
  for (const key of expiring) {
    const action = keyExpiryAction(key, now);
    if (action === null) continue;
    const label = key.label ?? "Device key";
    const homeName = key.home?.name ?? "\u2014";
    if (action === "warnSoon") {
      const title2 = `\u23F0 API key "${label}" KAL expire ho jayegi \u2014 aakhri warning`;
      const body2 = [
        `Aapki API key "${label}" (${key.keyPrefix}\u2026) kal expire ho jayegi (${key.expiresAt.toLocaleString()}).`,
        `Home: ${homeName}`,
        "",
        "Naya key abhi bana lo \u2014 expire hone ke baad aapke ESP boards server se connect nahi kar payenge."
      ].join("\n");
      await createNotificationWithEmail(
        key.userId,
        { category: "system", type: "warning", title: title2, body: body2 },
        { emailSubject: title2, emailBody: body2, ctaUrl: cta, ctaLabel: "Create new key" }
      );
      fileLog(`[keyExpiry] FINAL warned user ${key.userId} about key #${key.id} (${key.keyPrefix}\u2026) expiring ${key.expiresAt.toISOString()}`);
      continue;
    }
    const title = `\u26A0\uFE0F API key "${label}" ${daysLeft(key.expiresAt, now)} din me expire ho rahi hai`;
    const body = [
      `Aapki API key "${label}" (${key.keyPrefix}\u2026) ${daysLeft(key.expiresAt, now)} din baad expire ho jayegi.`,
      `Home: ${homeName}`,
      "",
      "Expire hone ke baad aapke ESP boards server se connect nahi kar payenge.",
      "Naya key banane ke liye Device Keys page kholo aur purana key revoke kar do."
    ].join("\n");
    await createNotificationWithEmail(
      key.userId,
      { category: "system", type: "warning", title, body },
      { emailSubject: title, emailBody: body, ctaUrl: cta, ctaLabel: "Manage keys" }
    );
    fileLog(`[keyExpiry] warned user ${key.userId} about key #${key.id} (${key.keyPrefix}\u2026) expiring ${key.expiresAt.toISOString()}`);
  }
  const expired = await prisma.apiKey.findMany({
    where: { expiresAt: { lt: now } },
    include: {
      home: { select: { name: true } },
      user: { select: { id: true, username: true, email: true } }
    },
    orderBy: { expiresAt: "asc" },
    take: 200
  });
  for (const key of expired) {
    const label = key.label ?? "Device key";
    const homeName = key.home?.name ?? "\u2014";
    const title = `\u{1F534} API key "${label}" expire ho gayi \u2014 naya key banao`;
    const body = [
      `Aapki API key "${label}" (${key.keyPrefix}\u2026) expire ho chuki hai.`,
      `Home: ${homeName}`,
      "",
      "Is key se connect hone wale ESP boards ab server se baat nahi kar payenge.",
      "Naya key banao, boards ko naye key se provision karo, aur purana key revoke kar do."
    ].join("\n");
    await createNotificationWithEmail(
      key.userId,
      { category: "system", type: "error", title, body },
      { emailSubject: title, emailBody: body, ctaUrl: cta, ctaLabel: "Create new key" }
    );
    await prisma.apiKey.update({
      where: { id: key.id },
      data: {}
    });
    fileLog(`[keyExpiry] notified user ${key.userId} about EXPIRED key #${key.id} (${key.keyPrefix}\u2026)`);
  }
  const candidates = await prisma.apiKey.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true, expiresAt: true, revokedAt: true }
  });
  const toRevoke = candidates.filter((k) => shouldAutoRevoke(k, now));
  if (toRevoke.length > 0) {
    const res = await prisma.apiKey.updateMany({
      where: { id: { in: toRevoke.map((k) => k.id) }, revokedAt: null },
      data: { revokedAt: now }
    });
    fileLog(`[keyExpiry] auto-revoked ${res.count} expired api key(s): ${toRevoke.map((k) => `#${k.id}`).join(", ")}`);
  }
}
async function checkKeyExpiry() {
  try {
    await checkKeyExpiryInner();
  } catch (err) {
    console.error("[keyExpiry] tick error:", err instanceof Error ? err.message : err);
    fileLog(`[keyExpiry] tick ERROR: ${err instanceof Error ? err.message : String(err)}`);
  }
}
function startKeyExpiryWatcher() {
  if (timer3) return;
  timer3 = setInterval(checkKeyExpiry, CHECK_INTERVAL_MS5);
  void checkKeyExpiry();
  console.log("[keyExpiry] watcher started (every 6h)");
  fileLog("[keyExpiry] watcher started (every 6h)");
}

// src/services/archival.service.ts
init_prisma();
init_siteSettings_service();
var import_node_fs7 = __toESM(require("node:fs"), 1);
var import_node_path7 = __toESM(require("node:path"), 1);
init_logger();
var COLD_STORAGE_TELEMETRY = import_node_path7.default.join(uploadsDir, "cold_storage", "telemetry");
var COLD_STORAGE_SUPPORT = import_node_path7.default.join(uploadsDir, "cold_storage", "support");
var archivalTimer = null;
var isRunning = false;
function startArchivalService() {
  if (archivalTimer) return;
  setTimeout(runArchival, 5e3);
  archivalTimer = setInterval(runArchival, 24 * 60 * 60 * 1e3);
  logger.info("[ArchivalService] started (runs daily)");
}
async function runArchival() {
  if (isRunning) return;
  isRunning = true;
  try {
    const settings = await getSiteSettings();
    import_node_fs7.default.mkdirSync(COLD_STORAGE_TELEMETRY, { recursive: true });
    import_node_fs7.default.mkdirSync(COLD_STORAGE_SUPPORT, { recursive: true });
    const now = /* @__PURE__ */ new Date();
    const telemetryThreshold = /* @__PURE__ */ new Date();
    telemetryThreshold.setDate(telemetryThreshold.getDate() - (settings.deviceTelemetryRetentionDays || 180));
    let archivedTelemetryCount = 0;
    while (true) {
      const oldLogs = await prisma.deviceLog.findMany({
        where: { createdAt: { lt: telemetryThreshold } },
        take: 1e3,
        orderBy: { createdAt: "asc" }
      });
      if (oldLogs.length === 0) break;
      const filePath = import_node_path7.default.join(COLD_STORAGE_TELEMETRY, `telemetry_${now.toISOString().split("T")[0]}.jsonl`);
      const lines = oldLogs.map((l) => JSON.stringify(l)).join("\n") + "\n";
      import_node_fs7.default.appendFileSync(filePath, lines);
      const ids = oldLogs.map((l) => l.id);
      await prisma.deviceLog.deleteMany({ where: { id: { in: ids } } });
      archivedTelemetryCount += oldLogs.length;
    }
    if (archivedTelemetryCount > 0) {
      logger.info(`[ArchivalService] Archived and deleted ${archivedTelemetryCount} old device telemetry logs.`);
    }
    const chatThreshold = /* @__PURE__ */ new Date();
    chatThreshold.setDate(chatThreshold.getDate() - (settings.chatHistoryRetentionDays || 90));
    let archivedChatCount = 0;
    while (true) {
      const oldMessages = await prisma.supportMessage.findMany({
        where: { createdAt: { lt: chatThreshold } },
        take: 500,
        orderBy: { createdAt: "asc" }
      });
      if (oldMessages.length === 0) break;
      const filePath = import_node_path7.default.join(COLD_STORAGE_SUPPORT, `chat_${now.toISOString().split("T")[0]}.jsonl`);
      const lines = oldMessages.map((m) => JSON.stringify(m)).join("\n") + "\n";
      import_node_fs7.default.appendFileSync(filePath, lines);
      const ids = oldMessages.map((m) => m.id);
      await prisma.supportMessage.deleteMany({ where: { id: { in: ids } } });
      archivedChatCount += oldMessages.length;
    }
    if (archivedChatCount > 0) {
      logger.info(`[ArchivalService] Archived and deleted ${archivedChatCount} old support chat messages.`);
    }
  } catch (err) {
    logger.error("[ArchivalService] error during archival run", err instanceof Error ? err.stack : err);
  } finally {
    isRunning = false;
  }
}

// src/index.ts
init_mqtt_service();
process.on("uncaughtException", (err) => {
  const line = `[uncaughtException] ${err instanceof Error ? err.stack || err.message : String(err)}`;
  console.error(line);
  fileLog(line);
});
process.on("unhandledRejection", (reason) => {
  const line = `[unhandledRejection] ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`;
  console.error(line);
  fileLog(line);
});
async function runLightMigrations() {
  const migration = async (label, fn) => {
    try {
      await fn();
    } catch (err) {
      logger.warn(`Migration skip/fail (${label})`, err instanceof Error ? err.message : String(err));
    }
  };
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE esp_devices e
       JOIN (
         SELECT serial_code, MAX(id) AS keep_id
         FROM esp_devices
         WHERE serial_code IS NOT NULL
         GROUP BY serial_code
         HAVING COUNT(*) > 1
       ) d ON e.serial_code = d.serial_code AND e.id <> d.keep_id
       SET e.serial_code = NULL`
    );
    const idx = await prisma.$queryRaw`
      SELECT COUNT(*) AS c FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'esp_devices' AND index_name = 'esp_devices_serial_code_key'
    `;
    if (Number(idx[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `esp_devices` ADD UNIQUE INDEX `esp_devices_serial_code_key`(`serial_code`)"
      );
      logger.info("\u2705 Migration: esp_devices.serial_code unique index added");
    }
    const col = await prisma.$queryRaw`
      SELECT COUNT(*) AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'notifications' AND column_name = 'category'
    `;
    if (Number(col[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `notifications` ADD COLUMN `category` VARCHAR(20) NOT NULL DEFAULT 'system'"
      );
      logger.info("\u2705 Migration: notifications.category column added");
    }
    const fixed = await prisma.$executeRawUnsafe(`
      UPDATE notifications
      SET category = 'schedule'
      WHERE category = 'system' AND (title LIKE '\u23F0 Schedule fired:%' OR title LIKE '%Schedule fired:%')
    `);
    logger.info(`\u2705 Backfill: ${fixed} schedule notification(s) category \u2192 schedule`);
    const sm = await prisma.$queryRaw`
      SELECT COUNT(*) AS c FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'support_messages'
    `;
    if (Number(sm[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE support_messages (
          id INT NOT NULL AUTO_INCREMENT,
          userId INT NOT NULL,
          senderRole VARCHAR(10) NOT NULL DEFAULT 'admin',
          senderName VARCHAR(100) NOT NULL,
          message TEXT NOT NULL,
          read_by_user BOOLEAN NOT NULL DEFAULT FALSE,
          read_by_admin BOOLEAN NOT NULL DEFAULT TRUE,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          INDEX support_messages_userId_createdAt_idx (userId, created_at),
          INDEX support_messages_readByAdmin_idx (read_by_admin),
          CONSTRAINT support_messages_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      logger.info("\u2705 Migration: support_messages table created");
    }
    const tp = await prisma.$queryRaw`
      SELECT COUNT(*) AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'theme_pref'
    `;
    if (Number(tp[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `users` ADD COLUMN `theme_pref` VARCHAR(16) NULL"
      );
      logger.info("\u2705 Migration: users.theme_pref column added");
    }
    const att = await prisma.$queryRaw`
      SELECT COUNT(*) AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'support_messages' AND column_name = 'attachment_name'
    `;
    if (Number(att[0]?.c ?? 0) === 0) {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `support_messages` ADD COLUMN `attachment_name` VARCHAR(255) NULL, ADD COLUMN `attachment_type` VARCHAR(100) NULL, ADD COLUMN `attachment_data` MEDIUMTEXT NULL"
      );
      logger.info("\u2705 Migration: support_messages.attachment_* columns added");
    }
    await migration("support_messages.deleted_at", async () => {
      const dl = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'support_messages' AND column_name = 'deleted_at'
      `;
      if (Number(dl[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `support_messages` ADD COLUMN `deleted_at` DATETIME(3) NULL"
        );
        logger.info("\u2705 Migration: support_messages.deleted_at added");
      }
    });
    await migration("support_messages.attachment_path", async () => {
      const ap = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'support_messages' AND column_name = 'attachment_path'
      `;
      if (Number(ap[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `support_messages` ADD COLUMN `attachment_path` VARCHAR(255) NULL"
        );
        logger.info("\u2705 Migration: support_messages.attachment_path added");
      }
    });
    await migration("support_chat_settings table", async () => {
      const cs = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'support_chat_settings'
      `;
      if (Number(cs[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE support_chat_settings (
            id INT NOT NULL AUTO_INCREMENT,
            userId INT NOT NULL,
            peer_user_id INT NOT NULL,
            muted_at DATETIME(3) NULL,
            pinned_at DATETIME(3) NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            UNIQUE INDEX support_chat_settings_userId_peerUserId_key (userId, peer_user_id),
            INDEX support_chat_settings_userId_idx (userId),
            CONSTRAINT support_chat_settings_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.info("\u2705 Migration: support_chat_settings table created");
      }
    });
    await migration("app_meta.value TEXT", async () => {
      const am = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'app_meta' AND column_name = 'value'
      `;
      if (Number(am[0]?.c ?? 0) > 0) {
        const typ = await prisma.$queryRaw`
          SELECT DATA_TYPE AS data_type FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'app_meta' AND column_name = 'value'
        `;
        if (typ[0]?.data_type === "varchar") {
          await prisma.$executeRawUnsafe(
            "ALTER TABLE `app_meta` MODIFY COLUMN `value` TEXT NOT NULL"
          );
          logger.info("\u2705 Migration: app_meta.value -> TEXT");
        }
      }
    });
    await migration("home_members restricted", async () => {
      const rm = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'home_members' AND column_name = 'restricted'
      `;
      if (Number(rm[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `home_members` ADD COLUMN `restricted` BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN `daily_limit_minutes` INT NULL"
        );
        logger.info("\u2705 Migration: home_members.restricted + daily_limit_minutes added");
      }
    });
    await migration("device_access table", async () => {
      const da = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'device_access'
      `;
      if (Number(da[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE device_access (
            id INT NOT NULL AUTO_INCREMENT,
            homeId INT NOT NULL,
            deviceId INT NOT NULL,
            userId INT NOT NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            UNIQUE INDEX device_access_deviceId_userId_key (deviceId, userId),
            INDEX device_access_homeId_idx (homeId),
            INDEX device_access_userId_idx (userId),
            CONSTRAINT device_access_homeId_fkey FOREIGN KEY (homeId) REFERENCES homes(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT device_access_deviceId_fkey FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT device_access_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.info("\u2705 Migration: device_access table created");
      }
    });
    await migration("device_usage table", async () => {
      const du = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'device_usage'
      `;
      if (Number(du[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE device_usage (
            id INT NOT NULL AUTO_INCREMENT,
            homeId INT NOT NULL,
            deviceId INT NOT NULL,
            userId INT NOT NULL,
            date DATE NOT NULL,
            on_minutes INT NOT NULL,
            updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            UNIQUE INDEX device_usage_deviceId_userId_date_key (deviceId, userId, date),
            INDEX device_usage_homeId_idx (homeId),
            CONSTRAINT device_usage_homeId_fkey FOREIGN KEY (homeId) REFERENCES homes(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT device_usage_deviceId_fkey FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT device_usage_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.info("\u2705 Migration: device_usage table created");
      }
    });
    await migration("password_reset_tokens table", async () => {
      const prt = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'password_reset_tokens'
      `;
      if (Number(prt[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE password_reset_tokens (
            id INT NOT NULL AUTO_INCREMENT,
            userId INT NOT NULL,
            token_hash VARCHAR(64) NOT NULL,
            expires_at DATETIME(3) NOT NULL,
            used_at DATETIME(3) NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            UNIQUE INDEX password_reset_tokens_token_hash_key (token_hash),
            INDEX password_reset_tokens_userId_idx (userId),
            CONSTRAINT password_reset_tokens_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.info("\u2705 Migration: password_reset_tokens table created");
      }
    });
    await migration("api_keys.revoked_at", async () => {
      const ra = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'api_keys' AND column_name = 'revoked_at'
      `;
      if (Number(ra[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `api_keys` ADD COLUMN `revoked_at` DATETIME(3) NULL"
        );
        logger.info("\u2705 Migration: api_keys.revoked_at added");
      }
    });
    await migration("esp_devices.led_enabled", async () => {
      const le = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'esp_devices' AND column_name = 'led_enabled'
      `;
      if (Number(le[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `esp_devices` ADD COLUMN `led_enabled` BOOLEAN NOT NULL DEFAULT TRUE"
        );
        logger.info("\u2705 Migration: esp_devices.led_enabled added");
      }
    });
    await migration("devices.channel", async () => {
      const ch = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'devices' AND column_name = 'channel'
      `;
      if (Number(ch[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `devices` ADD COLUMN `channel` INT NULL"
        );
        logger.info("\u2705 Migration: devices.channel column added");
      }
    });
    const addCol = async (table, col2, defSql) => {
      await migration(`${table}.${col2}`, async () => {
        const res = await prisma.$queryRaw`
          SELECT COUNT(*) AS c FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = ${table} AND column_name = ${col2}
        `;
        if (Number(res[0]?.c ?? 0) === 0) {
          await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${col2}\` ${defSql}`);
          logger.info(`\u2705 Migration: ${table}.${col2} added`);
        }
      });
    };
    await addCol("devices", "channel", "INT NULL");
    await addCol("users", "avatar_url", "VARCHAR(500) NULL");
    await addCol("users", "expo_push_token", "VARCHAR(100) NULL");
    await addCol("users", "dob", "DATE NULL");
    await addCol("users", "gender", "VARCHAR(20) NULL");
    await addCol("users", "phone", "VARCHAR(20) NULL");
    await addCol("users", "address", "TEXT NULL");
    await addCol("users", "push_device_toggles", "BOOLEAN NOT NULL DEFAULT TRUE");
    await addCol("users", "push_system_alerts", "BOOLEAN NOT NULL DEFAULT TRUE");
    await addCol("users", "token_version", "INT NOT NULL DEFAULT 0");
    await addCol("products", "stock_count", "INT NOT NULL DEFAULT 0");
    await addCol("products", "rating", "DECIMAL(3,2) NOT NULL DEFAULT 0.0");
    await addCol("products", "total_reviews", "INT NOT NULL DEFAULT 0");
    await addCol("orders", "razorpay_order_id", "VARCHAR(64) NULL");
    await addCol("orders", "payment_ref", "VARCHAR(64) NULL");
    await addCol("orders", "paid_at", "DATETIME(3) NULL");
    await addCol("serial_registry", "warranty_status", "VARCHAR(20) NOT NULL DEFAULT 'active'");
    await addCol("serial_registry", "warranty_expires_at", "DATETIME(3) NULL");
    await addCol("serial_registry", "console_password", "VARCHAR(64) NULL");
    await addCol("serial_registry", "tested_at", "DATETIME(3) NULL");
    await addCol("notifications", "category", "VARCHAR(20) NOT NULL DEFAULT 'system'");
    await addCol("notifications", "cta_url", "VARCHAR(255) NULL");
    await addCol("notifications", "cta_label", "VARCHAR(50) NULL");
    await addCol("home_members", "restricted", "BOOLEAN NOT NULL DEFAULT FALSE");
    await addCol("home_members", "daily_limit_minutes", "INT NULL");
    await migration("alter orders.status to VARCHAR(32)", async () => {
      await prisma.$executeRawUnsafe("ALTER TABLE `orders` MODIFY COLUMN `status` VARCHAR(32) NOT NULL DEFAULT 'pending'");
    });
    await migration("fix pending orders with paymentRef", async () => {
      const updatedCount = await prisma.$executeRawUnsafe(`
        UPDATE orders
        SET status = 'processing', paymentStatus = 'paid'
        WHERE payment_ref IS NOT NULL AND status = 'pending'
      `);
      if (Number(updatedCount) > 0) {
        logger.info(`\u2705 Migration: updated ${updatedCount} stuck pending orders to processing/paid`);
      }
    });
    await migration("auto-seed default products", async () => {
      const pc = await prisma.product.count();
      if (pc === 0) {
        const DEFAULT_PRODUCTS2 = [
          { name: "2CH WiFi Relay Module", modelCode: "2CH", relayCount: 2, price: "599", description: "Two-channel WiFi relay board for lights and small appliances. 10A per channel, ESP32 based, works with the SwitchNest app and voice assistant.", features: JSON.stringify({ channels: 2, wifi: true, ota: true, voice: true }), stockCount: 50 },
          { name: "4CH WiFi Relay Module", modelCode: "4CH", relayCount: 4, price: "799", description: "Four-channel WiFi relay board \u2014 the classic choice for room-wide control. 10A per channel with status LED and manual override switches.", features: JSON.stringify({ channels: 4, wifi: true, ota: true, voice: true }), stockCount: 50 },
          { name: "5CH WiFi Relay Module", modelCode: "5CH", relayCount: 5, price: "899", description: "Five-channel relay board \u2014 perfect for combining 4 devices plus one spare. ESP32 with OTA updates and two-way sync.", features: JSON.stringify({ channels: 5, wifi: true, ota: true, voice: true }), stockCount: 50 },
          { name: "6CH WiFi Relay Module", modelCode: "6CH", relayCount: 6, price: "999", description: "Six-channel WiFi relay board for medium-size homes. Control lights, fans and appliances from one compact board.", features: JSON.stringify({ channels: 6, wifi: true, ota: true, voice: true }), stockCount: 50 },
          { name: "8CH WiFi Relay Module", modelCode: "8CH", relayCount: 8, price: "1199", description: "Eight-channel WiFi relay board \u2014 full-home control. Ideal for new construction wiring with all loads in one panel.", features: JSON.stringify({ channels: 8, wifi: true, ota: true, voice: true }), stockCount: 50 },
          { name: "4CH IR WiFi Relay Module", modelCode: "4CH-IR", relayCount: 4, price: "999", description: "Four-channel relay board with built-in IR receiver \u2014 control with the app and any IR remote. Works with ACs, TVs and IR appliances.", features: JSON.stringify({ channels: 4, ir: true, wifi: true, ota: true, voice: true }), stockCount: 50 },
          { name: "Fan Speed Dimmer (WiFi)", modelCode: "FAN-DIM", relayCount: 1, price: "899", description: "WiFi fan regulator with stepped speed control. Replace your old 5-step regulator and control the fan from the app or voice.", features: JSON.stringify({ fanDimmer: true, steps: 5, wifi: true, ota: true, voice: true }), stockCount: 50 },
          { name: "3-State Touch Dimmer", modelCode: "DIM-3S", relayCount: 1, price: "749", description: "Touch dimmer with 3 brightness steps (off \u2192 50% \u2192 100%). WiFi + touch control, works with existing bulb holders.", features: JSON.stringify({ dimmer: true, steps: 3, touch: true, wifi: true, ota: true }), stockCount: 50 },
          { name: "4-State Touch Dimmer", modelCode: "DIM-4S", relayCount: 1, price: "799", description: "Touch dimmer with 4 brightness steps (off \u2192 33% \u2192 66% \u2192 100%). WiFi + touch control, app dimming via steps.", features: JSON.stringify({ dimmer: true, steps: 4, touch: true, wifi: true, ota: true }), stockCount: 50 }
        ];
        for (const p of DEFAULT_PRODUCTS2) {
          await prisma.product.create({ data: p });
        }
        logger.info("\u2705 Auto-seeded default product catalog (9 products)");
      }
    });
    await migration("refresh_tokens table", async () => {
      const rt = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'refresh_tokens'
      `;
      if (Number(rt[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE refresh_tokens (
            id INT NOT NULL AUTO_INCREMENT,
            userId INT NOT NULL,
            token_hash VARCHAR(64) NOT NULL,
            device_info VARCHAR(255) NULL,
            ip_address VARCHAR(45) NULL,
            last_active DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            expires_at DATETIME(3) NOT NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            revoked_at DATETIME(3) NULL,
            PRIMARY KEY (id),
            UNIQUE INDEX refresh_tokens_token_hash_key (token_hash),
            INDEX refresh_tokens_userId_idx (userId),
            CONSTRAINT refresh_tokens_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.info("\u2705 Migration: refresh_tokens table created");
      }
    });
    await addCol("product_media", "review_id", "INT NULL");
    await migration("product_media table", async () => {
      const pm = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'product_media'
      `;
      if (Number(pm[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE product_media (
            id INT NOT NULL AUTO_INCREMENT,
            product_id INT NOT NULL,
            review_id INT NULL,
            type VARCHAR(20) NOT NULL DEFAULT 'image',
            url VARCHAR(500) NOT NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            INDEX product_media_product_id_idx (product_id),
            CONSTRAINT product_media_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.info("\u2705 Migration: product_media table created");
      }
    });
    await migration("product_reviews table", async () => {
      const pr = await prisma.$queryRaw`
        SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'product_reviews'
      `;
      if (Number(pr[0]?.c ?? 0) === 0) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE product_reviews (
            id INT NOT NULL AUTO_INCREMENT,
            product_id INT NOT NULL,
            user_id INT NOT NULL,
            rating INT NOT NULL,
            comment TEXT NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            INDEX product_reviews_product_id_idx (product_id),
            INDEX product_reviews_user_id_idx (user_id),
            CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT product_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        logger.info("\u2705 Migration: product_reviews table created");
      }
    });
  } catch (err) {
    logger.warn("Light migration (esp serial unique) skip/fail", err instanceof Error ? err.message : String(err));
  }
}
async function dbHasSchema() {
  try {
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*) AS c FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'users'
    `;
    if (Number(rows[0]?.c ?? 0) > 0) return true;
  } catch (err) {
    logger.warn("Schema probe via Prisma failed \u2014 trying direct mysql probe:", err instanceof Error ? err.message : String(err));
  }
  try {
    const mysql2 = (await import("mysql2/promise")).default;
    const dbUrl = getEffectiveDbUrl();
    const u = new URL(dbUrl);
    const conn = await mysql2.createConnection({
      host: u.hostname === "localhost" ? "127.0.0.1" : u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: decodeURIComponent(u.pathname.replace(/^\//, "")),
      connectTimeout: 5e3
    });
    const [rows] = await conn.query(
      "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'"
    );
    await conn.end().catch(() => void 0);
    return Number(rows[0]?.c ?? 0) > 0;
  } catch {
    return false;
  }
}
process.on("unhandledRejection", (reason) => {
  const line = `[crashguard] unhandledRejection: ${reason instanceof Error ? reason.stack : String(reason)}`;
  process.stderr.write(line + "\n");
  fileLog(line);
});
process.on("uncaughtException", (err) => {
  const line = `[crashguard] uncaughtException: ${err instanceof Error ? err.stack : String(err)}`;
  process.stderr.write(line + "\n");
  fileLog(line);
});
setInterval(() => {
  fileLog(
    `[hb] alive ts=${(/* @__PURE__ */ new Date()).toISOString()} uptime=${Math.round(process.uptime())}s pid=${process.pid} rss=${Math.round(
      process.memoryUsage().rss / 1048576
    )}MB heap=${Math.round(process.memoryUsage().heapUsed / 1048576)}MB`
  );
}, 1e4);
process.on("beforeExit", (code) => {
  fileLog(`[hb] beforeExit code=${code} uptime=${Math.round(process.uptime())}s`);
});
process.on("exit", (code) => {
  fileLog(`[hb] exit code=${code} uptime=${Math.round(process.uptime())}s`);
});
var boot = (...args) => {
  const line = `[boot] ${args.join(" ")}`;
  process.stderr.write(line + "\n");
  fileLog(line);
};
async function main() {
  boot("node", process.version, "| cwd =", process.cwd());
  boot("PORT env =", JSON.stringify(process.env.PORT ?? "(not set)"), "-> API_PORT =", env.API_PORT);
  boot("log file =", logFilePath ?? "(disabled)");
  const app = createApp();
  boot("createApp done");
  const server = (0, import_http.createServer)(app);
  initSocket(server);
  boot("socket init done");
  try {
    startMqttBroker();
    boot("mqtt broker started");
  } catch (err) {
    boot("mqtt broker start failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }
  const rawPort = process.env.PORT;
  const listenTarget = rawPort && !/^\d+$/.test(rawPort.trim()) ? rawPort.trim() : env.API_PORT;
  boot("listen target:", JSON.stringify(listenTarget));
  const onListening = () => {
    const addr = server.address();
    boot("LISTENING on", typeof addr === "object" && addr ? `${addr.address}:${addr.port}` : String(addr));
    logger.info(`\u{1F680} API listening on ${JSON.stringify(listenTarget)}`);
    logger.info(`   Health check: /api/health`);
    logger.info(`   Realtime (Socket.IO): ws://${env.API_HOST}:${env.API_PORT}`);
  };
  if (typeof listenTarget === "string") {
    server.listen(listenTarget, onListening);
  } else {
    server.listen(listenTarget, env.API_HOST, onListening);
    if (env.API_PORT !== 4e3) {
      const fallback = (0, import_http.createServer)(app);
      fallback.on("error", (err) => {
        boot("fallback 4000 listener error:", err instanceof Error ? err.message : String(err));
        logger.warn("Fallback 4000 listener failed", err instanceof Error ? err.message : String(err));
      });
      fallback.listen(4e3, env.API_HOST);
      boot("fallback listener requested on 4000");
    }
  }
  server.on("error", (err) => {
    const line = `[server] listen error: ${err instanceof Error ? err.stack || err.message : String(err)}`;
    process.stderr.write(line + "\n");
    fileLog(line);
  });
  boot("main() setup complete \u2014 background DB init starting");
  void initDatabase();
}
async function selfHealPrismaClient() {
}
async function initDatabase() {
  boot("db probe: connecting...");
  const probeOnce = async () => {
    try {
      await prisma.$connect();
    } catch (err) {
      const pleskUrl = "mysql://switch_v2:switchnest%401234567890@127.0.0.1:3306/switch_v2";
      try {
        await resetPrismaClient(pleskUrl);
        await prisma.$connect();
      } catch {
        boot("db probe: NOT reachable \u2014", err instanceof Error ? err.message : String(err));
        return false;
      }
    }
    if (await dbHasSchema()) {
      logger.info("\u2705 Database connected (schema ready)");
      await runLightMigrations();
      await selfHealPrismaClient();
      return true;
    }
    logger.warn("\u26A0\uFE0F Database reachable par installed nahi \u2014 setup mode. /api/install se installation karo.");
    return false;
  };
  const finishReady = async () => {
    boot("db probe: schema ready = true");
    setDbReady(true);
    try {
      startScheduler();
      startFamilySafety();
      startHealthMonitor();
      startLeakMonitor();
    } catch (err) {
      logger.warn("Scheduler start skipped/failed", err instanceof Error ? err.message : String(err));
    }
    try {
      startKeyExpiryWatcher();
    } catch (err) {
      logger.warn("Key expiry watcher start skipped/failed", err instanceof Error ? err.message : String(err));
    }
    try {
      startOfflineWatcher();
    } catch (err) {
      logger.warn("Offline watcher start skipped/failed", err instanceof Error ? err.message : String(err));
    }
    try {
      startArchivalService();
    } catch (err) {
      logger.warn("Archival service start skipped/failed", err instanceof Error ? err.message : String(err));
    }
    try {
      await loadRequestTracker();
      startRequestFlush();
      boot("request tracker: loaded");
    } catch (err) {
      logger.warn("Request tracker start failed", err instanceof Error ? err.message : String(err));
    }
  };
  if (await probeOnce()) {
    await finishReady();
    return;
  }
  boot("db probe: retry loop start (har 15s) \u2014 DB aate hi ready ho jayega");
  setDbReady(false);
  const retryTimer = setInterval(async () => {
    const ok2 = await probeOnce();
    if (ok2) {
      clearInterval(retryTimer);
      await finishReady();
    }
  }, 15e3);
  retryTimer.unref?.();
}
main().catch((err) => {
  const line = `[fatal] main() failed: ${err instanceof Error ? err.stack || err.message : String(err)}`;
  process.stderr.write(line + "\n");
  fileLog(line);
  logger.error("Failed to start API", err instanceof Error ? err.stack : err);
});
