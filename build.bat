@echo off
echo ========================================
echo   Building aidevelop-bot.exe (pkg)
echo ========================================
echo.

if not exist dist mkdir dist

echo [1/3] Bundling with esbuild...
call node scripts/build.mjs
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: esbuild failed
    exit /b 1
)

echo.
echo [2/3] Creating exe with pkg...
call npx pkg dist/bot.cjs --targets node18-win-x64 --output dist/aidevelop-bot.exe
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: pkg failed
    exit /b 1
)

echo.
echo [3/3] Copying additional files...
if exist node_modules\@anthropic-ai\claude-agent-sdk\cli.js (
    copy /Y node_modules\@anthropic-ai\claude-agent-sdk\cli.js dist\cli.js >nul
    echo Copied: cli.js
)
copy /Y .env.example dist\.env.example >nul
echo Copied: .env.example

echo.
echo ========================================
echo   Build complete!
echo ========================================
echo.
echo Output:
echo   dist\aidevelop-bot.exe
echo   dist\cli.js
echo   dist\.env.example
echo.
echo Run the exe - .env will be created automatically on first run.
