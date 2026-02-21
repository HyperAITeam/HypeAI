@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title AI CLI Gateway Bot

REM Change to the directory where this batch file is located
cd /d "%~dp0"

echo ================================================
echo   AI CLI Gateway Bot - Starting...
echo ================================================
echo   Working Directory: %CD%
echo ================================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] node_modules not found. Running npm install...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] npm install failed!
        goto :error
    )
)

echo [INFO] Starting bot with tsx...
echo.

call npx tsx src/bot.ts
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo [ERROR] Bot exited with error code: !ERRORLEVEL!
    goto :error
)

goto :end

:error
echo.
echo ================================================
echo   An error occurred! Check the messages above.
echo ================================================
echo.
pause
exit /b 1

:end
echo.
echo [INFO] Bot stopped.
pause
