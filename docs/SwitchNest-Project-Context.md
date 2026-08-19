# SwitchNest (RoboSphere v2) — Complete Project Context

> **Purpose of this file:** Give any AI agent / model / collaborator the FULL picture —
> what this project is, what has been built, what was done recently, and what comes
> next — so it can give informed suggestions without needing to re-discover everything.
>
> Repo location (this machine): `C:\Users\robos\OneDrive\Documents\SwitchNest`
>
<!-- AUTO:STAMP:START -->
> _Auto-updated: 2026-08-19 21:08 UTC · branch `main` · tree clean · 242 commits_
<!-- AUTO:STAMP:END -->

---

## 1. Project at a Glance

**SwitchNest** (rebrand of **RoboSphere**; PHP v1 was "onlineswitch") is a self-hosted,
**multi-tenant smart-home IoT platform** — a family buys devices, registers them under a
**Home**, controls them from a web dashboard, and real **ESP32 relay modules** physically
switch the loads.

| Item | Detail |
|---|---|
| What | Web dashboard + REST API + ESP32 hardware (relay control) |
| Stack | React 18 + Vite + TypeScript (web) · Node.js + Express + TS (API) · Prisma + MySQL 8 · Socket.IO (planned) |
| Hardware | ESP32 + relay modules, PlatformIO firmware (`hardware/`) |
| Device model | ESP32 **polls** the server every ~10s; **DB is the source of truth**; server writes `device_commands`, ESP32 executes and mirrors status to relays |
| Auth | JWT (access + refresh rotation) for users; hashed API keys for ESP32/boards |
| Validation | Zod everywhere |
| Tests | Vitest (unit) — API + web |
| Deployment | Local dev on this Windows machine (XAMPP/OneDrive); production on **Plesk shared hosting** (IIS + iisnode) → `onlineswitch.bhartitechnical.com`; GitHub Actions CI; auto-deploy on `main` branch |
| Scale | Monorepo `site/` (api + web + shared packages) + `hardware/` firmware |

---

## 2. Architecture (How It Fits Together)

```
Browser (React SPA :5173)  ──HTTP──▶  Express API (:4000)  ──Prisma──▶  MySQL (switchnest)
                                            │
                                            ▼
                                    device_commands / device_logs
                                            │
ESP32 boards ──poll read-all every 10s──▶   API (api-key auth)  ──▶  relays ON/OFF
```

- **Monorepo layout:**
  ```
  site/
  ├── apps/api/      Express API: routes → controllers → services → repositories
  │   └── src/lib/   logger, prisma, socket, healthMonitor, leakMonitor, envPersist, dbState
  ├── apps/web/      React SPA: pages, components, features, stores, api client
  ├── packages/shared/  Shared TS types (User, Home, Device, …)
  └── .env           Local config (gitignored) — DB_*, ADMIN_*, JWT secrets
  ```
- **Multi-tenant model:** one **Home** per family (the tenant). Roles per member:
  `owner / admin / member / viewer`. **Devices belong to a Home**, not a person.
  Permission checks live in **backend middleware** (`requireRole`), never just the UI.
- **API design:** response envelope `{ success, data, error }`; Zod validation at the edge;
  structured logging (`site/apps/logs/app.log`) + audit trail (`audit_logs`).
- **Scheduler:** background worker ticks every 10s, fires due schedules → writes
  `device_commands` → ESP32 executes → audit log.

---

## 3. What Has Been Built (Phases Done)

Followed the roadmap in `ROADMAP.md`:

- **Phase 0 + 1 — Foundation + Core API (DONE):** monorepo scaffold, Docker Compose, CI;
  Prisma multi-tenant schema (16 tables); auth (signup → auto-create home + owner, login,
  refresh rotation); homes, members, invitations (invite codes), `requireRole` permissions;
  devices CRUD + status; API keys (hashed, scoped).
- **Phase 2 — React Web App (DONE):** landing, login/signup, dashboard (device cards,
  rooms, ONLINE badges, logs, filters), Family page (invite codes, roles, join), Device
  Keys, Homes (create/rename/transfer), Profile, admin links.
- **Phase 3 — Admin Panel (DONE):** platform stats, users (role/delete/suspend), homes
  (suspend/delete), all devices (online status), api-keys, audit log viewer. `audit_logs`
  written on every action.
