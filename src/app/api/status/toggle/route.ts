// 10X RPC — /api/status/toggle — Enable/Disable User Status (completely independent from RPC)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { daemonForcePush } from '@/lib/daemon-bridge'

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

    if (enabled) {
      // 1. Check trial
      const trial = await db.trial.findUnique({ where: { userId: session.userId } })
      if (!trial || !trial.active || trial.endsAt < new Date()) {
        return NextResponse.json(
          { ok: false, error: 'trial_expired', message: 'Your 3-day trial has expired.' },
          { status: 403 }
        )
      }

      // 2. Determine target status (default to 'online' if was 'invisible' or unset)
      const currentStatus = session.userStatus
      const targetStatus = (!currentStatus || currentStatus === 'invisible') ? 'online' : currentStatus

      // 3. Update status state in DB — strictly NO changes to rpcEnabled or rpcConfig
      await db.session.updateMany({
        where: { userId: session.userId },
        data: {
          statusEnabled: true,
          userStatus: targetStatus,
          gatewayReady: true,
          lastPresenceUpdate: new Date(),
        },
      })

      // 3. Force-push to daemon (disconnects + reconnects + pushes fresh state)
      if (session.discordAccessToken) {
        console.log(`[API /api/status/toggle] Force-pushing daemon for user ${session.userId} (status ENABLED)`)
        const syncResult = await daemonForcePush(session.userId)
        console.log(`[API /api/status/toggle] Daemon result:`, syncResult)
      }

      return NextResponse.json({
        ok: true,
        statusEnabled: true,
        userStatus: targetStatus,
        message: 'Status enabled (Online on Discord)',
      })
    } else {
      // 1. Disable status state in DB — strictly NO changes to rpcEnabled, gamesRpcEnabled,
      //    rpcConfig, or gameRpcConfig.
      // 2. Update gatewayReady: keep the gateway alive only if RPC or Games RPC is still ON.
      const rpcSession = await db.session.findFirst({
        where: { userId: session.userId, rpcEnabled: true },
      })
      const gamesSession = await db.session.findFirst({
        where: { userId: session.userId, gamesRpcEnabled: true },
      })
      const keepGateway = !!rpcSession || !!gamesSession

      await db.session.updateMany({
        where: { userId: session.userId },
        data: {
          statusEnabled: false,
          gatewayReady: keepGateway,
          lastPresenceUpdate: new Date(),
        },
      })

      // 3. Force-push to daemon (clears custom status from Discord immediately)
      if (session.discordAccessToken) {
        console.log(`[API /api/status/toggle] Force-pushing daemon for user ${session.userId} (status DISABLED)`)
        const syncResult = await daemonForcePush(session.userId)
        console.log(`[API /api/status/toggle] Daemon result:`, syncResult)
      }

      return NextResponse.json({
        ok: true,
        statusEnabled: false,
        userStatus: session.userStatus,
        message: 'Status disabled (Offline)',
      })
    }
  } catch (e: any) {
    console.error('Error in /api/status/toggle:', e)
    return NextResponse.json({
      ok: false,
      error: 'toggle_failed',
      message: e?.message || 'Failed to toggle status',
    }, { status: 500 })
  }
}
