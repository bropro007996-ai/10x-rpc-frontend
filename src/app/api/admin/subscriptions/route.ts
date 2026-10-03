// 10X RPC — /api/admin/subscriptions — list subscriptions with filters + pagination (admin only)
// status filter accepts: active | suspended | expired | cancelled | pending | expiring_soon
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

// Days threshold for the "expiring_soon" pseudo-status
const EXPIRING_SOON_DAYS = 7

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: 'forbidden', message: 'Admin access required' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search')?.trim() || undefined
    const takeRaw = Number(searchParams.get('take') || 20)
    const skipRaw = Number(searchParams.get('skip') || 0)

    const take = Math.min(Math.max(isNaN(takeRaw) ? 20 : takeRaw, 1), 100)
    const skip = Math.max(isNaN(skipRaw) ? 0 : skipRaw, 0)

    const now = new Date()
    const soonThreshold = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000)

    const where: Prisma.SubscriptionWhereInput = {}

    if (status) {
      switch (status) {
        case 'expiring_soon':
          where.status = 'active'
          where.endsAt = { gt: now, lte: soonThreshold }
          break
        case 'suspended':
          // Treat "suspended" as an alias for the stored "cancelled" state
          where.status = { in: ['suspended', 'cancelled'] }
          break
        case 'active':
        case 'expired':
        case 'cancelled':
        case 'pending':
        default:
          where.status = status
          break
      }
    }

    if (search) {
      where.user = {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { discordId: { contains: search, mode: 'insensitive' } },
        ],
      }
    }

    const [subscriptions, total] = await Promise.all([
      db.subscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          user: {
            select: {
              id: true,
              discordId: true,
              username: true,
              avatar: true,
              discriminator: true,
              createdAt: true,
            },
          },
        },
      }),
      db.subscription.count({ where }),
    ])

    return NextResponse.json({
      ok: true,
      total,
      take,
      skip,
      subscriptions: subscriptions.map(s => {
        const msLeft = s.endsAt.getTime() - now.getTime()
        const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)))
        return {
          id: s.id,
          userId: s.userId,
          plan: s.plan,
          status: s.status,
          paymentId: s.paymentId,
          amountPaid: s.amountPaid,
          currency: s.currency,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          daysLeft,
          autoRenew: s.autoRenew,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          user: s.user
            ? {
                id: s.user.id,
                discordId: s.user.discordId,
                username: s.user.username,
                avatar: s.user.avatar,
                discriminator: s.user.discriminator,
                createdAt: s.user.createdAt.toISOString(),
              }
            : null,
        }
      }),
    })
  } catch (e) {
    console.error('admin/subscriptions error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
