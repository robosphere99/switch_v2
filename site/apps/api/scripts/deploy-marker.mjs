// Deploy marker — deploy.cmd har deploy pe chalata hai.
// logs/deploy.json: deployedAt + commit + branch.
//
// RULE: deploy.json HAMESHA likha jata hai — pehle turant (deployedAt ke
// saath), phir commit enrich karke dobara. Isse deploy.cmd ka marker step
// kabhi hang/fail nahi hota (pehle version me GitHub fetch write se PEHLE
// tha — fetch hang hua to deploy.json kabhi banta hi nahi tha).
//
// Deployed folder me .git nahi hota (Plesk sirf files copy karta hai) —
// isliye commit: (1) .git ho to `git rev-parse HEAD`, (2) warna GitHub API
// (10s timeout — hang hone par bhi marker pehle hi likha hua hota hai).
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const REPO = "robosphere99/switch_v2";
const BRANCH = "main";

function gitHead() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8", windowsHide: true, timeout: 5000 }).trim() || "";
  } catch {
    return "";
  }
}

async function ghHead() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`, {
      headers: { "User-Agent": "switch-v2-deploy" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const j = await res.json();
    return j?.sha || "";
  } catch {
    return "";
  }
}

function writeMarker(commit) {
  const out = path.resolve(process.cwd(), "../logs/deploy.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ deployedAt: new Date().toISOString(), commit, branch: BRANCH }, null, 2));
  return out;
}

async function main() {
  const out = writeMarker(""); // pehle turant likho — deployedAt kabhi miss na ho
  const local = gitHead();
  if (local) {
    writeMarker(local);
    console.log(`[deploy-marker] wrote ${out} commit=${local.slice(0, 7)} branch=${BRANCH}`);
  } else {
    const gh = await ghHead(); // .git nahi — GitHub API se enrich (best-effort)
    if (gh) writeMarker(gh);
    console.log(`[deploy-marker] wrote ${out} commit=${(gh || "(empty)").slice(0, 7)} branch=${BRANCH}`);
  }
}

main().catch(() => {});
