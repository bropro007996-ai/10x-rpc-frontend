// 10X RPC — /api/activity-log — user's recent RPC + status activity
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  // Get recent audit logs for this user
  const logs = await db.auditLog.findMany({
    where: { target: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Also get recent notifications as activity
  const notifications = await db.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, type: true, title: true, message: true, read: true, createdAt: true },
  })

  // Get last presence update
  const sess = await db.session.findFirst({
    where: { userId: session.userId },
    select: { lastPresenceUpdate: true, rpcEnabled: true, statusEnabled: true, gamesRpcEnabled: true, gatewayReady: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    ok: true,
    activity: logs.map(l => ({
      id: l.id,
      action: l.action,
      actor: l.actor,
      timestamp: l.createdAt.toISOString(),
    })),
    notifications: notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    status: {
      rpcEnabled: sess?.rpcEnabled ?? false,
      statusEnabled: sess?.statusEnabled ?? false,
      gamesRpcEnabled: sess?.gamesRpcEnabled ?? false,
      gatewayReady: sess?.gatewayReady ?? false,
      lastPresenceUpdate: sess?.lastPresenceUpdate?.toISOString() ?? null,
    },
  })
}
