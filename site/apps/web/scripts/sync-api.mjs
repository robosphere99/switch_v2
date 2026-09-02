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
  // Copy legacy hashes so cached browsers requesting old index-[hash].js files get index.js without 404
  const apiAssets = join(apiRoot, "assets");
  const mainJs = join(apiAssets, "index.js");
  if (existsSync(mainJs)) {
    const legacyHashes = ["index-Bc2l33nz.js", "index-Bc2133mz.js", "index-Df8JkqRD.js", "index-CK8FOSB3.js"];
    for (const name of legacyHashes) {
      cpSync(mainJs, join(apiAssets, name));
    }
  }
  console.log("[sync-api] web build copied to apps/api (index.html + assets + legacy hashes)");
} else {
  console.warn("[sync-api] no dist/index.html found — skipping copy");
}
