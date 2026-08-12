@echo off
REM Run from repo root when Railway Postgres is reachable
cd /d %~dp0packages\db
call npx prisma generate
call npx prisma db push
call npx tsx prisma/seed.ts
echo Done.
