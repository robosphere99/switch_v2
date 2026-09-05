import crypto from "node:crypto";
import { env } from "../config/env";

// Bill verify key — JWT_ACCESS_SECRET se derived (koi naya env/config nahi chahiye).
const SECRET = crypto.createHash("sha256").update(env.JWT_ACCESS_SECRET).digest();

/**
 * Bill verification token — HMAC-signed orderId (forge-proof).
 * Format: `<orderId>.<base64url-hmac>` — QR me `/verify/bill/<token>` jaata hai.
 * Token bina secret ke nahi bana sakta — isliye scan karne pe genuine bill hi
 * verify hota hai (fake bill ka QR kabhi pass nahi hoga).
 */
export function signBillToken(orderId: number): string {
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(`bill:${orderId}`)
    .digest("base64url");
  return `${orderId}.${sig}`;
}

/** Token verify karo + orderId nikalo. Forged / tampered / garbage → null. */
export function verifyBillToken(token: string): { orderId: number } | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const idPart = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const orderId = Number(idPart);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return null;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`bill:${orderId}`)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { orderId };
}
