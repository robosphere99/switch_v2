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

## Quick Start (fresh environment — pehli baar)

> Repo location (this machine): `C:\Users\robos\OneDrive\Documents\SwitchNest`
> Puri step-by-step guide: **[`START_GUIDE.md`](./START_GUIDE.md)**

```bash
cd site
npm install            # install all workspaces (monorepo: web + api + shared)
npm run db:generate    # Prisma client (schema se)
npm run db:migrate     # create tables (agar DB empty ho)

npm run dev:api        # terminal 1 — API on :4000
npm run dev:web        # terminal 2 — Web on :5173
```

- Browser: **http://localhost:5173** · Health: `curl http://localhost:4000/api/health`
- `.env` me `DB_NAME=switchnest` set hai — app `switchnest` DB use karta hai (`switch_v2` backup ke roop me safe hai)
- Hardware (PlatformIO) + Flasher (Python GUI) ke steps ke liye `START_GUIDE.md` dekho

See [`site/README.md`](./site/README.md) for platform details.

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
