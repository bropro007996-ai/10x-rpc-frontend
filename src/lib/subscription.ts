// 10X RPC — Subscription status + plan activation (DB-driven, no hardcoded plans)
//
// LIFECYCLE (single generic system for ALL plan types — trial, monthly, 2-month, custom):
//
//   ACTIVE / EXPIRING_SOON  ──(endsAt <= now)──►  SUSPENDED  (7-day grace starts)
//   SUSPENDED               ──(gracePeriodEnd <= now)──►  EXPIRED  (workspace cleanup)
//   SUSPENDED + renew       ──►  ACTIVE  (suspension fields cleared, workspace restored)
//
// The backend is the single source of truth. `syncSubscriptionState()` performs
// on-demand expiry detection on every protected request, so suspension happens
// at the EXACT expiry timestamp — no waiting for the cron. The cron is only a
// backup safety net.
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

export const GRACE_PERIOD_DAYS = 7
export const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
export const MS_PER_DAY = 24 * 60 * 60 * 1000

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
  /** Raw DB status: active | expiring_soon | suspended | expired | cancelled | pending */
  status: string
  plan: string
  planName: string
  endsAt: string | null
  daysLeft: number
  isTrial: boolean
  isLifetime: boolean
  autoRenew: boolean
  /** ISO string — when the subscription was suspended (null if never suspended). */
  suspendedAt: string | null
  /** ISO string — when the 7-day grace period ends (null if not suspended). */
  gracePeriodEnd: string | null
  /** True only when status === 'suspended' AND gracePeriodEnd > now. */
  inGracePeriod: boolean
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
  const endsAt = new Date(now.getTime() + TRIAL_DAYS * MS_PER_DAY)

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

// ---------------------------------------------------------------------------
// CORE: On-demand subscription state synchronization
// ---------------------------------------------------------------------------
// This is the heart of the automatic lifecycle. It is called on every
// subscription status read (via getSubscriptionStatus) AND by the cron job.
//
// It is IDEMPOTENT — running it multiple times produces the same result:
//   - A subscription already 'suspended' is not suspended again.
//   - A subscription already 'expired' is not expired again.
//   - Grace period is never extended.
//   - Workspace cleanup runs at most once per subscription.
//   - Audit logs / notifications are only created on actual transitions.

