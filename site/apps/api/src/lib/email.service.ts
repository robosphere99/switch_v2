import * as net from "node:net";
import * as tls from "node:tls";
import * as os from "node:os";
import { getSiteSettings } from "../services/siteSettings.service";
import { decryptSecret } from "./crypto";
import { env } from "../config/env";
import { logger } from "./logger";

/**
 * Zero-dependency SMTP client (node:net + node:tls) — Plesk pe naye npm packages
 * install karna risky hai (deploy.cmd fast-path npm skip karta hai), isliye
 * nodemailer ki jagah chhota built-in client. EHLO → STARTTLS → AUTH (LOGIN/PLAIN)
 * → MAIL/RCPT/DATA. Config Admin → Settings se (app_meta, encrypted smtpPass)
 * ya SMTP_* env vars se. Configured nahi hai to skip (kabhi crash nahi).
 */

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const s = await getSiteSettings().catch(() => null);
  let pass = "";
  if (s?.smtpPass) {
    try {
      pass = decryptSecret(s.smtpPass);
    } catch {
      pass = s.smtpPass; // purana plaintext fallback
    }
  }
  return {
    host: s?.smtpHost || process.env.SMTP_HOST || "",
    port: s?.smtpPort || Number(process.env.SMTP_PORT) || 587,
    user: s?.smtpUser || process.env.SMTP_USER || "",
    pass: pass || process.env.SMTP_PASS || "",
    from: s?.smtpFrom || process.env.SMTP_FROM || s?.supportEmail || env.ADMIN_EMAIL,
    secure: s?.smtpSecure || process.env.SMTP_SECURE === "true",
  };
}

export function isEmailConfigured(cfg: SmtpConfig): boolean {
  return !!(cfg.host && cfg.user && cfg.pass);
}

