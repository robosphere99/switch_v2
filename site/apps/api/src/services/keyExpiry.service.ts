import { prisma } from "../lib/prisma";
import { fileLog } from "../lib/logger";
import { createNotificationWithEmail } from "./notification.service";
import { getSiteSettings } from "./siteSettings.service";

let timer: NodeJS.Timeout | null = null;

/** Kitne din pehle pehla "expiring soon" reminder bhejna hai. */
export const WARN_DAYS_BEFORE = 7;
/** Aakhri warning kitne ghante pehle (1 din = 24h). */
export const FINAL_WARN_HOURS_BEFORE = 24;
/** Watcher kitni baar chale (key expiry urgent nahi — 6h kaafi). */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type KeyExpiryAction = "warn" | "warnSoon" | "expired" | null;

/**
 * Ek key ke liye abhi kya karna hai (pure — unit-testable):
 *  - "warn"     : expiresAt 7 din ke andar hai, abhi tak warn nahi kiya
 *  - "warnSoon" : expiresAt 24h ke andar hai — aakhri warning (1 din pehle)
 *  - "expired"  : expiresAt nikal chuka hai, abhi tak notify nahi kiya
 *  - null       : kuch nahi (kabhi expire nahi hoga / already notified)
 *
 * Precedence: expired > warnSoon > warn. 24h ke andar wale ko sirf aakhri
 * warning milti hai (7-din wala redundant skip) — aur final-warn ke baad
 * 7-din wala dobara nahi aata.
 */
export function keyExpiryAction(
  key: {
    expiresAt: Date | null;
    expiryWarnedAt: Date | null;
    expiryFinalWarnedAt: Date | null;
    expiryNotifiedAt?: Date | null;
  },
  now: Date,
): KeyExpiryAction {
  if (!key.expiresAt) return null;
  if (key.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  const finalCutoff = now.getTime() + FINAL_WARN_HOURS_BEFORE * 60 * 60 * 1000;
  if (key.expiresAt.getTime() <= finalCutoff) {
    return key.expiryFinalWarnedAt ? null : "warnSoon";
  }
  const warnCutoff = now.getTime() + WARN_DAYS_BEFORE * 24 * 60 * 60 * 1000;
  if (key.expiresAt.getTime() <= warnCutoff) {
    return key.expiryWarnedAt ? null : "warn";
  }
  return null;
}

const daysLeft = (expiresAt: Date, now: Date) => Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000));

/**
 * Kya yeh key abhi auto-revoke honi chahiye? (pure — unit-testable)
 * Expire ho chuki + abhi tak revoke nahi hui = dead key, state bhi revoke
 * kar dete hain taaki admin/UI me "REVOKED" dikhe aur middleware bhi
 * revokedAt se block kare.
 */
export function shouldAutoRevoke(
  key: { expiresAt: Date | null; revokedAt: Date | null },
  now: Date,
): boolean {
  return key.expiresAt !== null && key.expiresAt.getTime() <= now.getTime() && key.revokedAt === null;
}

/** Site URL + /device-keys — email CTA (SMTP configured ho to). */
async function keysCtaUrl(): Promise<string | undefined> {
  const s = await getSiteSettings().catch(() => null);
  const siteUrl = (s?.siteUrl || "").replace(/\/$/, "");
  if (!siteUrl) return undefined;
  return `${siteUrl}/device-keys`;
}

