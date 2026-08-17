// Deploy marker — deploy.cmd har deploy pe chalata hai.
// logs/deploy.json: deployedAt + commit + branch.
//
// Deployed folder me .git NAHI hota (Plesk sirf files copy karta hai, git
// metadata nahi) — isliye commit GitHub API se liya jata hai (branch = main).
// Best-effort: fetch fail ho to commit khali rehta hai, deploy kabhi fail
// nahi hota. cwd = site/apps/api (deploy.cmd wahan cd karta hai).
import fs from "node:fs";
import path from "node:path";

const REPO = "robosphere99/switch_v2";
const BRANCH = "main";

async function main() {
  let commit = "";
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`, {
      headers: { "User-Agent": "switch-v2-deploy" },
    });
    if (res.ok) {
      const j = await res.json();
      commit = j?.sha || "";
    }
  } catch { /* best-effort — commit empty rehne do */ }

  const out = path.resolve(process.cwd(), "../logs/deploy.json");
  fs.writeFileSync(out, JSON.stringify({ deployedAt: new Date().toISOString(), commit, branch: BRANCH }, null, 2));
  console.log(`[deploy-marker] wrote ${out} commit=${commit.slice(0, 7) || "(empty)"} branch=${BRANCH}`);
}

main().catch(() => {});
