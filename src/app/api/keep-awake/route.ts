// 10X RPC — /api/keep-awake — keep-alive endpoint (pinged by Vercel Cron daily)
// Keeps Neon Postgres warm to avoid free-tier cold starts (Neon suspends compute
// after ~5 min of inactivity). Previously this also pinged an external Render
// backend daemon; that backend has been removed — the Next.js app now owns the
// RPC daemon in-process.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

export async function GET() {
  const results: Record<string, unknown> = {}

  // Neon DB keep-alive — lightweight query
  const dbStart = Date.now()
  try {
    await db.session.count({ where: { expiresAt: { gt: new Date() } } })
    results.database = { ok: true, ms: Date.now() - dbStart }
  } catch (e) {
    results.database = { ok: false, ms: Date.now() - dbStart, error: e instanceof Error ? e.message.slice(0, 80) : 'failed' }
  }

  return NextResponse.json({
    ok: true,
    awake: true,
    timestamp: new Date().toISOString(),
    results,
  })
}
