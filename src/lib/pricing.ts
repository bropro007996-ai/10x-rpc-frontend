// 10X RPC — Dynamic plan pricing + server-side price calculation
// ALL pricing logic lives HERE. The frontend NEVER sends a price to Razorpay.
import { db } from './db'

export interface PlanPricing {
  // The effective price the user pays RIGHT NOW (in paise)
  effectivePriceInr: number
  // Whether an offer is currently active (drives crossed-out display)
  offerActive: boolean
  // The original MRP to show crossed out (null = no crossed-out display)
  originalPriceInr: number | null
  // Auto-calculated discount percentage (0 if no offer)
  discountPercent: number
  // Offer display metadata (null = no offer)
  offerTag: string | null
  offerText: string | null
  offerStartsAt: string | null
  offerEndsAt: string | null
}

/**
 * Calculate the effective price for a plan at the current moment.
 * This is the SINGLE SOURCE OF TRUTH for pricing — Razorpay order creation
 * uses this value, never a frontend-supplied amount.
 *
 * Logic:
 * - offerEnabled must be true (master toggle)
 * - offerPriceInr must be set AND > 0
 * - offerStartsAt must be null or in the past
 * - offerEndsAt must be null or in the future
 * → offer is active
 *
 * When offer is active: effectivePrice = offerPriceInr, originalPrice = originalPriceInr || priceInr
 * When offer is NOT active: effectivePrice = priceInr, originalPrice = null
 * discountPercent = round((1 - effectivePrice / originalPrice) * 100) when offer active
 */
export function calculatePlanPricing(plan: {
  priceInr: number
  originalPriceInr?: number | null
  offerPriceInr?: number | null
  offerEnabled?: boolean
  offerTag?: string | null
  offerText?: string | null
  offerStartsAt?: Date | null
  offerEndsAt?: Date | null
}): PlanPricing {
  const now = new Date()
  const offerMasterEnabled = plan.offerEnabled !== false // default true if not set (backward compat)
  const offerStartOk = !plan.offerStartsAt || plan.offerStartsAt <= now
  const offerEndOk = !plan.offerEndsAt || plan.offerEndsAt >= now
  const hasOfferPrice = typeof plan.offerPriceInr === 'number' && plan.offerPriceInr! > 0
  const offerActive = offerMasterEnabled && hasOfferPrice && offerStartOk && offerEndOk

  if (offerActive) {
    const effective = plan.offerPriceInr!
    const original = plan.originalPriceInr ?? plan.priceInr
    const discountPercent = original > effective
      ? Math.round((1 - effective / original) * 100)
      : 0
    return {
      effectivePriceInr: effective,
      offerActive: true,
      originalPriceInr: original,
      discountPercent,
      offerTag: plan.offerTag ?? null,
      offerText: plan.offerText ?? null,
      offerStartsAt: plan.offerStartsAt ? plan.offerStartsAt.toISOString() : null,
      offerEndsAt: plan.offerEndsAt ? plan.offerEndsAt.toISOString() : null,
    }
  }

  return {
    effectivePriceInr: plan.priceInr,
    offerActive: false,
    originalPriceInr: null,
    discountPercent: 0,
    offerTag: null,
    offerText: null,
    offerStartsAt: plan.offerStartsAt ? plan.offerStartsAt.toISOString() : null,
    offerEndsAt: plan.offerEndsAt ? plan.offerEndsAt.toISOString() : null,
  }
}

/**
 * Fetch the effective price for a plan from the database.
 * Used by Razorpay order creation — NEVER trust a frontend-supplied amount.
 *
 * Returns null if the plan doesn't exist, is archived, inactive, or not visible.
 * This enforces both isActive (purchasable) AND isVisible (shown publicly).
 */
export async function getEffectivePlanPrice(planId: string): Promise<{
  planId: string
  planName: string
  durationDays: number
  priceInr: number
  pricing: PlanPricing
} | null> {
  const plan = await db.plan.findUnique({ where: { id: planId } })
  if (!plan || plan.isArchived || !plan.isActive || !plan.isVisible) return null

  const pricing = calculatePlanPricing(plan)
  return {
    planId: plan.id,
    planName: plan.name,
    durationDays: plan.durationDays,
    priceInr: pricing.effectivePriceInr,
    pricing,
  }
}

/**
 * Validate plan offer fields — used by POST/PUT /api/plans.
 * Returns an array of error strings (empty = valid).
 */
export function validatePlanOfferFields(input: {
  priceInr?: number
  originalPriceInr?: number | null
  offerPriceInr?: number | null
  offerStartsAt?: string | null
  offerEndsAt?: string | null
}): string[] {
  const errors: string[] = []

  if (input.priceInr !== undefined && input.priceInr < 0) {
    errors.push('priceInr cannot be negative')
  }
  if (input.originalPriceInr !== undefined && input.originalPriceInr !== null && input.originalPriceInr < 0) {
    errors.push('originalPriceInr cannot be negative')
  }
  if (input.offerPriceInr !== undefined && input.offerPriceInr !== null && input.offerPriceInr <= 0) {
    errors.push('offerPriceInr must be greater than 0')
  }

  // If offerPriceInr is set, originalPriceInr should be >= offerPriceInr (otherwise discount is negative)
  const base = input.originalPriceInr ?? input.priceInr
  if (input.offerPriceInr && base !== undefined && input.offerPriceInr > base) {
    errors.push('offerPriceInr cannot be greater than originalPriceInr')
  }

  // If both offer dates are set, start must be before end
  if (input.offerStartsAt && input.offerEndsAt) {
    const start = new Date(input.offerStartsAt)
    const end = new Date(input.offerEndsAt)
    if (isNaN(start.getTime())) errors.push('offerStartsAt is not a valid date')
    if (isNaN(end.getTime())) errors.push('offerEndsAt is not a valid date')
    if (start >= end) errors.push('offerStartsAt must be before offerEndsAt')
  }

  return errors
}
