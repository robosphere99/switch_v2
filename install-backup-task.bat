@echo off
setlocal
cd /d "%~dp0"
echo === SwitchNest backup — Windows Task Scheduler install ===
for /f "delims=" %%i in ('where node') do set "NODE=%%i"
if not defined NODE (
  echo ERROR: node PATH me nahi mila.
  pause
  exit /b 1
)
schtasks /Create /TN "SwitchNest Repo Backup" /TR "\"%NODE%\" \"%~dp0tools\backup\backup-repo.mjs\" --once" /SC WEEKLY /D SUN /ST 03:00 /IT /F
echo.
echo Task installed: har Sunday 3:00 AM pe backup chalega (login pe).
echo Test karo:  schtasks /Run /TN "SwitchNest Repo Backup"
echo Delete:     schtasks /Delete /TN "SwitchNest Repo Backup" /F
pause
