# 🚀 onlineswitch-v2 — RoboSphere Rebuild

The fresh, scalable rebuild of **RoboSphere** — a multi-tenant smart-home IoT platform.
Replacing the PHP v1 (`/c/xampp/htdocs/onlineswitch`) with a modern **React + Node.js + TypeScript + MySQL** stack.

## Repository Layout

```
onlineswitch-v2/
├── site/                  ← the whole platform (monorepo: web + api + shared)
├── hardware/              ← ESP32 / PlatformIO firmware (RoboSphere-Dev)
├── PROJECT_ANALYSIS.md    ← deep analysis of the PHP v1 project
├── ROADMAP.md             ← the rebuild plan (multi-tenant homes + admin + timers + AI)
└── README.md
```

## Quick Start (site/)

```bash
cd site
cp .env.example .env
docker compose up -d mysql        # start MySQL 8
npm install                       # install all workspaces
npm run db:migrate                # create tables (Prisma)
npm run dev                       # API on :4000 + web on :5173
```

See [`site/README.md`](./site/README.md) for details.

## Deploy flow (dev → main)

- **`dev`** — development branch. Changes yahan land karti hain, CI (typecheck + build) har push pe chalta hai. **Koi deploy nahi hota.**
- **`main`** — production. `dev` ko `main` me merge karo → webhook → Plesk → auto-deploy to `onlineswitch.bhartitechnical.com`.

```bash
# 1) Kaam dev pe
git checkout dev
git push origin dev            # CI check, koi deploy nahi

# 2) Production pe bhejna ho to main me merge karo
git checkout main
git pull origin main
git merge dev
git push origin main          # → auto-deploy live
```

> Plesk sirf `main` branch pe deploy karta hai — `dev` pushes webhook ko jaati hain par production restart nahi hota.

## Status

- [x] PHP v1 analyzed → `PROJECT_ANALYSIS.md`
- [x] Rebuild roadmap → `ROADMAP.md`
- [x] Repo + Phase 0 scaffold (this repo)
- [ ] Phases 1 → 8 (see ROADMAP.md)
