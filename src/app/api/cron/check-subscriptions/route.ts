// 10X RPC — /api/cron/check-subscriptions — Automated subscription lifecycle
//
// This is the BACKUP safety net. The primary real-time detection happens
// on-demand in `syncSubscriptionState()` (called by getSubscriptionStatus on
// every protected request). This cron ensures that:
//
//   1. Users who never log in still get their subscription suspended/expired.
//   2. Workspace cleanup happens even if no API request triggers it.
//
// The logic is IDEMPOTENT — `syncSubscriptionState()` is safe to call
// repeatedly and only performs transitions on actual state changes.
//
// Lifecycle:
//   ACTIVE / EXPIRING_SOON  ──(endsAt <= now)──►  SUSPENDED  (7-day grace)
//   SUSPENDED               ──(gracePeriodEnd <= now)──►  EXPIRED  (cleanup)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncSubscriptionState } from '@/lib/subscription'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  // Verify CRON_SECRET to prevent unauthorized access.
  // If CRON_SECRET is not set, allow Vercel Cron (which sends its own auth).
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const vercelCronHeader = req.headers.get('x-vercel-cron')
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const results = {
    processed: 0,
    suspended: 0,
    expired: 0,
    errors: [] as string[],
  }

  try {
    // Find ALL subscriptions that might need a state transition.
    // We deliberately over-select (active, expiring_soon, suspended) because
    // syncSubscriptionState is idempotent — calling it on an already-correct
    // row is a no-op.
    const candidates = await db.subscription.findMany({
      where: {
        status: { in: ['active', 'expiring_soon', 'suspended', 'cancelled'] },
      },
      select: { userId: true, status: true, endsAt: true, gracePeriodEnd: true },
    })

    // Also find users who have an expired trial but no Subscription row yet.
    // These need to be folded into the suspension lifecycle.
    const expiredTrials = await db.trial.findMany({
      where: {
        active: true,
        endsAt: { lte: new Date() },
      },
      select: { userId: true },
    })

    const userIds = new Set<string>()
    for (const c of candidates) userIds.add(c.userId)
    for (const t of expiredTrials) userIds.add(t.userId)

    for (const userId of userIds) {
      try {
        const before = await db.subscription.findUnique({
          where: { userId },
          select: { status: true },
        })
        await syncSubscriptionState(userId)
        const after = await db.subscription.findUnique({
          where: { userId },
          select: { status: true },
        })
        results.processed++
        if (before?.status !== 'suspended' && after?.status === 'suspended') {
          results.suspended++
        }
        if (before?.status !== 'expired' && after?.status === 'expired') {
          results.expired++
        }
      } catch (e) {
        results.errors.push(`${userId}: ${e instanceof Error ? e.message : 'unknown'}`)
      }
    }

    const elapsedMs = Date.now() - startedAt
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      elapsedMs,
      results,
    })
  } catch (e) {
    console.error('Cron check-subscriptions error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error', results },
      { status: 500 }
    )
  }
}
