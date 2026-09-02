import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.cwd(), "assets");
const src = path.join(dir, "index.js");

if (fs.existsSync(src)) {
  const legacyHashes = [
    "index-Bc2l33nz.js",
    "index-Bc2133mz.js",
    "index-Df8JkqRD.js",
    "index-CK8FOSB3.js",
  ];
  for (const name of legacyHashes) {
    fs.copyFileSync(src, path.join(dir, name));
    console.log(`[legacy-hash] Copied index.js -> ${name}`);
  }
}
