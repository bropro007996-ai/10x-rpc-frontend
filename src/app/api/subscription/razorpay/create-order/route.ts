// 10X RPC — /api/subscription/razorpay/create-order
// IMPORTANT: The order amount is ALWAYS read from the database via getEffectivePlanPrice().
// The frontend NEVER sends a price — it only sends the planId.
// This prevents price manipulation attacks.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getRazorpay, RAZORPAY_ENABLED, syncSubscriptionState } from '@/lib/subscription'
import { getEffectivePlanPrice } from '@/lib/pricing'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  if (!RAZORPAY_ENABLED) {
    return NextResponse.json({ error: 'razorpay_not_configured' }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as { planId?: string }
  const planId = body.planId

  if (!planId || planId === 'trial') {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 })
  }

  // ⚠️ SECURITY: Read the price from the DB, not from the request body.
  // This is the single source of truth — the frontend cannot manipulate the amount.
  const planData = await getEffectivePlanPrice(planId)
  if (!planData) {
    return NextResponse.json({ error: 'invalid or inactive plan' }, { status: 400 })
  }

  // Run on-demand subscription sync so the user's status is up-to-date.
  // This ensures that if the user's subscription just expired, they are
  // suspended BEFORE we check their state — so the renewal flow works
  // correctly (suspended users CAN purchase to reactivate).
  try {
    await syncSubscriptionState(session.userId)
  } catch (e) {
    console.error('syncSubscriptionState error in create-order (non-fatal):', e)
  }

  // NOTE: We do NOT block users who already have an active subscription.
  // Users are ALLOWED to purchase again at any time — whether to:
  //   - Extend an active subscription (adds days to the current end date)
  //   - Renew a suspended subscription (reactivates + restores workspace)
  //   - Reactivate an expired subscription (fresh start)
  // The activatePlan() function handles all these cases correctly by
  // extending from the existing endsAt if still active, or from now otherwise.

  const rzp = getRazorpay()!

  try {
    // amount in paise — read from DB, never from frontend
    const amount = planData.priceInr

    // Create a Payment record (status: created) so we can reconcile after verify
    const payment = await db.payment.create({
      data: {
        userId: session.userId,
        planId: planData.planId,
        planName: planData.planName,
        amount,
        currency: 'inr',
        status: 'created',
      },
    })

    const order = await rzp.orders.create({
      amount,
      currency: 'INR',
      receipt: `10xrpc_${planId}_${session.userId.slice(0, 8)}_${Date.now()}`,
      notes: {
        userId: session.userId,
        planId,
        planName: planData.planName,
        paymentRecordId: payment.id,
        effectivePriceInr: amount,
        offerActive: planData.pricing.offerActive ? 'true' : 'false',
      },
    })

    // Link the Razorpay order ID to our Payment record
    await db.payment.update({
      where: { id: payment.id },
      data: {
        razorpayOrderId: order.id,
        internalOrderId: payment.id,
      },
    })

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      amount: order.amount, // in paise — the frontend shows this for transparency
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      planId,
      planName: planData.planName,
      userEmail: session.user.username,
      // Show the pricing breakdown for the frontend (read-only display)
      pricing: planData.pricing,
      durationDays: planData.durationDays,
    })
  } catch (e: any) {
    console.error('Razorpay order creation error:', e)
    return NextResponse.json({
      ok: false,
      error: e?.message || 'Failed to create order',
    }, { status: 500 })
  }
}
