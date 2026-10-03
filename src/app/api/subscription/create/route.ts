// 10X RPC — /api/subscription/create — activate a plan (manual payment for now)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { activatePlan, getPlan } from '@/lib/subscription'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  const body = await req.json() as { planId?: string; paymentId?: string; amountPaid?: number }
  const planId = body.planId

  if (!planId) {
    return NextResponse.json({ error: 'missing planId' }, { status: 400 })
  }

  if (planId === 'trial') {
    return NextResponse.json({ error: 'Cannot activate trial manually' }, { status: 400 })
  }

  const plan = await getPlan(planId)
  if (!plan) {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 })
  }

  try {
    const status = await activatePlan(
      session.userId,
      planId,
      body.paymentId,
      body.amountPaid
    )
    return NextResponse.json({
      ok: true,
      message: `${plan.name} activated successfully!`,
      status,
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Failed to activate plan',
    }, { status: 500 })
  }
}
