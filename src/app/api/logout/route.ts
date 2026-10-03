// 10X RPC — /api/logout
import { NextResponse } from 'next/server'
import { clearSessionCookie, getSession } from '@/lib/session'
import { logActivity } from '@/lib/activity/logger'

export const dynamic = 'force-dynamic'

export async function POST() {
  // Capture logout event before clearing the session
  const session = await getSession().catch(() => null)
  if (session) {
    await logActivity({
      userId: session.userId,
      username: session.user.username,
      type: 'logout',
      category: 'user',
    })
  }
  await clearSessionCookie()
  // Return a RELATIVE redirect path so the frontend works in every environment
  // (localhost, Vercel prod, sandbox preview proxy). The caller does
  // window.location.href = '/' already; this is just for completeness.
  return NextResponse.json({ ok: true, redirect: '/' })
}
