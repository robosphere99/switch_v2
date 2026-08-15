// Web build ko apps/api me bhi copy karta hai — Plesk pe IIS static files
// wahan se serve karta hai (index.html + assets). Pull = pura update.
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const webDist = join(here, "..", "dist");
const apiRoot = join(here, "..", "..", "api");

if (existsSync(join(webDist, "index.html"))) {
  cpSync(join(webDist, "index.html"), join(apiRoot, "index.html"));
  rmSync(join(apiRoot, "assets"), { recursive: true, force: true });
  mkdirSync(join(apiRoot, "assets"), { recursive: true });
  cpSync(join(webDist, "assets"), join(apiRoot, "assets"), { recursive: true });
  console.log("[sync-api] web build copied to apps/api (index.html + assets)");
} else {
  console.warn("[sync-api] no dist/index.html found — skipping copy");
}
