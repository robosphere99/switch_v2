@echo off
title RoboSphere Local API (port 4000)
echo ============================================
echo   RoboSphere Local API  -  port 4000
echo ============================================
echo.

REM ---- working dir: site\apps\api ----
cd /d %~dp0site\apps\api
if errorlevel 1 goto ERR_CD
if not exist dist\index.mjs goto ERR_BUILD

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
node dist\index.mjs
pause
exit /b 0

:ERR_CD
echo [ERROR] site\apps\api nahi mila - is .bat ko repo root me rakho
pause
exit /b 1

:ERR_BUILD
echo [ERROR] dist\index.mjs nahi mila.
echo Pehle build karo:  cd site\apps\api
echo Phir:  npm run build:prod
pause
exit /b 1
