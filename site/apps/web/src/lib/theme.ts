export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const THEME_EVENT = "switchnest:theme";

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}

/** Saved preference — first visit pe OS ki setting follow karta hai (system). */
export function getThemeMode(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
}

/** Abhi screen pe kya dikh raha hai — system mode me OS preference resolve karta hai. */
export function resolvedDark(): boolean {
  const mode = getThemeMode();
  return mode === "dark" || (mode === "system" && systemPrefersDark());
}

function apply(): boolean {
  const dark = resolvedDark();
  document.documentElement.classList.toggle("dark", dark);
  document.dispatchEvent(
    new CustomEvent(THEME_EVENT, { detail: { mode: getThemeMode(), dark } }),
  );
  return dark;
}

/**
 * Apply saved theme to <html> — run once at startup.
 * System mode me OS ke dark/light change hone par bhi live update hota hai.
 */
export function applyTheme(): boolean {
  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => {
    if (getThemeMode() === "system") apply();
  });
  return apply();
}

/** Set explicit mode (light/dark/system) and persist. Returns resolved dark state. */
export function setThemeMode(mode: ThemeMode): boolean {
  localStorage.setItem(STORAGE_KEY, mode);
  return apply();
}

/** Navbar quick toggle — current resolution ke opposite explicit mode set karta hai. */
export function toggleTheme(): boolean {
  return setThemeMode(resolvedDark() ? "light" : "dark");
}

/** Theme badalne par callback — Navbar/selector sync ke liye. Returns unsubscribe. */
export function onThemeChange(cb: () => void): () => void {
  document.addEventListener(THEME_EVENT, cb);
  return () => document.removeEventListener(THEME_EVENT, cb);
}
