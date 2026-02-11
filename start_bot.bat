@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title AI CLI Gateway Bot

if not exist node_modules (
    echo node_modules not found. Running npm install...
    npm install
) else (
    npm ls --depth=0 >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        echo Some packages are missing. Running npm install...
        npm install
    )
)

echo.
echo Starting bot...
npx tsx src/bot.ts
pause
