@echo off
REM ============================================================
REM RoboSphere v2 - Plesk post-deploy script (Windows / IIS + iisnode)
REM
REM Wire this up in Plesk:  Git -> switch_v2 -> Deployment settings
REM   -> enable "Additional deployment actions" and enter:
REM        site\deploy.cmd
REM
REM Strategy (Plesk shared hosting safe):
REM   Fast path (normal) — node_modules already on the server:
REM     skip npm completely (deploys are instant, nothing can wipe
REM     node_modules), just refresh the Prisma client.
REM   Fresh install — node_modules missing:
REM     npm install --ignore-scripts --no-audit --no-fund
REM     (plain `npm ci` FAILS on Plesk — esbuild's postinstall gets
REM     "Access denied on parent dirs", and a failed npm ci DELETES
REM     node_modules killing the site. --ignore-scripts avoids it.)
REM     then npx prisma generate to rebuild @prisma/client.
REM ============================================================
cd /d "%~dp0apps\api"

set NODE_MODULES_OK=0
if exist "node_modules\.prisma\client\index.js" if exist "node_modules\express" set NODE_MODULES_OK=1

if "%NODE_MODULES_OK%"=="1" (
  echo [deploy] node_modules mila — npm skip, prisma client refresh
  call npx --no-install prisma generate
  if errorlevel 1 echo [deploy] WARN: prisma generate failed (purana client chalega)
  echo [deploy] OK
  exit /b 0
)

echo [deploy] node_modules nahi mila — install (Plesk-safe: --ignore-scripts)
call npm install --ignore-scripts --no-audit --no-fund
if errorlevel 1 (
  echo [deploy] ERROR: npm install failed — node_modules incomplete, site 500 dega
  exit /b 1
)
call npx --no-install prisma generate
if errorlevel 1 (
  echo [deploy] ERROR: prisma generate failed
  exit /b 1
)
echo [deploy] install + generate OK
exit /b 0
