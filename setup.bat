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

echo [1/3] Node.js OK
node --version

:: Install dependencies
echo.
echo [2/3] Installing dependencies...
npm install
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo Dependencies installed.

:: Create .env if not exists
echo.
if exist .env (
    echo [3/3] .env already exists. Skipping.
) else (
    echo [3/3] Creating .env file...
    set /p TOKEN="Enter your Discord bot token: "
    set /p UID="Enter your Discord user ID: "
    (
        echo DISCORD_BOT_TOKEN=%TOKEN%
        echo ALLOWED_USER_IDS=%UID%
        echo COMMAND_PREFIX=!
        echo COMMAND_TIMEOUT=30
        echo AI_CLI_TIMEOUT=300
    ) > .env
    echo .env file created.
)

echo.
echo ============================================
echo   Setup complete. Run start_bot.bat to start.
echo ============================================
pause
