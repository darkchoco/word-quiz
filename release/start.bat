@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js was not found. Please install Node.js 22.13 or later. & pause & exit /b 1)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" || (echo Node.js 22.13 or later is required. Current: & node -v & pause & exit /b 1)
node --disable-warning=ExperimentalWarning server.mjs %*
pause
