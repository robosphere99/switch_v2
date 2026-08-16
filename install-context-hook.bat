@echo off
setlocal
cd /d "%~dp0"
echo === SwitchNest — context doc auto-update hook install ===
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: node PATH me nahi mila.
  pause
  exit /b 1
)
if not exist ".git\hooks" (
  echo ERROR: .git\hooks folder nahi mila - sahi repo me ho?
  pause
  exit /b 1
)
if not exist "tools\hooks\post-commit" (
  echo ERROR: tools\hooks\post-commit template nahi mila.
  pause
  exit /b 1
)
copy /Y "tools\hooks\post-commit" ".git\hooks\post-commit" >nul
echo.
echo Hook installed: .git\hooks\post-commit
echo Ab har commit ke baad docs\SwitchNest-Project-Context.md khud refresh hoga.
echo.
echo Manual bhi chala sakte ho:   update-context.bat
echo Uninstall: delete .git\hooks\post-commit
pause
