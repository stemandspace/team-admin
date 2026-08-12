#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../packages/db"
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
echo Done.
