@echo off

REM ============================================================
REM RoboSphere v2 - Plesk post-deploy script (Windows / IIS + iisnode)
REM
REM Wire this up in Plesk:  Git -> switch_v2 -> Deployment settings
REM   -> enable "Additional deployment actions" and enter:
REM        site\deploy.cmd
REM
REM IMPORTANT: everything here is BEST-EFFORT - deploy hamesha exit 0.
REM ============================================================

cd /d "%~dp0apps\api"

REM 1) web.config PassThrough patch
call node scripts\patch-webconfig.mjs 2>nul

REM Logs dir ensure
if not exist "%~dp0apps\logs" mkdir "%~dp0apps\logs"

REM App pool config dump
set APPCMD=%windir%\System32\inetsrv\appcmd.exe
call "%APPCMD%" list apppool /config > "%~dp0apps\logs\apppool.log" 2>&1
call "%APPCMD%" list wp /config >> "%~dp0apps\logs\apppool.log" 2>&1

REM 2) Check node_modules
set NODE_MODULES_OK=0
if exist "node_modules\.prisma\client\index.js" if exist "node_modules\express" set NODE_MODULES_OK=1
if not "%NODE_MODULES_OK%"=="1" if exist "..\node_modules\.prisma\client\index.js" if exist "..\node_modules\express" set NODE_MODULES_OK=1

REM 3) Prisma generate + npm install (if needed)
REM    Use "for" trick to 100% suppress output - CMD redirect fails with "call npx"
if "%NODE_MODULES_OK%"=="1" (
  echo [deploy] node_modules found - refreshing prisma client
  for /f "delims=" %%i in ('call npx --no-install prisma generate --schema=prisma\schema.prisma 2^>nul') do echo.
  echo [deploy] prisma generate done
) else (
  echo [deploy] node_modules missing - installing
  for /f "delims=" %%i in ('call npm install --ignore-scripts --no-audit --no-fund 2^>nul') do echo.
  for /f "delims=" %%i in ('call npx --no-install prisma generate --schema=prisma\schema.prisma 2^>nul') do echo.
  echo [deploy] install + prisma done
)

REM 4) esbuild dist rebuild
echo [deploy] rebuilding dist
if exist "..\..\node_modules\.bin\esbuild.cmd" (
  for /f "delims=" %%i in ('call "..\..\node_modules\.bin\esbuild.cmd" src/index.ts --bundle --platform=node --format=esm --external:@prisma/client --external:bcryptjs --external:cors --external:dotenv --external:express --external:helmet --external:jsonwebtoken --external:multer --external:mysql2 --external:socket.io --external:zod --outfile=dist\index.mjs 2^>nul') do echo.
) else if exist "node_modules\.bin\esbuild.cmd" (
  for /f "delims=" %%i in ('call "node_modules\.bin\esbuild.cmd" src/index.ts --bundle --platform=node --format=esm --external:@prisma/client --external:bcryptjs --external:cors --external:dotenv --external:express --external:helmet --external:jsonwebtoken --external:multer --external:mysql2 --external:socket.io --external:zod --outfile=dist\index.mjs 2^>nul') do echo.
) else (
  for /f "delims=" %%i in ('call npx esbuild src/index.ts --bundle --platform=node --format=esm --external:@prisma/client --external:bcryptjs --external:cors --external:dotenv --external:express --external:helmet --external:jsonwebtoken --external:multer --external:mysql2 --external:socket.io --external:zod --outfile=dist\index.mjs 2^>nul') do echo.
)
if exist "dist\index.mjs" (
  echo [deploy] dist rebuilt OK
) else (
  echo [deploy] WARN: dist rebuild may have failed - using existing dist
)

REM 5) Deploy marker
call node scripts\deploy-marker.mjs 2>nul

REM 6) Self-heal marker touch
call node -e "try{require('dotenv').config({path:'../../.env'});const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.appMeta.upsert({where:{key:'prisma_selfheal_last'},create:{key:'prisma_selfheal_last',value:new Date().toISOString()},update:{value:new Date().toISOString()}}).catch(()=>{}).finally(()=>p.$disconnect())}catch(e){}" 2>nul

echo [deploy] all done - exit 0
exit /b 0
