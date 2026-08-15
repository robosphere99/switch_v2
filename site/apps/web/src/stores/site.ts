import { create } from "zustand";
import { getPublicSiteSettings, type SiteSettings } from "../api/public";

const DEFAULTS: SiteSettings = {
  siteName: "SwitchNest",
  supportEmail: "support@switchnest.in",
  supportPhone: "+91 98765 43210",
  supportAddress: "SwitchNest Labs, Sector 62, Noida, UP 201309",
  supportHours: "Mon–Sat · 9:00 AM – 7:00 PM",
  brandColor: "#2563eb",
};

interface SiteState {
  settings: SiteSettings;
  loaded: boolean;
  load: () => Promise<void>;
  apply: (s: SiteSettings) => void;
}

/** Hex (#RRGGBB) -> "r g b" triplet (CSS var ke liye). */
function hexToTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Brand color ko live CSS var (--brand) pe apply karo — poora site turant re-color. */
export function applyBrandColor(hex: string): void {
  const root = document.documentElement;
  root.style.setProperty("--brand", hexToTriplet(hex));
  // Brand light — same hue ka lighter shade (brightness up)
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * 0.55 + 128));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * 0.55 + 128));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * 0.55 + 128));
  root.style.setProperty("--brand-light", `${r} ${g} ${b}`);
}

export const useSiteStore = create<SiteState>()((set, get) => ({
  settings: DEFAULTS,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const res = await getPublicSiteSettings();
      if (res.success) {
        const s = { ...DEFAULTS, ...res.data };
        applyBrandColor(s.brandColor);
        set({ settings: s, loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },
  apply: (s) => {
    applyBrandColor(s.brandColor);
    set({ settings: s });
  },
}));
