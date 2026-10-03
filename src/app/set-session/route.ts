// 10X RPC — /set-session — sets the session cookie, then redirects to the dashboard.
// Runs on the SAME origin as the browser (Vercel in prod, sandbox preview in dev).
// Uses the request's own origin for the redirect so it works in every environment —
// never redirects to a hardcoded host (which previously broke sign-in in the preview
// proxy because CONFIG.app.url defaulted to http://localhost:3000).
import { NextResponse } from 'next/server'
import { CONFIG } from '@/lib/config'
import { absoluteUrl } from '@/lib/url'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(absoluteUrl(req, '/?error=missing_token'))
  }

  // Set the session cookie on the current origin (where the browser lives)
  const expiresAt = new Date(Date.now() + CONFIG.session.ttlDays * 24 * 60 * 60 * 1000)
  const res = NextResponse.redirect(absoluteUrl(req, '/dashboard'))
  res.cookies.set(CONFIG.session.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
  return res
}
