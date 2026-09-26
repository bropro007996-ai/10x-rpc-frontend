// 10X RPC — /api/admin/grant-access — manually grant subscription access (admin only)
// Body: { userId, planId, durationDays, reason }
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: 'forbidden', message: 'Admin access required' }, { status: 403 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      userId?: string
      planId?: string
      durationDays?: number
      reason?: string
    }

    const { userId, planId, durationDays, reason } = body

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ ok: false, error: 'userId is required' }, { status: 400 })
    }
    if (!planId || typeof planId !== 'string') {
      return NextResponse.json({ ok: false, error: 'planId is required' }, { status: 400 })
    }
    const days = Number(durationDays)
    if (!Number.isFinite(days) || days <= 0) {
      return NextResponse.json(
        { ok: false, error: 'durationDays must be a positive number' },
        { status: 400 }
      )
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, discordId: true, username: true },
    })
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 })
    }

    const now = new Date()
    const existing = await db.subscription.findUnique({ where: { userId } })

    // If user is suspended, clear suspension fields and start fresh
    // If user has active subscription, EXTEND from existing end date
    // If user has no subscription, start from now
    let baseDate: Date
    let clearSuspension = false

    if (existing) {
      if (existing.status === 'suspended') {
        // Unsuspend: start from now, clear suspension fields
        baseDate = now
        clearSuspension = true
      } else if (existing.status === 'active' && existing.endsAt > now) {
        // Extend from existing end date
        baseDate = existing.endsAt
      } else {
        // Expired or cancelled — start from now
        baseDate = now
      }
    } else {
      baseDate = now
    }

    const finalEndsAt = new Date(baseDate.getTime() + days * MS_PER_DAY)

    const subData: any = {
      plan: planId,
      status: 'active',
      amountPaid: 0,
      currency: 'inr',
      startsAt: now,
      endsAt: finalEndsAt,
      autoRenew: false,
    }
    if (clearSuspension) {
      subData.suspendedAt = null
      subData.gracePeriodEnd = null
    }

    const sub = await db.subscription.upsert({
      where: { userId },
      create: { userId, ...subData },
      update: subData,
    })

    // If the user was suspended, also reactivate the trial
    if (clearSuspension) {
      const trial = await db.trial.findUnique({ where: { userId } })
      if (trial && !trial.active) {
        await db.trial.update({
          where: { userId },
          data: { active: true, endsAt: finalEndsAt },
        })
      }
    } else {
      // Keep the Trial row in sync so /api/me and the daemon stay consistent
      const trial = await db.trial.findUnique({ where: { userId } })
      if (trial) {
        await db.trial.update({
          where: { userId },
          data: { endsAt: finalEndsAt, active: true },
        })
      } else {
        await db.trial.create({
          data: { userId, endsAt: finalEndsAt, active: true },
        })
      }
    }

    await db.auditLog.create({
      data: {
        action: 'admin_access_grant',
        actor: session.userId,
        target: userId,
        metadata: JSON.stringify({
          username: targetUser.username,
          planId,
          durationDays: days,
          reason: reason || null,
          endsAt: finalEndsAt.toISOString(),
          subscriptionId: sub.id,
        }),
      },
    })

    return NextResponse.json({
      ok: true,
      message: `Granted ${days} day(s) of ${planId} access to ${targetUser.username}${clearSuspension ? ' (unsuspended)' : existing?.status === 'active' && existing.endsAt > now ? ' (extended)' : ''}`,
      subscription: {
        id: sub.id,
        userId: sub.userId,
        plan: sub.plan,
        status: sub.status,
        startsAt: sub.startsAt instanceof Date ? sub.startsAt.toISOString() : String(sub.startsAt),
        endsAt: sub.endsAt instanceof Date ? sub.endsAt.toISOString() : String(sub.endsAt),
        suspendedAt: sub.suspendedAt ? (sub.suspendedAt instanceof Date ? sub.suspendedAt.toISOString() : String(sub.suspendedAt)) : null,
        gracePeriodEnd: sub.gracePeriodEnd ? (sub.gracePeriodEnd instanceof Date ? sub.gracePeriodEnd.toISOString() : String(sub.gracePeriodEnd)) : null,
      },
      user: {
        id: targetUser.id,
        discordId: targetUser.discordId,
        username: targetUser.username,
      },
    })
  } catch (e) {
    console.error('admin/grant-access error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
