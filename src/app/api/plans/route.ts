// 10X RPC — /api/plans — Dynamic subscription plan CRUD + public listing
// All pricing is computed server-side via calculatePlanPricing().
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'
import { calculatePlanPricing, validatePlanOfferFields } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

interface PlanInput {
  name?: string
  slug?: string
  priceInr?: number
  originalPriceInr?: number | null
  offerPriceInr?: number | null
  offerEnabled?: boolean
  offerTag?: string | null
  offerText?: string | null
  offerStartsAt?: string | null
  offerEndsAt?: string | null
  durationDays?: number
  durationUnit?: string
  description?: string
  features?: string[]
  isActive?: boolean
  isVisible?: boolean
  isArchived?: boolean
  isPopular?: boolean
  isRecommended?: boolean
  badge?: string | null
  displayOrder?: number
}

// Serialize a plan for the API response — always includes computed pricing
function serializePlan(p: any) {
  const pricing = calculatePlanPricing(p)
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    // Raw DB fields (for admin editing)
    priceInr: p.priceInr,
    originalPriceInr: p.originalPriceInr ?? null,
    offerPriceInr: p.offerPriceInr ?? null,
    offerEnabled: p.offerEnabled ?? false,
    offerTag: p.offerTag ?? null,
    offerText: p.offerText ?? null,
    offerStartsAt: p.offerStartsAt ? p.offerStartsAt.toISOString() : null,
    offerEndsAt: p.offerEndsAt ? p.offerEndsAt.toISOString() : null,
    // Plan config
    durationDays: p.durationDays,
    durationUnit: p.durationUnit ?? 'days',
    description: p.description,
    features: JSON.parse(p.features || '[]'),
    // State
    isActive: p.isActive,
    isVisible: p.isVisible ?? true,
    isArchived: p.isArchived,
    isPopular: p.isPopular,
    isRecommended: p.isRecommended ?? false,
    badge: p.badge,
    displayOrder: p.displayOrder,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    // Computed pricing — what the frontend displays
    pricing,
    // Convenience fields for display
    effectivePriceInr: pricing.effectivePriceInr,
    effectivePriceDisplay: `₹${(pricing.effectivePriceInr / 100).toFixed(0)}`,
    originalPriceDisplay: pricing.originalPriceInr
      ? `₹${(pricing.originalPriceInr / 100).toFixed(0)}`
      : null,
    discountPercent: pricing.discountPercent,
    offerActive: pricing.offerActive,
  }
}

// GET — public: list active, non-archived plans (sorted by displayOrder)
// GET ?all=true — admin: list ALL plans (including inactive + archived)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === 'true'

  if (all) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const plans = await db.plan.findMany({
    where: all ? {} : { isActive: true, isVisible: true, isArchived: false },
    orderBy: { displayOrder: 'asc' },
  })
  return NextResponse.json({ ok: true, plans: plans.map(serializePlan) })
}

// POST — admin: create plan
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as PlanInput

  // Validate required fields
  if (!body.name || !body.slug || body.priceInr === undefined || !body.durationDays) {
    return NextResponse.json(
      { ok: false, error: 'name, slug, priceInr, durationDays are required' },
      { status: 400 }
    )
  }

  // Validate offer fields
  const errors = validatePlanOfferFields(body)
  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors.join('; ') }, { status: 400 })
  }

  // Check slug uniqueness
  const existing = await db.plan.findUnique({ where: { slug: body.slug } })
  if (existing) {
    return NextResponse.json({ ok: false, error: 'slug already in use' }, { status: 409 })
  }

  // Build data object — only set fields that are provided
  const data: any = {
    name: body.name,
    slug: body.slug,
    priceInr: Math.round(body.priceInr),
    durationDays: body.durationDays,
    features: JSON.stringify(body.features || []),
    isActive: body.isActive ?? true,
    isVisible: body.isVisible ?? true,
    isArchived: body.isArchived ?? false,
    isPopular: body.isPopular ?? false,
    isRecommended: body.isRecommended ?? false,
    offerEnabled: body.offerEnabled ?? false,
    displayOrder: body.displayOrder ?? 0,
  }
  if (body.durationUnit !== undefined) data.durationUnit = body.durationUnit
  if (body.description !== undefined) data.description = body.description || null
  if (body.badge !== undefined) data.badge = body.badge || null
  if (body.originalPriceInr !== undefined) data.originalPriceInr = body.originalPriceInr ?? null
  if (body.offerPriceInr !== undefined) data.offerPriceInr = body.offerPriceInr ?? null
  if (body.offerTag !== undefined) data.offerTag = body.offerTag || null
  if (body.offerText !== undefined) data.offerText = body.offerText || null
  if (body.offerStartsAt !== undefined && body.offerStartsAt) {
    const d = new Date(body.offerStartsAt)
    if (!isNaN(d.getTime())) data.offerStartsAt = d
  }
  if (body.offerEndsAt !== undefined && body.offerEndsAt) {
    const d = new Date(body.offerEndsAt)
    if (!isNaN(d.getTime())) data.offerEndsAt = d
  }

  const plan = await db.plan.create({ data })

  await db.auditLog.create({
    data: {
      action: 'plan_created',
      target: plan.id,
      actor: session.userId,
      metadata: JSON.stringify({ name: plan.name, slug: plan.slug, priceInr: plan.priceInr }),
    },
  })

  return NextResponse.json({ ok: true, plan: serializePlan(plan) })
}

