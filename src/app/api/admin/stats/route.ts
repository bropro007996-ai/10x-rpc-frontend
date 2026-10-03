// 10X RPC — /api/admin/stats — aggregate stats for admin dashboard
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const now = new Date()

  const [totalUsers, activeSubs, allSubs, trialUsers, expiredSubs, dbPlans] = await Promise.all([
    db.user.count(),
    db.subscription.count({ where: { status: 'active', endsAt: { gt: now } } }),
    db.subscription.findMany({ where: { status: 'active', endsAt: { gt: now } }, select: { plan: true, amountPaid: true } }),
    db.trial.count({ where: { active: true, endsAt: { gt: now } } }),
    db.subscription.count({ where: { status: { in: ['expired', 'cancelled'] } } }),
    db.plan.findMany({ where: { isArchived: false }, orderBy: { displayOrder: 'asc' } }),
  ])

  const planBreakdown: Record<string, number> = {}
  let totalRevenue = 0
  for (const sub of allSubs) {
    planBreakdown[sub.plan] = (planBreakdown[sub.plan] || 0) + 1
    totalRevenue += sub.amountPaid || 0
  }
  // Add trial count
  planBreakdown['trial'] = trialUsers

  return NextResponse.json({
    ok: true,
    stats: {
      totalUsers,
      activeSubscriptions: activeSubs,
      totalRevenue,
      trialUsers,
      expiredSubs,
      planBreakdown,
      plans: dbPlans.map(p => ({
        id: p.id,
        name: p.name,
        priceInr: p.priceInr,
        durationDays: p.durationDays,
      })),
    },
  })
}
