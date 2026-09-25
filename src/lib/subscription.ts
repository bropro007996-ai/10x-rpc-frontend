// 10X RPC — Subscription status + plan activation (DB-driven, no hardcoded plans)
import { db } from './db'
import Razorpay from 'razorpay'

// Razorpay client (initialized lazily — only when payment routes are called)
let razorpayInstance: Razorpay | null = null
export function getRazorpay(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) return null
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret })
  }
  return razorpayInstance
}

export const RAZORPAY_ENABLED = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)

// Legacy interface — kept for backward compatibility with existing code.
// New code should read plans from /api/plans (which queries the DB).
export interface PlanInfo {
  id: string
  name: string
  price: number
  period: string
  durationDays: number
  features: string[]
  badge?: string
  highlighted?: boolean
}

/**
 * Fetch a plan from the database by slug or id.
 * Replaces the old hardcoded getPlan() function.
 */
export async function getPlan(planIdOrSlug: string): Promise<{
  id: string
  name: string
  slug: string
  priceInr: number
  durationDays: number
  features: string[]
} | null> {
  const plan = await db.plan.findFirst({
    where: {
      OR: [{ id: planIdOrSlug }, { slug: planIdOrSlug }],
      isActive: true,
      isArchived: false,
    },
  })
  if (!plan) return null
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    priceInr: plan.priceInr,
    durationDays: plan.durationDays,
    features: JSON.parse(plan.features || '[]'),
  }
}

export interface SubscriptionStatus {
  active: boolean
  plan: string
  planName: string
  endsAt: string | null
  daysLeft: number
  isTrial: boolean
  isLifetime: boolean
  autoRenew: boolean
}

/**
 * 30-day one-time free trial.
 * Backend-controlled — trial state lives in the DB, not localStorage.
 * Once a trial expires, it CANNOT be re-used (the Trial row remains in the DB
 * with active=false, blocking future trial creation).
 */
export async function startTrial(userId: string): Promise<{ ok: boolean; message: string; endsAt?: string }> {
  const TRIAL_DAYS = 30
  const now = new Date()
  const endsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

  // Check if a trial already exists for this user (one-time enforcement)
  const existing = await db.trial.findUnique({ where: { userId } })
  if (existing) {
    if (existing.active && existing.endsAt > now) {
      return {
        ok: false,
        message: 'Trial already active',
        endsAt: existing.endsAt.toISOString(),
      }
    }
    // Trial exists but expired — DO NOT allow re-activation
    return {
      ok: false,
      message: 'Trial already used. Please choose a subscription plan to continue.',
    }
  }

  // Create the trial — first time only
  await db.trial.create({
    data: { userId, startsAt: now, endsAt, active: true },
  })

  await db.auditLog.create({
    data: {
      action: 'trial_started',
      actor: userId,
      target: userId,
      metadata: JSON.stringify({ days: TRIAL_DAYS, endsAt: endsAt.toISOString() }),
    },
  })

  return { ok: true, message: `30-day trial activated`, endsAt: endsAt.toISOString() }
}

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const sub = await db.subscription.findUnique({ where: { userId } })
  const now = new Date()

  if (!sub || sub.status !== 'active' || sub.endsAt < now) {
    // Fall back to trial
    const trial = await db.trial.findUnique({ where: { userId } })
    const trialActive = trial?.active && trial.endsAt > now
    const trialMsLeft = trial ? trial.endsAt.getTime() - now.getTime() : 0
    return {
      active: !!trialActive,
      plan: 'trial',
      planName: 'Trial',
      endsAt: trial?.endsAt?.toISOString() || null,
      daysLeft: Math.max(0, Math.ceil(trialMsLeft / (24 * 60 * 60 * 1000))),
      isTrial: true,
      isLifetime: false,
      autoRenew: false,
    }
  }

  const msLeft = sub.endsAt.getTime() - now.getTime()
  // Look up the plan name from DB (fallback to stored plan string)
  let planName = sub.plan
  try {
    const plan = await db.plan.findFirst({ where: { OR: [{ id: sub.plan }, { slug: sub.plan }] } })
    if (plan) planName = plan.name
  } catch {}

  return {
    active: true,
    plan: sub.plan,
    planName,
    endsAt: sub.endsAt.toISOString(),
    daysLeft: Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000))),
    isTrial: sub.plan === 'trial',
    isLifetime: sub.plan === 'lifetime' || sub.plan === 'Lifetime',
    autoRenew: sub.autoRenew,
  }
}

export async function checkFeatureAccess(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const status = await getSubscriptionStatus(userId)
  if (status.active) return { allowed: true }
  return { allowed: false, reason: 'Your subscription has expired. Please choose a plan to continue.' }
}

/**
 * Activate a plan after successful payment.
 * Does NOT modify existing subscriptions — extends them instead.
 */
export async function activatePlan(
  userId: string,
  planId: string,
  paymentId?: string,
  amountPaid?: number
): Promise<SubscriptionStatus> {
  // Fetch the plan from DB — fail if it doesn't exist or is archived
  const plan = await db.plan.findFirst({
    where: { OR: [{ id: planId }, { slug: planId }], isArchived: false },
  })
  if (!plan) throw new Error('Invalid or archived plan')

  const now = new Date()
  // Extend from the existing subscription's end date if still active
  const existing = await db.subscription.findUnique({ where: { userId } })
  const baseDate = existing && existing.status === 'active' && existing.endsAt > now
    ? existing.endsAt
    : now

  const finalEndsAt = new Date(baseDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000)

  // Upsert the subscription — this preserves existing paymentId if already set
  const sub = await db.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: plan.id, // store the plan ID (stable reference)
      status: 'active',
      paymentId,
      amountPaid: amountPaid || plan.priceInr,
      currency: 'inr',
      startsAt: now,
      endsAt: finalEndsAt,
      autoRenew: false,
    },
    update: {
      plan: plan.id,
      status: 'active',
      paymentId,
      amountPaid: amountPaid || plan.priceInr,
      currency: 'inr',
      endsAt: finalEndsAt,
    },
  })

  // Sync the trial row so /api/me stays consistent
  const trial = await db.trial.findUnique({ where: { userId } })
  if (trial) {
    await db.trial.update({
      where: { userId },
      data: { endsAt: finalEndsAt, active: true },
    })
  }

  await db.auditLog.create({
    data: {
      action: 'subscription_activated',
      actor: userId,
      target: sub.id,
      metadata: JSON.stringify({
        planId: plan.id,
        planName: plan.name,
        amountPaid: amountPaid || plan.priceInr,
        endsAt: finalEndsAt.toISOString(),
      }),
    },
  })

  return getSubscriptionStatus(userId)
}

export async function cancelSubscription(userId: string): Promise<{ ok: boolean; message: string }> {
  const sub = await db.subscription.findUnique({ where: { userId } })
  if (!sub) {
    return { ok: false, message: 'No subscription found' }
  }
  await db.subscription.update({
    where: { userId },
    data: { status: 'cancelled', autoRenew: false },
  })
  return { ok: true, message: 'Subscription cancelled. Access continues until the current period ends.' }
}
