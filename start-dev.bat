@echo off
title SwitchNest - Dev Launcher
color 0B
echo ================================================
echo    SwitchNest - Dev Environment Launcher
echo ================================================
echo.

set "ROOT=%~dp0"
set "SITE=%ROOT%site"
set "MYSQLD=C:\xampp\mysql\bin\mysqld.exe"
set "MY_INI=C:\xampp\mysql\bin\my.ini"

REM ---------- 0) First-run setup (fresh user) ----------
if exist "%SITE%\node_modules" goto deps_ok
echo [0/4] Pehli baar setup - npm install ho raha hai...
echo        (is me 1-2 minute lag sakte hain)
cd /d "%SITE%"
call npm install
if errorlevel 1 goto fail_install
:deps_ok

if exist "%SITE%\node_modules\.prisma\client" goto prisma_ok
echo [0/4] Prisma client generate ho raha hai...
cd /d "%SITE%"
call npm run db:generate
if errorlevel 1 goto fail_prisma
:prisma_ok

REM ---------- 1) MySQL check ----------
echo [1/4] MySQL check...
netstat -ano | findstr ":3306" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 goto mysql_ok
if not exist "%MYSQLD%" goto mysql_missing
echo        MySQL band hai - start kar raha hoon...
start "SwitchNest MySQL" /min "%MYSQLD%" --defaults-file="%MY_INI%"
echo        MySQL ready hone ka wait (10s)...
%SystemRoot%\System32\timeout.exe /t 10 /nobreak >nul
netstat -ano | findstr ":3306" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 goto mysql_ok
echo.
echo    MySQL start nahi hua - XAMPP Control Panel kholo aur MySQL Start karo.
pause
exit /b 1
:mysql_missing
echo.
echo    MySQL binary nahi mili: %MYSQLD%
echo    XAMPP Control Panel kholo -^> MySQL -^> Start, phir is script ko dobara chalao.
pause
exit /b 1
:mysql_ok
echo        MySQL ready - OK

REM ---------- 2) API server (port 4000) ----------
echo [2/4] API server (port 4000)...
netstat -ano | findstr ":4000" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 goto api_ok
start "SwitchNest API" /D "%SITE%" cmd /k "npm run dev:api"
echo        API window khul gayi
goto api_done
:api_ok
echo        API pehle se chal raha hai - naya window nahi kholega
:api_done

REM ---------- 3) Web server (port 5173) ----------
echo [3/4] Web server (port 5173)...
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 goto web_ok
start "SwitchNest Web" /D "%SITE%" cmd /k "npm run dev:web"
echo        Web window khul gayi
goto web_done
:web_ok
echo        Web pehle se chal raha hai - naya window nahi kholega
:web_done

REM ---------- 4) Browser ----------
echo [4/4] Browser khol raha hoon...
%SystemRoot%\System32\timeout.exe /t 5 /nobreak >nul
start http://localhost:5173

echo.
echo ================================================
echo    Sab ready!
echo      Site:    http://localhost:5173
echo      API:     http://localhost:4000/api/health

REM ---- login hint: .env (ADMIN_PASSWORD) se asli password - change ho to yahan bhi sahi dikhe ----
set "ADMIN_PW=admin123"
if exist "%SITE%\.env" (
  for /f "usebackq tokens=1,* delims==" %%a in ("%SITE%\.env") do (
    if /i "%%a"=="ADMIN_PASSWORD" set "ADMIN_PW=%%b"
  )
)
set "ADMIN_PW=%ADMIN_PW:"=%"

echo      Login:   admin@robosphere.local / %ADMIN_PW%
echo.
echo    Band karne ke liye API/Web windows close karo.
echo ================================================
echo.
pause
exit /b 0

:fail_install
echo.
echo    npm install FAIL - error dekho aur dobara try karo.
pause
exit /b 1

:fail_prisma
echo.
echo    prisma generate FAIL - error dekho aur dobara try karo.
pause
exit /b 1