/** SMTP line-response reader — multiline (250-) responses ko terminal line tak jama karta hai. */
function createReader(sock: net.Socket, timeoutMs: number) {
  let buf = "";
  let pending: { resolve: (lines: string[]) => void; reject: (e: Error) => void } | null = null;
  let timer: NodeJS.Timeout | null = null;

  const tryResolve = (): boolean => {
    if (!pending || !buf.endsWith("\r\n")) return false;
    const lines = buf.split("\r\n").filter((l) => l.length > 0);
    const last = lines[lines.length - 1] ?? "";
    if (!/^\d{3} /.test(last)) return false;
    const p = pending;
    pending = null;
    if (timer) clearTimeout(timer);
    buf = "";
    p.resolve(lines);
    return true;
  };

  const onData = (chunk: Buffer) => {
    buf += chunk.toString("utf8");
    tryResolve();
  };

  sock.on("data", onData);

  return {
    next(): Promise<string[]> {
      if (pending) return Promise.reject(new Error("SMTP: concurrent read"));
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        timer = setTimeout(() => {
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
      if (timer) clearTimeout(timer);
    },
  };
}

function send(sock: net.Socket, line: string): void {
  sock.write(line + "\r\n");
}

function encodeHeader(value: string): string {
  return /[^\x20-\x7E]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`
    : value;
}

function buildMessage(from: string, to: string, subject: string, text: string, html?: string): string {
  const date = new Date().toUTCString();
  const boundary = `----switchnest_${Date.now().toString(36)}`;
  const head = [
    `Date: ${date}`,
    `From: ${encodeHeader("SwitchNest")} <${from}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
  ];
  const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
  const lines = html
    ? [
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
        ".",
      ]
    : [
        ...head,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        b64(text),
        ".",
      ];
  return lines.join("\r\n");
}

export interface EmailResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

/** Email bhejo — SMTP configured nahi to skip; kabhi throw nahi karta (caller ko result milta hai). */
export async function sendEmail(opts: { to: string; subject: string; text: string; html?: string }): Promise<EmailResult> {
  const cfg = await getSmtpConfig().catch(() => null);
  if (!cfg || !isEmailConfigured(cfg)) {
    logger.warn(`[email] SMTP configured nahi hai — email skip (to=${opts.to})`);
    return { ok: false, skipped: true, error: "SMTP not configured" };
  }

  return new Promise((resolve) => {
    let sock: net.Socket | tls.TLSSocket;
    try {
      sock = net.connect({ host: cfg.host, port: cfg.port });
    } catch (e) {
      logger.error("[email] connect error", e);
      return resolve({ ok: false, error: String(e) });
    }
    let reader = createReader(sock, 20000);
    let done = false;

    const fail = (msg: string) => {
      if (done) return;
      done = true;
      try {
        reader.detach();
        sock.destroy();
      } catch {
        /* ignore */
      }
      logger.warn(`[email] SMTP fail (${cfg.host}): ${msg}`);
      resolve({ ok: false, error: msg });
    };

    const succeed = () => {
      if (done) return;
      done = true;
      try {
        reader.detach();
        sock.destroy();
      } catch {
        /* ignore */
      }
      logger.info(`[email] sent to ${opts.to}`);
      resolve({ ok: true });
    };

    sock.on("error", (e) => fail(String(e.message || e)));

    (async () => {
      try {
        let r = await reader.next();
        if (!r[0]?.startsWith("220")) return fail(`Greeting: ${r[0] ?? "no response"}`);

        const ehloName = os.hostname() || "switchnest";
        send(sock, `EHLO ${ehloName}`);
        r = await reader.next();
        let ehlo = r.join("\r\n");

        // STARTTLS — port 587 pe (jab tak explicitly secure na ho)
        const useTls = cfg.secure || cfg.port === 465;
        if (!useTls && /STARTTLS/i.test(ehlo)) {
          send(sock, "STARTTLS");
          r = await reader.next();
          if (!r[0]?.startsWith("220")) return fail(`STARTTLS: ${r[0]}`);
          reader.detach();
          sock = tls.connect({ socket: sock as net.Socket, servername: cfg.host });
          reader = createReader(sock, 20000);
          await new Promise<void>((res, rej) => {
            sock.once("secureConnect", () => res());
            sock.once("error", rej);
          });
          sock.on("error", (e) => fail(String(e.message || e)));
          send(sock, `EHLO ${ehloName}`);
          r = await reader.next();
          ehlo = r.join("\r\n");
        }

        // AUTH — LOGIN pehle, phir PLAIN
        const mech = ehlo.toUpperCase();
        if (/AUTH/.test(mech) && !/AUTH=NONE/.test(mech)) {
          if (/LOGIN/.test(mech)) {
            send(sock, "AUTH LOGIN");
            r = await reader.next();
            if (!r[0]?.startsWith("334")) return fail(`AUTH LOGIN: ${r[0]}`);
            send(sock, Buffer.from(cfg.user, "utf8").toString("base64"));
            r = await reader.next();
            if (!r[0]?.startsWith("334")) return fail(`AUTH user: ${r[0]}`);
            send(sock, Buffer.from(cfg.pass, "utf8").toString("base64"));
            r = await reader.next();
            if (!r[0]?.startsWith("235")) return fail(`AUTH pass: ${r[0]}`);
          } else if (/PLAIN/.test(mech)) {
            const token = Buffer.from(`\u0000${cfg.user}\u0000${cfg.pass}`, "utf8").toString("base64");
            send(sock, `AUTH PLAIN ${token}`);
            r = await reader.next();
            if (!r[0]?.startsWith("235")) return fail(`AUTH PLAIN: ${r[0]}`);
          } else {
            return fail("No supported AUTH mechanism (LOGIN/PLAIN required)");
          }
        }

        send(sock, `MAIL FROM:<${cfg.from}>`);
        r = await reader.next();
        if (!r[0]?.startsWith("250")) return fail(`MAIL FROM: ${r[0]}`);
        send(sock, `RCPT TO:<${opts.to}>`);
        r = await reader.next();
        if (!r[0]?.startsWith("250")) return fail(`RCPT TO: ${r[0]}`);
        send(sock, "DATA");
        r = await reader.next();
        if (!r[0]?.startsWith("354")) return fail(`DATA: ${r[0]}`);
        send(sock, buildMessage(cfg.from, opts.to, opts.subject, opts.text, opts.html));
        r = await reader.next();
        if (!r[0]?.startsWith("250")) return fail(`send: ${r[0]}`);
        send(sock, "QUIT");
        try {
          r = await reader.next(); // 221 Bye — socket destroy se pehle server ko likhne do
          if (!r[0]?.startsWith("221")) return fail(`QUIT: ${r[0]}`);
        } catch {
          /* timeout — already sent, koी issue nahi */
        }
        succeed();
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
      }
    })();
  });
}

/** Admin reply → user ko support email. Site settings se site name/URL leke compose karta hai. */
export async function sendSupportReplyEmail(opts: {
  to: string;
  userName: string;
  replyText: string;
}): Promise<EmailResult> {
  const s = await getSiteSettings().catch(() => null);
  const siteName = s?.siteName || "SwitchNest";
  const siteUrl = s?.siteUrl || "";
  const subject = `🛠️ ${siteName} Support — Admin ne reply kiya`;

  const text = [
    `Namaste ${opts.userName},`,
    "",
    `Aapke support message pe ${siteName} team ne reply kiya hai:`,
    "",
    `"${opts.replyText}"`,
    "",
    siteUrl
      ? `Reply dekhne aur jawab dene ke liye: ${siteUrl}`
      : "Support chat khol kar turant jawab de sakte ho.",
    "",
    `— ${siteName} Support Team`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#2563eb;margin:0 0 16px">${siteName} Support</h2>
      <p style="font-size:15px;color:#333">Namaste <b>${opts.userName}</b>,</p>
      <p style="font-size:15px;color:#333">Aapke support message pe team ne reply kiya hai:</p>
      <div style="border-left:4px solid #2563eb;background:#f5f7fb;padding:12px 16px;border-radius:8px;color:#333;white-space:pre-wrap">${opts.replyText.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string)}</div>
      ${siteUrl ? `<p style="font-size:15px;color:#333;margin-top:16px">Reply dekhne aur jawab dene ke liye: <a href="${siteUrl}" style="color:#2563eb">${siteUrl}</a></p>` : ""}
      <p style="font-size:13px;color:#888;margin-top:24px">— ${siteName} Support Team</p>
    </div>
  `.trim();

  return sendEmail({ to: opts.to, subject, text, html });
}

/**
 * Generic notification email — in-app notification ka email version.
 * Site settings se siteName/siteUrl leke text + HTML compose karta hai.
 * SMTP configured nahi to skip (kabhi throw nahi).
 */
export async function sendNotificationEmail(opts: {
  to: string;
  userName: string;
  title: string;
  body?: string;
  /** Optional CTA link (order page, dashboard...) */
  ctaUrl?: string;
  ctaLabel?: string;
  siteName?: string;
}): Promise<EmailResult> {
  const s = await getSiteSettings().catch(() => null);
  const siteName = opts.siteName || s?.siteName || "SwitchNest";
  const siteUrl = (s?.siteUrl || "").replace(/\/$/, "");
  const subject = `${siteName} — ${opts.title}`;
  const bodyText = opts.body?.trim() ? opts.body.trim() : "";

  const text = [
    `Namaste ${opts.userName},`,
    "",
    opts.title,
    bodyText ? "" : undefined,
    bodyText,
    opts.ctaUrl ? `\nYahan dekho: ${opts.ctaUrl}` : undefined,
    "",
    siteUrl ? `— ${siteName} Team · ${siteUrl}` : `— ${siteName} Team`,
  ]
    .filter((l): l is string => Boolean(l))
    .join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#2563eb;margin:0 0 8px">${siteName}</h2>
      <p style="font-size:15px;color:#333">Namaste <b>${opts.userName}</b>,</p>
      <h3 style="margin:8px 0;color:#111">${opts.title}</h3>
      ${bodyText ? `<p style="font-size:15px;color:#333;white-space:pre-wrap">${bodyText.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string)}</p>` : ""}
      ${opts.ctaUrl ? `<p style="margin:20px 0"><a href="${opts.ctaUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">${opts.ctaLabel ?? "Dekho"}</a></p>` : ""}
      <p style="font-size:13px;color:#888;margin-top:24px">— ${siteName} Team${siteUrl ? ` · <a href="${siteUrl}" style="color:#888">${siteUrl}</a>` : ""}</p>
    </div>
  `.trim();

  return sendEmail({ to: opts.to, subject, text, html });
}

