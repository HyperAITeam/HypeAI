@echo off
chcp 65001 >nul 2>&1
title AI CLI Gateway Bot

if not exist .env (
    echo .env file not found. Run setup.bat first.
    pause
    exit /b 1
)

echo.
python bot.py
pause
