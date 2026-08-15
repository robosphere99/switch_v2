@echo off
REM ============================================================
REM RoboSphere v2 - Plesk post-deploy script (Windows / IIS + iisnode)
REM
REM Wire this up in Plesk:  Git -> switch_v2 -> Deployment settings
REM   -> enable "Additional deployment actions" and enter:
REM        site\deploy.cmd
REM
REM What it does: installs the API workspace dependencies.
REM apps/api package.json has  "postinstall": "prisma generate",
REM so the Prisma client is always regenerated to match the
REM committed schema (dist/index.mjs needs @prisma/client at
REM runtime - it is NOT bundled into the esbuild output).
REM ============================================================
cd /d "%~dp0apps\api"
call npm ci
if errorlevel 1 (
  echo [deploy] ERROR: npm ci failed - deployment marked as failed
  exit /b 1
)
echo [deploy] API dependencies installed OK
exit /b 0
