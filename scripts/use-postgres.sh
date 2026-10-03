#!/usr/bin/env bash
# Switch the Prisma schema from SQLite (sandbox/demo) to PostgreSQL (Neon, production).
# Run this before deploying to Vercel / Render. Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="prisma/schema.prod.prisma"
DST="prisma/schema.prisma"
BAK="prisma/schema.sqlite.bak"

if [ ! -f "$SRC" ]; then
  echo "❌ $SRC not found"; exit 1
fi

# Back up the current SQLite schema the first time
if [ ! -f "$BAK" ] && grep -q 'provider = "sqlite"' "$DST" 2>/dev/null; then
  cp "$DST" "$BAK"
  echo "📦 Backed up SQLite schema to $BAK"
fi

cp "$SRC" "$DST"
echo "✅ Prisma schema switched to PostgreSQL (Neon)."
echo "   Next steps:"
echo "     1. Set DATABASE_URL (pooled) + DATABASE_URL_UNPOOLED in your Vercel + Render env."
echo "     2. Run: bun run db:push   (to create tables in Neon)"
echo "     3. Deploy."
echo ""
echo "   To revert to SQLite for local sandbox: bash scripts/use-sqlite.sh"
