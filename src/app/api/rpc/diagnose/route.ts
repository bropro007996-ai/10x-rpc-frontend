// 10X RPC — /api/rpc/diagnose — full RPC/Status diagnostic
// Runs a complete pipeline check and returns a human-readable report of WHY
// presence may not be appearing on Discord. Requires an authenticated session.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'
import { refreshDiscordToken } from '@/lib/rpc-manager'
import WebSocket from 'ws'

export const dynamic = 'force-dynamic'
export const maxDuration = 25

interface CheckResult {
  name: string
  ok: boolean
  status: string
  detail?: string
}

export async function GET() {
  const checks: CheckResult[] = []

  // 1. Session check
  const session = await getSession()
  if (!session) {
    checks.push({ name: 'Session', ok: false, status: 'No authenticated session' })
    return NextResponse.json({ ok: false, checks })
  }
  checks.push({ name: 'Session', ok: true, status: `Signed in as ${session.user.username}` })

  // 2. Discord access token present?
  if (!session.discordAccessToken) {
    checks.push({
      name: 'Discord Token',
      ok: false,
      status: 'No Discord access token',
      detail: 'You are in DEMO mode. Sign in with Discord (not Demo Mode) to use RPC.',
    })
    return NextResponse.json({ ok: false, checks })
  }
  checks.push({ name: 'Discord Token', ok: true, status: 'Access token present' })

  // 3. Token validity — refresh if needed, then call /users/@me
  let accessToken = session.discordAccessToken
  const now = new Date()
  if (session.discordTokenExpiresAt && session.discordTokenExpiresAt < now) {
    checks.push({ name: 'Token Expiry', ok: true, status: 'Expired — refreshing...' })
    if (session.discordRefreshToken) {
      const refreshed = await refreshDiscordToken(session.discordRefreshToken)
      if (refreshed) {
        accessToken = refreshed.access_token
        await db.session.update({
          where: { id: session.id },
          data: {
            discordAccessToken: refreshed.access_token,
            discordRefreshToken: refreshed.refresh_token,
            discordTokenExpiresAt: new Date(Date.now() + (refreshed.expires_in || 604800) * 1000),
          },
        })
        checks.push({ name: 'Token Refresh', ok: true, status: 'Refreshed successfully' })
      } else {
        checks.push({
          name: 'Token Refresh',
          ok: false,
          status: 'Refresh failed',
          detail: 'Sign in with Discord again to get a fresh token.',
        })
        return NextResponse.json({ ok: false, checks })
      }
    }
  } else {
    checks.push({ name: 'Token Expiry', ok: true, status: `Valid until ${session.discordTokenExpiresAt?.toISOString()}` })
  }

  // 4. /users/@me — token works + check verification
  let userFlags = 0
  let userVerified: boolean | undefined
  let userName = ''
  try {
    const res = await fetch(`${CONFIG.discord.apiBase}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      const body = await res.text()
      checks.push({
        name: 'Discord API /users/@me',
        ok: false,
        status: `HTTP ${res.status}`,
        detail: body.slice(0, 150),
      })
      return NextResponse.json({ ok: false, checks })
    }
    const d = await res.json()
    userName = d.username
    userFlags = d.flags || 0
    userVerified = d.verified
    const isVerified = d.verified === true || (d.flags & 256) !== 0 || !!d.email
    checks.push({
      name: 'Discord API /users/@me',
      ok: true,
      status: `OK — @${d.username}`,
      detail: `verified=${d.verified} | flags=${d.flags} | email=${d.email ? 'yes' : 'no'} | mfa=${d.mfa_enabled}`,
    })
    if (!isVerified) {
      checks.push({
        name: 'Account Verification',
        ok: false,
        status: 'ACCOUNT NOT VERIFIED — presence will be SILENTLY DROPPED by Discord',
        detail:
          'Discord requires email or phone verification before accepting presence updates (custom status, rich presence, status changes). ' +
          'Go to Discord -> User Settings -> My Account -> verify your email or add a phone number, then sign in again.',
      })
    } else {
      checks.push({ name: 'Account Verification', ok: true, status: 'Account is verified' })
    }
  } catch (e) {
    checks.push({
      name: 'Discord API /users/@me',
      ok: false,
      status: 'Fetch failed',
      detail: e instanceof Error ? e.message : 'unknown',
    })
    return NextResponse.json({ ok: false, checks })
  }

  // 5. OAuth scope check (via /oauth2/@me)
  try {
    const res = await fetch(`https://discord.com/api/oauth2/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) {
      const d = await res.json()
      const scopes: string[] = d.scopes || []
      const hasPresence = scopes.includes('sdk.social_layer_presence')
      const hasIdentify = scopes.includes('identify')
      checks.push({
        name: 'OAuth Scopes',
        ok: hasPresence && hasIdentify,
        status: scopes.join(' '),
        detail: hasPresence
          ? 'sdk.social_layer_presence OK (required for gateway)'
          : 'MISSING sdk.social_layer_presence — re-authorize',
      })
    } else {
      checks.push({
        name: 'OAuth Scopes',
        ok: false,
        status: `/oauth2/@me returned ${res.status}`,
        detail: (await res.text()).slice(0, 120),
      })
    }
  } catch (e) {
    checks.push({
      name: 'OAuth Scopes',
      ok: false,
      status: 'Fetch failed',
      detail: e instanceof Error ? e.message : 'unknown',
    })
  }

  // 6. Gateway connectivity test
  try {
    const gwOk = await new Promise<boolean>((resolve) => {
      try {
        const ws = new WebSocket(CONFIG.discord.gatewayUrl)
        const t = setTimeout(() => {
          try { ws.close() } catch {}
          resolve(false)
        }, 8000)
        ws.on('open', () => {})
        ws.on('message', (data) => {
          try {
            const pl = JSON.parse(data.toString())
            if (pl.op === 10) {
              clearTimeout(t)
              try { ws.close() } catch {}
              resolve(true)
            }
          } catch {}
        })
        ws.on('error', () => {
          clearTimeout(t)
          resolve(false)
        })
        ws.on('close', () => {
          clearTimeout(t)
        })
      } catch {
        resolve(false)
      }
    })
    checks.push({
      name: 'Gaming SDK Gateway',
      ok: gwOk,
      status: gwOk ? 'Reachable (OP 10 HELLO received)' : 'Unreachable',
      detail: gwOk ? CONFIG.discord.gatewayUrl : `Could not connect to ${CONFIG.discord.gatewayUrl}`,
    })
  } catch (e) {
    checks.push({
      name: 'Gaming SDK Gateway',
      ok: false,
      status: 'Test failed',
      detail: e instanceof Error ? e.message : 'unknown',
    })
  }

  // 7. REST API test — can we PATCH /users/@me/settings? (verified accounts only)
  try {
    const res = await fetch(`${CONFIG.discord.apiBase}/users/@me/settings`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: session.userStatus || 'online' }),
    })
    if (res.ok) {
      checks.push({
        name: 'REST API (settings)',
        ok: true,
        status: 'PATCH /users/@me/settings succeeded — REST fallback available',
      })
    } else {
      const body = await res.text()
      let code: number | null = null
      try { code = JSON.parse(body).code } catch {}
      checks.push({
        name: 'REST API (settings)',
        ok: false,
        status: `PATCH failed: HTTP ${res.status}`,
        detail: `${body.slice(0, 120)}${code === 40002 ? ' (account needs verification)' : ''}`,
      })
    }
  } catch (e) {
    checks.push({
      name: 'REST API (settings)',
      ok: false,
      status: 'Fetch failed',
      detail: e instanceof Error ? e.message : 'unknown',
    })
  }

  // 8. DB state check
  const rpcConfig = await db.rpcConfig.findFirst({ where: { userId: session.userId } })
  checks.push({
    name: 'RPC Config (DB)',
    ok: !!rpcConfig,
    status: rpcConfig
      ? `name="${rpcConfig.name}" type=${rpcConfig.type} platform=${rpcConfig.platform} enabled=${rpcConfig.enabled}`
      : 'No RPC config found',
  })
  checks.push({
    name: 'Session State (DB)',
    ok: true,
    status: `rpcEnabled=${session.rpcEnabled} statusEnabled=${session.statusEnabled} gatewayReady=${session.gatewayReady} userStatus=${session.userStatus} customStatus=${session.customStatus || '(none)'}`,
  })

  const failingChecks = checks.filter((c) => !c.ok)
  const overall = failingChecks.length === 0
  const verdict = overall
    ? 'All checks passed — presence should be working. If it still does not appear in Discord, wait ~30s for the daemon to push, or check your Discord client for the activity.'
    : failingChecks.map((c) => `[${c.name}] ${c.status}`).join(' | ')

  return NextResponse.json({
    ok: overall,
    user: userName,
    checks,
    verdict,
    debug: {
      flags: userFlags,
      verified: userVerified,
      daemonRunningInProcess: true,
    },
  })
}
