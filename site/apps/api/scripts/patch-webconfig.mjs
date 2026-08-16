#!/usr/bin/env node
/**
 * Plesk/IIS ke web.config me httpErrors existingResponse="PassThrough" set karta hai.
 *
 * Problem: IIS (default existingResponse="Auto") app ke >=400 JSON responses ko apne
 * HTML error page se REPLACE kar deta hai — isliye wrong-password/login pe raw HTML
 * dikhta hai JSON ki jagah. "PassThrough" se app ka response waise ka waisa jata hai.
 *
 * Idempotent — har deploy pe chalta hai. Plesk ka apna config preserve karta hai
 * (sirf httpErrors element patch karta hai, baaki file ko haath nahi lagata).
 * web.config nahi mila to kuch nahi karta (best-effort).
 */
import fs from "node:fs";
import path from "node:path";

const CANDIDATES = [
  path.resolve(process.cwd(), "web.config"), // apps/api
  path.resolve(process.cwd(), "../web.config"), // site/
  path.resolve(process.cwd(), "../../web.config"), // repo root
];

/** Existing httpErrors element ko PassThrough banata hai (ya naya insert karta hai). */
function patch(content) {
  let out = content;

  // 1) <httpErrors> pehle se hai → existingResponse ko PassThrough karo
  if (/<httpErrors/i.test(out)) {
    if (/existingResponse\s*=\s*"[^"]*"/i.test(out)) {
      out = out.replace(/existingResponse\s*=\s*"[^"]*"/gi, 'existingResponse="PassThrough"');
    } else {
      out = out.replace(/(<httpErrors\b[^>]*?)(\/?>)/gi, (m, head, tail) => {
        const close = tail === "/>" ? "/>" : ">";
        return `${head} existingResponse="PassThrough"${close}`;
      });
    }
  } else if (/<system\.webServer>/i.test(out)) {
    // 2) system.webServer hai → element insert karo
    out = out.replace(
      /(<\/system\.webServer>)/i,
      '  <httpErrors existingResponse="PassThrough" />\n$1',
    );
  } else if (/<\/configuration>/i.test(out)) {
    // 3) kuch bhi nahi → configuration ke andar system.webServer + element
    out = out.replace(
      /(<\/configuration>)/i,
      '  <system.webServer>\n    <httpErrors existingResponse="PassThrough" />\n  </system.webServer>\n$1',
    );
  } else {
    return null; // valid config nahi — mat chhedo
  }

  if (out === content) return null; // koi change nahi
  return out;
}

let found = null;
for (const p of CANDIDATES) {
  if (fs.existsSync(p)) {
    found = p;
    break;
  }
}

if (!found) {
  console.log("[patch-webconfig] web.config nahi mila — skip (koi change nahi)");
  process.exit(0);
}

const original = fs.readFileSync(found, "utf-8");
const patched = patch(original);

if (!patched) {
  console.log(`[patch-webconfig] ${found} — patch karne ki zaroorat nahi (pehle se PassThrough ya invalid)`);
  process.exit(0);
}

fs.writeFileSync(found, patched, "utf-8");
console.log(`[patch-webconfig] ✅ ${found} — httpErrors existingResponse="PassThrough" set`);

// Verify
const after = fs.readFileSync(found, "utf-8");
console.log(`[patch-webconfig] verify: ${/existingResponse="PassThrough"/.test(after) ? "OK" : "FAIL"}`);
