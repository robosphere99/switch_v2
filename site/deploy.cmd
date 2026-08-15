@echo off
REM ============================================================
REM RoboSphere v2 - Plesk post-deploy script (Windows / IIS + iisnode)
REM
REM Wire this up in Plesk (verified applied 16-Aug):  Git -> switch_v2 -> Deployment settings
REM   -> enable "Additional deployment actions" and enter:
REM        site\deploy.cmd
REM
REM IMPORTANT: plain `npm ci` FAILS on Plesk shared hosting —
REM esbuild's postinstall gets "Access denied on parent dirs", and a
REM failed npm ci DELETES node_modules (killing the site). So we:
REM   1. npm ci --ignore-scripts   (installs deps, skips ALL postinstalls)
REM   2. npx prisma generate       (regenerates @prisma/client from the
REM      committed schema — does NOT touch esbuild)
REM ============================================================
cd /d "%~dp0apps\api"

call npm ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 (
  echo [deploy] ERROR: npm ci failed - node_modules missing, site will 500
  exit /b 1
)

call npx prisma generate
if errorlevel 1 (
  echo [deploy] ERROR: prisma generate failed
  exit /b 1
)

echo [deploy] API dependencies installed + Prisma client regenerated OK
exit /b 0
