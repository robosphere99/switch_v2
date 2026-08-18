@echo off
title RoboSphere Flasher (Latest)
rem ============================================================
rem  HAMESHA repo wala flasher chalta hai (hamesha latest).
rem  Purane exe builds (Downloads me RoboSphere-Flasher*.exe) se
rem  update karne ki zaroorat nahi — repo update hote hi naya code.
rem ============================================================
setlocal
set "REPO=C:\Users\robos\OneDrive\Documents\SwitchNest\tools\flasher"

if not exist "%REPO%\flasher_gui.py" (
  echo [ERROR] Repo file nahi mila: %REPO%\flasher_gui.py
  echo Repo location badal gayi? Is .bat me REPO line update karo.
  pause
  exit /b 1
)

set "PYCMD="
where pythonw >nul 2>nul && set "PYCMD=pythonw"
if not defined PYCMD where python >nul 2>nul && set "PYCMD=python"
if not defined PYCMD where py >nul 2>nul && set "PYCMD=py"
if not defined PYCMD (
  echo [ERROR] Python nahi mila — https://python.org se install karo
  pause
  exit /b 1
)

cd /d "%REPO%"
start "" "%PYCMD%" flasher_gui.py
endlocal
