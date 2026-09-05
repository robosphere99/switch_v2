import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";

// Load .env from multiple candidate paths so runtime always picks up persisted .env
const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), "../../.env"),
];
for (const p of envPaths) {
  try {
    if (fs.existsSync(p)) dotenv.config({ path: p, override: true });
  } catch {}
}

// Database — granular DB_* vars se DATABASE_URL build hota hai (hosting pe
// user sirf DB_HOST/DB_USER/DB_PASS/DB_NAME type karta hai). Explicit
// DATABASE_URL diya ho to woh precedence leta hai.
function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST ?? "127.0.0.1";
  const port = process.env.DB_PORT ?? "3306";
  const user = process.env.DB_USER ?? "root";
  const pass = process.env.DB_PASS ?? "";
  const name = process.env.DB_NAME ?? "switchnest";
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${name}?connection_limit=10`;
}

const envSchema = z.object({
  // Empty DATABASE_URL diya ho to ignore karke DB_* vars use hote hain
  DATABASE_URL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v : undefined),
    z.string().default(buildDatabaseUrl),
  ),
  JWT_ACCESS_SECRET: z.string().default("dev-access-secret"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret"),
  JWT_ACCESS_EXPIRES: z.string().default("7d"),
  JWT_REFRESH_EXPIRES: z.string().default("15m"),
  // Plesk/Paas PORT env var ko respect karta hai (Plesk nginx app ko assigned
  // port pe proxy karta hai); nahi diya to 4000.
  API_PORT: z.coerce.number().default(Number(process.env.PORT) || 4000),
  API_HOST: z.string().default("0.0.0.0"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  WIFI_ENC_KEY: z.string().default("switchnest-dev-wifi-key-change-me"),
  // Payment gateway (optional) — nahi diya to demo/manual mode chalta hai
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  UPI_ID: z.string().optional().default("switchnest@upi"),
  // First-run admin (install route) — hosting pe yahan se set hota hai
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_EMAIL: z.string().default("admin@switchnest.local"),
  ADMIN_PASSWORD: z.string().default("admin123"),
  // Install ko lock karne ke liye (installed flag ke saath match karta hai)
  INSTALL_TOKEN: z.string().optional().default(""),
  // AI assistant (Phase 7) — OpenAI-compatible API (OpenAI / Gemini / Ollama)
  AI_PROVIDER: z.string().default(""), // openai | gemini | ollama | "" (off → rule-based)
  AI_API_KEY: z.string().default(""),
  AI_BASE_URL: z.string().default(""), // empty → provider default
  AI_MODEL: z.string().default(""),
  // MQTT IoT broker port (ESP32 devices connect here)
  MQTT_PORT: z.coerce.number().default(1883),
});

const parsed = envSchema.safeParse(process.env);

// Invalid env pe process.exit(1) NAHI — iisnode pe exit = startup failure →
// rapid-fail pool stop → 503 jab tak manual restart na ho. Isliye defaults
// ke saath zinda rehte hain (galat config ho sakta hai, par site down nahi).
if (!parsed.success) {
  console.error("⚠️ Invalid environment variables — defaults use kar rahe hain:", parsed.error.flatten().fieldErrors);
}

export const env = parsed.success ? parsed.data : envSchema.parse({});

// Prisma schema env("DATABASE_URL") use karta hai — granular DB_* vars se
// built URL ko process.env me bhi set karna zaroori hai, warna PrismaClient
// instantiation pe "Environment variable not found" error deta hai.
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;

/** Allowed CORS origins for the web app. */
export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim());
