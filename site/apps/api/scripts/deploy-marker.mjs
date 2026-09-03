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

// Build-time embedded commit — dist/build-commit.json (git me committed,
// build:prod usse likhta hai). Network ke bina kaam karta hai — production
// me deployed commit ka SABSE reliable source.
function buildCommit() {
  try {
    const p = path.resolve(process.cwd(), "dist/build-commit.json");
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      if (j?.commit) return j.commit;
    }
  } catch {
    /* missing/corrupt — fallback chain aage badhe */
  }
  return "";
}

async function ghHead() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`, {
      headers: {
        "User-Agent": "switch-v2-deploy",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const j = await res.json();
    return j?.sha || "";
  } catch {
    return "";
  }
}

function writeMarker(commit, source) {
  const out = path.resolve(process.cwd(), "../logs/deploy.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ deployedAt: new Date().toISOString(), commit, branch: BRANCH, source }, null, 2));
  return out;
}

async function main() {
  const out = writeMarker("", "none"); // pehle turant likho — deployedAt kabhi miss na ho
  const local = gitHead(); // .git ho (dev/local) — exact
  let commit = "";
  let source = "none";
  if (local) {
    commit = local;
    source = "git";
  } else {
    // GitHub API deploy-time SHA exact hai (build-commit.json parent hota hai,
    // kyunki build commit se pehle chalta hai) — isliye GitHub primary, build
    // metadata sirf last resort jab GitHub down/rate-limited ho.
    const gh = await ghHead();
    if (gh) {
      commit = gh;
      source = "github";
    } else {
      const bc = buildCommit();
      if (bc) {
        commit = bc;
        source = "build"; // parent commit — sync compare ke liye trusted NAHI
      }
    }
  }
  if (commit) writeMarker(commit, source);
  console.log(`[deploy-marker] wrote ${out} commit=${(commit || "(empty)").slice(0, 7)} source=${source} branch=${BRANCH}`);
}

main().catch(() => {});
