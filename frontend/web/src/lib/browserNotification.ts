/**
 * Native browser push notification — Web Notifications API.
 * Jab naya notification socket se aaye, OS-level alert dikhata hai
 * (even when tab is in background). Permission lazy maangta hai —
 * pehli notification ke time pe, page load pe nahi.
 */

let permission: NotificationPermission = "default";

/** Permission ek baar check/request karo — repeat nahi hoga. */
export async function ensurePermission(): Promise<NotificationPermission> {
  if (permission === "granted" || permission === "denied") return permission;
  if (!("Notification" in window)) return "denied";
  try {
    permission = await Notification.requestPermission();
  } catch {
    // Safari old versions — requestPermission callback style
    permission = await new Promise((resolve) => {
      (Notification as unknown as { requestPermission: (cb: (p: string) => void) => void }).requestPermission(
        (p: string) => resolve(p as NotificationPermission),
      );
    });
  }
  return permission;
}

/**
 * Native notification dikhao. Permission granted hai to dikhao, nahi to silently skip.
 * Click karne pe window focus hota hai (tab switch).
 */
export function showBrowserNotification(title: string, body?: string, tag?: string): void {
  if (!("Notification" in window)) return;
  // Agar permission abhi default hai to request karo — par first notification
  // ke liye turant dikhana possible nahi (permission async hai). Isliye fire-and-forget.
  if (permission === "default") {
    void ensurePermission().then((p) => {
      if (p === "granted") fire(title, body, tag);
    });
    return;
  }
  if (permission !== "granted") return;
  fire(title, body, tag);
}

function fire(title: string, body?: string, tag?: string): void {
  try {
    const n = new Notification(title, {
      body: body ?? undefined,
      tag: tag ?? "switchnest",       // same tag = ek hi notification visible (duplicate nahi)
      icon: "/favicon.ico",
      silent: true,                   // OS default sound — humne already chime play kiya
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Service worker context me Notification constructor alag hota hai — silently skip
  }
}
