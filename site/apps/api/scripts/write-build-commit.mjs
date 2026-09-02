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

const shortCommit = commit.slice(0, 7) || "(no git)";
const out = path.resolve("dist/build-commit.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ commit, shortCommit, builtAt: new Date().toISOString() }, null, 2));
console.log(`[build-commit] ${out} → ${shortCommit}`);

// Inject meta tag and console log into index.html
const htmlPath = path.resolve("index.html");
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, "utf-8");
  html = html.replace(/<meta name="git-commit" content="[^"]*" \/>/g, "");
  html = html.replace(/<title>/, `<meta name="git-commit" content="${shortCommit}" />\n    <title>`);
  fs.writeFileSync(htmlPath, html, "utf-8");
  console.log(`[build-commit] Injected meta git-commit="${shortCommit}" into ${htmlPath}`);
}
