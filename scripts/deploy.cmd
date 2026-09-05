@echo off

REM ============================================================
REM RoboSphere v2 - Plesk post-deploy script
REM dist/index.mjs is pre-built and committed. This script only
REM refreshes the Prisma client and touches markers.
REM ============================================================

cd /d "%~dp0..\backend\api"

REM 1) web.config PassThrough patch
call node scripts\patch-webconfig.mjs 2>nul

REM Logs dir ensure
if not exist "%~dp0..\logs" mkdir "%~dp0..\logs"

REM App pool config dump
set APPCMD=%windir%\System32\inetsrv\appcmd.exe
call "%APPCMD%" list apppool /config > "%~dp0..\logs\apppool.log" 2>&1
call "%APPCMD%" list wp /config >> "%~dp0..\logs\apppool.log" 2>&1

REM 2) Check node_modules
set NODE_MODULES_OK=0
if exist "node_modules\.prisma\client\index.js" if exist "node_modules\express" set NODE_MODULES_OK=1
if not "%NODE_MODULES_OK%"=="1" if exist "..\node_modules\.prisma\client\index.js" if exist "..\node_modules\express" set NODE_MODULES_OK=1

REM 3) Prisma generate via node script (avoids CMD npx redirect issue)
if "%NODE_MODULES_OK%"=="1" (
  echo [deploy] prisma refresh
  call node -e "try{require('child_process').execSync('npx --no-install prisma generate --schema=prisma/schema.prisma',{stdio:'ignore',timeout:30000})}catch(e){}" 2>nul
  echo [deploy] prisma done
) else (
  echo [deploy] node_modules missing - install
  call npm install --ignore-scripts --no-audit --no-fund 2>nul
  call node -e "try{require('child_process').execSync('npx --no-install prisma generate --schema=prisma/schema.prisma',{stdio:'ignore',timeout:30000})}catch(e){}" 2>nul
  echo [deploy] install + prisma done
)

REM 4) Dist check
if exist "dist\index.mjs" (
  echo [deploy] dist present
) else (
  echo [deploy] WARN: dist missing
)

REM 5) Deploy marker
call node scripts\deploy-marker.mjs 2>nul

REM 6) Self-heal marker
call node -e "try{require('dotenv').config({path:'../../.env'});const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.appMeta.upsert({where:{key:'prisma_selfheal_last'},create:{key:'prisma_selfheal_last',value:new Date().toISOString()},update:{value:new Date().toISOString()}}).catch(()=>{}).finally(()=>p.$disconnect())}catch(e){}" 2>nul

echo [deploy] done
exit /b 0
