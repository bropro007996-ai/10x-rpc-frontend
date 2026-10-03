// 10X RPC — /api/notifications — GET (list) + POST (mark read) + DELETE (clear)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const notifications = await db.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const unreadCount = await db.notification.count({
    where: { userId: session.userId, read: false },
  })

  return NextResponse.json({
    ok: true,
    notifications: notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const body = await req.json() as { action?: 'mark_read' | 'mark_all_read' | 'clear'; id?: string }

  if (body.action === 'mark_read' && body.id) {
    await db.notification.update({ where: { id: body.id }, data: { read: true } })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'mark_all_read') {
    await db.notification.updateMany({ where: { userId: session.userId, read: false }, data: { read: true } })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'clear' && body.id) {
    await db.notification.delete({ where: { id: body.id } })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'invalid action' }, { status: 400 })
}
