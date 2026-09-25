// 10X RPC — /api/admin/feature-flags — GET (list) + PUT (toggle/update) (admin only)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

// Default feature flags that should always exist
const DEFAULT_FLAGS = [
  { key: 'maintenance_mode',       label: 'Maintenance Mode',          description: 'Take the site offline for non-admin users', category: 'general',  enabled: false },
  { key: 'disable_new_signups',    label: 'Disable New Signups',       description: 'Block new Discord OAuth registrations', category: 'general',  enabled: false },
  { key: 'disable_demo_login',     label: 'Disable Demo Login',         description: 'Block the demo-mode login button', category: 'general',  enabled: false },
  { key: 'disable_payments',       label: 'Disable Payments',           description: 'Block new subscription purchases', category: 'payments', enabled: false },
  { key: 'force_rpc_for_all',      label: 'Force RPC for All',          description: 'Enable RPC for every user regardless of trial status', category: 'rpc', enabled: false },
  { key: 'beta_features',          label: 'Beta Features',              description: 'Enable experimental features for all users', category: 'beta', enabled: false },
  { key: 'beta_games_rpc',         label: 'Beta: Games RPC',             description: 'Show the Games RPC tab to all users', category: 'beta', enabled: true },
  { key: 'require_email_verify',   label: 'Require Email Verification',  description: 'Force email verification before dashboard access', category: 'security', enabled: false },
  { key: 'log_all_actions',        label: 'Verbose Audit Logging',       description: 'Log every user action (high DB write volume)', category: 'security', enabled: false },
]

async function ensureDefaultFlags() {
  for (const f of DEFAULT_FLAGS) {
    const existing = await db.featureFlag.findUnique({ where: { key: f.key } })
    if (!existing) {
      await db.featureFlag.create({
        data: {
          key: f.key,
          label: f.label,
          description: f.description,
          category: f.category,
          enabled: f.enabled,
        },
      })
    }
  }
}

function serialize(f: any) {
  return {
    id: f.id,
    key: f.key,
    label: f.label,
    description: f.description,
    enabled: f.enabled,
    category: f.category,
    updatedAt: f.updatedAt.toISOString(),
    createdAt: f.createdAt.toISOString(),
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    await ensureDefaultFlags()
    const flags = await db.featureFlag.findMany({
      orderBy: [{ category: 'asc' }, { label: 'asc' }],
    })
    return NextResponse.json({ ok: true, flags: flags.map(serialize) })
  } catch (e) {
    console.error('admin/feature-flags GET error:', e)
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
      key?: string
      enabled?: boolean
      label?: string
      description?: string
    }

    if (!body.key) {
      return NextResponse.json({ ok: false, error: 'key is required' }, { status: 400 })
    }

    await ensureDefaultFlags()
    const existing = await db.featureFlag.findUnique({ where: { key: body.key } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'flag not found' }, { status: 404 })
    }

    const data: { enabled?: boolean; label?: string; description?: string } = {}
    if (body.enabled !== undefined) data.enabled = !!body.enabled
    if (body.label !== undefined) data.label = body.label
    if (body.description !== undefined) data.description = body.description

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: 'no fields to update' }, { status: 400 })
    }

    const updated = await db.featureFlag.update({
      where: { key: body.key },
      data,
    })

    await db.auditLog.create({
      data: {
        action: 'feature_flag_toggled',
        actor: session.userId,
        target: body.key,
        metadata: JSON.stringify(data),
      },
    })

    return NextResponse.json({ ok: true, flag: serialize(updated) })
  } catch (e) {
    console.error('admin/feature-flags PUT error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}