async function checkKeyExpiryInner(): Promise<void> {
  const now = new Date();
  const warnCutoff = new Date(now.getTime() + WARN_DAYS_BEFORE * 24 * 60 * 60 * 1000);
  const cta = await keysCtaUrl();

  // ---------- Phase 1: expiring soon (7 din) + final warning (24h) ----------
  const expiring = await prisma.apiKey.findMany({
    where: {
      expiresAt: { not: null, lte: warnCutoff, gt: now },
    },
    include: {
      home: { select: { name: true } },
      user: { select: { id: true, username: true, email: true } },
    },
    orderBy: { expiresAt: "asc" },
    take: 200,
  });

  for (const key of expiring) {
    // Dedup + precedence: expired > warnSoon (24h) > warn (7d) — keyExpiryAction decide karta hai.
    const action = keyExpiryAction(key, now);
    if (action === null) continue;

    const label = key.label ?? "Device key";
    const homeName = key.home?.name ?? "—";
    if (action === "warnSoon") {
      const title = `⏰ API key "${label}" KAL expire ho jayegi — aakhri warning`;
      const body = [
        `Aapki API key "${label}" (${key.keyPrefix}…) kal expire ho jayegi (${key.expiresAt!.toLocaleString()}).`,
        `Home: ${homeName}`,
        "",
        "Naya key abhi bana lo — expire hone ke baad aapke ESP boards server se connect nahi kar payenge.",
      ].join("\n");
      await createNotificationWithEmail(
        key.userId,
        { category: "system", type: "warning", title, body },
        { emailSubject: title, emailBody: body, ctaUrl: cta, ctaLabel: "Create new key" },
      );
      await prisma.apiKey.update({
        where: { id: key.id },
        data: { expiryFinalWarnedAt: now },
      });
      fileLog(`[keyExpiry] FINAL warned user ${key.userId} about key #${key.id} (${key.keyPrefix}…) expiring ${key.expiresAt!.toISOString()}`);
      continue;
    }

    const title = `⚠️ API key "${label}" ${daysLeft(key.expiresAt!, now)} din me expire ho rahi hai`;
    const body = [
      `Aapki API key "${label}" (${key.keyPrefix}…) ${daysLeft(key.expiresAt!, now)} din baad expire ho jayegi.`,
      `Home: ${homeName}`,
      "",
      "Expire hone ke baad aapke ESP boards server se connect nahi kar payenge.",
      "Naya key banane ke liye Device Keys page kholo aur purana key revoke kar do.",
    ].join("\n");
    await createNotificationWithEmail(
      key.userId,
      { category: "system", type: "warning", title, body },
      { emailSubject: title, emailBody: body, ctaUrl: cta, ctaLabel: "Manage keys" },
    );
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { expiryWarnedAt: now },
    });
    fileLog(`[keyExpiry] warned user ${key.userId} about key #${key.id} (${key.keyPrefix}…) expiring ${key.expiresAt!.toISOString()}`);
  }

  // ---------- Phase 2: already expired ----------
  const expired = await prisma.apiKey.findMany({
    where: { expiresAt: { lt: now } } as any,
    include: {
      home: { select: { name: true } },
      user: { select: { id: true, username: true, email: true } },
    },
    orderBy: { expiresAt: "asc" },
    take: 200,
  });

  for (const key of expired) {
    const label = key.label ?? "Device key";
    const homeName = key.home?.name ?? "—";
    const title = `🔴 API key "${label}" expire ho gayi — naya key banao`;
    const body = [
      `Aapki API key "${label}" (${key.keyPrefix}…) expire ho chuki hai.`,
      `Home: ${homeName}`,
      "",
      "Is key se connect hone wale ESP boards ab server se baat nahi kar payenge.",
      "Naya key banao, boards ko naye key se provision karo, aur purana key revoke kar do.",
    ].join("\n");
    await createNotificationWithEmail(
      key.userId,
      { category: "system", type: "error", title, body },
      { emailSubject: title, emailBody: body, ctaUrl: cta, ctaLabel: "Create new key" },
    );
    await prisma.apiKey.update({
      where: { id: key.id },
      data: {} as any,
    });
    fileLog(`[keyExpiry] notified user ${key.userId} about EXPIRED key #${key.id} (${key.keyPrefix}…)`);
  }

  // ---------- Phase 3: auto-revoke expired keys ----------
  // Expired key = dead key. Middleware pehle se 401 deta hai; yahan state
  // bhi revoke kar dete hain — UI me REVOKED dikhe + koi bhi alternate path
  // (revokedAt check) usse turant block kare. Sab expired keys cover hoti
  // hain (notified ho ya na ho) — idempotent: revokedAt set ho chuki ho to
  // phir kabhi touch nahi hoti.
  const candidates = await prisma.apiKey.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true, expiresAt: true, revokedAt: true },
  });
  const toRevoke = candidates.filter((k) => shouldAutoRevoke(k, now));
  if (toRevoke.length > 0) {
    const res = await prisma.apiKey.updateMany({
      where: { id: { in: toRevoke.map((k) => k.id) }, revokedAt: null },
      data: { revokedAt: now },
    });
    fileLog(`[keyExpiry] auto-revoked ${res.count} expired api key(s): ${toRevoke.map((k) => `#${k.id}`).join(", ")}`);
  }
}

async function checkKeyExpiry(): Promise<void> {
  try {
    await checkKeyExpiryInner();
  } catch (err) {
    console.error("[keyExpiry] tick error:", err instanceof Error ? err.message : err);
    fileLog(`[keyExpiry] tick ERROR: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Start the key-expiry watcher. Idempotent. */
export function startKeyExpiryWatcher(): void {
  if (timer) return;
  timer = setInterval(checkKeyExpiry, CHECK_INTERVAL_MS);
  void checkKeyExpiry();
  console.log("[keyExpiry] watcher started (every 6h)");
  fileLog("[keyExpiry] watcher started (every 6h)");
}

export function stopKeyExpiryWatcher(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
