// 10X RPC — /api/admin/audit-logs — list audit logs with filters + pagination (admin only)
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
    const action = searchParams.get('action')?.trim() || undefined
    const actor = searchParams.get('actor')?.trim() || undefined
    const target = searchParams.get('target')?.trim() || undefined
    const takeRaw = Number(searchParams.get('take') || 50)
    const skipRaw = Number(searchParams.get('skip') || 0)

    const take = Math.min(Math.max(isNaN(takeRaw) ? 50 : takeRaw, 1), 200)
    const skip = Math.max(isNaN(skipRaw) ? 0 : skipRaw, 0)

    const where: Prisma.AuditLogWhereInput = {}

    if (action) {
      where.action = { contains: action, mode: 'insensitive' }
    }
    if (actor) {
      where.OR = [
        { actor: { contains: actor, mode: 'insensitive' } },
      ]
    }
    if (target) {
      where.target = { contains: target, mode: 'insensitive' }
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      db.auditLog.count({ where }),
    ])

    return NextResponse.json({
      ok: true,
      total,
      take,
      skip,
      logs: logs.map(l => ({
        id: l.id,
        action: l.action,
        target: l.target,
        actor: l.actor,
        metadata: l.metadata,
        createdAt: l.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error('admin/audit-logs error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
