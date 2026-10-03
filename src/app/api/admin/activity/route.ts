// 10X RPC — /api/admin/activity — GET: list recent activity events (admin only)
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
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const takeRaw = Number(searchParams.get('take') || 50)
    const skipRaw = Number(searchParams.get('skip') || 0)
    const category = searchParams.get('category') || undefined
    const type = searchParams.get('type') || undefined

    const take = Math.min(Math.max(isNaN(takeRaw) ? 50 : takeRaw, 1), 200)
    const skip = Math.max(isNaN(skipRaw) ? 0 : skipRaw, 0)

    const where: Prisma.ActivityEventWhereInput = {}
    if (category) where.category = category
    if (type) where.type = { contains: type, mode: 'insensitive' }

    const [events, total] = await Promise.all([
      db.activityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      db.activityEvent.count({ where }),
    ])

    // Aggregate by type (for category filter chips)
    const byType = await db.activityEvent.groupBy({
      by: ['type'],
      _count: { _all: true },
      orderBy: { _count: { type: 'desc' } },
      take: 20,
    })

    return NextResponse.json({
      ok: true,
      total,
      take,
      skip,
      events: events.map(e => ({
        id: e.id,
        userId: e.userId,
        username: e.username,
        type: e.type,
        category: e.category,
        ip: e.ip,
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString(),
      })),
      types: byType.map(t => ({ type: t.type, count: t._count._all })),
    })
  } catch (e) {
    console.error('admin/activity error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
