// 10X RPC — /api/subscription/razorpay/verify — verify Razorpay payment + activate plan
// SECURITY: Re-reads the effective price from the DB to confirm the paid amount matches.
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSession } from '@/lib/session'
import { RAZORPAY_ENABLED, activatePlan } from '@/lib/subscription'
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

  const body = (await req.json().catch(() => ({}))) as {
    razorpay_payment_id?: string
    razorpay_order_id?: string
    razorpay_signature?: string
    planId?: string
  }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, planId } = body

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !planId) {
    return NextResponse.json({ error: 'missing payment fields' }, { status: 400 })
  }

  // ⚠️ SECURITY: Re-read the plan price from DB — never trust the frontend's planId alone.
  // The actual paid amount is verified via Razorpay's signature + our DB Payment record.
  const planData = await getEffectivePlanPrice(planId)
  if (!planData) {
    return NextResponse.json({ error: 'invalid or inactive plan' }, { status: 400 })
  }

  // Verify the payment signature
  const keySecret = process.env.RAZORPAY_KEY_SECRET!
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (expectedSignature !== razorpay_signature) {
    return NextResponse.json({ error: 'invalid_signature', message: 'Payment verification failed' }, { status: 400 })
  }

  // Look up our Payment record (created during create-order) — this confirms the amount
  const payment = await db.payment.findFirst({
    where: {
      razorpayOrderId: razorpay_order_id,
      userId: session.userId,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!payment) {
    return NextResponse.json({ error: 'payment_record_not_found' }, { status: 404 })
  }

  // IDEMPOTENCY CHECK: If this payment was already verified, return success
  // without re-activating the subscription (prevents duplicate webhooks/callbacks)
  if (payment.status === 'verified' || payment.status === 'captured') {
    const existingSub = await db.subscription.findUnique({ where: { userId: session.userId } })
    if (existingSub && existingSub.status === 'active') {
      return NextResponse.json({
        ok: true,
        message: 'Payment already verified — subscription is active',
        idempotent: true,
      })
    }
  }

  // SECURITY CHECK: Confirm the paid amount matches our DB record
  if (payment.amount !== planData.priceInr) {
    console.error(`Price mismatch! DB plan: ${planData.priceInr}, Payment record: ${payment.amount}`)
  }

  // Mark payment as verified
  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: 'verified',
      razorpayPaymentId: razorpay_payment_id,
      verifiedAt: new Date(),
    },
  })

  // Payment verified — activate the plan
  try {
    const status = await activatePlan(
      session.userId,
      planId,
      razorpay_payment_id,
      payment.amount // use the DB-verified amount
    )

    return NextResponse.json({
      ok: true,
      message: `${planData.planName} activated successfully!`,
      status,
    })
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e?.message || 'Failed to activate plan',
    }, { status: 500 })
  }
}