// PUT — admin: update plan (existing subscribers are NOT affected)
export async function PUT(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as PlanInput & { id: string }
  if (!body.id) return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 })

  const existing = await db.plan.findUnique({ where: { id: body.id } })
  if (!existing) return NextResponse.json({ ok: false, error: 'plan not found' }, { status: 404 })

  // Validate offer fields
  const errors = validatePlanOfferFields(body)
  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors.join('; ') }, { status: 400 })
  }

  const data: any = {}
  if (body.name !== undefined) data.name = body.name
  if (body.slug !== undefined) {
    // Check slug uniqueness if changing
    if (body.slug !== existing.slug) {
      const slugConflict = await db.plan.findUnique({ where: { slug: body.slug } })
      if (slugConflict) return NextResponse.json({ ok: false, error: 'slug already in use' }, { status: 409 })
    }
    data.slug = body.slug
  }
  if (body.priceInr !== undefined) data.priceInr = Math.round(body.priceInr)
  if (body.durationDays !== undefined) data.durationDays = body.durationDays
  if (body.durationUnit !== undefined) data.durationUnit = body.durationUnit
  if (body.description !== undefined) data.description = body.description || null
  if (body.features !== undefined) data.features = JSON.stringify(body.features)
  if (body.isActive !== undefined) data.isActive = body.isActive
  if (body.isVisible !== undefined) data.isVisible = body.isVisible
  if (body.isArchived !== undefined) data.isArchived = body.isArchived
  if (body.isPopular !== undefined) data.isPopular = body.isPopular
  if (body.isRecommended !== undefined) data.isRecommended = body.isRecommended
  if (body.offerEnabled !== undefined) data.offerEnabled = body.offerEnabled
  if (body.badge !== undefined) data.badge = body.badge || null
  if (body.originalPriceInr !== undefined) data.originalPriceInr = body.originalPriceInr ?? null
  if (body.offerPriceInr !== undefined) data.offerPriceInr = body.offerPriceInr ?? null
  if (body.offerTag !== undefined) data.offerTag = body.offerTag || null
  if (body.offerText !== undefined) data.offerText = body.offerText || null
  if (body.offerStartsAt !== undefined) {
    data.offerStartsAt = body.offerStartsAt ? new Date(body.offerStartsAt) : null
  }
  if (body.offerEndsAt !== undefined) {
    data.offerEndsAt = body.offerEndsAt ? new Date(body.offerEndsAt) : null
  }
  if (body.displayOrder !== undefined) data.displayOrder = body.displayOrder

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: 'no fields to update' }, { status: 400 })
  }

  // IMPORTANT: This only updates the Plan record.
  // Existing Subscription records are NOT touched — they keep their original amountPaid/endsAt.
  const plan = await db.plan.update({ where: { id: body.id }, data })

  await db.auditLog.create({
    data: {
      action: 'plan_changed',
      target: plan.id,
      actor: session.userId,
      metadata: JSON.stringify({ ...data, _note: 'Existing subscribers NOT affected' }),
    },
  })

  return NextResponse.json({ ok: true, plan: serializePlan(plan) })
}

// DELETE — admin: soft-delete (archive) a plan, preserving data
// A hard delete would break existing subscription references — we archive instead.
export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const hard = searchParams.get('hard') === 'true'
  if (!id) return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 })

  const existing = await db.plan.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ ok: false, error: 'plan not found' }, { status: 404 })

  // Check if any subscriptions reference this plan
  const subscriberCount = await db.subscription.count({ where: { plan: id } })

  if (hard && subscriberCount === 0) {
    // Hard delete only allowed if no subscribers reference this plan
    await db.plan.delete({ where: { id } })
    await db.auditLog.create({
      data: { action: 'plan_hard_deleted', target: id, actor: session.userId },
    })
    return NextResponse.json({ ok: true, deleted: true })
  }

  // Default: soft delete (archive) — preserves data + subscriber references
  const plan = await db.plan.update({
    where: { id },
    data: { isArchived: true, isActive: false },
  })

  await db.auditLog.create({
    data: {
      action: 'plan_archived',
      target: id,
      actor: session.userId,
      metadata: JSON.stringify({ name: plan.name, subscriberCount }),
    },
  })

  return NextResponse.json({ ok: true, archived: true, plan: serializePlan(plan) })
}
