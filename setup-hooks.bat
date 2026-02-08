@echo off
REM ============================================================
REM Setup Git Hooks / Git 훅 설정
REM ============================================================
echo Setting up git hooks...

REM Configure git to use .husky folder for hooks
git config core.hooksPath .husky

echo.
echo ✅ Git hooks installed successfully!
echo    Pre-commit hook will now block .env commits.
echo.
echo ✅ Git 훅이 설치되었습니다!
echo    이제 .env 커밋 시도시 자동으로 차단됩니다.
echo.
pause
