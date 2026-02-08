@echo off
echo Building aidevelop-bot.exe...
if not exist dist mkdir dist
bun build src/bot.ts --compile --outfile dist/aidevelop-bot.exe --target bun-windows-x64
copy .env.example dist\.env.example
echo.
echo Build complete: dist\aidevelop-bot.exe
echo Run the exe - .env will be created automatically on first run.
