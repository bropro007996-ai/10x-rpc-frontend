// 10X RPC — /api/auth/redirect-uri — returns the OAuth redirect URI
import { NextResponse } from 'next/server'
import { CONFIG } from '@/lib/config'
import { requestOrigin } from '@/lib/url'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // On Vercel (production), use the configured redirect URI (www.10xrpc.shop)
  // On localhost/preview, derive from the request origin
  const origin = requestOrigin(req)
  const isVercel = process.env.VERCEL === '1'
  const redirectUri = isVercel && CONFIG.discord.redirectUri
    ? CONFIG.discord.redirectUri
    : `${origin}/auth/discord/callback`

  return NextResponse.json({
    origin,
    redirectUri,
    instructions: `Register this URL in Discord Developer Portal → OAuth2 → Redirects: ${redirectUri}`,
  })
}
