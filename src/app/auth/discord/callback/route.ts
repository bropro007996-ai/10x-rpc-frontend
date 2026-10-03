// 10X RPC — OAuth callback handler at /auth/discord/callback
//
// This path MUST match CONFIG.discord.redirectUri
// (https://www.10xrpc.shop/auth/discord/callback) and the redirect URI
// registered in the Discord Developer Portal. A previous version of the route
// lived at /auth/callback, which caused a 404 because Discord redirected to
// /auth/discord/callback (per the hardcoded config) while no handler existed
// there.
//
// Looks up the PKCE verifier from the database by state (NOT cookies).
// All redirects use the request's own origin (via absoluteUrl) so the flow
// works on Vercel, localhost, and the sandbox preview proxy without any
// hardcoded host.
import { NextResponse } from 'next/server'
import { exchangeCode, fetchDiscordUser } from '@/lib/discord-oauth'
import { CONFIG } from '@/lib/config'
import { db } from '@/lib/db'
import { setSessionCookie } from '@/lib/session'
import { absoluteUrl } from '@/lib/url'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(absoluteUrl(req, `/?error=${encodeURIComponent(error)}`))
  }
  if (!code || !state) {
    return NextResponse.redirect(absoluteUrl(req, '/?error=missing_code'))
  }

  // Look up the PKCE verifier from the database by state
  const oauthState = await db.oAuthState.findUnique({
    where: { state },
  })

  if (!oauthState) {
    return NextResponse.redirect(absoluteUrl(req, '/?error=invalid_state'))
  }

  // Check if the state has expired
  if (oauthState.expiresAt < new Date()) {
    await db.oAuthState.delete({ where: { id: oauthState.id } }).catch(() => {})
    return NextResponse.redirect(absoluteUrl(req, '/?error=state_expired'))
  }

  const verifier = oauthState.verifier

  // Delete the state so it can't be reused (one-time use)
  await db.oAuthState.delete({ where: { id: oauthState.id } }).catch(() => {})

  try {
    // The redirect URI passed to Discord's token endpoint MUST exactly match the
    // one used to build the authorize URL (i.e. CONFIG.discord.redirectUri).
    const redirectUri = CONFIG.discord.redirectUri
    const tokens = await exchangeCode(code, verifier, redirectUri)
    const discordUser = await fetchDiscordUser(tokens.access_token)

    // Upsert the user
    const user = await db.user.upsert({
      where: { discordId: discordUser.id },
      create: {
        discordId: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator,
        avatar: discordUser.avatar,
      },
      update: {
        username: discordUser.username,
        discriminator: discordUser.discriminator,
        avatar: discordUser.avatar,
      },
    })

    // Create trial if not present
    if (!await db.trial.findUnique({ where: { userId: user.id } })) {
      await db.trial.create({
        data: {
          userId: user.id,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + CONFIG.app.trialDays * 24 * 60 * 60 * 1000),
        },
      })
    }

    // Create default GlobalConfig if not present
    if (!await db.globalConfig.findUnique({ where: { userId: user.id } })) {
      await db.globalConfig.create({ data: { userId: user.id } })
    }

    // Create the session and get the token back
    const sessionToken = await setSessionCookie(user.id)

    // Store the Discord OAuth tokens in that session
    if (sessionToken) {
      await db.session.update({
        where: { token: sessionToken },
        data: {
          discordAccessToken: tokens.access_token,
          discordRefreshToken: tokens.refresh_token,
          discordTokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 604800) * 1000),
        },
      })
    }

    // Redirect to /set-session on the SAME origin so the session cookie is set
    // on the browser's actual domain.
    return NextResponse.redirect(absoluteUrl(req, `/set-session?token=${encodeURIComponent(sessionToken)}`))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown_error'
    return NextResponse.redirect(absoluteUrl(req, `/?error=${encodeURIComponent(msg)}`))
  }
}
