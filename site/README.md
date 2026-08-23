# RoboSphere v2 — Site Monorepo

Scalable, multi-tenant smart-home IoT platform.
Frontend: **React + Vite + TypeScript**. Backend: **Node.js + Express + TypeScript + Prisma**. Database: **MySQL 8** (kept from v1).

## Structure

```
site/
├── apps/
│   ├── api/          Express API (routes → controllers → services → repositories)
│   └── web/          React SPA (pages, components, features, stores)
├── packages/
│   └── shared/       Shared TypeScript types (User, Home, Device, …)
├── docker-compose.yml
└── .env.example
```

## Local Development

```bash
cp .env.example .env
docker compose up -d mysql     # start MySQL 8
npm install                    # install all workspaces
npm run db:migrate             # apply Prisma migrations
npm run dev:api                # API → http://localhost:4000
npm run dev:web                # Web → http://localhost:5173
```

- API health check: `GET http://localhost:4000/api/health`
- No `.env`? The API falls back to defaults for local dev (root/root @ localhost:3306, db `switch_v2`).

## Device API (ESP32 / hardware) — api_key auth

These endpoints are what the ESP32 firmware (in `../hardware/Robosphere-Dev`) calls.
Authenticate with a **home-scoped API key** (`POST /api/api-keys` with `homeId`, returns `rawKey` once).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/device/read-all?api_key=…` | All devices of the key's home (`data.devices[]`), also marks them alive (`lastSeen`) |
| POST | `/api/device/update` | Physical switch → server (`device_id`, `status`). Sets state + logs, **no** command loop |
| GET | `/api/device/commands?api_key=…` | Pending commands (`data.commands[]` — `{id, deviceId, command: "set_status:on/off"}`) |
| POST | `/api/device/commands/ack` | Confirm execution (`command_id`, `device_id`, `status: executed\|failed`) — idempotent |

**Flow:** web/API toggle → `device_commands` row (`pending`) → ESP32 polls `/commands` → applies to relay → acks → command marked `executed`.

## Domain Model (v2)

- **User** — account (role: `user` / `system_admin`)
- **Home** — the tenant (one per family); user who creates it becomes `owner`
- **HomeMember** — user + home + role (`owner` / `admin` / `member` / `viewer`)
- **Device** — belongs to a **Home** (not a person), has serial number for pairing
- **Invitation** — join a home via email link or invite code
- **Schedule / DeviceCommand / DeviceLog** — timers, command queue, audit
  - *Note:* Device logs and telemetry are captured comprehensively to build historical datasets for upcoming **Machine Learning models** (Automatic On/Off and Smart Automation Suggestions).

## Data Retention & Storage  (Scalability)
To manage infinite scale and massive user data load, the system enforces dynamic data retention policies for uploaded media and logs (configurable via the Admin Panel). 
Avatars and support media attachments are instantly downscaled and compressed via `sharp` and React Native image optimizers to drastically cut bandwidth & storage costs. 

See `../ROADMAP.md` for the full plan.

## Production Deployment (Plesk → onlineswitch.bhartitechnical.com)

The live site is served from the **`main` branch** of `robosphere99/switch_v2`, deployed
automatically by Plesk Git to the `onlineswitch` subdomain:

```
git push origin main  →  GitHub webhook  →  Plesk pulls + deploys  →  site updates
```

- **CI** — `.github/workflows/ci.yml`: `npm ci` + typecheck + tests + build on every push to `main`.
- **CD — Plesk Git settings** (Plesk → Git → `switch_v2` → Deployment settings):
  - Repository: `robosphere99/switch_v2` · Branch: **`main`** · Mode: **Automatic**
  - **Server path: `\onlineswitch.bhartitechnical.com`** (domain root)
  - **Enable additional deployment actions** ✅ → **Deploy actions: `site\deploy.cmd`**
- **Post-deploy actions (`site\deploy.cmd`)** — web.config patch (iisnode recycle + JSON
  PassThrough), Prisma client refresh (fast path: `npx prisma generate`; fresh install:
  `npm install --ignore-scripts`), app pool config dump, deploy marker `site/apps/logs/deploy.json`
  (admin → Diagnostics → "LAST CODE UPDATE" card). Without this a fresh server install fails
  with `ERR_MODULE_NOT_FOUND: @prisma/client`.
- **⚠️ Server path gotcha** — server path ko `\onlineswitch.bhartitechnical.com\site\apps\api`
  jaise sub-path pe mat rakho: repo root wahan dump hota hai → **double-nesting**
  (`site/apps/api/site/apps/api/...`). Symptom: web static files update ho jaati hain par
  **API kabhi nahi** (`dist/index.mjs` + `package.json` purane rehte hain), deploy actions bhi
  galat resolve hote hain. Fix: server path = **domain root**, phir ek deploy trigger karo.
- **Build artifacts are committed** — Plesk shared hosting can't run esbuild
  (Access denied on parent dirs), so `apps/api/dist/` and `apps/web/dist/` are
  committed intentionally (see `site/.gitignore`). Update flow: build locally
  (`npm run build` + `npm run build:prod -w @robosphere/api`) → commit `dist` →
  push `main` → Plesk auto-deploys.
- **Verify** —
  - `GET /api/health` → `data.build` (e.g. `"2.2.0"`) live code version
  - `GET /api/admin/deploy-info` (admin JWT) → `marker.deployedAt` + `sync` status
    (`synced` / `pending` / `lagging` / `unknown` — push live site pe nahi pahuncha
    to panel me amber banner + Redeliver hint; 60s auto-refresh)
  - Commit 3-layer fallback: marker (deploy-time SHA, `source` field) →
    `dist/build-commit.json` (build-time, committed) → GitHub `latest` —
    deploy.json wipe ho jaye to bhi card kabhi blank nahi
  - Server-side diagnosis: Plesk → Node.js → Run script → `diag` (npm script,
    `scripts/diag.cjs` — deploy layout, file lock, git state check)
- **GITHUB_TOKEN (recommended)** — server ke unauthenticated GitHub API calls shared IP pe
  60 req/hr rate-limit hote hain (`ci`/`latest`/marker → `unknown`). Plesk → Node.js →
  Environment variables → `GITHUB_TOKEN` = PAT (repo scope) → Restart. Code token support
  bhejta hai.
- **Lost webhook delivery** — CI green par site purana = delivery lost. Fix: GitHub →
  Settings → Webhooks → Recent Deliveries → **Redeliver**, ya empty-commit push
  (`git commit --allow-empty -m "deploy: re-trigger" && git push origin main`).
