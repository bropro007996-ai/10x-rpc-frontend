// 10X RPC — Legacy /auth/callback → redirects to /auth/discord/callback
//
// The canonical OAuth callback handler now lives at /auth/discord/callback to
// match CONFIG.discord.redirectUri and the redirect URI registered in the
// Discord Developer Portal. This legacy path preserves any code/state in the
// query string so an in-flight OAuth flow that somehow still hits /auth/callback
// is forwarded transparently instead of 404'ing.
import { NextResponse } from 'next/server'
import { absoluteUrl } from '@/lib/url'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const target = absoluteUrl(req, `/auth/discord/callback${url.search}`)
  return NextResponse.redirect(target)
}
