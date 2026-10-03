// 10X RPC — /api/admin/settings — GET (singleton) + PUT (update) (admin only)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

function serialize(s: any) {
  return {
    id: s.id,
    siteName: s.siteName,
    heroTitle: s.heroTitle,
    heroSubtitle: s.heroSubtitle,
    discordInvite: s.discordInvite,
    supportText: s.supportText,
    maintenanceMode: s.maintenanceMode,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: 'forbidden', message: 'Admin access required' }, { status: 403 })
  }

  try {
    let settings = await db.siteSettings.findUnique({ where: { id: 'singleton' } })
    if (!settings) {
      // Auto-create the singleton row using schema defaults
      settings = await db.siteSettings.create({ data: { id: 'singleton' } })
    }
    return NextResponse.json({ ok: true, settings: serialize(settings) })
  } catch (e) {
    console.error('admin/settings GET error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: 'forbidden', message: 'Admin access required' }, { status: 403 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      siteName?: string
      heroTitle?: string
      heroSubtitle?: string
      discordInvite?: string
      supportText?: string | null
      maintenanceMode?: boolean
    }

    const data: {
      siteName?: string
      heroTitle?: string
      heroSubtitle?: string
      discordInvite?: string
      supportText?: string | null
      maintenanceMode?: boolean
    } = {}

    if (body.siteName !== undefined) data.siteName = String(body.siteName)
    if (body.heroTitle !== undefined) data.heroTitle = String(body.heroTitle)
    if (body.heroSubtitle !== undefined) data.heroSubtitle = String(body.heroSubtitle)
    if (body.discordInvite !== undefined) data.discordInvite = String(body.discordInvite)
    if (body.supportText !== undefined) data.supportText = body.supportText
    if (body.maintenanceMode !== undefined) data.maintenanceMode = !!body.maintenanceMode

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: 'no fields to update' }, { status: 400 })
    }

    // Upsert so the singleton row always exists
    const updated = await db.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    })

    await db.auditLog.create({
      data: {
        action: 'settings_changed',
        actor: session.userId,
        target: 'singleton',
        metadata: JSON.stringify(data),
      },
    })

    return NextResponse.json({ ok: true, settings: serialize(updated) })
  } catch (e) {
    console.error('admin/settings PUT error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
