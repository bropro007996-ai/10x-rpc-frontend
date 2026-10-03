// 10X RPC — /api/admin/api-keys — GET (list) + POST (create) + DELETE (admin only)
// Keys are stored as SHA-256 hashes; the raw key is only returned ONCE at creation time.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

const VALID_SCOPES = [
  'read:users', 'write:users',
  'read:payments', 'write:payments',
  'read:subscriptions', 'write:subscriptions',
  'read:stats', 'read:analytics',
  'send:notifications',
  'manage:announcements',
  'manage:plans',
] as const

function generateRawKey(): string {
  // 10xrpc_<32 random hex chars>
  return `10xrpc_${crypto.randomBytes(24).toString('hex')}`
}

function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex')
}

function serialize(k: any) {
  return {
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    permissions: JSON.parse(k.permissions || '[]'),
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
    lastUsedIp: k.lastUsedIp,
    isActive: k.isActive,
    createdBy: k.createdBy,
    expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
    createdAt: k.createdAt.toISOString(),
    updatedAt: k.updatedAt.toISOString(),
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const keys = await db.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({
      ok: true,
      keys: keys.map(serialize),
      availableScopes: VALID_SCOPES,
      activeCount: keys.filter(k => k.isActive).length,
    })
  } catch (e) {
    console.error('admin/api-keys GET error:', e)
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
      name?: string
      permissions?: string[]
      expiresInDays?: number
    }

    const name = (body.name || '').trim()
    if (!name) return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 })
    if (name.length > 60) return NextResponse.json({ ok: false, error: 'name too long (60 chars max)' }, { status: 400 })

    const permissions = Array.isArray(body.permissions)
      ? body.permissions.filter(p => (VALID_SCOPES as readonly string[]).includes(p))
      : []

    const rawKey = generateRawKey()
    const keyHash = hashKey(rawKey)
    const prefix = rawKey.slice(0, 14) // 10xrpc_XXXXXX

    let expiresAt: Date | null = null
    if (body.expiresInDays && body.expiresInDays > 0) {
      expiresAt = new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
    }

    const apiKey = await db.apiKey.create({
      data: {
        name,
        keyHash,
        prefix,
        permissions: JSON.stringify(permissions),
        isActive: true,
        createdBy: session.userId,
        expiresAt,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'api_key_created',
        actor: session.userId,
        target: apiKey.id,
        metadata: JSON.stringify({ name, prefix, permissions }),
      },
    })

    // Return the raw key ONCE — never again retrievable
    return NextResponse.json({
      ok: true,
      apiKey: serialize(apiKey),
      rawKey, // ⚠️ Only returned at creation time
      warning: 'Save this key now. It will not be shown again.',
    })
  } catch (e) {
    console.error('admin/api-keys POST error:', e)
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

    const existing = await db.apiKey.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ ok: false, error: 'key not found' }, { status: 404 })

    await db.apiKey.delete({ where: { id } })

    await db.auditLog.create({
      data: {
        action: 'api_key_deleted',
        actor: session.userId,
        target: id,
        metadata: JSON.stringify({ name: existing.name, prefix: existing.prefix }),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('admin/api-keys DELETE error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}

// Export the hashKey function for use in auth middleware (future)
export { hashKey, VALID_SCOPES }
