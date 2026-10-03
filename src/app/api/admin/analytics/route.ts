// 10X RPC — /api/admin/analytics — time-series analytics for charts (admin only)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const daysRaw = Number(searchParams.get('days') || 30)
    const days = Math.min(Math.max(isNaN(daysRaw) ? 30 : daysRaw, 1), 90)

    const now = new Date()
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    // Build the list of day buckets
    const buckets: { date: string; signups: number; revenue: number; payments: number; notifications: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      buckets.push({ date: dayKey(d), signups: 0, revenue: 0, payments: 0, notifications: 0 })
    }
    const bucketMap = new Map(buckets.map(b => [b.date, b]))

    // Fetch users created in the range
    const users = await db.user.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
    })
    for (const u of users) {
      const key = dayKey(u.createdAt)
      const b = bucketMap.get(key)
      if (b) b.signups++
    }

    // Fetch verified payments in range
    const payments = await db.payment.findMany({
      where: {
        createdAt: { gte: startDate },
        status: { in: ['verified', 'captured'] },
      },
      select: { amount: true, currency: true, createdAt: true },
    })
    for (const p of payments) {
      const key = dayKey(p.createdAt)
      const b = bucketMap.get(key)
      if (b) {
        b.revenue += p.amount
        b.payments++
      }
    }

    // Fetch notifications sent in range
    const notifications = await db.notification.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
    })
    for (const n of notifications) {
      const key = dayKey(n.createdAt)
      const b = bucketMap.get(key)
      if (b) b.notifications++
    }

    // Plan distribution (all-time)
    const planBreakdown = await db.subscription.groupBy({
      by: ['plan'],
      _count: { _all: true },
    })

    // Subscription status distribution
    const subStatusBreakdown = await db.subscription.groupBy({
      by: ['status'],
      _count: { _all: true },
    })

    // Top recent users (last 10)
    const recentUsers = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        username: true,
        discordId: true,
        avatar: true,
        createdAt: true,
      },
    })

    // Top payments by amount (last 5)
    const topPayments = await db.payment.findMany({
      where: { status: { in: ['verified', 'captured'] } },
      orderBy: { amount: 'desc' },
      take: 5,
      include: {
        user: {
          select: { id: true, username: true, discordId: true, avatar: true },
        },
      },
    })

    // Summary totals
    const totalUsers = await db.user.count()
    const totalPayments = await db.payment.count({
      where: { status: { in: ['verified', 'captured'] } },
    })
    const totalRevenue = await db.payment.aggregate({
      where: { status: { in: ['verified', 'captured'] } },
      _sum: { amount: true },
    })
    const totalSubs = await db.subscription.count()
    const activeSubs = await db.subscription.count({ where: { status: 'active' } })

    return NextResponse.json({
      ok: true,
      days,
      timeSeries: buckets,
      planBreakdown: planBreakdown.map(p => ({ plan: p.plan, count: p._count._all })),
      subStatusBreakdown: subStatusBreakdown.map(s => ({ status: s.status, count: s._count._all })),
      recentUsers: recentUsers.map(u => ({
        id: u.id,
        username: u.username,
        discordId: u.discordId,
        avatar: u.avatar,
        createdAt: u.createdAt.toISOString(),
      })),
      topPayments: topPayments.map(p => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        planName: p.planName,
        createdAt: p.createdAt.toISOString(),
        user: p.user
          ? {
              id: p.user.id,
              username: p.user.username,
              discordId: p.user.discordId,
              avatar: p.user.avatar,
            }
          : null,
      })),
      summary: {
        totalUsers,
        totalPayments,
        totalRevenue: totalRevenue._sum.amount || 0,
        totalSubs,
        activeSubs,
      },
    })
  } catch (e) {
    console.error('admin/analytics error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
