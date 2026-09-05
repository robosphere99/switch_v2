import { api } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { setThemeMode } from "./theme";
import type { ThemeMode } from "./theme";

/**
 * Theme change karte hi account pe bhi save karo (logged in ho to) —
 * taaki kisi bhi device pe login karne par wahi theme mile.
 */
export function changeTheme(mode: ThemeMode): void {
  setThemeMode(mode);
  const { user, accessToken } = useAuthStore.getState();
  if (user && accessToken) {
    api.put("/auth/theme", { theme: mode }).catch(() => {
      /* offline/network hiccup — local preference already applied */
    });
  }
}

/** Login/signup ke baad account ki saved theme apply karo (agar koi ho). */
export function applyAccountTheme(user?: { themePref?: string | null }): void {
  const pref = user?.themePref;
  if (pref === "light" || pref === "dark" || pref === "system") {
    setThemeMode(pref);
  }
}
