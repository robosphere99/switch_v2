/**
 * Draft templates ab SERVER side generate hote hain (notification body me `d` field
 * ke saath aate hain — shared package me ek hi source of truth: buildNotificationDraft).
 * Yeh wrappers pehle server draft use karte hain; purane notifications (bina `d` ke)
 * ke liye client-side builders fallback hain.
 */
import {
  buildClientAdminReplyDraft,
  buildClientSupportDraft,
  parseNotificationBody,
} from "@robosphere/shared";

export { parseNotificationBody } from "@robosphere/shared";
export type { ParsedNotificationBody } from "@robosphere/shared";

/** User side — server draft (body me `d`) mila to wahi, warna client fallback. */
export function buildSupportDraft(n: { category: string; title: string; body: string | null }): string | null {
  const parsed = parseNotificationBody(n.body);
  if (parsed.draft) return parsed.draft;
  return buildClientSupportDraft(n);
}

/** Admin side — server draft pehle, phir client fallback. */
export function buildAdminReplyDraft(n: { category: string; title: string; body: string | null }): string | null {
  const parsed = parseNotificationBody(n.body);
  if (parsed.draft) return parsed.draft;
  return buildClientAdminReplyDraft(n);
}
