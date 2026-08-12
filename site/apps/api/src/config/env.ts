import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

// Load .env from the workspace root (site/.env) and/or this package's .env.
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .default("mysql://root:root@localhost:3306/switch_v2"),
  JWT_ACCESS_SECRET: z.string().default("dev-access-secret"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret"),
  JWT_ACCESS_EXPIRES: z.string().default("15m"),
  JWT_REFRESH_EXPIRES: z.string().default("7d"),
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default("0.0.0.0"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  WIFI_ENC_KEY: z.string().default("robosphere-dev-wifi-key-change-me"),
  // Payment gateway (optional) — nahi diya to demo/manual mode chalta hai
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  UPI_ID: z.string().optional().default("robosphere@upi"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/** Allowed CORS origins for the web app. */
export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim());
