# Preview run doc — SwitchNest

## Artifacts (reproduce on a fresh worktree)

- This workspace **is** the main checkout (`C:\Users\robos\OneDrive\Documents\SwitchNest`), so nothing needs copying. On a fresh worktree, copy `site/.env` from the main checkout (contains `DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME`; no `DATABASE_URL` — `site/apps/api/src/config/env.ts` builds it from the `DB_*` vars at runtime).
- Dependencies: `cd site && npm install` (monorepo workspaces; already installed here).
- Prisma client: already generated under `site/node_modules/.prisma`. Regenerate after schema changes: `cd site/apps/api && npx prisma generate`.
- MySQL (XAMPP, port 3306) must be running — the app connects to db `switchnest` at `localhost:3306`.

## Run (two dev servers — web needs the API)

- API: `cd site && npm run dev:api` → listens on `http://localhost:4000` (tsx watch; scheduler + offline watcher start).
- Web: `cd site && npm run dev:web` → listens on `http://localhost:5173` (Vite dev server; `/api` and `/socket.io` proxied to `:4000`).
- Preview registers the web URL `http://localhost:5173`.
- Both servers: PowerShell `Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev:api'|'dev:web' -WorkingDirectory '<repo>\site'` with stdout/stderr to separate files.
