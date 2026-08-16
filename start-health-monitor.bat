@echo off
REM ============================================================
REM SwitchNest Production Health Monitor — launcher
REM Is window ko khula rakho — har 30s check hota rahega,
REM outages log hote rahenge (tools/health-checker/logs/).
REM 2 hafte baad health-report.bat chala ke report dekho.
REM ============================================================
title SwitchNest Health Monitor
cd /d "%~dp0tools\health-checker"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js nahi mila — https://nodejs.org se install karo
  pause
  exit /b 1
)
echo Health monitor start ho raha hai — is window ko band mat karna!
echo Har 30s check hoga, outage pe fast-poll (5s) + recovery log.
echo Report ke liye: health-report.bat
echo.
node health-checker.mjs
echo.
echo Monitor ruk gaya — koi error aaya ho to upar dekho.
pause
