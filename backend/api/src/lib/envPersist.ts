/**
 * site/.env persist helpers — install wizard aur admin password sync dono
 * yahi use karte hain taaki ek hi source of truth ho (har jagah same value).
 *
 * .env path: process.cwd() se ../../.env (site/apps/api → site/.env).
 * Best-effort: write fail ho to sirf warn — crash nahi.
 */
import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

export function envFilePath(): string {
  return path.resolve(process.cwd(), "../../.env");
}

/** .env value me special chars (# " space) ho to quote kar do. */
function escapeEnv(v: string): string {
  return /[\s#"']/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v;
}

/**
 * Ek ya zyada keys ko site/.env me set karo (existing line replace /
 * missing line append). Multiple keys ek hi write me — atomic-ish.
 */
export function persistEnvKeys(entries: Array<[string, string]>): { path: string; ok: boolean } {
  const targets = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
  ];

  let mainPath = targets[0];
  let written = false;

  for (const envPath of targets) {
    try {
      let content = "";
      if (fs.existsSync(envPath)) content = fs.readFileSync(envPath, "utf-8");
      for (const [key, value] of entries) {
        process.env[key] = value;
        const line = `${key}=${escapeEnv(value)}`;
        const re = new RegExp(`^${key}=.*$`, "m");
        if (re.test(content)) content = content.replace(re, line);
        else content = (content ? content.replace(/\s*$/, "\n") : "") + line + "\n";
      }
      fs.writeFileSync(envPath, content, "utf-8");
      mainPath = envPath;
      written = true;
    } catch (err) {
      logger.warn(`[envPersist] .env write fail for ${envPath}:`, err instanceof Error ? err.message : String(err));
    }
  }

  return { path: mainPath, ok: written };
}

export function persistEnvKey(key: string, value: string): { path: string; ok: boolean } {
  return persistEnvKeys([[key, value]]);
}
