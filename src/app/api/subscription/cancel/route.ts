// 10X RPC — /api/subscription/cancel — cancel auto-renew
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { cancelSubscription } from '@/lib/subscription'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  const result = await cancelSubscription(session.userId)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
