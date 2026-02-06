@echo off
chcp 65001 >nul 2>&1
title AI CLI Gateway Bot - Setup

echo ============================================
echo   AI CLI Gateway Bot - Initial Setup
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed.
    echo Install from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/3] Python OK
python --version

:: Install dependencies
echo.
echo [2/3] Installing dependencies...
pip install -r requirements.txt
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
    python -c "token=input('Enter your Discord bot token: '); uid=input('Enter your Discord user ID: '); f=open('.env','w'); f.write(f'DISCORD_BOT_TOKEN={token}\nALLOWED_USER_IDS={uid}\nCOMMAND_PREFIX=!\nCOMMAND_TIMEOUT=30\nAI_CLI_TIMEOUT=300\nDEFAULT_CLI=claude\n'); f.close(); print('.env file created.')"
)

echo.
echo ============================================
echo   Setup complete. Run start_bot.bat to start.
echo ============================================
pause
