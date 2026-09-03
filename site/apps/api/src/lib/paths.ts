import * as fs from "fs";
import * as path from "path";

/**
 * Plesk pe app ka cwd = <domain>/site/apps (npm workspace root), dev me
 * <repo>/site/apps/api hota hai. Repo root ko cwd se upar chadh ke dhoondo
 * ("hardware" folder wala directory) — taaki firmware/web paths dono jagah
 * sahi resolve hon. Koi folder na mile to purane relative fallback.
 */
function findRepoRoot(start: string): string | null {
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "hardware")) && fs.existsSync(path.join(dir, "site", "apps", "api"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const repoRoot = findRepoRoot(process.cwd());

const isDist = process.cwd().endsWith("dist");
const apiRoot = isDist ? path.resolve(process.cwd(), "..") : process.cwd();

/** <repo>/hardware/firmware — admin firmware upload + /firmware serving. */
export const firmwareDir = repoRoot
  ? path.join(repoRoot, "hardware", "firmware")
  : path.resolve(process.cwd(), "../../../hardware/firmware");

/** <repo>/mobile-app — hosting Android APK releases for OTA updates. */
export const mobileAppDir = repoRoot
  ? path.join(repoRoot, "mobile-app")
  : path.resolve(process.cwd(), "mobile-app");

export function getMobileAppCandidateDirs(): string[] {
  const dirs = [
    path.resolve(process.cwd(), "mobile-app"),
    path.resolve(process.cwd(), "../mobile-app"),
    path.resolve(process.cwd(), "../../mobile-app"),
    path.resolve(process.cwd(), "../../../mobile-app"),
    repoRoot ? path.join(repoRoot, "mobile-app") : "",
    repoRoot ? path.join(repoRoot, "site", "apps", "web", "public", "mobile-app") : "",
    path.resolve(process.cwd(), "apps/web/public/mobile-app"),
    path.resolve(process.cwd(), "../web/public/mobile-app"),
    path.resolve(process.cwd(), "../../apps/web/public/mobile-app"),
  ].filter((d): d is string => Boolean(d));

  return Array.from(new Set(dirs));
}

/** <repo>/hardware/attachments — support chat files (DB me sirf path, blobs yahan disk pe).
 *  Firmware ki tarah Plesk pe writable. Gitignore me hai (user data — commit nahi hota). */
export const attachmentDir = repoRoot
  ? path.join(repoRoot, "hardware", "attachments")
  : path.resolve(process.cwd(), "../../../hardware/attachments");

/** <repo>/site/apps/web/dist — built Vite app (SPA serving). */
export const webDist = repoRoot
  ? path.join(repoRoot, "site", "apps", "web", "dist")
  : path.resolve(apiRoot, "../web/dist");

/** <repo>/site/apps/api/public/swagger-ui — vendored Swagger UI assets (CDN-free,
 *  helmet ke CSP `script-src 'self'` ke saath kaam karta hai). */
export const swaggerUiDir = repoRoot
  ? path.join(repoRoot, "site", "apps", "api", "public", "swagger-ui")
  : path.resolve(apiRoot, "public/swagger-ui");

/** <repo>/site/apps/web/public/mobile-app — Vite dev & static serve folder for APK. */
export const webPublicMobileAppDir = repoRoot
  ? path.join(repoRoot, "site", "apps", "web", "public", "mobile-app")
  : path.resolve(apiRoot, "../web/public/mobile-app");

/** <repo>/site/apps/api/uploads — avatars and user uploaded assets. */
export const uploadsDir = repoRoot
  ? path.join(repoRoot, "site", "apps", "api", "uploads")
  : path.resolve(apiRoot, "uploads");
