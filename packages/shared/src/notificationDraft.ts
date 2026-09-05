/**
 * Notification body + draft templates — API aur web dono ka SINGLE source of truth.
 *
 * API jab notification banata hai to draft text body me hi bhejta hai:
 *   {"t": "display text", "u": <userId>, "d": "<draft>"}
 * — frontend sirf `d` padhta hai. Purane notifications (bina `d` ke) ke liye
 * client-side builders fallback hain.
 */

export interface ParsedNotificationBody {
  text: string;
  /** Support conversation target — admin isse user ka chat khol sakta hai. */
  targetUserId?: number;
  /** Server-side draft (notification body me `d` field) — mila to ise use karo. */
  draft?: string;
}

export function parseNotificationBody(body: string | null): ParsedNotificationBody {
  if (!body) return { text: "" };
  try {
    const obj: unknown = JSON.parse(body);
    if (obj && typeof obj === "object" && typeof (obj as { t?: unknown }).t === "string") {
      const o = obj as { t: string; u?: unknown; d?: unknown };
      return {
        text: o.t,
        targetUserId: typeof o.u === "number" ? o.u : undefined,
        draft: typeof o.d === "string" && o.d.length > 0 ? o.d : undefined,
      };
    }
  } catch {
    // plain text body — wapas waise hi
  }
  return { text: body };
}

type NotificationLike = { category: string; title: string; body: string | null };

/**
 * Client-side fallback — notification pe click → support chat mein pre-filled
 * (draft) message. Har notification type ka apna template.
 * (Naye notifications me draft server se body me aata hai; yeh purane rows ke liye.)
 */
export function buildClientSupportDraft(n: NotificationLike): string | null {
  const title = n.title ?? "";
  const body = n.body ?? "";

  // Admin reply — thread khula dikhega, koi draft zaroori nahi
  if (/Support ne message bheja/.test(title)) return null;
  // Admin-targeted notification — user side ise kabhi nahi dekhta; draft admin builder se aata hai
  if (/User ne support me reply kiya/.test(title)) return null;

  // --- Support team actions ---
  let m = title.match(/Support ne (.+?) (ON|OFF) kiya/i);
  if (m) {
    const on = m[2].toUpperCase() === "ON";
    return `Aapne mera device "${m[1].trim()}" ${on ? "ON" : "OFF"} kar diya, lekin maine aisa koi action nahi kiya tha. Kya yeh sahi hai? Please check karein.`;
  }
  m = title.match(/board renamed kiya: (.+?) → (.+)/i);
  if (m) {
    return `Aapne mera board rename kar diya hai (${m[1].trim()} → ${m[2].trim()}). Mujhe yeh samajh nahi aaya — kya yeh galat hua?`;
  }
  m = title.match(/"(.*?)" ke stuck commands clear/i);
  if (m) {
    return `Mera device "${m[1].trim()}" abhi kaam nahi kar raha tha. Ab kya karna hoga? Koi aur dikkat ho toh bata dijiye.`;
  }
  m = title.match(/"(.*?)" ke liye firmware update push/i);
  if (m) {
    return `Aapne mere device "${m[1].trim()}" pe firmware update push kiya hai — kya yeh expected tha? Update ke baad koi dikkat aaye toh yahi bataunga.`;
  }

  // --- Device events (offline / online / rename / OTA) ---
  m = title.match(/Board offline: (.+)/i);
  if (m) return `Mera board "${m[1].trim()}" offline ho gaya hai — WiFi/power check kar liya, phir bhi connect nahi ho raha. Please help karein.`;
  m = title.match(/Board online: (.+)/i);
  if (m) return `Mera board "${m[1].trim()}" wapas online aa gaya hai. Sab theek hai ya kuch aur check karna hai?`;
  m = title.match(/^📡 (.+?) offline$/i);
  if (m) return `Mera device "${m[1].trim()}" offline ho gaya hai — WiFi/power check kar liya, phir bhi nahi aa raha. Please help karein.`;
  m = title.match(/^✅ (.+?) online$/i);
  if (m) return `Mera device "${m[1].trim()}" wapas online ho gaya hai. Sab theek hai ya kuch aur check karna hai?`;
  m = title.match(/"(.*?)" pe firmware update push/i);
  if (m) return `Mere device "${m[1].trim()}" pe firmware update chal raha hai — kya yeh sahi hai?`;
  m = title.match(/Board renamed: (.+?) → (.+)/i);
  if (m) return `Mera board rename ho gaya hai (${m[1].trim()} → ${m[2].trim()}). Kya yeh theek hai ya kuch galat hua?`;

  // --- Family safety ---
  m = title.match(/Child safety: "(.*?)" band kiya/i);
  if (m) {
    return `Mera device "${m[1].trim()}" child safety ke karan band ho gaya — kya yeh sahi tha? Agar main ab bhi use kar sakta hoon to bata dijiye.`;
  }
  m = title.match(/"(.*?)" ka time khatam/i);
  if (m) {
    return `Mujhe bataya gaya ki device "${m[1].trim()}" ka aaj ka time khatam ho gaya. Kya main isse dobara ON kar sakta hoon?`;
  }

  // --- Schedule --- (action ON/OFF anchor — device name me spaces ho sakte hain)
  m = title.match(/Schedule fired: (.+?) (ON|OFF)/i);
  if (m) return `Mera schedule device "${m[1].trim()}" ko ${m[2].toLowerCase()} kar diya — kya time aur action sahi tha? Please confirm karein.`;

  // --- Order ---
  if (/Order placed/.test(title)) {
    const num = body.match(/Order ([A-Z0-9-]+)/i);
    return `Mere order${num ? ` ${num[1]}` : ""} ke baare me ek sawal hai — please madad karein.`;
  }

  // --- Member ---
  m = title.match(/New member joined (.+)/i);
  if (m) return `Mere home "${m[1].trim()}" me koi naya member join hua hai — kya yeh expected tha?`;

  // --- Generic fallback (koi bhi notification) ---
  const text = body ? ` — ${body}` : "";
  return `Mujhe yeh notification mili: "${title}"${text}. Iske baare me madad chahiye.`;
}

/**
 * Admin-side fallback — support notification click pe reply template (draft).
 * "User ne reply kiya" → user ka message quote + ready reply.
 */
export function buildClientAdminReplyDraft(n: NotificationLike): string | null {
  const title = n.title ?? "";
  // Sirf user-reply notifications ke liye — baaki support notifications pe draft nahi
  if (!/User ne support me reply kiya/.test(title)) return null;
  const { text } = parseNotificationBody(n.body);
  const trimmed = text.trim();
  if (trimmed) {
    const quote = trimmed.slice(0, 120);
    return `Namaste, aapka message padh liya: "${quote}" — hum isse check kar rahe hain, jald hi update denge. 🙏`;
  }
  return `Namaste, aapka support message note kar liya — hum jald hi update denge. 🙏`;
}

/**
 * Notification ke liye sahi draft — user-side ya admin-side jiski bhi ban sake.
 * API isse createNotification me body me `d` field bharne ke liye use karta hai.
 */
export function buildNotificationDraft(n: NotificationLike): string | null {
  return buildClientSupportDraft(n) ?? buildClientAdminReplyDraft(n);
}
