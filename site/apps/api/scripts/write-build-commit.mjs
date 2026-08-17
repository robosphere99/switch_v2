// Build-time metadata — dist/build-commit.json me commit + builtAt likhta hai.
// Yeh file git me COMMIT hoti hai (dist/index.mjs ki tarah), isliye:
//   - production pe deploy.json (untracked) wipe ho jaye to bhi deployed
//     commit pata hota hai — code hi apna source of truth hai
//   - deploy-marker ko GitHub API ki zaroorat nahi — network fail ho to
//     bhi commit milta hai
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

let commit = "";
try {
  commit = execSync("git rev-parse HEAD", { encoding: "utf8", windowsHide: true, timeout: 5000 }).trim() || "";
} catch {
  /* no git — commit empty rehne do */
}

const out = path.resolve("dist/build-commit.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ commit, builtAt: new Date().toISOString() }, null, 2));
console.log(`[build-commit] ${out} → ${commit.slice(0, 7) || "(no git)"}`);
