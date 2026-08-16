@echo off
REM ============================================================
REM SwitchNest Health Report — monitor logs ka summary
REM Saare logs (tools/health-checker/logs/health-*.jsonl) padhke
REM uptime %, outages, latency stats print karta hai.
REM ============================================================
title SwitchNest Health Report
cd /d "%~dp0tools\health-checker"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js nahi mila — https://nodejs.org se install karo
  pause
  exit /b 1
)
node health-checker.mjs --report %*
echo.
pause
