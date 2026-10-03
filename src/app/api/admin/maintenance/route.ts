// 10X RPC — /api/admin/maintenance — CRUD for scheduled maintenance windows (admin only)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

function serialize(m: any) {
  return {
    id: m.id,
    title: m.title,
    message: m.message,
    startsAt: m.startsAt.toISOString(),
    endsAt: m.endsAt.toISOString(),
    isActive: m.isActive,
    isResolved: m.isResolved,
    createdBy: m.createdBy,
    resolvedAt: m.resolvedAt ? m.resolvedAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }
}

function getStatus(m: any): 'scheduled' | 'active' | 'ended' | 'resolved' {
  if (m.isResolved) return 'resolved'
  const now = Date.now()
  const start = m.startsAt.getTime()
  const end = m.endsAt.getTime()
  if (now < start) return 'scheduled'
  if (now >= start && now < end) return 'active'
  return 'ended'
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const windows = await db.maintenanceWindow.findMany({
      orderBy: { startsAt: 'desc' },
    })
    return NextResponse.json({
      ok: true,
      windows: windows.map(w => ({ ...serialize(w), status: getStatus(w) })),
      activeCount: windows.filter(w => getStatus(w) === 'active').length,
      scheduledCount: windows.filter(w => getStatus(w) === 'scheduled').length,
    })
  } catch (e) {
    console.error('admin/maintenance GET error:', e)
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
      title?: string
      message?: string
      startsAt?: string
      endsAt?: string
    }

    const title = (body.title || '').trim()
    const message = (body.message || '').trim()
    if (!title) return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 })
    if (!message) return NextResponse.json({ ok: false, error: 'message is required' }, { status: 400 })

    const startsAt = body.startsAt ? new Date(body.startsAt) : null
    const endsAt = body.endsAt ? new Date(body.endsAt) : null
    if (!startsAt || isNaN(startsAt.getTime())) return NextResponse.json({ ok: false, error: 'invalid startsAt' }, { status: 400 })
    if (!endsAt || isNaN(endsAt.getTime())) return NextResponse.json({ ok: false, error: 'invalid endsAt' }, { status: 400 })
    if (endsAt <= startsAt) return NextResponse.json({ ok: false, error: 'endsAt must be after startsAt' }, { status: 400 })

    const window = await db.maintenanceWindow.create({
      data: {
        title,
        message,
        startsAt,
        endsAt,
        isActive: true,
        isResolved: false,
        createdBy: session.userId,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'maintenance_scheduled',
        actor: session.userId,
        target: window.id,
        metadata: JSON.stringify({ title, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }),
      },
    })

    return NextResponse.json({ ok: true, window: serialize(window) })
  } catch (e) {
    console.error('admin/maintenance POST error:', e)
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
      id?: string
      action?: 'resolve' | 'cancel'
    }

    if (!body.id) return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 })
    const action = body.action || 'resolve'

    const existing = await db.maintenanceWindow.findUnique({ where: { id: body.id } })
    if (!existing) return NextResponse.json({ ok: false, error: 'window not found' }, { status: 404 })

    const updated = await db.maintenanceWindow.update({
      where: { id: body.id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        isActive: action === 'cancel' ? false : existing.isActive,
      },
    })

    await db.auditLog.create({
      data: {
        action: `maintenance_${action}d`,
        actor: session.userId,
        target: body.id,
        metadata: JSON.stringify({ title: existing.title }),
      },
    })

    return NextResponse.json({ ok: true, window: serialize(updated) })
  } catch (e) {
    console.error('admin/maintenance PUT error:', e)
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

    await db.maintenanceWindow.delete({ where: { id } })

    await db.auditLog.create({
      data: {
        action: 'maintenance_deleted',
        actor: session.userId,
        target: id,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('admin/maintenance DELETE error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
