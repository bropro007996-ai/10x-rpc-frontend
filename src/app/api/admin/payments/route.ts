// 10X RPC — /api/admin/payments — list all payments with filters + pagination (admin only)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: 'forbidden', message: 'Admin access required' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search')?.trim() || undefined
    const takeRaw = Number(searchParams.get('take') || 20)
    const skipRaw = Number(searchParams.get('skip') || 0)

    const take = Math.min(Math.max(isNaN(takeRaw) ? 20 : takeRaw, 1), 100)
    const skip = Math.max(isNaN(skipRaw) ? 0 : skipRaw, 0)

    // Build the where clause
    const where: Prisma.PaymentWhereInput = {}

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { user: { username: { contains: search, mode: 'insensitive' } } },
        { internalOrderId: { contains: search, mode: 'insensitive' } },
        { razorpayOrderId: { contains: search, mode: 'insensitive' } },
        { razorpayPaymentId: { contains: search, mode: 'insensitive' } },
        { user: { discordId: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          user: {
            select: {
              id: true,
              discordId: true,
              username: true,
              avatar: true,
              discriminator: true,
            },
          },
        },
      }),
      db.payment.count({ where }),
    ])

    return NextResponse.json({
      ok: true,
      total,
      take,
      skip,
      payments: payments.map(p => ({
        id: p.id,
        userId: p.userId,
        planId: p.planId,
        planName: p.planName,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        razorpayOrderId: p.razorpayOrderId,
        razorpayPaymentId: p.razorpayPaymentId,
        internalOrderId: p.internalOrderId,
        verifiedAt: p.verifiedAt,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        user: p.user
          ? {
              id: p.user.id,
              discordId: p.user.discordId,
              username: p.user.username,
              avatar: p.user.avatar,
              discriminator: p.user.discriminator,
            }
          : null,
      })),
    })
  } catch (e) {
    console.error('admin/payments error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
