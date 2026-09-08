import * as fs from "fs";
import * as path from "path";

/**
 * Plesk pe app ka cwd = <domain>/backend/api ya <domain> (repo root).
 * Repo root ko cwd se upar chadh ke dhoondo taaki firmware/web/api paths dono jagah sahi resolve hon.
 */
function findRepoRoot(start: string): string | null {
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i++) {
    if (
      fs.existsSync(path.join(dir, "hardware")) &&
      (fs.existsSync(path.join(dir, "backend", "api")) ||
        fs.existsSync(path.join(dir, "frontend", "web")) ||
        fs.existsSync(path.join(dir, "site", "apps", "api")))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export const repoRoot = findRepoRoot(process.cwd());

const isDist = process.cwd().endsWith("dist") || (typeof __dirname !== "undefined" && __dirname.endsWith("dist"));
export const apiRoot = isDist
  ? path.resolve(process.cwd().endsWith("dist") ? process.cwd() : __dirname, "..")
  : (repoRoot ? path.join(repoRoot, "backend", "api") : process.cwd());

/** <repo>/hardware/firmware — admin firmware upload + /firmware serving. */
export const firmwareDir = repoRoot
  ? path.join(repoRoot, "hardware", "firmware")
  : path.resolve(apiRoot, "../../hardware/firmware");

/** <repo>/mobile-app — hosting Android APK releases for OTA updates. */
export const mobileAppDir = repoRoot
  ? path.join(repoRoot, "mobile-app")
  : path.resolve(apiRoot, "../../mobile-app");

export function getMobileAppCandidateDirs(): string[] {
  const dirs = [
    path.resolve(apiRoot, "mobile-app"),
    path.resolve(process.cwd(), "mobile-app"),
    path.resolve(apiRoot, "../../mobile-app"),
    repoRoot ? path.join(repoRoot, "mobile-app") : "",
    repoRoot ? path.join(repoRoot, "frontend", "web", "public", "mobile-app") : "",
    repoRoot ? path.join(repoRoot, "site", "apps", "web", "public", "mobile-app") : "",
  ].filter((d): d is string => Boolean(d));

  return Array.from(new Set(dirs));
}

/** <repo>/hardware/attachments — support chat files */
export const attachmentDir = repoRoot
  ? path.join(repoRoot, "hardware", "attachments")
  : path.resolve(apiRoot, "../../hardware/attachments");

/** Built Vite app (SPA serving) */
export const webDist = repoRoot
  ? (fs.existsSync(path.join(repoRoot, "frontend", "web", "dist"))
      ? path.join(repoRoot, "frontend", "web", "dist")
      : path.join(repoRoot, "site", "apps", "web", "dist"))
  : (fs.existsSync(path.resolve(apiRoot, "../../frontend/web/dist"))
      ? path.resolve(apiRoot, "../../frontend/web/dist")
      : path.resolve(apiRoot, "../web/dist"));

/** <repo>/backend/api/public/swagger-ui — vendored Swagger UI assets */
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
  : path.resolve(apiRoot, "../../frontend/web/public/mobile-app");

export function getCandidateUploadDirs(): string[] {
  const dirs = [
    repoRoot ? path.join(repoRoot, "backend", "api", "uploads") : "",
    path.resolve(apiRoot, "uploads"),
    path.resolve(process.cwd(), "uploads"),
    path.resolve(process.cwd(), "backend", "api", "uploads"),
  ].filter((d): d is string => Boolean(d));

  return Array.from(new Set(dirs));
}

function resolveUploadsDir(): string {
  const dirs = getCandidateUploadDirs();
  for (const d of dirs) {
    if (fs.existsSync(d)) {
      for (const sub of ["products", "avatars", "support", "billing"]) {
        try { fs.mkdirSync(path.join(d, sub), { recursive: true }); } catch {}
      }
      return d;
    }
  }

  const preferred = (repoRoot && path.join(repoRoot, "backend", "api", "uploads")) ||
    path.resolve(apiRoot, "uploads") ||
    path.resolve(process.cwd(), "uploads");

  try {
    fs.mkdirSync(preferred, { recursive: true });
    for (const sub of ["products", "avatars", "support", "billing"]) {
      fs.mkdirSync(path.join(preferred, sub), { recursive: true });
    }
  } catch {}
  return preferred;
}

/** Avatars, products, support attachments and billing user uploaded assets */
export const uploadsDir = resolveUploadsDir();

// Pre-create all subdirectories across candidate directories
for (const d of getCandidateUploadDirs()) {
  try {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
    for (const sub of ["products", "avatars", "support", "billing"]) {
      const subDir = path.join(d, sub);
      if (!fs.existsSync(subDir)) {
        fs.mkdirSync(subDir, { recursive: true });
      }
    }
  } catch {}
}

/** Finds SPA index.html across all possible directory structures */
export function getSpaIndexHtmlPath(): string | null {
  const candidates = [
    path.resolve(apiRoot, "index.html"),
    path.resolve(process.cwd(), "index.html"),
    path.resolve(process.cwd(), "backend", "api", "index.html"),
    path.resolve(webDist, "index.html"),
    repoRoot ? path.join(repoRoot, "backend", "api", "index.html") : "",
    repoRoot ? path.join(repoRoot, "frontend", "web", "dist", "index.html") : "",
    repoRoot ? path.join(repoRoot, "site", "apps", "web", "dist", "index.html") : "",
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Finds all candidate asset directories */
export function getCandidateAssetDirs(): string[] {
  const dirs = [
    path.resolve(apiRoot, "assets"),
    path.resolve(process.cwd(), "assets"),
    path.resolve(process.cwd(), "backend", "api", "assets"),
    path.resolve(webDist, "assets"),
    repoRoot ? path.join(repoRoot, "backend", "api", "assets") : "",
    repoRoot ? path.join(repoRoot, "frontend", "web", "dist", "assets") : "",
    repoRoot ? path.join(repoRoot, "site", "apps", "web", "dist", "assets") : "",
  ].filter((d): d is string => Boolean(d));

  return Array.from(new Set(dirs.filter((d) => fs.existsSync(d))));
}

