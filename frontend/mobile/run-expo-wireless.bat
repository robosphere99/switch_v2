@echo off
title SwitchNest Wireless Dev Environment
echo ======================================================
echo    SWITCHNEST WIRELESS DEVELOPER RUNNER
echo ======================================================
echo.
echo Make sure your Backend server is running on port 4000!
echo.
echo Starting tunnel and Expo...
node tunnel-start.js
if %errorlevel% neq 0 (
    echo.
    echo Something went wrong. Make sure Node.js is installed.
    pause
)
