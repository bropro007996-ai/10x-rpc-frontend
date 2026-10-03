// 10X RPC — /api/rpc/status — set user status (online/idle/dnd/invisible) via Gateway
// INSTANT UPDATE: Returns immediately after DB write. Discord push runs in background.
import { NextResponse, after } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { daemonPushUpdate } from '@/lib/daemon-bridge'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }

  const body = await req.json() as { status?: string }
  const status = body.status || 'online'

  if (!['online', 'idle', 'dnd', 'invisible'].includes(status)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_status', message: 'Must be: online, idle, dnd, or invisible' },
      { status: 400 }
    )
  }

  // Persist to session
  await db.session.updateMany({
    where: { userId: session.userId },
    data: {
      userStatus: status,
      lastPresenceUpdate: new Date(),
    },
  })

  const hasDiscordToken = !!session.discordAccessToken
  const isStatusEnabled = !!session.statusEnabled
  const userId = session.userId

  // Return INSTANTLY
  const response = NextResponse.json({
    ok: true,
    status,
    syncing: hasDiscordToken && isStatusEnabled,
    message: hasDiscordToken && isStatusEnabled
      ? `Status set to ${status} & syncing`
      : `Status set to ${status}`,
  })

  // Background push
  if (hasDiscordToken && isStatusEnabled) {
    after(async () => {
      try {
        await daemonPushUpdate(userId)
      } catch (e) {
        console.error('[rpc/status] Background push failed:', e)
      }
    })
  }

  return response
}
