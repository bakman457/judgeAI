@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-judge-ai.ps1"
if errorlevel 1 (
  echo.
  echo Judge AI failed to start.
)
pause
