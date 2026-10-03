// 10X RPC — /api/admin/export — consolidated data export (CSV/JSON) (admin only)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

interface ExportRow {
  [key: string]: any
}

function toCsv(rows: ExportRow[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) {
    const cells = headers.map(h => {
      const v = row[h]
      if (v === null || v === undefined) return ''
      const s = String(v).replace(/"/g, '""')
      return `"${s}"`
    })
    lines.push(cells.join(','))
  }
  return lines.join('\n')
}

function escapeJsonField(v: any): any {
  if (v instanceof Date) return v.toISOString()
  if (v && typeof v === 'object') {
    try { return JSON.parse(JSON.stringify(v, (_k, val) => val instanceof Date ? val.toISOString() : val)) } catch { return String(v) }
  }
  return v
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const entity = searchParams.get('entity') || 'users'
    const format = (searchParams.get('format') || 'csv').toLowerCase()

    if (!['csv', 'json'].includes(format)) {
      return NextResponse.json({ ok: false, error: 'format must be csv or json' }, { status: 400 })
    }

    let rows: ExportRow[] = []
    let filename = ''

    switch (entity) {
      case 'users': {
        const users = await db.user.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            trial: true,
            rpcConfigs: { take: 1, orderBy: { createdAt: 'desc' } },
            globalConfig: true,
          },
        })
        rows = users.map(u => ({
          id: u.id,
          discordId: u.discordId,
          username: u.username,
          discriminator: u.discriminator || '',
          avatar: u.avatar || '',
          hasTrial: !!u.trial,
          trialActive: u.trial?.active || false,
          trialEndsAt: u.trial?.endsAt ? u.trial.endsAtAt?.toISOString?.() || u.trial.endsAt.toISOString() : '',
          trialDaysLeft: u.trial ? Math.max(0, Math.ceil((u.trial.endsAt.getTime() - Date.now()) / 86400000)) : 0,
          rpcConfigName: u.rpcConfigs[0]?.name || '',
          rpcEnabled: u.rpcConfigs[0]?.enabled || false,
          city: u.globalConfig?.city || '',
          timezone: u.globalConfig?.timezone || '',
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        }))
        filename = `users-${new Date().toISOString().slice(0, 10)}`
        break
      }

      case 'payments': {
        const payments = await db.payment.findMany({
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { username: true, discordId: true } } },
          take: 1000,
        })
        rows = payments.map(p => ({
          id: p.id,
          userId: p.userId,
          username: p.user?.username || '',
          discordId: p.user?.discordId || '',
          planId: p.planId,
          planName: p.planName,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          razorpayOrderId: p.razorpayOrderId || '',
          razorpayPaymentId: p.razorpayPaymentId || '',
          internalOrderId: p.internalOrderId || '',
          verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : '',
          createdAt: p.createdAt.toISOString(),
        }))
        filename = `payments-${new Date().toISOString().slice(0, 10)}`
        break
      }

      case 'subscriptions': {
        const subs = await db.subscription.findMany({
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { username: true, discordId: true } } },
          take: 1000,
        })
        rows = subs.map(s => ({
          id: s.id,
          userId: s.userId,
          username: s.user?.username || '',
          discordId: s.user?.discordId || '',
          plan: s.plan,
          status: s.status,
          amountPaid: s.amountPaid,
          currency: s.currency,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          autoRenew: s.autoRenew,
          createdAt: s.createdAt.toISOString(),
        }))
        filename = `subscriptions-${new Date().toISOString().slice(0, 10)}`
        break
      }

      case 'activity': {
        const events = await db.activityEvent.findMany({
          orderBy: { createdAt: 'desc' },
          take: 1000,
        })
        rows = events.map(e => ({
          id: e.id,
          userId: e.userId || '',
          username: e.username || '',
          type: e.type,
          category: e.category,
          ip: e.ip || '',
          metadata: e.metadata || '',
          createdAt: e.createdAt.toISOString(),
        }))
        filename = `activity-${new Date().toISOString().slice(0, 10)}`
        break
      }

      case 'audit-logs': {
        const logs = await db.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 1000,
        })
        rows = logs.map(l => ({
          id: l.id,
          action: l.action,
          target: l.target || '',
          actor: l.actor,
          metadata: l.metadata || '',
          createdAt: l.createdAt.toISOString(),
        }))
        filename = `audit-logs-${new Date().toISOString().slice(0, 10)}`
        break
      }

      default:
        return NextResponse.json({ ok: false, error: `unknown entity: ${entity}` }, { status: 400 })
    }

    await db.auditLog.create({
      data: {
        action: 'data_exported',
        actor: session.userId,
        target: entity,
        metadata: JSON.stringify({ format, rowCount: rows.length }),
      },
    })

    if (format === 'json') {
      const cleanRows = rows.map(r => {
        const out: ExportRow = {}
        for (const k of Object.keys(r)) out[k] = escapeJsonField(r[k])
        return out
      })
      return new NextResponse(JSON.stringify({ ok: true, entity, count: cleanRows.length, rows: cleanRows }, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}.json"`,
        },
      })
    }

    // CSV
    const csv = toCsv(rows)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    })
  } catch (e) {
    console.error('admin/export error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
