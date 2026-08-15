/**
 * Support notification body ek chhota JSON marker rakhta hai:
 *   {"u": <userId>, "t": "message text"}
 * — taaki notification pe click karne se usi user ka support chat khul jaye.
 * Purane plain-text notifications bhi theek kaam karte hain (text as-is).
 */
export interface ParsedNotificationBody {
  text: string;
  /** Support conversation target — admin isse user ka chat khol sakta hai. */
  targetUserId?: number;
}

export function parseNotificationBody(body: string | null): ParsedNotificationBody {
  if (!body) return { text: "" };
  try {
    const obj: unknown = JSON.parse(body);
    if (obj && typeof obj === "object" && typeof (obj as { t?: unknown }).t === "string") {
      const o = obj as { t: string; u?: unknown };
      return {
        text: o.t,
        targetUserId: typeof o.u === "number" ? o.u : undefined,
      };
    }
  } catch {
    // plain text body — wapas waise hi
  }
  return { text: body };
}
