@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\.bin\prisma.cmd" (
  echo Dependencies are missing. Run: corepack pnpm install
  exit /b 1
)

call node_modules\.bin\prisma.cmd generate
if errorlevel 1 exit /b %errorlevel%

sqlite3 prisma\dev.db ".read prisma/migrations/20260703000000_init/migration.sql"
if errorlevel 1 exit /b %errorlevel%

echo Database is ready.
