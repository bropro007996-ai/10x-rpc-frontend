// 10X RPC — /api/admin/impersonate — POST: start impersonating a user (admin only)
//                                DELETE: end impersonation
import { NextResponse } from 'next/server'
import { getSession, setSessionCookie, clearSessionCookie, createSessionToken } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'
import { logActivity } from '@/lib/activity/logger'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  if (!isAdmin(session.user.discordId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const body = (await req.json().catch(() => ({}))) as { userId?: string }
    if (!body.userId) return NextResponse.json({ ok: false, error: 'userId is required' }, { status: 400 })

    const targetUser = await db.user.findUnique({
      where: { id: body.userId },
      select: { id: true, discordId: true, username: true, avatar: true },
    })
    if (!targetUser) return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 })

    // Don't allow impersonating other admins (security)
    if (isAdmin(targetUser.discordId) && targetUser.id !== session.userId) {
      return NextResponse.json({ ok: false, error: 'cannot impersonate other admins' }, { status: 403 })
    }

    // Save the admin's original session token in a short-lived cookie so we can restore it
    const originalToken = (await import('next/headers')).cookies().get(CONFIG.session.cookieName)?.value

    // Create a new session for the target user
    const newToken = createSessionToken(targetUser.id)
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours max for impersonation
    await db.session.create({
      data: { userId: targetUser.id, token: newToken, expiresAt },
    })

    // Set the new session cookie
    const cookieStore = await import('next/headers')
    cookieStore.cookies().set(CONFIG.session.cookieName, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    })

    // Store original admin token in a separate short-lived cookie (2 hours)
    if (originalToken) {
      cookieStore.cookies().set('10x_rpc_impersonator', originalToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      })
    }

    await logActivity({
      userId: session.userId,
      username: session.user.username,
      type: 'admin_impersonate_start',
      category: 'admin',
      metadata: { targetUserId: targetUser.id, targetUsername: targetUser.username },
    })

    return NextResponse.json({
      ok: true,
      message: `Now impersonating ${targetUser.username}`,
      user: targetUser,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (e) {
    console.error('admin/impersonate POST error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  const cookieStore = await import('next/headers')
  const impersonatorToken = cookieStore.cookies().get('10x_rpc_impersonator')?.value

  if (!impersonatorToken) {
    return NextResponse.json({ ok: false, error: 'no impersonation session to restore' }, { status: 400 })
  }

  // Delete the impersonation session from DB
  const currentToken = cookieStore.cookies().get(CONFIG.session.cookieName)?.value
  if (currentToken) {
    await db.session.deleteMany({ where: { token: currentToken } }).catch(() => {})
  }

  // Restore the admin's original session
  const expiresAt = new Date(Date.now() + CONFIG.session.ttlDays * 24 * 60 * 60 * 1000)
  cookieStore.cookies().set(CONFIG.session.cookieName, impersonatorToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })

  // Clear the impersonator cookie
  cookieStore.cookies().delete('10x_rpc_impersonator')

  // Log restoration
  const session = await getSession()
  if (session) {
    await logActivity({
      userId: session.userId,
      username: session.user.username,
      type: 'admin_impersonate_end',
      category: 'admin',
    })
  }

  return NextResponse.json({ ok: true, message: 'Impersonation ended, admin session restored' })
}