- **Phase 5 — Timers & Scheduler (DONE):** Schedule CRUD (`once/daily/weekly/cron` +
  custom 5-field cron), 10s background worker, next-run computation, UI verified.
- **Phase 4 — Realtime (DONE):** Socket.IO (auth, per-home rooms, `socket:ready` ack),
  uniform `device:updated` DTO via shared `REALTIME_EVENTS` types (12 emit points
  migrated), web `useRealtime` hook (query invalidate / access-revoked / reconnect
  refresh), polling relaxed to 15s/20s, live <2s toggle updates verified.
- **Phase 6 — Rooms/Notifications/Analytics (PARTIAL):** rooms (grouping + bulk on/off)
  ✅ · offline detection → in-app notifications (boards root-cause, summary) ✅ ·
  **usage analytics** ✅ — `GET /api/homes/:homeId/analytics/usage?days=7|30|90`
  (toggles/day 0-filled, per-device on-time from ON→OFF pairing, per-member activity)
  + Dashboard 📊 Usage modal (div-based bar chart, no new deps) · **email channel ✅**
  (order placed/paid/shipped/delivered + serial keys, warranty submit/status,
  device/board offline+online — SMTP configured ho to, nahi to silent skip) ·
  **offline batching ✅** (power-cut summary: ek tick me ek home ke 2+ events =
  ek summary notification+email, single event pe individual). **Phase 6 COMPLETE.**
- **Ops/infra (DONE along the way):**
  - Install wizard (DB connect → schema → admin account → .env persist)
  - Health Monitor (30s self-check, outage detection, incident history)
  - Diagnostics panel (boot/exit/crash analysis, process status, web.config/iisnode probes)
  - Memory trend chart (RSS + heap time-series, 24h, time ranges, zoom)
  - Leak Monitor (per-process RSS growth detection → incidents file + admin alert)
  - Deploy-info card (last update, commit, CI status badge)
  - GitHub repo backup script (weekly offsite, mirror + source zip + private release)
  - Recurring-503 fixes (DB probe retry loop, safe reboot timing, iisnode recycle probes)

---

## 4. Very Recent Work (last ~30 commits) — context for suggestions

Recent theme: **production hardening + observability** (the site runs on a home server
that also serves real ESP32 hardware).

<!-- AUTO:RECENT_COMMITS:START -->
Sabse naye 20 commits:

- `d51c3cf` (2026-08-20) feat(mobile): Complete Phase 8 Mobile SDK 54 MVP
- `eef9f3d` (2026-08-20) fix(api): rebuild dist bundle to include serial delete routes
- `92562d5` (2026-08-19) chore: rebuild production assets with latest admin features
- `1528aa8` (2026-08-19) feat: pagination for serials table — prev/next + page size selector
- `7c9ddc5` (2026-08-19) feat: admin panel — serials delete + bulk delete + filters + user management
- `356993e` (2026-08-19) chore: rebuild production assets after UI fixes
- `dd05991` (2026-08-19) fix: dashboard mobile layout, device card expand arrow, admin users tab
- `6a4b760` (2026-08-19) fix: grouped navbar + compact device cards + always-visible logout
- `cf1fe81` (2026-08-19) fix: desktop navbar overflow — compact labels, scrollable nav, no cutoff
- `d81a309` (2026-08-19) fix: mobile UI — navbar dropdown, ChatWidget, touch targets, dark mode
- `4e077c9` (2026-08-19) feat: real-time notification bell — auto-update + audio feedback + browser push
- `bc9f958` (2026-08-19) fix: add api_keys.revoked_at auto-migration on boot + defensive try-catch in user api-keys routes
- `c44e522` (2026-08-19) fix: add settle delay after setserver + retry setapname (3 attempts, 15s timeout) to prevent Connection Timeout
- `c6cf4b3` (2026-08-19) fix: use console.error instead of fileLog in api-keys catch to fix ReferenceError
- `b8a5d48` (2026-08-19) fix: remove esbuild from deploy.cmd - dist pre-built and committed, no server rebuild needed
- `6e26b50` (2026-08-19) fix: wrap api-keys endpoint with try-catch fallback to prevent 500
- `0cb8625` (2026-08-19) fix: rewrite deploy.cmd with for-loop output suppression to eliminate error 255
- `4fd82ec` (2026-08-19) fix(deploy): suppress CMD error 255 by redirecting prisma output to nul
- `031aea4` (2026-08-19) fix: remove missing DB columns from Prisma schema + code (loginCount, ledEnabled, shippedAt, deliveredAt, expiryWarnedAt)
- `4d80aef` (2026-08-19) fix(deploy): simplify prisma generate in deploy.cmd
<!-- AUTO:RECENT_COMMITS:END -->

