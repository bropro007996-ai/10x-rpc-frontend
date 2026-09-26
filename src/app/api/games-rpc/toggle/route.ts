// 10X RPC — /api/games-rpc/toggle — Enable/Disable Games RPC
// MUTUALLY EXCLUSIVE: When Game RPC is enabled, Normal RPC is automatically disabled.
// This ensures both modes can never be active at the same time.
// All other settings (statusEnabled, custom status, trial, gateway) are preserved.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { daemonSyncUser, daemonStopUserRpc } from '@/lib/daemon-bridge'
import { findSpoofGame } from '@/lib/spoof-games'
import { logActivity } from '@/lib/activity/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
    }

    const body = await req.json() as { enabled?: boolean }
    const enabled = !!body.enabled

    if (enabled) {
      // 1. Check trial
      const trial = await db.trial.findUnique({ where: { userId: session.userId } })
      if (!trial || !trial.active || trial.endsAt < new Date()) {
        return NextResponse.json(
          { ok: false, error: 'trial_expired', message: 'Your trial has expired.' },
          { status: 403 }
        )
      }

      // 2. MUTUAL EXCLUSIVITY: Disable Normal RPC if it's currently enabled
      const currentSession = await db.session.findFirst({ where: { userId: session.userId } })
      const normalRpcWasEnabled = currentSession?.rpcEnabled ?? false

      if (normalRpcWasEnabled) {
        // Disable Normal RPC in session
        await db.session.updateMany({
          where: { userId: session.userId },
          data: { rpcEnabled: false },
        })
        // Disable Normal RPC config
        const rpcConfig = await db.rpcConfig.findFirst({ where: { userId: session.userId } })
        if (rpcConfig) {
          await db.rpcConfig.update({
            where: { id: rpcConfig.id },
            data: { enabled: false },
          })
        }
        // Stop the Normal RPC daemon activity (clears normal RPC presence)
        if (session.discordAccessToken) {
          await daemonStopUserRpc(session.userId)
        }
        await logActivity({
          userId: session.userId,
          username: session.user.username,
          type: 'normal_rpc_auto_disabled',
          category: 'rpc',
          metadata: { reason: 'games_rpc_enabled' },
        })
      }

      // 3. Load/create the game RPC config (default: Minecraft)
      let gameRpcConfig = await db.gameRpcConfig.findUnique({ where: { userId: session.userId } })
      if (gameRpcConfig) {
        gameRpcConfig = await db.gameRpcConfig.update({
          where: { userId: session.userId },
          data: { enabled: true },
        })
      } else {
        const game = findSpoofGame('minecraft')!
        gameRpcConfig = await db.gameRpcConfig.create({
          data: {
            userId: session.userId,
            gameSlug: 'minecraft',
            enabled: true,
            state: game.defaultState,
            details: game.defaultDetails,
            partyCurrent: game.defaultPartyCurrent,
            partyMax: game.defaultPartyMax,
          },
        })
      }

      // 4. Enable Games RPC in session — enforce rpcEnabled=false (mutual exclusivity)
      await db.session.updateMany({
        where: { userId: session.userId },
        data: {
          gamesRpcEnabled: true,
          rpcEnabled: false, // enforce mutual exclusivity at session level
          gatewayReady: true,
          lastPresenceUpdate: new Date(),
        },
      })

      // 5. Sync daemon (pushes game activity — takes priority over normal RPC)
      if (session.discordAccessToken) {
        await daemonSyncUser(session.userId)
      }

      await logActivity({
        userId: session.userId,
        username: session.user.username,
        type: 'games_rpc_enabled',
        category: 'rpc',
        metadata: { gameSlug: gameRpcConfig.gameSlug, normalRpcWasDisabled: normalRpcWasEnabled },
      })

      return NextResponse.json({
        ok: true,
        enabled: true,
        gameRpcConfig,
        normalRpcAutoDisabled: normalRpcWasEnabled,
        message: normalRpcWasEnabled
          ? 'Games RPC enabled & live on Discord (Normal RPC was auto-disabled)'
          : 'Games RPC enabled & live on Discord',
      })
    } else {
      // Disable Games RPC — NEVER touches rpcEnabled or statusEnabled
      const statusSession = await db.session.findFirst({
        where: { userId: session.userId, statusEnabled: true },
      })
      const normalRpcSession = await db.session.findFirst({
        where: { userId: session.userId, rpcEnabled: true },
      })
      const keepGateway = !!statusSession || !!normalRpcSession

      await db.session.updateMany({
        where: { userId: session.userId },
        data: {
          gamesRpcEnabled: false,
          gatewayReady: keepGateway,
          lastPresenceUpdate: new Date(),
        },
      })

      const gameRpcConfig = await db.gameRpcConfig.findUnique({ where: { userId: session.userId } })
      if (gameRpcConfig) {
        await db.gameRpcConfig.update({
          where: { userId: session.userId },
          data: { enabled: false },
        })
      }

      // Sync daemon — will clear the game activity (transition detected)
      if (session.discordAccessToken) {
        await daemonSyncUser(session.userId)
      }

      await logActivity({
        userId: session.userId,
        username: session.user.username,
        type: 'games_rpc_disabled',
        category: 'rpc',
      })

      return NextResponse.json({
        ok: true,
        enabled: false,
        message: 'Games RPC disabled & cleared from Discord',
      })
    }
  } catch (e: any) {
    console.error('Error in /api/games-rpc/toggle:', e)
    return NextResponse.json({
      ok: false,
      error: 'toggle_failed',
      message: e?.message || 'Failed to toggle Games RPC',
    }, { status: 500 })
  }
}
