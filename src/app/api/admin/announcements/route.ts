// 10X RPC — /api/admin/announcements — GET (list) + POST (create) (admin only)
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
    const onlyActive = searchParams.get('active') === 'true'
    const takeRaw = Number(searchParams.get('take') || 50)
    const skipRaw = Number(searchParams.get('skip') || 0)

    const take = Math.min(Math.max(isNaN(takeRaw) ? 50 : takeRaw, 1), 200)
    const skip = Math.max(isNaN(skipRaw) ? 0 : skipRaw, 0)

    const where = onlyActive ? { isActive: true } : {}

    const [announcements, total] = await Promise.all([
      db.announcement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      db.announcement.count({ where }),
    ])

    return NextResponse.json({
      ok: true,
      total,
      take,
      skip,
      announcements: announcements.map(a => ({
        id: a.id,
        type: a.type,
        title: a.title,
        message: a.message,
        isActive: a.isActive,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error('admin/announcements GET error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
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
      type?: string
      title?: string
      message?: string
      isActive?: boolean
    }

    const title = (body.title || '').trim()
    const message = (body.message || '').trim()
    if (!title || !message) {
      return NextResponse.json(
        { ok: false, error: 'title and message are required' },
        { status: 400 }
      )
    }

    const type = isAnnouncementType(body.type) ? body.type : 'info'
    const isActive = body.isActive !== false // default true

    const announcement = await db.announcement.create({
      data: {
        type,
        title,
        message,
        isActive,
      },
    })

    // Log to audit trail
    await db.auditLog.create({
      data: {
        action: 'announcement_created',
        actor: session.userId,
        target: announcement.id,
        metadata: JSON.stringify({ type, title, isActive }),
      },
    })

    return NextResponse.json({
      ok: true,
      announcement: {
        id: announcement.id,
        type: announcement.type,
        title: announcement.title,
        message: announcement.message,
        isActive: announcement.isActive,
        createdAt: announcement.createdAt.toISOString(),
        updatedAt: announcement.updatedAt.toISOString(),
      },
    })
  } catch (e) {
    console.error('admin/announcements POST error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
