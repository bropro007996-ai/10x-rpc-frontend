// 10X RPC — /api/trial — 30-day one-time free trial (backend-controlled)
// GET: check trial status
// POST: start a NEW trial (fails if one already exists)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { startTrial } from '@/lib/subscription'

export const dynamic = 'force-dynamic'

// GET — return the current trial status (does NOT auto-create)
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const trial = await db.trial.findUnique({ where: { userId: session.userId } })
  const now = new Date()

  if (!trial) {
    return NextResponse.json({
      trial: null,
      canStartTrial: true,
      message: 'You can start a 30-day free trial.',
    })
  }

  const isActive = trial.active && trial.endsAt > now
  const msLeft = trial.endsAt.getTime() - now.getTime()
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)))

  return NextResponse.json({
    trial: {
      active: isActive,
      endsAt: trial.endsAt.toISOString(),
      startsAt: trial.startsAt.toISOString(),
      daysLeft,
      usedBefore: !isActive, // if trial exists but is inactive, it was used before
    },
    canStartTrial: false, // can't start a new trial if one already exists
    message: isActive
      ? `Trial active — ${daysLeft} days left`
      : 'Trial already used. Please choose a subscription plan to continue.',
  })
}

// POST — start a new 30-day trial (one-time enforcement)
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const result = await startTrial(session.userId)

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 409 })
  }

  return NextResponse.json({
    ok: true,
    message: result.message,
    endsAt: result.endsAt,
  })
}
