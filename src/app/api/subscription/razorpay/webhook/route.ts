// 10X RPC — /api/subscription/razorpay/webhook — Razorpay webhook handler
// Verifies webhook signature, processes payment events, activates subscriptions
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { activatePlan } from '@/lib/subscription'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature')

  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 })
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[Razorpay Webhook] WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 })
  }

  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex')

  if (expectedSignature !== signature) {
    console.error('[Razorpay Webhook] Invalid signature')
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const eventType = event.event
  const paymentEntity = event.payload?.payment?.entity

  if (!paymentEntity) {
    return NextResponse.json({ ok: true, message: 'no payment entity' })
  }

  const razorpayOrderId = paymentEntity.order_id
  const razorpayPaymentId = paymentEntity.id
  const amount = paymentEntity.amount // in paise
  const currency = paymentEntity.currency || 'INR'

  // Find the internal payment record by razorpayOrderId
  const payment = await db.payment.findUnique({
    where: { razorpayOrderId },
  })

  if (!payment) {
    console.error('[Razorpay Webhook] Payment not found for order:', razorpayOrderId)
    return NextResponse.json({ ok: true, message: 'payment not found' })
  }

  // Prevent duplicate processing
  if (payment.status === 'captured' || payment.status === 'refunded') {
    console.log('[Razorpay Webhook] Already processed:', payment.id)
    return NextResponse.json({ ok: true, message: 'already processed' })
  }

  // Create audit log
  await db.auditLog.create({
    data: {
      action: 'webhook_processed',
      target: payment.userId,
      actor: 'system',
      metadata: JSON.stringify({ eventType, razorpayPaymentId, razorpayOrderId }),
    },
  })

  // Process based on event type
  switch (eventType) {
    case 'payment.captured':
    case 'payment.authorized': {
      // Update payment record
      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: 'captured',
          razorpayPaymentId,
          razorpaySignature: signature,
          verifiedAt: new Date(),
        },
      })

      // Activate subscription
      try {
        await activatePlan(payment.userId, payment.planId, razorpayPaymentId, payment.amount)

        // Create notification
        await db.notification.create({
          data: {
            userId: payment.userId,
            type: 'subscription_activated',
            title: 'Subscription Activated!',
            message: `Your ${payment.planName} has been activated successfully.`,
            metadata: JSON.stringify({ planId: payment.planId, paymentId: payment.id }),
          },
        })

        // Audit log
        await db.auditLog.create({
          data: {
            action: 'subscription_activated',
            target: payment.userId,
            actor: 'system',
            metadata: JSON.stringify({ planId: payment.planId, paymentId: payment.id }),
          },
        })

        console.log('[Razorpay Webhook] Subscription activated for user:', payment.userId)
      } catch (e) {
        console.error('[Razorpay Webhook] Failed to activate subscription:', e)
      }
      break
    }

    case 'payment.failed': {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      })

      await db.notification.create({
        data: {
          userId: payment.userId,
          type: 'payment_failed',
          title: 'Payment Failed',
          message: `Your payment for ${payment.planName} could not be completed. Please try again.`,
        },
      })
      break
    }

    case 'payment.refunded': {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: 'refunded' },
      })
      break
    }

    default:
      console.log('[Razorpay Webhook] Unhandled event:', eventType)
  }

  return NextResponse.json({ ok: true })
}