export async function syncSubscriptionState(userId: string): Promise<void> {
  const now = new Date()
  const sub = await db.subscription.findUnique({ where: { userId } })

  // ------------------------------------------------------------------
  // CASE A: No Subscription row yet.
  // If the user has an EXPIRED trial, fold it into the suspension
  // lifecycle by creating a suspended Subscription (plan = 'trial').
  // ------------------------------------------------------------------
  if (!sub) {
    const trial = await db.trial.findUnique({ where: { userId } })
    if (trial && trial.active && trial.endsAt <= now) {
      const gracePeriodEnd = new Date(trial.endsAt.getTime() + GRACE_PERIOD_MS)
      try {
        await db.subscription.create({
          data: {
            userId,
            plan: 'trial',
            status: 'suspended',
            startsAt: trial.startsAt,
            endsAt: trial.endsAt,
            suspendedAt: now,
            gracePeriodEnd,
            amountPaid: 0,
            currency: 'inr',
            autoRenew: false,
          },
        })
      } catch {
        // Race condition — another request created the row concurrently.
        return
      }

      // Mark trial as inactive so it can never be re-used.
      await db.trial.update({
        where: { userId },
        data: { active: false },
      })

      // Audit trail (3 events — expiry, suspension, grace start).
      await logAudit('subscription_expired', userId, { plan: 'trial', endsAt: trial.endsAt.toISOString() })
      await logAudit('subscription_suspended', userId, { plan: 'trial', suspendedAt: now.toISOString(), gracePeriodEnd: gracePeriodEnd.toISOString(), originalExpiry: trial.endsAt.toISOString() })
      await logAudit('grace_period_started', userId, { plan: 'trial', gracePeriodEnd: gracePeriodEnd.toISOString() })

      await notify(userId, 'error', 'Subscription Suspended',
        `Your trial has expired and your subscription is now suspended. You have ${GRACE_PERIOD_DAYS} days to renew before your workspace is permanently deleted.`)
    }
    return
  }

  // ------------------------------------------------------------------
  // CASE B: active/expiring_soon but endsAt has passed → SUSPEND.
  // This is the real-time detection that runs on every protected request.
  // ------------------------------------------------------------------
  if ((sub.status === 'active' || sub.status === 'expiring_soon') && sub.endsAt <= now) {
    const gracePeriodEnd = new Date(sub.endsAt.getTime() + GRACE_PERIOD_MS)
    await db.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'suspended',
        suspendedAt: now,
        gracePeriodEnd,
      },
    })

    await logAudit('subscription_expired', userId, { subscriptionId: sub.id, plan: sub.plan, endsAt: sub.endsAt.toISOString() })
    await logAudit('subscription_suspended', userId, { subscriptionId: sub.id, plan: sub.plan, suspendedAt: now.toISOString(), gracePeriodEnd: gracePeriodEnd.toISOString(), originalExpiry: sub.endsAt.toISOString() })
    await logAudit('grace_period_started', userId, { subscriptionId: sub.id, plan: sub.plan, gracePeriodEnd: gracePeriodEnd.toISOString() })

    await notify(userId, 'error', 'Subscription Suspended',
      `Your subscription has expired and is now suspended. You have ${GRACE_PERIOD_DAYS} days to renew before your workspace is permanently deleted.`)
    return
  }

  // ------------------------------------------------------------------
  // CASE C: suspended but grace period has ended → EXPIRE + cleanup.
  // Workspace is disabled (RPC configs, sessions, status). Payment
  // records, audit logs, and subscription records are PRESERVED.
  // ------------------------------------------------------------------
  if (sub.status === 'suspended' && sub.gracePeriodEnd && sub.gracePeriodEnd <= now) {
    await db.subscription.update({
      where: { id: sub.id },
      data: { status: 'expired' },
    })

    // Workspace cleanup — disable (do not delete) so audit/payment data is intact.
    await db.rpcConfig.updateMany({ where: { userId }, data: { enabled: false } })
    await db.gameRpcConfig.updateMany({ where: { userId }, data: { enabled: false } })
    await db.session.updateMany({
      where: { userId, expiresAt: { gt: now } },
      data: {
        rpcEnabled: false,
        gamesRpcEnabled: false,
        gatewayReady: false,
        statusEnabled: false,
      },
    })

    await logAudit('grace_period_ended', userId, { subscriptionId: sub.id, gracePeriodEnd: sub.gracePeriodEnd.toISOString(), cleanupAt: now.toISOString() })
    await logAudit('workspace_deleted', userId, { subscriptionId: sub.id, gracePeriodEnd: sub.gracePeriodEnd.toISOString(), cleanupAt: now.toISOString() })

    await notify(userId, 'error', 'Grace Period Ended',
      'Your grace period has ended. Your workspace configuration has been cleared. Purchase a new plan to create a fresh workspace.')
    return
  }

  // ------------------------------------------------------------------
  // CASE D: active/expiring_soon within 7 days of expiry → EXPIRING_SOON.
  // (Informational transition — access is still granted.)
  // ------------------------------------------------------------------
  if (sub.status === 'active' && sub.endsAt <= new Date(now.getTime() + 7 * MS_PER_DAY)) {
    await db.subscription.update({
      where: { id: sub.id },
      data: { status: 'expiring_soon' },
    })
    const daysLeft = Math.ceil((sub.endsAt.getTime() - now.getTime()) / MS_PER_DAY)
    await logAudit('subscription_expiring_soon', userId, { subscriptionId: sub.id, daysLeft, endsAt: sub.endsAt.toISOString() })
    // Only notify on the 7/3/1 thresholds to avoid spam.
    if ([7, 3, 1].includes(daysLeft)) {
      await notify(userId, 'warning', 'Subscription Expiring',
        `Your subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew now to avoid suspension.`)
    }
    return
  }
}

