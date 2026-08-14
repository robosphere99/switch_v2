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
    if (fs.existsSync(path.join(dir, "hardware"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const repoRoot = findRepoRoot(process.cwd());

/** <repo>/hardware/firmware — admin firmware upload + /firmware serving. */
export const firmwareDir = repoRoot
  ? path.join(repoRoot, "hardware", "firmware")
  : path.resolve(process.cwd(), "../../../hardware/firmware");

/** <repo>/site/apps/web/dist — built Vite app (SPA serving). */
export const webDist = repoRoot
  ? path.join(repoRoot, "site", "apps", "web", "dist")
  : path.resolve(process.cwd(), "../../apps/web/dist");
