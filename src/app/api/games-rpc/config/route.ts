// 10X RPC — /api/games-rpc/config — GET/POST the user's Games RPC config
// INSTANT UPDATE: Returns immediately after DB write. Discord push runs in background.
import { NextResponse, after } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { daemonPushUpdate } from '@/lib/daemon-bridge'
import { findSpoofGame } from '@/lib/spoof-games'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let gameRpcConfig = await db.gameRpcConfig.findUnique({ where: { userId: session.userId } })
  if (!gameRpcConfig) {
    // Initialize with Minecraft defaults
    const game = findSpoofGame('minecraft')!
    gameRpcConfig = await db.gameRpcConfig.create({
      data: {
        userId: session.userId,
        gameSlug: 'minecraft',
        enabled: false,
        state: game.defaultState,
        details: game.defaultDetails,
        partyCurrent: game.defaultPartyCurrent,
        partyMax: game.defaultPartyMax,
      },
    })
  }

  return NextResponse.json({ gameRpcConfig, gamesRpcEnabled: session.gamesRpcEnabled })
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

    const body = await req.json()
    const gameSlug = body.gameSlug || 'minecraft'

    // Validate game slug exists
    const game = findSpoofGame(gameSlug)
    if (!game) {
      return NextResponse.json({ ok: false, error: 'invalid_game_slug' }, { status: 400 })
    }

    // NOTE: the `enabled` field from the body is IGNORED for session/config state.
    // The toggle state is controlled exclusively by /api/games-rpc/toggle (which
    // enforces mutual exclusivity with Normal RPC). The save route only persists
    // CONFIG fields. This prevents the "UPDATE" button from accidentally toggling
    // Games RPC on/off or creating a state where both are enabled simultaneously.

    const data = {
      gameSlug,
      state: body.state?.trim() || null,
      details: body.details?.trim() || null,
      largeImage: body.largeImage?.trim() || null,
      largeText: body.largeText?.trim() || null,
      smallImage: body.smallImage?.trim() || null,
      smallText: body.smallText?.trim() || null,
      button1Label: body.button1Label?.trim() || null,
      button1Url: body.button1Url?.trim() || null,
      button2Label: body.button2Label?.trim() || null,
      button2Url: body.button2Url?.trim() || null,
      partyCurrent: typeof body.partyCurrent === 'number' ? body.partyCurrent : 1,
      partyMax: typeof body.partyMax === 'number' ? body.partyMax : game.defaultPartyMax,
      startMinsAgo: typeof body.startMinsAgo === 'number' ? body.startMinsAgo : 0,
      endTotalMins: typeof body.endTotalMins === 'number' ? body.endTotalMins : null,
    }

    // 1. Save ONLY config fields to DB. Do NOT touch gameRpcConfig.enabled —
    //    that flag is managed exclusively by /api/games-rpc/toggle.
    const existing = await db.gameRpcConfig.findUnique({ where: { userId: session.userId } })
    let gameRpcConfig
    if (existing) {
      gameRpcConfig = await db.gameRpcConfig.update({ where: { userId: session.userId }, data })
    } else {
      gameRpcConfig = await db.gameRpcConfig.create({ data: { userId: session.userId, ...data, enabled: false } })
    }

    // 2. Do NOT update session.gamesRpcEnabled — that is controlled by /api/games-rpc/toggle.
    await db.session.updateMany({
      where: { userId: session.userId },
      data: { lastPresenceUpdate: new Date() },
    })

    // 3. Check if Games RPC is currently enabled
    const currentSession = await db.session.findFirst({ where: { userId: session.userId } })
    const isGamesRpcCurrentlyEnabled = !!currentSession?.gamesRpcEnabled
    const userId = session.userId
    const hasDiscordToken = !!session.discordAccessToken

    // 4. Return INSTANTLY
    const response = NextResponse.json({
      ok: true,
      gameRpcConfig,
      gamesRpcEnabled: isGamesRpcCurrentlyEnabled,
      syncing: hasDiscordToken && isGamesRpcCurrentlyEnabled,
      message: isGamesRpcCurrentlyEnabled
        ? 'Games RPC updated & syncing to Discord'
        : 'Configuration saved (Games RPC is OFF)',
    })

    // 5. Background push
    if (hasDiscordToken && isGamesRpcCurrentlyEnabled) {
      after(async () => {
        try {
          await daemonPushUpdate(userId)
        } catch (e) {
          console.error('[games-rpc/config] Background push failed:', e)
        }
      })
    }

    return response
  } catch (e: any) {
    console.error('Error saving Games RPC config:', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Failed' }, { status: 500 })
  }
}
