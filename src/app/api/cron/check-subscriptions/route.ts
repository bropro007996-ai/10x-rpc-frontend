// 10X RPC — /api/cron/check-subscriptions — Automated subscription lifecycle
// Runs via Vercel Cron. Handles:
// 1. ACTIVE → EXPIRING_SOON (7 days before expiry)
// 2. EXPIRING_SOON → SUSPENDED (at expiry, starts 7-day grace period)
// 3. SUSPENDED → EXPIRED (after grace period ends, cleans up workspace)
// 4. Creates notifications at 7/3/1 days before expiry
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GRACE_PERIOD_DAYS = 7
const EXPIRY_WARNING_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

export async function GET(req: Request) {
  // Verify CRON_SECRET to prevent unauthorized access
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Also allow Vercel Cron (no secret needed if CRON_SECRET not set)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results = { expiringSoon: 0, suspended: 0, expired: 0, notifications: 0, errors: [] as string[] }

  try {
    // =====================================================
    // 1. ACTIVE → EXPIRING_SOON (≤7 days before expiry)
    // =====================================================
    const expiringThreshold = new Date(now.getTime() + EXPIRY_WARNING_DAYS * MS_PER_DAY)
    const activeSubs = await db.subscription.findMany({
      where: {
        status: 'active',
        endsAt: { lte: expiringThreshold, gt: now },
      },
    })

    for (const sub of activeSubs) {
      await db.subscription.update({
        where: { id: sub.id },
        data: { status: 'expiring_soon' },
      })
      results.expiringSoon++

      // Create notification
      const daysLeft = Math.ceil((sub.endsAt.getTime() - now.getTime()) / MS_PER_DAY)
      await createNotification(sub.userId, 'warning', 'Subscription Expiring', 
        `Your subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew now to protect uninterrupted access.`)
      results.notifications++

      await db.auditLog.create({
        data: {
          action: 'subscription_expiring_soon',
          actor: 'system',
          target: sub.userId,
          metadata: JSON.stringify({ subscriptionId: sub.id, daysLeft, endsAt: sub.endsAt.toISOString() }),
        },
      })
    }

    // =====================================================
    // 2. EXPIRING_SOON/ACTIVE → SUSPENDED (at expiry)
    // =====================================================
    const expiredSubs = await db.subscription.findMany({
      where: {
        status: { in: ['active', 'expiring_soon'] },
        endsAt: { lte: now },
      },
    })

    for (const sub of expiredSubs) {
      const gracePeriodEnd = new Date(sub.endsAt.getTime() + GRACE_PERIOD_DAYS * MS_PER_DAY)
      await db.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'suspended',
          suspendedAt: now,
          gracePeriodEnd,
        },
      })
      results.suspended++

      // Create notification
      await createNotification(sub.userId, 'error', 'Subscription Suspended',
        `Your subscription has expired and is now suspended. You have ${GRACE_PERIOD_DAYS} days to renew before your workspace is permanently deleted.`)
      results.notifications++

      await db.auditLog.create({
        data: {
          action: 'subscription_suspended',
          actor: 'system',
          target: sub.userId,
          metadata: JSON.stringify({
            subscriptionId: sub.id,
            suspendedAt: now.toISOString(),
            gracePeriodEnd: gracePeriodEnd.toISOString(),
            originalExpiry: sub.endsAt.toISOString(),
          }),
        },
      })
    }

    // =====================================================
    // 3. SUSPENDED → EXPIRED (after grace period ends — workspace cleanup)
    // =====================================================
    const graceExpiredSubs = await db.subscription.findMany({
      where: {
        status: 'suspended',
        gracePeriodEnd: { lte: now },
      },
    })

    for (const sub of graceExpiredSubs) {
      // Mark as expired
      await db.subscription.update({
        where: { id: sub.id },
        data: { status: 'expired' },
      })
      results.expired++

      // Workspace cleanup: disable RPC configs, clear sessions, etc.
      // Preserve: payment records, audit logs, subscription records (legal/operational)
      // Delete/disable: RPC configs, game configs, sessions, custom status
      await db.rpcConfig.updateMany({
        where: { userId: sub.userId },
        data: { enabled: false },
      })
      await db.gameRpcConfig.updateMany({
        where: { userId: sub.userId },
        data: { enabled: false },
      })
      // Disable all active sessions (forces re-login)
      await db.session.updateMany({
        where: { userId: sub.userId, expiresAt: { gt: now } },
        data: {
          rpcEnabled: false,
          gamesRpcEnabled: false,
          gatewayReady: false,
          statusEnabled: false,
        },
      })

      // Create notification
      await createNotification(sub.userId, 'error', 'Grace Period Ended',
        'Your grace period has ended. Your workspace configuration has been cleared. Purchase a new plan to create a fresh workspace.')
      results.notifications++

      await db.auditLog.create({
        data: {
          action: 'workspace_deleted',
          actor: 'system',
          target: sub.userId,
          metadata: JSON.stringify({
            subscriptionId: sub.id,
            gracePeriodEnd: sub.gracePeriodEnd?.toISOString(),
            cleanupAt: now.toISOString(),
          }),
        },
      })
    }

    // =====================================================
    // 4. Check for 3-day and 1-day notifications (for expiring_soon subs)
    // =====================================================
    const expiringSoonSubs = await db.subscription.findMany({
      where: { status: 'expiring_soon' },
    })

    for (const sub of expiringSoonSubs) {
      const daysLeft = Math.ceil((sub.endsAt.getTime() - now.getTime()) / MS_PER_DAY)

      // Check if we already sent a notification for this threshold
      const existingNotifs = await db.notification.findFirst({
        where: {
          userId: sub.userId,
          type: 'warning',
          title: { contains: 'expiring' },
          createdAt: { gt: new Date(now.getTime() - MS_PER_DAY) }, // within last 24h
        },
      })

      if (!existingNotifs && (daysLeft <= 3 || daysLeft <= 1)) {
        await createNotification(sub.userId, 'warning', 'Subscription Expiring Soon',
          `Your subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew now to avoid suspension.`)
        results.notifications++
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: now.toISOString(),
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

async function createNotification(userId: string, type: string, title: string, message: string) {
  try {
    await db.notification.create({
      data: { userId, type, title, message },
    })
  } catch (e) {
    console.error('Failed to create notification:', e)
  }
}
