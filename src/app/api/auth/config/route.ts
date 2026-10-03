// 10X RPC — /api/auth/config — public endpoint that tells the frontend whether
// real Discord OAuth is configured. When it isn't (e.g. local sandbox / preview
// without DISCORD_CLIENT_ID), the OAuth consent page promotes "Continue with
// Demo" to the primary action instead of sending the user to a broken Discord
// authorize URL with an empty client_id.
import { NextResponse } from 'next/server'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const oauthAvailable = !!(
    CONFIG.discord.clientId &&
    CONFIG.discord.clientSecret
  )
  return NextResponse.json({
    oauthAvailable,
    // Demo mode is always available — it creates a local demo user + session.
    demoAvailable: true,
    appName: CONFIG.app.name,
  })
}
