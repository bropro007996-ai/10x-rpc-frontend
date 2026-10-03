// 10X RPC — /api/status/update — Save & Apply ONLY Status configuration
// Strictly independent from RPC: never modifies rpcConfig, never touches rpcEnabled, never starts RPC.
//
// PUSH STRATEGY:
//   - Platform change (mobile↔VR↔desktop) → AWAIT daemonForcePush (full reconnect).
//     This MUST be awaited because it takes 3-6s and the user needs to know
//     if the reconnect succeeded. Backgrounding it via after() risks the
//     Vercel process being killed before the reconnect completes.
//   - Non-platform change (text/status/emoji) → BACKGROUND daemonPushUpdate via after().
//     This is fast (~50ms if socket connected) and safe to background.
import { NextResponse, after } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { daemonPushUpdate, daemonForcePush } from '@/lib/daemon-bridge'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export interface StatusUpdateInput {
  userStatus?: string
  customStatus?: string | null
  customStatusEmoji?: string | null
  statusPlatform?: string
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
    }

    const body: StatusUpdateInput = await req.json()

    const updateData: Record<string, unknown> = {
      lastPresenceUpdate: new Date(),
    }

    // Track whether the platform changed — determines push strategy
    let platformChanged = false

    if (body.userStatus !== undefined) {
      const validStatuses = ['online', 'idle', 'dnd', 'invisible']
      if (!validStatuses.includes(body.userStatus)) {
        return NextResponse.json(
          { ok: false, error: 'invalid_status', message: 'Status must be online, idle, dnd, or invisible' },
          { status: 400 }
        )
      }
      updateData.userStatus = body.userStatus
    }

    if (body.customStatus !== undefined) {
      const text = body.customStatus ? body.customStatus.trim() : null
      if (text && text.length > 128) {
        return NextResponse.json(
          { ok: false, error: 'invalid_text', message: 'Custom message too long (max 128 chars)' },
          { status: 400 }
        )
      }
      updateData.customStatus = text
    }

    if (body.customStatusEmoji !== undefined) {
      updateData.customStatusEmoji = body.customStatusEmoji ? body.customStatusEmoji.trim() : null
    }

    if (body.statusPlatform !== undefined) {
      const platform = body.statusPlatform || 'mobile'
      const oldPlatform = session.statusPlatform || 'mobile'
      if (platform !== oldPlatform) {
        platformChanged = true
      }
      updateData.statusPlatform = platform
      updateData.vrStatusActive = platform === 'meta_quest'
    }

    // ── Save to DB (source of truth) ───────────────────────────────────────
    await db.session.updateMany({
      where: { userId: session.userId },
      data: updateData,
    })

    const isStatusEnabled = !!session.statusEnabled
    const userId = session.userId
    const hasDiscordToken = !!session.discordAccessToken
    const shouldPush = hasDiscordToken && isStatusEnabled

    // ── PUSH STRATEGY ──────────────────────────────────────────────────────
    // Platform changes REQUIRE a full reconnect (new IDENTIFY) → MUST await.
    // Non-platform changes are fast → background via after().
    let pushResult: { ok: boolean; message?: string } | null = null
    if (shouldPush && platformChanged) {
      // AWAIT the full reconnect — the response reflects success/failure
      pushResult = await daemonForcePush(userId)
    }

    // Build the response
    const response = NextResponse.json({
      ok: true,
      statusEnabled: isStatusEnabled,
      userStatus: (updateData.userStatus as string) || session.userStatus || 'online',
      customStatus: (updateData.customStatus as string | null) ?? session.customStatus,
      customStatusEmoji: (updateData.customStatusEmoji as string | null) ?? session.customStatusEmoji,
      statusPlatform: (updateData.statusPlatform as string) || session.statusPlatform || 'mobile',
      syncing: shouldPush && !platformChanged, // background push in progress
      pushed: pushResult ? pushResult.ok : undefined,
      message: (() => {
        if (!shouldPush) {
          return isStatusEnabled
            ? '✓ Status updated & syncing to Discord'
            : '✓ Status configuration saved (Status is OFF)'
        }
        if (platformChanged) {
          return pushResult?.ok
            ? '✓ Platform changed & synced to Discord'
            : `✓ Platform saved but sync failed: ${pushResult?.message || 'unknown'}`
        }
        return '✓ Status updated & syncing to Discord'
      })(),
    })

    // Background push for non-platform changes (fast path, ~50ms)
    if (shouldPush && !platformChanged) {
      after(async () => {
        try {
          await daemonPushUpdate(userId)
        } catch (e) {
          console.error('[status/update] Background push failed:', e)
        }
      })
    }

    return response
  } catch (e: any) {
    console.error('Error in /api/status/update:', e)
    return NextResponse.json(
      { ok: false, error: 'status_update_failed', message: e?.message || 'Failed to update status' },
      { status: 500 }
    )
  }
}
