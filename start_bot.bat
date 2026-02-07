@echo off
chcp 65001 >nul 2>&1
title AI CLI Gateway Bot

if not exist .env (
    echo .env file not found. Run setup.bat first.
    pause
    exit /b 1
)

if not exist node_modules (
    echo node_modules not found. Running npm install...
    npm install
)

echo.
npx tsx src/bot.ts
pause