/** Forgot-password link email — token ke saath reset page (30 min valid). */
export async function sendPasswordResetEmail(opts: {
  to: string;
  userName: string;
  resetUrl: string;
  siteName?: string;
}): Promise<EmailResult> {
  const siteName = opts.siteName || "SwitchNest";
  const subject = `🔑 ${siteName} — Password reset`;

  const text = [
    `Namaste ${opts.userName},`,
    "",
    `Aapne ${siteName} pe password reset maanga hai.`,
    "",
    opts.resetUrl
      ? `Password reset karne ke liye ye link 30 min ke andar kholo:`
      : "Password reset karne ke liye app ke Login page pe 'Forgot password?' ka link use karo.",
    opts.resetUrl || "",
    "",
    "Agar aapne ye request nahi bheji to is email ko ignore kar do — aapka password change nahi hoga.",
    "",
    `— ${siteName} Team`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#2563eb;margin:0 0 16px">${siteName}</h2>
      <p style="font-size:15px;color:#333">Namaste <b>${opts.userName}</b>,</p>
      <p style="font-size:15px;color:#333">Aapne <b>${siteName}</b> pe password reset maanga hai. Ye link <b>30 min</b> ke liye valid hai:</p>
      ${opts.resetUrl ? `<p style="margin:20px 0"><a href="${opts.resetUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Password Reset karo</a></p>` : `<p style="font-size:15px;color:#333">Password reset karne ke liye app ke Login page pe 'Forgot password?' ka link use karo.</p>`}
      <p style="font-size:13px;color:#888">Agar aapne ye request nahi bheji to is email ko ignore kar do — aapka password change nahi hoga.</p>
      <p style="font-size:13px;color:#888;margin-top:24px">— ${siteName} Team</p>
    </div>
  `.trim();

  return sendEmail({ to: opts.to, subject, text, html });
}
