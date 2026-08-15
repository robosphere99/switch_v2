import { prisma } from "../lib/prisma";

/**
 * Site-wide settings — Admin → Settings tab se edit hote hain.
 * AppMeta (key-value) me JSON ke roop me store hote hain.
 * Frontend public endpoint se inhe boot pe load karta hai (brand color,
 * contact info) — login se pehle bhi kaam kare.
 */

export interface SiteSettings {
  siteName: string;
  supportEmail: string;
  supportPhone: string;
  supportAddress: string;
  supportHours: string;
  /** Hex brand color — site-wide CSS var (--brand) pe apply hota hai. */
  brandColor: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: "SwitchNest",
  supportEmail: "support@switchnest.in",
  supportPhone: "+91 98765 43210",
  supportAddress: "SwitchNest Labs, Sector 62, Noida, UP 201309",
  supportHours: "Mon–Sat · 9:00 AM – 7:00 PM",
  brandColor: "#2563eb",
};

const KEY = "site_settings";

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const row = await prisma.appMeta.findUnique({ where: { key: KEY } });
    if (row?.value) {
      return { ...DEFAULT_SITE_SETTINGS, ...(JSON.parse(row.value) as Partial<SiteSettings>) };
    }
  } catch {
    /* fallback defaults */
  }
  return DEFAULT_SITE_SETTINGS;
}

export async function updateSiteSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSiteSettings();
  const next: SiteSettings = { ...current, ...patch };
  await prisma.appMeta.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}
