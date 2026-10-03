// 10X RPC — /api/admin/ip-blocklist — GET (list) + POST (add) + DELETE (remove) (admin only)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

function isValidIp(ip: string): boolean {
  // IPv4 or IPv6
  const v4 = /^(\d{1,3}\.){3}\d{1,3}$/
  const v6 = /^[0-9a-f:]+$/i
  return v4.test(ip) || v6.test(ip)
}

function serialize(b: any) {
  return {
    id: b.id,
    ip: b.ip,
    reason: b.reason,
    blockedBy: b.blockedBy,
    isActive: b.isActive,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const blocks = await db.ipBlock.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({
      ok: true,
      blocks: blocks.map(serialize),
      activeCount: blocks.filter(b => b.isActive).length,
    })
  } catch (e) {
    console.error('admin/ip-blocklist GET error:', e)
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
    const body = (await req.json().catch(() => ({}))) as { ip?: string; reason?: string }
    const ip = (body.ip || '').trim()
    if (!ip) return NextResponse.json({ ok: false, error: 'ip is required' }, { status: 400 })
    if (!isValidIp(ip)) return NextResponse.json({ ok: false, error: 'invalid IP address' }, { status: 400 })

    // Upsert so re-blocking an existing IP just updates reason/active state
    const block = await db.ipBlock.upsert({
      where: { ip },
      create: {
        ip,
        reason: body.reason || null,
        blockedBy: session.userId,
        isActive: true,
      },
      update: {
        reason: body.reason || null,
        blockedBy: session.userId,
        isActive: true,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'ip_blocked',
        actor: session.userId,
        target: ip,
        metadata: JSON.stringify({ reason: body.reason }),
      },
    })

    return NextResponse.json({ ok: true, block: serialize(block) })
  } catch (e) {
    console.error('admin/ip-blocklist POST error:', e)
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

    const block = await db.ipBlock.findUnique({ where: { id } })
    if (!block) return NextResponse.json({ ok: false, error: 'block not found' }, { status: 404 })

    await db.ipBlock.delete({ where: { id } })

    await db.auditLog.create({
      data: {
        action: 'ip_unblocked',
        actor: session.userId,
        target: block.ip,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('admin/ip-blocklist DELETE error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
