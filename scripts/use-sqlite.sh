#!/usr/bin/env bash
# Revert the Prisma schema back to SQLite (sandbox/demo mode).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f prisma/schema.sqlite.bak ]; then
  cp prisma/schema.sqlite.bak prisma/schema.prisma
  echo "✅ Reverted to SQLite (from prisma/schema.sqlite.bak)."
else
  echo "⚠️  No prisma/schema.sqlite.bak found. Manually set provider to \"sqlite\" in prisma/schema.prisma"
fi
