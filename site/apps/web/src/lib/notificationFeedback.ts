/**
 * Subtle audio + haptic feedback jab naya notification aaye.
 * Web Audio API se chime generate hota hai (koi file nahi chahiye),
 * aur mobile pe navigator.vibrate se haptic pulse.
 * Browser autoplay policy ke under safe — user interaction ke baad hi kaam karta hai.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    // Suspended state se resume karo (autoplay policy — first user click ke baad)
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Short two-tone chime — soft, not annoying. ~200ms total. */
export function playNotificationChime(): void {
  const ac = getCtx();
  if (!ac) return;

  const now = ac.currentTime;

  // Two short sine tones — gentle "ding-ding"
  const freqs = [880, 1100]; // A5, C#6 — pleasant upward interval
  freqs.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;

    // Very soft — 0.12 max volume, fades out quickly
    gain.gain.setValueAtTime(0.12, now + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.15);

    osc.connect(gain);
    gain.connect(ac.destination);

    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.2);
  });
}

/** Short vibration pulse — mobile pe haptic feedback. Desktop pe no-op. */
export function vibrateNotification(): void {
  try {
    if ("vibrate" in navigator) {
      // Short double-pulse: 30ms on, 50ms off, 30ms on
      navigator.vibrate([30, 50, 30]);
    }
  } catch {
    // vibrate API nahi hai ya blocked — silently skip
  }
}

/** Dono together — call this on notification:new event. */
export function notifyFeedback(): void {
  playNotificationChime();
  vibrateNotification();
}
