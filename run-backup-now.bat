@echo off
cd /d "%~dp0"
echo === SwitchNest repo backup (one-shot) ===
node tools\backup\backup-repo.mjs --once
echo.
echo Backup done. Log: tools\backup\logs\backup.log
pause
