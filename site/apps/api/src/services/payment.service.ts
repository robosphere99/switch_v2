import crypto from "node:crypto";
import { env } from "../config/env";
import { AppError } from "../lib/response";

export function razorpayConfigured(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

/** Razorpay Orders API se payment order banao (amount INR me). */
export async function createRazorpayOrder(amountInr: number, receipt: string) {
  const auth = "Basic " + Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ amount: Math.round(amountInr * 100), currency: "INR", receipt }),
  });
  if (!res.ok) throw new AppError("PAYMENT_ERROR", `Razorpay order create fail (${res.status})`);
  return res.json() as Promise<{ id: string; amount: number; currency: string }>;
}

/** Razorpay signature verify — order_id|payment_id ka HMAC-SHA256. */
export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}

/** Webhook signature verify — raw body + X-Razorpay-Signature. */
export function verifyRazorpayWebhook(rawBody: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(rawBody).digest("hex");
  return expected === signature;
}
