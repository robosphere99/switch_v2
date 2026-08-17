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

REM

REM IMPORTANT: everything here is BEST-EFFORT — deploy hamesha exit 0.

REM   - web.config patch sabse pehle: iisnode web.config change pe node

REM     process recycle karta hai -> naye code ke saath fresh boot. Isi se

REM     API update hota hai (prisma generate DLL-lock ke karan fail bhi ho

REM     jaye, process phir bhi restart hota hai).

REM   - Prisma client refresh fail ho to naya process boot-time self-heal

REM     se regenerate + 45s baad safe reboot karta hai (index.ts selfHeal).

REM ============================================================

cd /d "%~dp0apps\api"

REM 1) web.config PassThrough patch — SABSE PEHLE.

REM    (a) wrong-password/login pe JSON error dikhe (IIS HTML nahi), aur

REM    (b) iisnode web.config change pe node process recycle karta hai —

REM        naye code ke saath fresh boot hota hai. Best-effort: web.config

REM        nahi mila to kuch nahi karta, deploy chalta rahega.

call node scripts\patch-webconfig.mjs 2>nul

REM 1b) App pool config dump — har 60s recycle investigation. App pool

REM     identity ko appcmd read access nahi hota; webhook identity me ho

REM     sakta hai. Best-effort — fail ho to error text hi milta hai.

REM     Logs dir ensure — Plesk deploy untracked files wipe kar sakta hai.

if not exist "%~dp0apps\logs" mkdir "%~dp0apps\logs"

set APPCMD=%windir%\System32\inetsrv\appcmd.exe

call "%APPCMD%" list apppool /config > "%~dp0apps\logs\apppool.log" 2>&1

call "%APPCMD%" list wp /config >> "%~dp0apps\logs\apppool.log" 2>&1

REM node_modules npm workspaces ke saath hoisted hoke site\ pe bhi ho sakta hai

REM — dono jagah check karo (apps\api\node_modules ya site\node_modules).

set NODE_MODULES_OK=0

if exist "node_modules\.prisma\client\index.js" if exist "node_modules\express" set NODE_MODULES_OK=1

if not "%NODE_MODULES_OK%"=="1" if exist "..\node_modules\.prisma\client\index.js" if exist "..\node_modules\express" set NODE_MODULES_OK=1

REM 2) Prisma client refresh — BEST-EFFORT. Chal raha process DLL lock kar

REM    leta hai to EPERM aata hai (normal — recycle ke baad naya process

REM    self-heal karke generate + reboot karta hai). Isliye kabhi exit /b 1

REM    nahi — deploy ko hamesha success maano.

if "%NODE_MODULES_OK%"=="1" (

  echo [deploy] node_modules mila — npm skip, prisma client refresh

  call npx --no-install prisma generate 2>nul

  if errorlevel 1 (

    echo [deploy] WARN: npx --no-install prisma generate fail — plain npx retry

    call npx prisma generate 2>nul

  )

  if errorlevel 1 echo [deploy] WARN: prisma generate fail — self-heal handle karega

) else (

  echo [deploy] node_modules nahi mila — install (Plesk-safe: --ignore-scripts)

  call npm install --ignore-scripts --no-audit --no-fund 2>nul

  if errorlevel 1 echo [deploy] WARN: npm install fail — existing node_modules chalega

  call npx --no-install prisma generate 2>nul

  if errorlevel 1 call npx prisma generate 2>nul

  if errorlevel 1 echo [deploy] WARN: prisma generate fail — self-heal handle karega

)

REM 3) Deploy marker — admin panel me 'last code update' info ke liye.

REM    deploy.json: timestamp + commit + branch (best-effort).

REM    Deployed folder me .git nahi hota (Plesk files copy karta hai) —

REM    isliye commit GitHub API se fetch karta hai (scripts\deploy-marker.mjs).

call node scripts\deploy-marker.mjs 2>nul

call :touchSelfHealMarker

echo [deploy] OK

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
