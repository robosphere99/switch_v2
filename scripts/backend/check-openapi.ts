// CI sync check — committed openapi.json snapshot vs live-generated spec.
// Fail exit code = docs stale → developer ko `npm run docs:generate` chala kar
// snapshot update karna hota hai. Isi se "docs hamesha in sync" enforce hota hai.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getOpenApiSpec } from "../src/lib/openapi";

const here = path.dirname(fileURLToPath(import.meta.url));
const COMMITTED = path.resolve(here, "../openapi.json");

const generated = JSON.stringify(getOpenApiSpec(), null, 2) + "\n";
let committed = "";
try {
  committed = fs.readFileSync(COMMITTED, "utf8");
} catch {
  committed = ""; // missing file = out of sync
}

if (committed === generated) {
  console.log("✅ OpenAPI spec in sync (openapi.json == generated spec)");
  process.exit(0);
}

console.error("❌ OpenAPI spec OUT OF SYNC — committed openapi.json generated spec se match nahi karta.");
console.error("   Routes/schemas badle hain par docs snapshot update nahi hua.");
console.error("   Fix:");
console.error("     cd site && npm run docs:generate");
console.error("   phir openapi.json ke changes commit karo.");
process.exit(1);
