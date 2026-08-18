@echo off
REM ============================================================
REM  SwitchNest — Windows Deploy Restart (Plesk)
REM  Webhook trigger pe: git pull + npm install + restart
REM ============================================================
setlocal

set "APP_DIR=C:\Inetpub\vhosts\bhartitechnical.com\onlineswitch.bhartitechnical.com"

cd /d "%APP_DIR%"
echo [%date% %time%] Deploy triggered

REM 1. Git pull
echo Pulling latest code...
git pull origin main

REM 2. Install deps
echo Installing dependencies...
if exist "package-lock.json" (
  call npm ci --production 2>nul
) else (
  call npm install --production 2>nul
)

REM 3. Prisma generate
echo Generating Prisma client...
cd /d "%APP_DIR%\site\apps\api"
call npx prisma generate --schema=prisma\schema.prisma 2>nul
cd /d "%APP_DIR%"

REM 4. Restart app
echo Restarting app...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq switchnest*" 2>nul
timeout /t 2 /nobreak >nul

REM 5. Start API server
echo Starting API server...
cd /d "%APP_DIR%\site\apps\api"
start "switchnest-api" /min cmd /c "npx tsx src/index.ts"
cd /d "%APP_DIR%"

echo [%date% %time%] Deploy complete
endlocal
