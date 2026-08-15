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

See `../ROADMAP.md` for the full plan.

## Production Deployment (Plesk → onlineswitch.bhartitechnical.com)

The live site is served from the **`main` branch** of `robosphere99/switch_v2`, deployed
automatically by Plesk Git to the `onlineswitch` subdomain:

```
git push origin main  →  GitHub webhook  →  Plesk pulls + deploys  →  site updates
```

- **CI** — `.github/workflows/ci.yml`: `npm ci` + typecheck + build on every push to `main`.
- **CD** — Plesk Git: repo `switch_v2`, branch `main`, mode **Automatic**,
  server path `onlineswitch.bhartitechnical.com`.
- **Post-deploy commands** — Plesk → Git → `switch_v2` → Deployment settings →
  **Additional deployment actions** should run `site\deploy.cmd` (installs the API
  workspace; `postinstall` regenerates the Prisma client). Without this, a fresh
  server install fails with `ERR_MODULE_NOT_FOUND: @prisma/client`.
- **Build artifacts are committed** — Plesk shared hosting can't run esbuild
  (Access denied on parent dirs), so `apps/api/dist/` and `apps/web/dist/` are
  committed intentionally (see `site/.gitignore`). Update flow: build locally
  (`npm run build` + `npm run build:prod -w @robosphere/api`) → commit `dist` →
  push `main` → Plesk auto-deploys.
- **Verify** — `GET /api/health` on the live domain.
