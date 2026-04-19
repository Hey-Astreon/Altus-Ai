@echo off
title Aura — AI Interview Assistant
color 0B

echo.
echo  ============================================
echo   AURA — Stealth AI Interview Assistant
echo  ============================================
echo.

:: Change to the script's own directory so it works from any location
cd /d "%~dp0"

:: Check if node_modules exists, install if missing
if not exist "node_modules" (
    echo  [*] First run detected. Installing dependencies...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo  [!] npm install FAILED. Make sure Node.js ^(v18+^) is installed.
        pause
        exit /b 1
    )
)

:: Build the Electron main process TypeScript
echo  [*] Compiling Electron main process...
call npm run build:electron
if errorlevel 1 (
    echo.
    echo  [!] TypeScript build FAILED. Check the errors above.
    pause
    exit /b 1
)

echo.
echo  [*] Launching Aura...
echo  [*] Use Ctrl+Shift+V to toggle visibility.
echo  [*] Use Ctrl+Shift+Q for emergency quit.
echo.

:: Start the full dev environment (Vite + Electron concurrently)
call npm run start

echo.
echo  Aura has exited.
pause
