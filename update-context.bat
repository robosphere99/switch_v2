@echo off
cd /d "%~dp0"
echo === SwitchNest - context doc refresh ===
node tools\update-context.mjs
echo.
pause
