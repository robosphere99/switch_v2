#!/usr/bin/env node
/**
 * update-context.mjs — docs/SwitchNest-Project-Context.md ka auto-refresh.
 *
 * `docs/PHASE4...` jaisi hand-written narrative KOI touch nahi hota — sirf
 * do marker blocks refresh hote hain:
 *
 *   <!-- AUTO:STAMP:START --> ... <!-- AUTO:STAMP:END -->        → last-updated stamp
 *   <!-- AUTO:RECENT_COMMITS:START --> ... <!-- AUTO:RECENT_COMMITS:END -->  → git log list
 *
 * Use:  node tools/update-context.mjs
 * Hook: install-context-hook.bat (post-commit) isi ko call karta hai.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docPath = path.join(root, "docs", "SwitchNest-Project-Context.md");

const STAMP_START = "<!-- AUTO:STAMP:START -->";
const STAMP_END = "<!-- AUTO:STAMP:END -->";
const COMMITS_START = "<!-- AUTO:RECENT_COMMITS:START -->";
const COMMITS_END = "<!-- AUTO:RECENT_COMMITS:END -->";
const COMMIT_COUNT = 20;

function git(...args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function replaceBlock(content, startMarker, endMarker, block) {
  const i = content.indexOf(startMarker);
  const j = content.indexOf(endMarker);
  if (i === -1 || j === -1 || j < i) return null;
  return content.slice(0, i + startMarker.length) + "\n" + block + "\n" + content.slice(j);
}

if (!fs.existsSync(docPath)) {
  console.log(`[update-context] doc nahi mila: ${docPath}`);
  process.exit(1);
}

const branch = git("branch", "--show-current") || "(detached)";
const dirty = git("status", "--porcelain");
const treeState = dirty === "" ? "clean" : `dirty (${dirty.split("\n").length} changes)`;
const total = git("rev-list", "--count", "HEAD") || "?";
const now = new Date().toISOString().slice(0, 16).replace("T", " ");

const stamp = `> _Auto-updated: ${now} UTC · branch \`${branch}\` · tree ${treeState} · ${total} commits_`;

const log = git("log", `-${COMMIT_COUNT}`, "--pretty=format:%h|%ad|%s", "--date=short");
const commitLines = log
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [hash, date, ...rest] = line.split("|");
    const subject = rest.join("|");
    return `- \`${hash}\` (${date}) ${subject}`;
  })
  .join("\n");
const commits = `Sabse naye ${COMMIT_COUNT} commits:\n\n${commitLines}`;

let content = fs.readFileSync(docPath, "utf8");

let next = replaceBlock(content, STAMP_START, STAMP_END, stamp);
if (next === null) {
  console.log("[update-context] STAMP markers nahi mile — doc me add karo:");
  console.log(`  ${STAMP_START}\n  ${STAMP_END}`);
  process.exit(1);
}
content = next;

next = replaceBlock(content, COMMITS_START, COMMITS_END, commits);
if (next === null) {
  console.log("[update-context] RECENT_COMMITS markers nahi mile — doc me add karo:");
  console.log(`  ${COMMITS_START}\n  ${COMMITS_END}`);
  process.exit(1);
}
content = next;

fs.writeFileSync(docPath, content, "utf8");
console.log(`[update-context] ${docPath} refresh ho gaya (${COMMIT_COUNT} commits, ${treeState}).`);
