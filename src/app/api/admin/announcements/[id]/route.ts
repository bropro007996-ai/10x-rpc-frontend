// 10X RPC — /api/admin/announcements/[id] — PUT (update) + DELETE (remove) (admin only)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

const VALID_TYPES = ['info', 'update', 'warning', 'maintenance'] as const
type AnnouncementType = (typeof VALID_TYPES)[number]

function isAnnouncementType(v: unknown): v is AnnouncementType {
  return typeof v === 'string' && (VALID_TYPES as readonly string[]).includes(v)
}

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: 'forbidden', message: 'Admin access required' }, { status: 403 })
  }

  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      type?: string
      title?: string
      message?: string
      isActive?: boolean
    }

    const data: {
      type?: AnnouncementType
      title?: string
      message?: string
      isActive?: boolean
    } = {}

    if (body.title !== undefined) {
      const t = body.title.trim()
      if (!t) {
        return NextResponse.json({ ok: false, error: 'title cannot be empty' }, { status: 400 })
      }
      data.title = t
    }
    if (body.message !== undefined) {
      const m = body.message.trim()
      if (!m) {
        return NextResponse.json({ ok: false, error: 'message cannot be empty' }, { status: 400 })
      }
      data.message = m
    }
    if (body.type !== undefined) {
      if (!isAnnouncementType(body.type)) {
        return NextResponse.json(
          { ok: false, error: `type must be one of: ${VALID_TYPES.join(', ')}` },
          { status: 400 }
        )
      }
      data.type = body.type
    }
    if (body.isActive !== undefined) {
      data.isActive = !!body.isActive
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: 'no fields to update' }, { status: 400 })
    }

    const updated = await db.announcement.update({
      where: { id },
      data,
    })

    await db.auditLog.create({
      data: {
        action: 'announcement_updated',
        actor: session.userId,
        target: updated.id,
        metadata: JSON.stringify(data),
      },
    })

    return NextResponse.json({
      ok: true,
      announcement: {
        id: updated.id,
        type: updated.type,
        title: updated.title,
        message: updated.message,
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (e) {
    console.error('admin/announcements/[id] PUT error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: 'forbidden', message: 'Admin access required' }, { status: 403 })
  }

  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 })
    }

    const existing = await db.announcement.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'announcement not found' }, { status: 404 })
    }

    await db.announcement.delete({ where: { id } })

    await db.auditLog.create({
      data: {
        action: 'announcement_deleted',
        actor: session.userId,
        target: id,
        metadata: JSON.stringify({ title: existing.title, type: existing.type }),
      },
    })

    return NextResponse.json({ ok: true, deleted: id })
  } catch (e) {
    console.error('admin/announcements/[id] DELETE error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
