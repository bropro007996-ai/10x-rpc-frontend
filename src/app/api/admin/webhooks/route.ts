// 10X RPC — /api/admin/webhooks — GET (list) + POST (create) + PUT (update) + DELETE (admin only)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

const VALID_EVENTS = [
  'user.signup',
  'user.login',
  'user.deleted',
  'payment.created',
  'payment.verified',
  'payment.failed',
  'subscription.created',
  'subscription.expired',
  'subscription.cancelled',
  'announcement.created',
  'announcement.deleted',
  'notification.sent',
  'admin.grant_access',
  'flag.toggled',
] as const

function serialize(w: any) {
  return {
    id: w.id,
    url: w.url,
    secret: w.secret ? '••••••••' : null, // don't expose actual secret
    hasSecret: !!w.secret,
    events: JSON.parse(w.events || '[]'),
    isActive: w.isActive,
    description: w.description,
    lastTriggeredAt: w.lastTriggeredAt ? w.lastTriggeredAt.toISOString() : null,
    lastStatus: w.lastStatus,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const webhooks = await db.webhook.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { deliveries: true } },
      },
    })
    return NextResponse.json({
      ok: true,
      webhooks: webhooks.map(w => ({ ...serialize(w), deliveryCount: w._count.deliveries })),
      availableEvents: VALID_EVENTS,
    })
  } catch (e) {
    console.error('admin/webhooks GET error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const body = (await req.json().catch(() => ({}))) as {
      url?: string
      secret?: string
      events?: string[]
      isActive?: boolean
      description?: string
    }

    const url = (body.url || '').trim()
    if (!url) return NextResponse.json({ ok: false, error: 'url is required' }, { status: 400 })
    try { new URL(url) } catch { return NextResponse.json({ ok: false, error: 'invalid url' }, { status: 400 }) }

    const events = Array.isArray(body.events)
      ? body.events.filter(e => (VALID_EVENTS as readonly string[]).includes(e))
      : []

    const webhook = await db.webhook.create({
      data: {
        url,
        secret: body.secret || null,
        events: JSON.stringify(events),
        isActive: body.isActive !== false,
        description: body.description || null,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'webhook_created',
        actor: session.userId,
        target: webhook.id,
        metadata: JSON.stringify({ url, events }),
      },
    })

    return NextResponse.json({ ok: true, webhook: serialize(webhook) })
  } catch (e) {
    console.error('admin/webhooks POST error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const body = (await req.json().catch(() => ({}))) as {
      id: string
      url?: string
      secret?: string | null
      events?: string[]
      isActive?: boolean
      description?: string
    }

    if (!body.id) return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 })

    const existing = await db.webhook.findUnique({ where: { id: body.id } })
    if (!existing) return NextResponse.json({ ok: false, error: 'webhook not found' }, { status: 404 })

    const data: { url?: string; secret?: string | null; events?: string; isActive?: boolean; description?: string | null } = {}
    if (body.url !== undefined) {
      try { new URL(body.url) } catch { return NextResponse.json({ ok: false, error: 'invalid url' }, { status: 400 }) }
      data.url = body.url
    }
    if (body.secret !== undefined) data.secret = body.secret || null
    if (body.events !== undefined) {
      data.events = JSON.stringify(body.events.filter(e => (VALID_EVENTS as readonly string[]).includes(e)))
    }
    if (body.isActive !== undefined) data.isActive = !!body.isActive
    if (body.description !== undefined) data.description = body.description || null

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: 'no fields to update' }, { status: 400 })
    }

    const updated = await db.webhook.update({ where: { id: body.id }, data })

    await db.auditLog.create({
      data: {
        action: 'webhook_updated',
        actor: session.userId,
        target: body.id,
        metadata: JSON.stringify(data),
      },
    })

    return NextResponse.json({ ok: true, webhook: serialize(updated) })
  } catch (e) {
    console.error('admin/webhooks PUT error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 })

    await db.webhook.delete({ where: { id } })

    await db.auditLog.create({
      data: {
        action: 'webhook_deleted',
        actor: session.userId,
        target: id,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('admin/webhooks DELETE error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
