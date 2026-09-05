@echo off
cd /d "%~dp0"
echo === SwitchNest API - duplicate instances cleanup ===
echo.
REM Dry-run ke liye:  fix-api-instances.bat -DryRun
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\fix-api-instances.ps1" %*
echo.
pause
