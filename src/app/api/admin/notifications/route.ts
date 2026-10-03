// 10X RPC — /api/admin/notifications — list all sent notifications (admin only)
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
    const takeRaw = Number(searchParams.get('take') || 50)
    const skipRaw = Number(searchParams.get('skip') || 0)
    const unreadOnly = searchParams.get('unread') === 'true'

    const take = Math.min(Math.max(isNaN(takeRaw) ? 50 : takeRaw, 1), 200)
    const skip = Math.max(isNaN(skipRaw) ? 0 : skipRaw, 0)

    const where: Prisma.NotificationWhereInput = {}
    if (unreadOnly) {
      where.readAt = null
    }

    const [notifications, total, unread] = await Promise.all([
      db.notification.findMany({
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
            },
          },
        },
      }),
      db.notification.count({ where }),
      db.notification.count({ where: { readAt: null } }),
    ])

    return NextResponse.json({
      ok: true,
      total,
      unread,
      take,
      skip,
      notifications: notifications.map(n => ({
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        metadata: n.metadata,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
        user: n.user
          ? {
              id: n.user.id,
              discordId: n.user.discordId,
              username: n.user.username,
              avatar: n.user.avatar,
            }
          : null,
      })),
    })
  } catch (e) {
    console.error('admin/notifications error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
