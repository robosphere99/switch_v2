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

REM node_modules npm workspaces ke saath hoisted hoke site\ pe bhi ho sakta hai
REM — dono jagah check karo (apps\api\node_modules ya site\node_modules).
set NODE_MODULES_OK=0
if exist "node_modules\.prisma\client\index.js" if exist "node_modules\express" set NODE_MODULES_OK=1
if not "%NODE_MODULES_OK%"=="1" if exist "..\node_modules\.prisma\client\index.js" if exist "..\node_modules\express" set NODE_MODULES_OK=1

if "%NODE_MODULES_OK%"=="1" (
  echo [deploy] node_modules mila — npm skip, prisma client refresh
  call npx --no-install prisma generate
  if errorlevel 1 (
    echo [deploy] WARN: npx --no-install prisma generate fail — plain npx retry
    call npx prisma generate
  )
  if errorlevel 1 (
    echo [deploy] ERROR: prisma generate failed — purana client chalega
  ) else (
    call :touchSelfHealMarker
  )
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
call :touchSelfHealMarker
echo [deploy] install + generate OK
exit /b 0

REM ============================================================
REM Self-heal marker touch — naye process ko boot-time prisma
REM regenerate + 45s reboot se bachata hai. Best-effort (DB pe
REM depend karta hai — fail ho to deploy chalta rahega).
REM ============================================================
:touchSelfHealMarker
call node -e "require('dotenv').config({ path: '../../.env' }); const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.appMeta.upsert({ where: { key: 'prisma_selfheal_last' }, create: { key: 'prisma_selfheal_last', value: new Date().toISOString() }, update: { value: new Date().toISOString() } }).catch(() => {}).finally(() => p.$disconnect());" 2>nul
if errorlevel 1 echo [deploy] WARN: self-heal marker touch fail (ignore)
exit /b 0
