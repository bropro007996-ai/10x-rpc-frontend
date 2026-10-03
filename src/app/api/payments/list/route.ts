// 10X RPC — /api/payments/list — user's payment history
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const payments = await db.payment.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      planName: true,
      amount: true,
      currency: true,
      status: true,
      internalOrderId: true,
      createdAt: true,
      verifiedAt: true,
    },
  })

  return NextResponse.json({
    ok: true,
    payments: payments.map(p => ({
      id: p.id,
      planName: p.planName,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      orderId: p.internalOrderId,
      date: p.createdAt.toISOString(),
      verified: !!p.verifiedAt,
    })),
  })
}
