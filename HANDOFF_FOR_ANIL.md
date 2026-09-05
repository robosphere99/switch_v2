# 📋 SwitchNest – Handoff Notes for Anil

> **Written:** 2026-09-06, ~3:30 AM IST  
> **Author:** Antigravity (AI assistant)  
> **For:** Anil – continuing where the user left off  

---

## 🧠 What This Project Is

**SwitchNest** is a **home-automation platform** (similar to SmartThings).

- **Backend:** Node.js + Express + Prisma ORM → `backend/api/`
- **Frontend:** Web app (React/Next.js)
- **Hardware:** ESP32 boards that control smart devices (lights, switches, etc.)
- **Integrations:** Google Home, Alexa (OAuth 2.0)
- **Database:** Currently MySQL → **being migrated to Neon PostgreSQL**
- **Deployment target:** Vercel (both frontend and backend)

---

## ✅ What Has Been Done (Don't Redo This)

### 1. Backend Architecture Refactor – DONE ✅

The entire backend was refactored to properly separate:
- **Routes** (`backend/api/src/routes/`) — only define endpoints, connect to controllers
- **Controllers** (`backend/api/src/controllers/`) — handle request/response logic
- **Services** (`backend/api/src/services/`) — all business logic + DB queries

**Files refactored:**

| Route File | Controller File | Status |
|---|---|---|
| `admin.routes.ts` | `admin.controller.ts` | ✅ Done |
| `auth.routes.ts` | `auth.controller.ts` | ✅ Done |
| `device.routes.ts` | `device.controller.ts` | ✅ Done |
| `deviceApi.routes.ts` | `deviceApi.controller.ts` | ✅ Done |
| `google.routes.ts` | `google.controller.ts` | ✅ Done |
| `oauth.routes.ts` | `oauth.controller.ts` | ✅ Done |
| `alexa.routes.ts` | `alexa.controller.ts` | ✅ Done |
| `docs.routes.ts` | `docs.controller.ts` | ✅ Done |
| `webhook.routes.ts` | `webhook.controller.ts` | ✅ Done |

- `npx tsc --noEmit` → **0 errors** ✅
- Everything committed and pushed to GitHub (`main` branch) ✅
- `ARCHITECTURE.md` created at `backend/api/ARCHITECTURE.md` ✅

---

## ❌ What Still Needs To Be Done (Anil's Work)

### TASK 1 – Install Vercel CLI

The `vercel` command is not installed. Run this first:

```powershell
npm install -g vercel
vercel --version   # verify it works
```

---

### TASK 2 – Create a Neon PostgreSQL Database

1. Go to **https://neon.tech** → Sign up / Log in
2. Create a new **Project** → name it `switchnest-prod`
3. Go to **Connection Details** and copy the Connection String:
   ```
   postgresql://user:password@host.neon.tech/dbname?sslmode=require
   ```
4. **Save this string** — needed in next steps

---

### TASK 3 – Migrate MySQL → Neon PostgreSQL

**Step 3a** – Change Prisma provider in `backend/api/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"   // change from "mysql"
  url      = env("DATABASE_URL")
}
```

**Step 3b** – Update `.env` at the repo root:

```env
DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"
```

**Step 3c** – Run migration:

```powershell
cd "C:\Users\robos\OneDrive\Documents\SwitchNest\backend\api"
npx prisma migrate dev --name init_postgres
```

**Step 3d** – Import existing MySQL data (if needed):

```bash
pgloader mysql://mysql_user:mysql_pass@localhost/switchnest_db \
          postgresql://neon_user:neon_pass@host.neon.tech/dbname
```

---

### TASK 4 – Set Up ALL Environment Variables

#### Local `.env` file (at repo root)

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:pass@host.neon.tech/dbname?sslmode=require"

# Auth
JWT_SECRET="a-very-long-random-string-at-least-32-chars"

# Server
PORT=3000
NODE_ENV=production

# Frontend API URL
NEXT_PUBLIC_API_URL="https://YOUR-BACKEND.vercel.app/api"

