@echo off
title Altus AI Platinum — Stealth AI Interview Assistant
color 0A

echo.
echo  ================================================================
echo    █████╗ ██╗  ████████╗██╗   ██╗███████╗     █████╗ ██╗
echo   ██╔══██╗██║  ╚══██╔══╝██║   ██║██╔════╝    ██╔══██╗██║
echo   ███████║██║     ██║   ██║   ██║███████╗    ███████║██║
echo   ██╔══██║██║     ██║   ██║   ██║╚════██║    ██╔══██║██║
echo   ██║  ██║███████╗██║   ╚██████╔╝███████║    ██║  ██║██║
echo   ╚═╝  ╚═╝╚══════╝╚═╝    ╚═════╝ ╚══════╝    ╚═╝  ╚═╝╚═╝
echo.
echo   [ ELITE EDITION v3.0.0 ]  --  Autonomous Mode: ONLINE
echo  ================================================================
echo.

:: Always navigate to the folder where this .bat file lives
cd /d "%~dp0"

:: Kill any leftover Electron or Node ghost processes from prior sessions
echo  [*] Clearing prior session ghosts...
taskkill /F /IM electron.exe /T >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Verify Node.js is installed
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [!] ERROR: Node.js is not installed or not in PATH.
    echo  [!] Download from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b 1
)

:: Install dependencies if missing
if not exist "node_modules" (
    echo  [*] First run detected. Installing dependencies...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo  [!] npm install FAILED. Check your internet connection.
        pause
        exit /b 1
    )
    echo.
)

:: Compile the Electron TypeScript layer
echo  [*] Compiling Electron V3.0 Core...
call npm run build:electron
if errorlevel 1 (
    echo.
    echo  [!] TypeScript build FAILED. Check the errors above.
    echo.
)

echo.
echo  [*] All systems nominal. Igniting Altus AI Platinum...
echo  [*] The UI will appear in 5-10 seconds. Stay ghost.
echo.
echo  ----------------------------------------------------------------
echo    Press Ctrl+C in this window to SHUT DOWN Altus AI fully.
echo  ----------------------------------------------------------------
echo.

:: Launch in Dev Mode (stable, no Phantom relay complications)
call npm run start

echo.
echo  ================================================================
echo    Altus AI has exited cleanly. Ghost protocol terminated.
echo  ================================================================
echo.
pause