/**
 * Read the authoritative subscription status for a user.
 * ALWAYS calls syncSubscriptionState() first — so expiry/suspension/cleanup
 * is detected on-demand, at the exact expiry timestamp, regardless of
 * whether the cron has run.
 */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  // On-demand lifecycle detection — runs on every read.
  try {
    await syncSubscriptionState(userId)
  } catch (e) {
    // Never let lifecycle sync break a protected request — log and continue.
    console.error('syncSubscriptionState error (non-fatal):', e)
  }

  const sub = await db.subscription.findUnique({ where: { userId } })
  const now = new Date()

  // ---- SUSPENDED (in grace period) ----
  if (sub && sub.status === 'suspended') {
    const inGrace = !!(sub.gracePeriodEnd && sub.gracePeriodEnd > now)
    return {
      active: false,
      status: 'suspended',
      plan: sub.plan,
      planName: sub.plan === 'trial' ? 'Trial' : sub.plan,
      endsAt: sub.endsAt.toISOString(),
      daysLeft: 0,
      isTrial: sub.plan === 'trial',
      isLifetime: false,
      autoRenew: sub.autoRenew,
      suspendedAt: sub.suspendedAt?.toISOString() ?? null,
      gracePeriodEnd: sub.gracePeriodEnd?.toISOString() ?? null,
      inGracePeriod: inGrace,
    }
  }

  // ---- EXPIRED (grace period ended, workspace cleaned up) ----
  if (sub && sub.status === 'expired') {
    return {
      active: false,
      status: 'expired',
      plan: sub.plan,
      planName: sub.plan === 'trial' ? 'Trial' : sub.plan,
      endsAt: sub.endsAt.toISOString(),
      daysLeft: 0,
      isTrial: sub.plan === 'trial',
      isLifetime: false,
      autoRenew: sub.autoRenew,
      suspendedAt: sub.suspendedAt?.toISOString() ?? null,
      gracePeriodEnd: sub.gracePeriodEnd?.toISOString() ?? null,
      inGracePeriod: false,
    }
  }

  // ---- CANCELLED ----
  if (sub && sub.status === 'cancelled') {
    // Cancelled subs retain access until endsAt, then fall through to suspension.
    if (sub.endsAt > now) {
      const msLeft = sub.endsAt.getTime() - now.getTime()
      return {
        active: true,
        status: 'cancelled',
        plan: sub.plan,
        planName: sub.plan === 'trial' ? 'Trial' : sub.plan,
        endsAt: sub.endsAt.toISOString(),
        daysLeft: Math.max(0, Math.ceil(msLeft / MS_PER_DAY)),
        isTrial: sub.plan === 'trial',
        isLifetime: false,
        autoRenew: false,
        suspendedAt: null,
        gracePeriodEnd: null,
        inGracePeriod: false,
      }
    }
    // Cancelled + expired → treat as expired.
    return {
      active: false,
      status: 'expired',
      plan: sub.plan,
      planName: sub.plan === 'trial' ? 'Trial' : sub.plan,
      endsAt: sub.endsAt.toISOString(),
      daysLeft: 0,
      isTrial: sub.plan === 'trial',
      isLifetime: false,
      autoRenew: false,
      suspendedAt: sub.suspendedAt?.toISOString() ?? null,
      gracePeriodEnd: sub.gracePeriodEnd?.toISOString() ?? null,
      inGracePeriod: false,
    }
  }

  // ---- ACTIVE / EXPIRING_SOON ----
  if (sub && (sub.status === 'active' || sub.status === 'expiring_soon') && sub.endsAt > now) {
    const msLeft = sub.endsAt.getTime() - now.getTime()
    let planName = sub.plan
    try {
      const plan = await db.plan.findFirst({ where: { OR: [{ id: sub.plan }, { slug: sub.plan }] } })
      if (plan) planName = plan.name
    } catch {}

    return {
      active: true,
      status: sub.status,
      plan: sub.plan,
      planName: sub.plan === 'trial' ? 'Trial' : planName,
      endsAt: sub.endsAt.toISOString(),
      daysLeft: Math.max(0, Math.ceil(msLeft / MS_PER_DAY)),
      isTrial: sub.plan === 'trial',
      isLifetime: sub.plan === 'lifetime' || sub.plan === 'Lifetime',
      autoRenew: sub.autoRenew,
      suspendedAt: null,
      gracePeriodEnd: null,
      inGracePeriod: false,
    }
  }

  // ---- NO SUBSCRIPTION ROW: fall back to active trial (if still valid) ----
  // NOTE: An expired trial would have been folded into a suspended Subscription
  // by syncSubscriptionState() above. If we reach here with an expired trial,
  // the sync failed silently — treat as no active access.
  const trial = await db.trial.findUnique({ where: { userId } })
  const trialActive = !!trial && trial.active && trial.endsAt > now
  const trialMsLeft = trial ? trial.endsAt.getTime() - now.getTime() : 0
  return {
    active: trialActive,
    status: trialActive ? 'active' : 'none',
    plan: 'trial',
    planName: 'Trial',
    endsAt: trial?.endsAt?.toISOString() ?? null,
    daysLeft: Math.max(0, Math.ceil(trialMsLeft / MS_PER_DAY)),
    isTrial: true,
    isLifetime: false,
    autoRenew: false,
    suspendedAt: null,
    gracePeriodEnd: null,
    inGracePeriod: false,
  }
}

