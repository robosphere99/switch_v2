@echo off
title SwitchNest Local API (port 4000)
echo ============================================
echo   SwitchNest Local API  -  port 4000
echo ============================================
echo.

REM ---- working dir: is bat ke relative (repo root) - kahin se bhi chalao ----
set "API_DIR=%~dp0site\apps\api"
if not exist "%API_DIR%\dist\index.mjs" goto ERR_BUILD
cd /d "%API_DIR%"
if errorlevel 1 goto ERR_CD

REM ---- MySQL check (XAMPP) - not fatal, sirf warning ----
tasklist /FI "IMAGENAME eq mysqld.exe" 2>nul | find /I "mysqld.exe" >nul
if errorlevel 1 goto WARN_MYSQL
goto START

:WARN_MYSQL
echo [WARN] MySQL (mysqld.exe) nahi chal raha - XAMPP me MySQL Start karo.
echo        Board heartbeat/DB ke liye zaroori hai.
echo.

:START
set PORT=4000
set API_PORT=4000

REM ---- duplicate instance guard: port 4000 pe pehle se listener ho to exit ----
REM      (multiple node processes = multiplied memory + duplicate leak/health monitors)
netstat -ano | findstr ":4000" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo [WARN] Port 4000 pe pehle se API chal raha hai - duplicate instance nahi chalayenge.
    echo        Naya window band ho raha hai (purana instance continue karega).
    echo.
    pause
    exit /b 0
)

echo Starting API on port 4000 ...
echo Health check:  http://localhost:4000/api/health
echo Band karne ke liye:  Ctrl+C
echo.
node dist\index.mjs
pause
exit /b 0

:ERR_CD
echo [ERROR] API folder mila nahi - %API_DIR%
pause
exit /b 1

:ERR_BUILD
echo [ERROR] dist\index.mjs nahi mila.
echo        Pehle production build banao:
echo          cd site ^&^& npm run build -w @robosphere/api
echo        Ya dev mode ke liye start-dev.bat use karo.
pause
exit /b 1
