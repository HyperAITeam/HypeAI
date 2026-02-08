@echo off
chcp 65001 >nul 2>&1
title AI CLI Gateway Bot - Setup

echo ============================================
echo   AI CLI Gateway Bot - Initial Setup
echo ============================================
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed.
    echo Install from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/2] Node.js OK
node --version

:: Install dependencies
echo.
echo [2/2] Installing dependencies...
npm install
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo Dependencies installed.

echo.
echo ============================================
echo   Setup complete. Run start_bot.bat to start.
echo   (.env is auto-created on first run)
echo ============================================
pause