/**
 * Check if a user's subscription is currently suspended (in grace period).
 * Performs on-demand lifecycle sync first, so it returns true the instant
 * the subscription expires — no waiting for the cron.
 */
export async function isSubscriptionSuspended(userId: string): Promise<boolean> {
  try {
    await syncSubscriptionState(userId)
  } catch (e) {
    console.error('syncSubscriptionState error (non-fatal):', e)
  }
  const sub = await db.subscription.findUnique({ where: { userId } })
  if (!sub) return false
  return sub.status === 'suspended'
}

export async function checkFeatureAccess(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const status = await getSubscriptionStatus(userId)
  if (status.active) return { allowed: true }
  if (status.status === 'suspended') {
    return { allowed: false, reason: 'Your subscription is suspended. Please renew to restore access.' }
  }
  if (status.status === 'expired') {
    return { allowed: false, reason: 'Your subscription has expired. Please choose a plan to continue.' }
  }
  return { allowed: false, reason: 'Your subscription has expired. Please choose a plan to continue.' }
}

/**
 * Activate a plan after successful payment.
 *
 * - If the user is renewing DURING the grace period (status === 'suspended'
 *   and gracePeriodEnd > now), the workspace was preserved — we just clear
 *   the suspension fields, reactivate the subscription, and audit-log the
 *   restoration.
 * - If renewing AFTER cleanup (status === 'expired'), the workspace was
 *   disabled — the user starts fresh but keeps their saved RPC config
 *   (settings are preserved, only `enabled` flags were reset).
 * - Extends the existing end date if the current subscription is still active.
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
  const existing = await db.subscription.findUnique({ where: { userId } })

  // Detect renewal-during-grace vs fresh activation.
  const wasSuspended = existing?.status === 'suspended'
  const wasExpired = existing?.status === 'expired'
  const inGrace = wasSuspended && !!(existing?.gracePeriodEnd && existing.gracePeriodEnd > now)

  // Extend from the existing end date if still active.
  const baseDate = existing && existing.status === 'active' && existing.endsAt > now
    ? existing.endsAt
    : now
  const finalEndsAt = new Date(baseDate.getTime() + plan.durationDays * MS_PER_DAY)

  // Upsert the subscription — clears all suspension fields.
  const sub = await db.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: plan.id,
      status: 'active',
      paymentId,
      amountPaid: amountPaid || plan.priceInr,
      currency: 'inr',
      startsAt: now,
      endsAt: finalEndsAt,
      autoRenew: false,
      suspendedAt: null,
      gracePeriodEnd: null,
    },
    update: {
      plan: plan.id,
      status: 'active',
      paymentId,
      amountPaid: amountPaid || plan.priceInr,
      currency: 'inr',
      endsAt: finalEndsAt,
      suspendedAt: null,
      gracePeriodEnd: null,
    },
  })

  // Sync the trial row so /api/me stays consistent.
  const trial = await db.trial.findUnique({ where: { userId } })
  if (trial) {
    await db.trial.update({
      where: { userId },
      data: { endsAt: finalEndsAt, active: true },
    })
  }

  // ---- Workspace restoration (renewal during grace period) ----
  // During the grace period, the RPC config & session were PRESERVED (not
  // cleaned up). The user's `enabled` flags may still be set correctly.
  // We just need to re-arm `gatewayReady` so the daemon can resume pushing
  // presence if the user had RPC/Status enabled before suspension.
  if (inGrace) {
    // Re-arm gatewayReady if the user has a Discord token, so the daemon
    // can resume pushing presence if the user had RPC/Status enabled before suspension.
    await db.session.updateMany({
      where: { userId, discordAccessToken: { not: null } },
      data: { gatewayReady: true, lastPresenceUpdate: new Date() },
    }).catch(() => {})

    await logAudit('subscription_reactivated', userId, {
      subscriptionId: sub.id,
      planId: plan.id,
      planName: plan.name,
      amountPaid: amountPaid || plan.priceInr,
      endsAt: finalEndsAt.toISOString(),
      renewedDuringGrace: true,
    })
    await logAudit('workspace_restored', userId, {
      subscriptionId: sub.id,
      restoredAt: now.toISOString(),
    })
    await logAudit('grace_period_cancelled', userId, {
      subscriptionId: sub.id,
      cancelledAt: now.toISOString(),
    })
    await notify(userId, 'success', 'Subscription Reactivated',
      `Your subscription has been reactivated. Your workspace and RPC configuration have been restored.`)
  } else if (wasSuspended || wasExpired) {
    // Renewed AFTER cleanup — fresh start (workspace was disabled, not deleted).
    await logAudit('subscription_reactivated', userId, {
      subscriptionId: sub.id,
      planId: plan.id,
      planName: plan.name,
      amountPaid: amountPaid || plan.priceInr,
      endsAt: finalEndsAt.toISOString(),
      renewedAfterCleanup: true,
    })
    await notify(userId, 'success', 'Subscription Activated',
      `Your ${plan.name} subscription is now active.`)
  } else {
    await logAudit('subscription_activated', userId, {
      subscriptionId: sub.id,
      planId: plan.id,
      planName: plan.name,
      amountPaid: amountPaid || plan.priceInr,
      endsAt: finalEndsAt.toISOString(),
    })
  }

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
  await logAudit('subscription_cancelled', userId, { subscriptionId: sub.id })
  return { ok: true, message: 'Subscription cancelled. Access continues until the current period ends.' }
}

// ---------------------------------------------------------------------------
// Helpers — safe audit log + notification writers (never throw to caller)
// ---------------------------------------------------------------------------

async function logAudit(action: string, userId: string, metadata: Record<string, unknown>) {
  try {
    await db.auditLog.create({
      data: {
        action,
        actor: 'system',
        target: userId,
        metadata: JSON.stringify({ ...metadata, userId }),
      },
    })
  } catch (e) {
    console.error(`Failed to write audit log [${action}]:`, e)
  }
}

async function notify(userId: string, type: string, title: string, message: string) {
  try {
    await db.notification.create({
      data: { userId, type, title, message },
    })
  } catch (e) {
    console.error('Failed to create notification:', e)
  }
}
