// Plesk natively manages IIS web.config. Do not mutate.
console.log("[patch-webconfig] Plesk IIS native web.config preserved.");
process.exit(0);


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
