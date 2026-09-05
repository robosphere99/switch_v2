import { prisma } from "../lib/prisma";
import { encryptSecret } from "../lib/crypto";

/**
 * Site-wide settings — Admin → Settings tab se edit hote hain.
 * AppMeta (key-value) me JSON ke roop me store hote hain.
 * Frontend public endpoint se inhe boot pe load karta hai (brand color,
 * contact info) — login se pehle bhi kaam kare.
 * SMTP fields (email notifications) sirf admin API se dikhte hain —
 * public endpoint me kabhi nahi. smtpPass encrypted (AES-256-GCM) store hota hai.
 */

export interface SiteSettings {
  siteName: string;
  supportEmail: string;
  supportPhone: string;
  supportAddress: string;
  supportHours: string;
  /** Hex brand color — site-wide CSS var (--brand) pe apply hota hai. */
  brandColor: string;
  /** Public site URL — email notifications me link ke liye. */
  siteUrl: string;
  // Email (SMTP) — admin settings se configure; public pe strip
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string; // encrypted at rest
  smtpFrom: string;
  smtpSecure: boolean;
  smtpPaused: boolean;
  // AI assistant — provider/key/model (UI se, env ke bajaye); public pe strip
  aiProvider: string; // openai | gemini | ollama | "" (off → rule-based)
  aiApiKey: string; // encrypted at rest
  aiBaseUrl: string; // empty → provider default
  aiModel: string;
  // Data Retention Settings
  supportTicketMediaRetentionDays: number;
  chatHistoryRetentionDays: number;
  deviceTelemetryRetentionDays: number;
  // Mobile App Release Settings
  mobileAppVersion: string;
  mobileAppMinVersion: string;
  mobileAppReleaseNotes: string;
  mobileAppUpdateMessage: string;
  mobileAppIsMandatory: boolean;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: "SwitchNest",
  supportEmail: "support@switchnest.in",
  supportPhone: "+91 98765 43210",
  supportAddress: "SwitchNest Labs, Sector 62, Noida, UP 201309",
  supportHours: "Mon–Sat · 9:00 AM – 7:00 PM",
  brandColor: "#2563eb",
  siteUrl: "https://onlineswitch.bhartitechnical.com",
  // SMTP defaults yahan empty — asli defaults (587, STARTTLS) email.service me resolve hote hain,
  // taaki SMTP_* env vars hamesha precedence le saken jab settings me kuch set na ho.
  smtpHost: "",
  smtpPort: 0,
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "",
  smtpSecure: false,
  smtpPaused: false,
  aiProvider: "",
  aiApiKey: "",
  aiBaseUrl: "",
  aiModel: "",
  supportTicketMediaRetentionDays: 90, // Defaults to 3 months
  chatHistoryRetentionDays: 90,
  deviceTelemetryRetentionDays: 180, // Defaults to 6 months for ML analysis (Hot Storage)
  mobileAppVersion: "1.0.11",
  mobileAppMinVersion: "1.0.0",
  mobileAppReleaseNotes: "• Connect to Live Website & In-App Server Selector\n• Live LAN QR Code Auto-Detection\n• ESP WebServer Direct Connection",
  mobileAppUpdateMessage: "New Mobile App Release Available!",
  mobileAppIsMandatory: false,
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

/** Public endpoint ke liye — SMTP + AI credentials kabhi public nahi. */
export async function getPublicSiteSettings(): Promise<
  Omit<SiteSettings, "smtpHost" | "smtpPort" | "smtpUser" | "smtpPass" | "smtpFrom" | "smtpSecure" | "smtpPaused" | "aiProvider" | "aiApiKey" | "aiBaseUrl" | "aiModel">
> {
  const s = await getSiteSettings();
  const {
    smtpHost: _h, smtpPort: _p, smtpUser: _u, smtpPass: _pp, smtpFrom: _f, smtpSecure: _sc, smtpPaused: _sp,
    aiProvider: _ap, aiApiKey: _ak, aiBaseUrl: _ab, aiModel: _am,
    ...pub
  } = s;
  return pub;
}

export async function updateSiteSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSiteSettings();
  const next: SiteSettings = { ...current, ...patch };
  // smtpPass: blank = purana rakho (UI kabhi asli pass wapas nahi bhejta)
  if (patch.smtpPass !== undefined) {
    if (patch.smtpPass) next.smtpPass = encryptSecret(patch.smtpPass);
    else next.smtpPass = current.smtpPass;
  }
  // aiApiKey: blank = purana rakho; naya aaye to encrypt
  if (patch.aiApiKey !== undefined) {
    if (patch.aiApiKey) next.aiApiKey = encryptSecret(patch.aiApiKey);
    else next.aiApiKey = current.aiApiKey;
  }
  await prisma.appMeta.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}
