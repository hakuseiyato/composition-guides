@echo off
rem Composition Guides installer entry point (double-click to run).
rem Runs install.ps1 with Windows PowerShell 5.1, which every Windows has.
rem -ExecutionPolicy Bypass avoids the block caused by the Mark-of-the-Web on files extracted from a ZIP.
rem Arguments are passed through as-is, e.g.: install.cmd -Target il,ppro
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
set "CG_EXIT=%ERRORLEVEL%"
echo.
pause
exit /b %CG_EXIT%
