// OpenAPI spec → committed openapi.json snapshot.
// CI (docs:check) isi file se generated spec compare karta hai — routes/schemas
// badlo to `npm run docs:generate` chalao aur snapshot bhi commit karo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getOpenApiSpec } from "../src/lib/openapi";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../openapi.json");

const spec = getOpenApiSpec();
fs.writeFileSync(OUT, JSON.stringify(spec, null, 2) + "\n", "utf8");

const paths = Object.keys(spec.paths).length;
let ops = 0;
for (const p of Object.values(spec.paths)) ops += Object.keys(p).length;
console.log(`✅ openapi.json written — ${paths} paths, ${ops} operations (${fs.statSync(OUT).size} bytes)`);