- 503 root-cause work: DB probe retry loop so the app self-heals, `nodeProcessCountPerApplication=1`,
  recycle probes via appcmd/WP events.
- Diagnostics panel + heartbeat logging (every 10s `[hb]` line with ts/uptime/pid/rss/heap).
- Admin memory chart (heap toggle, 1h/6h/24h ranges, drag-zoom) + RSS growth alert badge.
- In-app health checker (30s, incident history), deploy-info + CI badge, backup scripts.

**Today's session (all committed on `main`):**
1. **Leak monitor false-positive fix** — PID 4032 "+27% in 2.9h" alert was a BUG: old
   heartbeat lines (no `ts=`) had timestamps reconstructed as `now - uptime`, which
   inverted the chronological order → a process whose RSS *fell* 76→60 MB was reported
   as +26.7% growth. Fix: only real `ts=` lines participate in detection; boot-adoption
   guard (dead/stale pids can't resurrect incidents); file-level dedup (multiple API
   instances were interleaving duplicate `leak_start/leak_end` entries).
2. **Admin password ↔ .env sync** — when a `system_admin` changes their password via
   Profile, `site/.env` `ADMIN_PASSWORD` is updated automatically (shared
   `lib/envPersist.ts`; install wizard also persists it; `seed.ts`, `start-dev.bat`,
   docs now read from env). Live E2E verified.
3. **Duplicate API instance cleanup** — `fix-api-instances.bat` + `tools/fix-api-instances.ps1`:
   keeps exactly one canonical instance (port 4000 listener + its npm/cmd/tsx parent
   chain), kills stale duplicates tree-wise (CIM tree + Stop-Process; taskkill /T hangs
   on hidden-console processes). `-DryRun` mode included. Live kill-path tested.
4. **TESTING.md** — verification checklist for all the above.

---

## 5. Current State (right now)

- **Local dev running:** API on `:4000`, web on `:5173` (Vite), MySQL (db `switchnest`).
- **Admin login:** `admin@robosphere.local` / `Anil@20552` (also in `site/.env`
  `ADMIN_PASSWORD` — changes auto-sync both ways).
- **Health:** `curl http://localhost:4000/api/health` → `"status":"ok"`.
- **Leak monitor live state:** `leaking: false`, no active incident.
- **ESP32:** one board (COM8, `192.168.1.36`) running v2 firmware, live — web toggle →
  command queue → physical relay verified.
- **Process topology:** exactly one API chain + one web (vite) chain; `fix-api-instances.bat`
  keeps it that way.
- **Git:** `main` branch, working tree clean. Local-only files (gitignored): `site/.env`,
  `site/apps/logs/*`.

---

## 6. Roadmap — What Comes Next

From `ROADMAP.md` (build order — each phase is a working milestone):

1. ~~**Phase 4 — Realtime:** Socket.IO push → polling fallback~~ **DONE** (v1.1 polish
   baaki: admin live devices, "live" indicator dot).
2. ~~**Phase 6 — Rooms, Notifications & Analytics:**~~ **DONE** — rooms + bulk on/off ✅,
   offline → notifications ✅, usage analytics ✅ (Dashboard 📊 Usage), email channel ✅
   (order/warranty/offline+recovery), offline batching ✅ (power-cut summary).
3. **Phase 7 — AI Assist Mode:** natural-language control ("turn off all fans" → confirm →
   execute); suggested automations from usage history; **modular `ai` service** with a
   swappable provider interface (OpenAI / Gemini / local Ollama); chat history in
   `assistant_chats`.
4. **Phase 8 (optional) — Mobile App:** React Native / Expo reusing the same API + shared
   types; push notifications.
5. **Production/migration backlog:** data migration from PHP v1 (`switch` DB → v2, users
   become home owners); ESP32 firmware base-URL switch; cutover + archive PHP repo.

