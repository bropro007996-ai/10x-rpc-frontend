// 10X RPC — /api/admin/send-notification — broadcast notifications to user(s) (admin only)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: 'forbidden', message: 'Admin access required' }, { status: 403 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      userIds?: string[]
      type?: string
      title?: string
      message?: string
      metadata?: Record<string, unknown>
    }

    const { userIds, type, title, message } = body

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'userIds must be a non-empty array' }, { status: 400 })
    }
    if (!type || typeof type !== 'string') {
      return NextResponse.json({ ok: false, error: 'type is required' }, { status: 400 })
    }
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 })
    }
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ ok: false, error: 'message is required' }, { status: 400 })
    }

    // Validate that the userIds actually exist (avoids silently dropping notifications)
    const validUsers = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    })
    const validIds = validUsers.map(u => u.id)
    const invalidCount = userIds.length - validIds.length

    if (validIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'no valid userIds provided' },
        { status: 400 }
      )
    }

    const metadataStr = body.metadata ? JSON.stringify(body.metadata) : null

    // createMany returns only count, not records — that's fine for a broadcast
    const result = await db.notification.createMany({
      data: validIds.map(userId => ({
        userId,
        type,
        title,
        message,
        metadata: metadataStr,
      })),
    })

    await db.auditLog.create({
      data: {
        action: 'notification_sent',
        actor: session.userId,
        target: 'broadcast',
        metadata: JSON.stringify({
          recipientCount: result.count,
          type,
          title,
          invalidCount,
        }),
      },
    })

    return NextResponse.json({
      ok: true,
      sent: result.count,
      requested: userIds.length,
      invalid: invalidCount,
      type,
      title,
    })
  } catch (e) {
    console.error('admin/send-notification error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
