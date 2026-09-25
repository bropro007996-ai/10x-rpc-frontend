// 10X RPC — /api/subscription/status — get user's subscription status + active plans
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getSubscriptionStatus } from '@/lib/subscription'
import { db } from '@/lib/db'
import { calculatePlanPricing } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  const status = await getSubscriptionStatus(session.userId)

  // Fetch active plans from DB (dynamic)
  const dbPlans = await db.plan.findMany({
    where: { isActive: true, isArchived: false },
    orderBy: { displayOrder: 'asc' },
  })

  const plans = dbPlans.map(p => {
    const pricing = calculatePlanPricing(p)
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      durationDays: p.durationDays,
      features: JSON.parse(p.features || '[]'),
      isPopular: p.isPopular,
      badge: p.badge,
      description: p.description,
      effectivePriceInr: pricing.effectivePriceInr,
      effectivePriceDisplay: `₹${(pricing.effectivePriceInr / 100).toFixed(0)}`,
      originalPriceDisplay: pricing.originalPriceInr
        ? `₹${(pricing.originalPriceInr / 100).toFixed(0)}`
        : null,
      discountPercent: pricing.discountPercent,
      offerActive: pricing.offerActive,
      offerTag: pricing.offerTag,
      offerText: pricing.offerText,
    }
  })

  return NextResponse.json({ ok: true, status, plans })
}
