@echo off
cd /d "%~dp0"
title SwitchNest Weekly Backup
echo === SwitchNest repo backup — har 7 din automatic ===
echo Window khuli rakho (minimize kar sakte ho). Har Sunday wala backup isi se hoga.
echo.
node tools\backup\backup-repo.mjs
pause