**Open questions awaiting the owner's decision** (great place for an AI to give opinions):
- Express vs NestJS (currently plain Express — suggested to keep)
- Keep 4 roles (owner/admin/member/viewer) or drop viewer?
- Can regular members add devices, or owner/admin only?
- Invites: email link + code, or code only?
- Device serial = ESP32 chip ID/MAC for pairing?
- ESP32 comms: keep polling or move to command-queue push?
- AI provider choice (decide at Phase 7)
- Whether to build the mobile app at all

---

## 7. Key Files an Agent Should Read First

| File | Why |
|---|---|
| `ROADMAP.md` | The plan, phases, open questions |
| `README.md` | Quick start + deploy flow |
| `START_GUIDE.md` | Full local setup (XAMPP, firmware, flasher) |
| `PROJECT_ANALYSIS.md` | Deep analysis of the legacy PHP v1 |
| `TESTING.md` | Verification checklist for recent fixes |
| `docs/DEMO-WALKTHROUGH.md` | Full demo video script — order→flash→OTA, field-by-field (demo video banane ke liye) |
| `docs/FACTORY-FLOW-V2.md` | Factory/order flow v2 spec — payment→flash→sticker→delivery improvements (proposed) |
| `docs/IDEAS-BACKLOG.md` | Suggestions backlog — jo ideas review ke liye accumulate hote hain |
| `docs/PHASE4-REALTIME.md` | Phase 4 (Socket.IO) implementation plan + status |
| `docs/COURIER-TRACKING-PLAN.md` | Shiprocket/DTDC/Bluedart integration plan (AWB/webhook/polling) |
| `site/apps/api/src/index.ts` | App bootstrap: boot, heartbeat, DB init, services |
| `site/apps/api/src/lib/leakMonitor.ts` | Leak detection (recently fixed) |
| `site/apps/api/src/lib/envPersist.ts` | .env write helper (password sync) |
| `site/apps/api/src/lib/healthMonitor.ts` | In-app health checker |
| `site/apps/api/src/routes/admin.routes.ts` | Admin/diagnostics endpoints |
| `site/apps/api/prisma/schema.prisma` | DB schema (single source of truth) |
| `tools/fix-api-instances.ps1` | Duplicate-instance cleanup |
| `site/.env` | Local config (gitignored) — DB, ADMIN_PASSWORD, JWT secrets |

---

## 8. Gotchas / Rules of the Road (important for any AI to know)

- **Code comments are Hinglish** (Hindi + English mix) — a deliberate project culture.
- **Never let the process exit during iisnode startup** (~first 60s) — an exit there =
  IIS rapid-fail → 503 until manual restart. Self-heal reboots are delayed to ≥120s uptime.
- **`nodeProcessCountPerApplication=1`** — must stay 1, otherwise duplicate schedulers /
  leak monitors / health checks run.
- **Multiple API instances** were a real problem (each ~100MB RSS + duplicate monitors) —
  use `fix-api-instances.bat`; `start-api.bat` now refuses to start a second instance.
- **`.env` is gitignored** — passwords/secrets never commit; each machine has its own.
- **Prebuilt `dist/` folders ARE committed** (Plesk can't run esbuild) — build locally →
  commit dist → push.
- **Deploy flow:** work on `dev` (CI only, no deploy) → merge to `main` → webhook →
  Plesk auto-deploy. Plesk deploys `main` only.
- **STRATEGY (owner decision, 2026-08-18):** LOCALHOST-FIRST development — saare
  features pehle local (API :4000 + web :5173 + XAMPP MySQL) pe develop/verify hote
  hain, production domain pe deploy SIRF kisi solid milestone pe hota hai. Production
  DB pe koi schema change abhi apply mat karo bina pooche.
- **Heartbeat log format** (current): `[hb] alive ts=<ISO> uptime=<s> pid=<n> rss=<MB> heap=<MB>`
  — leak monitor and the memory chart depend on the `ts=` field.
- **Logs** live in `site/apps/logs/` (`app.log`, `health-check.jsonl`, `leak-incidents.jsonl`) —
  gitignored, persistent across restarts.

---

## 9. Quick Start (for a fresh checkout)

```bash
cd site
npm install
npm run db:generate      # Prisma client
npm run db:migrate       # tables (if DB empty)
npm run dev:api          # terminal 1 — API :4000
npm run dev:web          # terminal 2 — Web :5173
# browser → http://localhost:5173 · health → curl localhost:4000/api/health
```

Production deploy: merge `dev` → `main` → push (Plesk auto-deploys).

---

*Generated as a context handoff — update this file whenever the roadmap moves.*
