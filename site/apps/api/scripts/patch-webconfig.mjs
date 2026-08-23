#!/usr/bin/env node
/**
 * Plesk/IIS ke web.config me do fixes karta hai:
 *
 * 1) httpErrors existingResponse="PassThrough"
 *    IIS (default existingResponse="Auto") app ke >=400 JSON responses ko apne
 *    HTML error page se REPLACE kar deta hai — wrong-password/login pe raw HTML
 *    dikhta hai JSON ki jagah. "PassThrough" se app ka response jaise ka waisa
 *    jata hai.
 *
 * 2) nodeProcessCountPerApplication="1"
 *    Plesk default 2 node processes chala sakta hai — dono me scheduler +
 *    family-safety ALAG chalti hain → schedule 2 baar fire ho sakti hai,
 *    notifications duplicate. Single process se side-effects ek baar hote hain.
 *
 * Idempotent — har deploy pe chalta hai. Plesk ka apna config preserve karta hai
 * (sirf specific attributes/elements patch karta hai). web.config nahi mila to
 * kuch nahi karta (best-effort).
 */
import fs from "node:fs";
import path from "node:path";

const CANDIDATES = [
  path.resolve(process.cwd(), "web.config"), // apps/api
  path.resolve(process.cwd(), "../web.config"), // site/
  path.resolve(process.cwd(), "../../web.config"), // repo root
];

/** PassThrough + single-process — both idempotent patches. */
function patch(content) {
  let out = content;
  let changed = false;

  // --- 1) httpErrors PassThrough ---
  if (/<httpErrors/i.test(out)) {
    if (/existingResponse\s*=\s*"[^"]*"/i.test(out)) {
      const next = out.replace(/existingResponse\s*=\s*"[^"]*"/gi, 'existingResponse="PassThrough"');
      changed = changed || next !== out;
      out = next;
    } else {
      const next = out.replace(/(<httpErrors\b[^>]*?)(\/?>)/gi, (m, head, tail) => {
        const close = tail === "/>" ? "/>" : ">";
        return `${head} existingResponse="PassThrough"${close}`;
      });
      changed = changed || next !== out;
      out = next;
    }
  } else if (/<system\.webServer>/i.test(out)) {
    const next = out.replace(
      /(<\/system\.webServer>)/i,
      '  <httpErrors existingResponse="PassThrough" />\n$1',
    );
    changed = changed || next !== out;
    out = next;
  } else if (/<\/configuration>/i.test(out)) {
    const next = out.replace(
      /(<\/configuration>)/i,
      '  <system.webServer>\n    <httpErrors existingResponse="PassThrough" />\n  </system.webServer>\n$1',
    );
    changed = changed || next !== out;
    out = next;
  } else {
    return null; // valid config nahi — mat chhedo
  }

  // --- 1.5) Bypass Plesk .bootstrap.cjs ESM Crash ---
  // Plesk jab module load karta hai, CJS wrapper use karta hai jo .mjs par fat jata hai.
  // Isliye IIS path + rewrite URL dono direct index.mjs par redirect kardo.
  if (out.includes('.bootstrap.cjs') || out.includes('app.js')) {
    const next1 = out.replace(/path="\.bootstrap\.cjs"/gi, 'path="dist/index.mjs"');
    const next2 = next1.replace(/url="\.bootstrap\.cjs"/gi, 'url="dist/index.mjs"');
    // Agar manually app.js pe mapped hai
    const next3 = next2.replace(/path="app\.js"/gi, 'path="dist/index.mjs"');
    const next4 = next3.replace(/url="app\.js"/gi, 'url="dist/index.mjs"');

    if (next4 !== out) {
      changed = true;
      out = next4;
    }
  }

  // --- 2) iisnode: nodeProcessCountPerApplication -> "1" ---
  if (/<iisnode\b/i.test(out)) {
    const next = out.replace(/nodeProcessCountPerApplication\s*=\s*"[^"]*"/gi, 'nodeProcessCountPerApplication="1"');
    changed = changed || next !== out;
    out = next;
    const dev = out.replace(/devErrorsEnabled\s*=\s*"[^"]*"/gi, 'devErrorsEnabled="false"');
    changed = changed || dev !== out;
    out = dev;
  }

  if (!changed) return null;
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
  console.log(`[patch-webconfig] ${found} — patch karne ki zaroorat nahi (sab already set)`);
  process.exit(0);
}

fs.writeFileSync(found, patched, "utf-8");
console.log(`[patch-webconfig] ✅ ${found} — PassThrough + nodeProcessCountPerApplication=1 set`);

// Verify
const after = fs.readFileSync(found, "utf-8");
const pass = /existingResponse="PassThrough"/.test(after) && /nodeProcessCountPerApplication="1"/.test(after) && /devErrorsEnabled="false"/.test(after);
console.log(`[patch-webconfig] verify: ${pass ? "OK" : "FAIL"}`);
