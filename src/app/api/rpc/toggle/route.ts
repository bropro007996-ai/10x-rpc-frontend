// 10X RPC — /api/rpc/toggle — Enable/Disable Normal RPC
// MUTUALLY EXCLUSIVE: When Normal RPC is enabled, Game RPC is automatically disabled.
// This ensures both modes can never be active at the same time.
// All other settings (statusEnabled, custom status, trial, gateway) are preserved.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { daemonSyncUser, daemonStopUserRpc } from '@/lib/daemon-bridge'
import { logActivity } from '@/lib/activity/logger'
import { isSubscriptionSuspended } from '@/lib/subscription'
import { getSubscriptionStatus } from '@/lib/subscription'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'not_authenticated' },
        { status: 401 }
      )
    }

    const body = await req.json() as { enabled?: boolean }
    const enabled = !!body.enabled

    // BLOCK RPC for suspended users
    if (enabled) {
      const subStatus = await getSubscriptionStatus(session.userId)
      if (!subStatus.active && !subStatus.isTrial) {
        return NextResponse.json(
          { ok: false, error: 'subscription_suspended', message: 'Your subscription is suspended. Please renew to restore RPC access.' },
          { status: 403 }
        )
      }
    }

    if (enabled) {
      // 1. Check trial
      const trial = await db.trial.findUnique({ where: { userId: session.userId } })
      if (!trial || !trial.active || trial.endsAt < new Date()) {
        return NextResponse.json(
          { ok: false, error: 'trial_expired', message: 'Your trial has expired.' },
          { status: 403 }
        )
      }

      // 2. MUTUAL EXCLUSIVITY: Disable Game RPC if it's currently enabled
      const currentSession = await db.session.findFirst({ where: { userId: session.userId } })
      const gamesRpcWasEnabled = currentSession?.gamesRpcEnabled ?? false

      if (gamesRpcWasEnabled) {
        // Disable Game RPC in session
        await db.session.updateMany({
          where: { userId: session.userId },
          data: { gamesRpcEnabled: false },
        })
        // Disable Game RPC config
        const gameConfig = await db.gameRpcConfig.findUnique({ where: { userId: session.userId } })
        if (gameConfig) {
          await db.gameRpcConfig.update({
            where: { userId: session.userId },
            data: { enabled: false },
          })
        }
        await logActivity({
          userId: session.userId,
          username: session.user.username,
          type: 'games_rpc_auto_disabled',
          category: 'rpc',
          metadata: { reason: 'normal_rpc_enabled' },
        })
      }

      // 3. Load latest saved DB config and mark enabled with fresh timestamp
      let rpcConfig = await db.rpcConfig.findFirst({ where: { userId: session.userId } })
      if (rpcConfig) {
        rpcConfig = await db.rpcConfig.update({
          where: { id: rpcConfig.id },
          data: { enabled: true },
        })
      } else {
        rpcConfig = await db.rpcConfig.create({
          data: {
            userId: session.userId,
            name: '10X RPC',
            type: 'PLAYING',
            platform: 'desktop',
            enabled: true,
            startMinsAgo: 0,
          },
        })
      }

      // 4. Update session: enable RPC, preserve gateway (status may still be active)
      // Determine if gateway should stay alive (status is separate from RPC)
      const statusSession = await db.session.findFirst({
        where: { userId: session.userId, statusEnabled: true },
      })
      await db.session.updateMany({
        where: { userId: session.userId },
        data: {
          rpcEnabled: true,
          gamesRpcEnabled: false, // enforce mutual exclusivity at session level too
          gatewayReady: true,
          lastPresenceUpdate: new Date(),
        },
      })

      // 5. Start RPC via the Render daemon (long-lived process owns the gateway socket)
      if (session.discordAccessToken) {
        await daemonSyncUser(session.userId)
      }

      await logActivity({
        userId: session.userId,
        username: session.user.username,
        type: 'rpc_enabled',
        category: 'rpc',
        metadata: { rpcConfigName: rpcConfig?.name, gamesRpcWasDisabled: gamesRpcWasEnabled },
      })

      return NextResponse.json({
        ok: true,
        enabled: true,
        rpcConfig,
        gamesRpcAutoDisabled: gamesRpcWasEnabled,
        message: gamesRpcWasEnabled
          ? 'RPC enabled & live on Discord (Game RPC was auto-disabled)'
          : 'RPC enabled & live on Discord',
      })
    } else {
      // 1. Stop RPC for ONLY THIS USER (does not affect any other user)
      const statusSession = await db.session.findFirst({
        where: {
          userId: session.userId,
          statusEnabled: true,
        },
      })
      const keepGateway = !!statusSession

      // ONLY update THIS user's sessions — where: { userId: session.userId }
      const stopResult = await db.session.updateMany({
        where: { userId: session.userId },
        data: {
          rpcEnabled: false,
          gamesRpcEnabled: false,
          gatewayReady: keepGateway,
          lastPresenceUpdate: new Date(),
        },
      })

      const rpcConfig = await db.rpcConfig.findFirst({ where: { userId: session.userId } })
      let updatedRpcConfig = rpcConfig
      if (rpcConfig) {
        updatedRpcConfig = await db.rpcConfig.update({
          where: { id: rpcConfig.id },
          data: { enabled: false },
        })
      }

      // 2. Clear Discord Rich Presence completely via the Render daemon
      //    (stops all timers & background updates for RPC; preserves Status if still ON)
      if (session.discordAccessToken) {
        await daemonStopUserRpc(session.userId)
      }

      await logActivity({
        userId: session.userId,
        username: session.user.username,
        type: 'rpc_disabled',
        category: 'rpc',
      })

      return NextResponse.json({
        ok: true,
        enabled: false,
        rpcConfig: updatedRpcConfig,
        message: 'RPC stopped & Rich Presence cleared from Discord',
      })
    }
  } catch (e: any) {
    console.error('Error in /api/rpc/toggle:', e)
    return NextResponse.json({
      ok: false,
      error: 'toggle_failed',
      message: e?.message || 'Failed to toggle RPC',
    }, { status: 500 })
  }
}
