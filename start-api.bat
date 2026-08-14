@echo off
title RoboSphere Local API (port 4000)
echo ============================================
echo   RoboSphere Local API  -  port 4000
echo ============================================
echo.

REM ---- working dir: local API folder (absolute path - kahin se bhi chalao) ----
set API_DIR=C:\\Users\\robos\\OneDrive\\Documents\\onlineswitch-v2\\site\\apps\\api
if not exist "%API_DIR%\\dist\\index.mjs" goto ERR_BUILD
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
echo Starting API on port 4000 ...
echo Board se connect karne ke liye:  http://192.168.1.37:4000
echo Band karne ke liye:  Ctrl+C
echo.
node dist\\index.mjs
pause
exit /b 0

:ERR_CD
echo [ERROR] API folder mila nahi - C:\\Users\\robos\\OneDrive\\Documents\\onlineswitch-v2\\site\\apps\\api
pause
exit /b 1

:ERR_BUILD
echo [ERROR] dist\\index.mjs nahi mila - pehle npm run build:prod karo
pause
exit /b 1
