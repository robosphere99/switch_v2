#!/usr/bin/env node
/**
 * SwitchNest GitHub Repo Backup (private repo ka offsite backup)
 * ==============================================================
 * Har run pe:
 *   1. Git mirror fetch (incremental — sirf naye commits aate hain)
 *   2. Clean source ZIP (git archive — .git / node_modules nahi)
 *   3. GitHub Release me ZIP upload (offsite copy — private release, sirf tum dekh sakte ho)
 *   4. Retention — local last 8 zips, remote last 12 releases (purane auto-delete)
 *
 * Usage:
 *   node backup-repo.mjs              # abhi ek baar, phir har 7 din (forever loop)
 *   node backup-repo.mjs --once       # single backup (manual ya Task Scheduler)
 *   node backup-repo.mjs --keep 8     # local zips kitne rakhein (default 8)
 *   node backup-repo.mjs --releases 12  # remote releases kitne rakhein (default 12)
 *
 * Auth: GITHUB_TOKEN env → warna git credential manager (stored credentials).
 * Logs: logs/backup.log (append-only)
 * Zero dependencies — Node 18+ (global fetch).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OWNER = "robosphere99";
const REPO = "switch_v2";
const REPO_URL = `https://github.com/${OWNER}/${REPO}.git`;
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;
const UPLOAD_BASE = `https://uploads.github.com/repos/${OWNER}/${REPO}`;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const MIRROR_DIR = path.join(__dirname, "mirror", `${REPO}.git`);
const SNAPSHOT_DIR = path.join(__dirname, "snapshots");
const LOG_DIR = path.join(__dirname, "logs");
const LOG_FILE = path.join(LOG_DIR, "backup.log");

let KEEP_LOCAL = 8;
let KEEP_RELEASES = 12;
let ONCE = false;

for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--once") ONCE = true;
  else if (a === "--keep") KEEP_LOCAL = parseInt(process.argv[++i], 10) || 8;
  else if (a === "--releases") KEEP_RELEASES = parseInt(process.argv[++i], 10) || 12;
}

/* ---------------- helpers ---------------- */

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch { /* log fail — koi baat nahi */ }
}

function sh(args, opts = {}) {
  return execFileSync(args[0], args.slice(1), {
    encoding: "utf8",
    windowsHide: true,
    stdio: opts.input !== undefined ? ["pipe", "pipe", "inherit"] : ["ignore", "pipe", "inherit"],
    input: opts.input,
  });
}

function dateStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function tokenFromGitCredential() {
  try {
    const out = sh(["git", "credential", "fill"], { input: "protocol=https\nhost=github.com\n\n" });
    const m = out.match(/^password=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

async function ghApi(p, token, { method = "GET", body, contentType, upload = false } = {}) {
  const base = upload ? UPLOAD_BASE : API_BASE;
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "switchnest-backup" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (contentType) headers["Content-Type"] = contentType;
  const payload =
    body === undefined ? undefined : Buffer.isBuffer(body) || typeof body === "string" ? body : JSON.stringify(body);
  const res = await fetch(`${base}${p}`, { method, headers, body: payload });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`GitHub API ${res.status} on ${method} ${p}: ${data?.message ?? text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------------- steps ---------------- */

function ensureMirror() {
  if (fs.existsSync(path.join(MIRROR_DIR, "HEAD"))) {
    log(`mirror fetch (incremental): ${MIRROR_DIR}`);
    sh(["git", "-C", MIRROR_DIR, "remote", "update", "--prune"]);
  } else {
    fs.mkdirSync(path.dirname(MIRROR_DIR), { recursive: true });
    log(`mirror clone (first time): ${REPO_URL}`);
    sh(["git", "clone", "--mirror", REPO_URL, MIRROR_DIR]);
  }
}

function makeZip(sha) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const stamp = dateStamp();
  const zipName = `switch_v2-${stamp}-${sha.slice(0, 8)}.zip`;
  const zipPath = path.join(SNAPSHOT_DIR, zipName);
  if (fs.existsSync(zipPath)) {
    log(`zip already exists: ${zipName}`);
    return { zipName, zipPath };
  }
  log(`archiving origin/main (${sha.slice(0, 12)}) -> ${zipName}`);
  const out = fs.openSync(zipPath, "w");
  try {
    execFileSync(
      "git",
      ["-C", MIRROR_DIR, "archive", "--format=zip", `--prefix=switch_v2-${sha.slice(0, 8)}/`, "main"],
      { stdio: ["ignore", out, "inherit"], windowsHide: true },
    );
  } finally {
    fs.closeSync(out);
  }
  const size = fs.statSync(zipPath).size;
  const manifest = {
    repo: `${OWNER}/${REPO}`,
    createdAt: new Date().toISOString(),
    commit: sha,
    branch: "main",
    zip: zipName,
    sizeBytes: size,
  };
  fs.writeFileSync(path.join(SNAPSHOT_DIR, `manifest-${stamp}.json`), JSON.stringify(manifest, null, 2));
  log(`zip done: ${zipName} (${(size / 1024 / 1024).toFixed(2)} MB)`);
  return { zipName, zipPath };
}

async function createRelease(token, sha, { zipName, zipPath }) {
  const date = dateStamp().slice(0, 10); // 2026-08-16
  const baseTag = `backup/${date}`;
  let tagName = baseTag;
  try {
    await ghApi("/git/refs", token, { method: "POST", body: { ref: `refs/tags/${baseTag}`, sha } });
    log(`tag created: ${baseTag}`);
  } catch (e) {
    if (e.status === 422) {
      tagName = `${baseTag}-${dateStamp().slice(11)}`; // same-day rerun -> backup/2026-08-16-1830
      await ghApi("/git/refs", token, { method: "POST", body: { ref: `refs/tags/${tagName}`, sha } });
      log(`same-day tag exists — using ${tagName}`);
    } else {
      throw e;
    }
  }
  const rel = await ghApi("/releases", token, {
    method: "POST",
    body: {
      tag_name: tagName,
      name: `SwitchNest backup ${tagName.replace("backup/", "")}`,
      body: `Weekly offsite backup of **${OWNER}/${REPO}** (private repo).\n\n- Commit: \`${sha.slice(0, 12)}\`\n- Branch: main\n- Zip: ${zipName}\n- Auto-generated by \`tools/backup/backup-repo.mjs\``,
    },
  });
  log(`release created: ${rel.html_url} (id ${rel.id})`);
  const zipBuf = fs.readFileSync(zipPath);
  await ghApi(`/releases/${rel.id}/assets?name=${encodeURIComponent(zipName)}`, token, {
    method: "POST",
    body: zipBuf,
    contentType: "application/zip",
    upload: true,
  });
  log(`asset uploaded: ${zipName}`);
  return rel;
}

function pruneLocal() {
  const snaps = fs.readdirSync(SNAPSHOT_DIR).filter((f) => f.endsWith(".zip")).sort();
  while (snaps.length > KEEP_LOCAL) {
    const old = snaps.shift();
    fs.unlinkSync(path.join(SNAPSHOT_DIR, old));
    log(`local prune (keep ${KEEP_LOCAL}): ${old}`);
  }
  // manifest files bhi — zip ke saath
  const mans = fs.readdirSync(SNAPSHOT_DIR).filter((f) => f.startsWith("manifest-")).sort();
  const keepMans = Math.max(0, KEEP_LOCAL);
  while (mans.length > keepMans) {
    const old = mans.shift();
    fs.unlinkSync(path.join(SNAPSHOT_DIR, old));
  }
}

async function pruneRemote(token) {
  const rels = await ghApi("/releases?per_page=100", token);
  const backups = rels
    .filter((r) => (r.tag_name || "").startsWith("backup/"))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  while (backups.length > KEEP_RELEASES) {
    const old = backups.pop();
    await ghApi(`/releases/${old.id}`, token, { method: "DELETE" });
    log(`remote prune (keep ${KEEP_RELEASES}): ${old.tag_name}`);
  }
}

/* ---------------- main ---------------- */

async function runBackup() {
  const started = Date.now();
  log("=== backup start ===");
  try {
    ensureMirror();
    const sha = sh(["git", "-C", MIRROR_DIR, "rev-parse", "main"]).trim();
    log(`main HEAD: ${sha}`);

    const zip = makeZip(sha);

    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || tokenFromGitCredential();
    if (!token) {
      log("WARN: GitHub token nahi mila (GITHUB_TOKEN / git credential) — release skip, sirf local zip bana");
    } else {
      try {
        await createRelease(token, sha, zip);
        await pruneRemote(token);
      } catch (e) {
        log(`ERROR release step: ${e.message}`);
      }
    }
    pruneLocal();
    log(`=== backup done in ${((Date.now() - started) / 1000).toFixed(1)}s (${zip.zipName}) ===`);
  } catch (e) {
    log(`ERROR: ${e.message}`);
    process.exitCode = 1;
  }
}

if (ONCE) {
  await runBackup();
} else {
  await runBackup();
  log(`next backup in 7 days (${new Date(Date.now() + WEEK_MS).toISOString()})`);
  setInterval(runBackup, WEEK_MS);
}
