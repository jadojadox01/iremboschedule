@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\.bin\next.cmd" (
  echo Dependencies are missing. Run: corepack pnpm install
  exit /b 1
)

node scripts\devWithWorker.js
