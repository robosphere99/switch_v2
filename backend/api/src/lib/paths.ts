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
    if (fs.existsSync(path.join(dir, "hardware")) && (fs.existsSync(path.join(dir, "site", "apps", "api")) || fs.existsSync(path.join(dir, "backend", "api")))) {
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

/** Built Vite app (SPA serving). */
export const webDist = repoRoot
  ? (fs.existsSync(path.join(repoRoot, "frontend", "web", "dist"))
      ? path.join(repoRoot, "frontend", "web", "dist")
      : path.join(repoRoot, "site", "apps", "web", "dist"))
  : (fs.existsSync(path.resolve(apiRoot, "../../frontend/web/dist"))
      ? path.resolve(apiRoot, "../../frontend/web/dist")
      : path.resolve(apiRoot, "../web/dist"));

/** Swagger UI assets */
export const swaggerUiDir = repoRoot
  ? (fs.existsSync(path.join(repoRoot, "backend", "api", "public", "swagger-ui"))
      ? path.join(repoRoot, "backend", "api", "public", "swagger-ui")
      : path.join(repoRoot, "site", "apps", "api", "public", "swagger-ui"))
  : path.resolve(apiRoot, "public/swagger-ui");

/** Vite dev & static serve folder for APK */
export const webPublicMobileAppDir = repoRoot
  ? (fs.existsSync(path.join(repoRoot, "frontend", "web", "public", "mobile-app"))
      ? path.join(repoRoot, "frontend", "web", "public", "mobile-app")
      : path.join(repoRoot, "site", "apps", "web", "public", "mobile-app"))
  : (fs.existsSync(path.resolve(apiRoot, "../../frontend/web/public/mobile-app"))
      ? path.resolve(apiRoot, "../../frontend/web/public/mobile-app")
      : path.resolve(apiRoot, "../web/public/mobile-app"));

/** Avatars and user uploaded assets */
export const uploadsDir = repoRoot
  ? (fs.existsSync(path.join(repoRoot, "backend", "api", "uploads"))
      ? path.join(repoRoot, "backend", "api", "uploads")
      : path.join(repoRoot, "site", "apps", "api", "uploads"))
  : path.resolve(apiRoot, "uploads");

