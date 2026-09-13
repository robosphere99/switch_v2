/**
 * App-wide constants — no hardcoded values scattered across components.
 * Values that are configurable at runtime come from the site store (API);
 * these are compile-time/static constants only.
 */

/** App display name used in Razorpay modal, page titles, share text, etc. */
export const APP_NAME = "SwitchNest";

/** Default currency for the shop & payment UI. */
export const CURRENCY = "INR";

/** Default currency symbol. */
export const CURRENCY_SYMBOL = "₹";

/** Phone number placeholder used in forms. */
export const PHONE_PLACEHOLDER = "+91 98765 43210";

/**
 * Build a WhatsApp `wa.me` link from a phone number string.
 * Strips all non-digit characters and prepends country code if needed.
 */
export function buildWhatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

/**
 * Build a Google Maps embed URL from an address string.
 */
export function buildMapsEmbedUrl(address: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}