# Email (if app sends emails)
MAIL_HOST="smtp.gmail.com"
MAIL_PORT=587
MAIL_USER="your-email@gmail.com"
MAIL_PASS="your-app-password"
```

#### Vercel Dashboard

1. Go to https://vercel.com → Your project → **Settings → Environment Variables**
2. Add ALL the same variables as above
3. Set them for **Production**, **Preview**, and **Development**

---

### TASK 5 – Configure Express for Vercel

Create: `backend/api/api/index.ts`

```typescript
import { createServer } from "http";
import { app } from "../src/app";

const server = createServer(app);
export default (req: any, res: any) => {
  server.emit("request", req, res);
};
```

Create/update `vercel.json` at the **repo root**:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.ts" }
  ]
}
```

---

### TASK 6 – Deploy to Vercel

```powershell
cd "C:\Users\robos\OneDrive\Documents\SwitchNest"

# First time setup
vercel link

# Deploy to production
vercel --prod
```

---

### TASK 7 – Verify Everything Works

1. Open the deployed frontend URL
2. Log in / register
3. Try a device operation
4. Check Vercel **Functions** tab for logs
5. Check Neon dashboard for DB rows

---

### TASK 8 – MCP Setup (Optional, Lower Priority)

```powershell
# MUST run from repo ROOT (not backend/api)
cd "C:\Users\robos\OneDrive\Documents\SwitchNest"
npx -y add-mcp https://mcp.vercel.com
```

If it says "0 agents detected", create `.agents/agents.json` manually:

```json
{
  "$schema": "https://mcp.vercel.com/schemas/agents.json",
  "name": "switch-nest",
  "description": "SwitchNest home-automation backend + frontend",
  "version": "1.0.0",
  "agents": [
    {
      "name": "backend",
      "type": "node",
      "entrypoint": "backend/api/src/server.ts",
      "workingDirectory": "backend/api",
      "environment": {
        "DATABASE_URL": "${env:DATABASE_URL}",
        "JWT_SECRET": "${env:JWT_SECRET}"
      },
      "ports": [{ "port": 3000, "protocol": "http" }]
    }
  ]
}
```

Then: `git add .agents && git commit -m "Add MCP manifest" && git push`

---

## 📂 Important File Locations

| File | Purpose |
|------|---------|
| `backend/api/prisma/schema.prisma` | DB schema — change `provider` to postgresql |
| `backend/api/src/app.ts` | Express app — imports all routes |
| `backend/api/src/routes/` | Route files — endpoints only |
| `backend/api/src/controllers/` | Controller files |
| `backend/api/src/services/` | Business logic |
| `backend/api/ARCHITECTURE.md` | Full architecture docs |
| `.env` | Local env vars |
| `vercel.json` | Vercel config |

---

## ⚠️ Critical Rules (Never Break These)

1. **NEVER commit `web.config`** — Plesk generates this. It's in `.gitignore`. Don't touch it.
2. **Always run `npx tsc --noEmit`** after code changes to verify 0 TypeScript errors.
3. **Express 5 wildcards** — Don't use `"/api/*"`. Use `"/api"` (without wildcard).
4. **localStorage** — Always use the `safeStorage` utility, never access `localStorage` directly.
5. **Routes must NOT contain** DB queries or business logic. Only: middleware + controller calls.

---

## 🚀 Quick Start Commands Summary

```powershell
# 1. Install Vercel CLI
npm install -g vercel

# 2. Update .env with Neon PostgreSQL DATABASE_URL

# 3. Change schema.prisma provider to "postgresql"

# 4. Run migration
cd "C:\Users\robos\OneDrive\Documents\SwitchNest\backend\api"
npx prisma migrate dev --name init_postgres

# 5. Type-check (must be 0 errors)
npx tsc --noEmit

# 6. Deploy
cd "C:\Users\robos\OneDrive\Documents\SwitchNest"
vercel link
vercel --prod
```

---

## 💬 Notes from the User

- He's been working late (3:30 AM)
- The big backend refactor is done and pushed — clean codebase
- Only pending: DB migration to Neon + Vercel deployment setup

---

*Good luck, Anil! The hard part is already done. Just deployment setup remains. 🙌*
