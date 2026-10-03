// 10X RPC — /api/rpc/custom-status — set custom Discord status via Gateway
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

  const body = await req.json() as { emoji?: string | null; text?: string | null }
  const emoji = body.emoji?.trim() || null
  const text = body.text?.trim() || null

  // Persist to session
  await db.session.update({
    where: { id: session.id },
    data: {
      customStatus: text,
      customStatusEmoji: emoji,
    },
  })

  const hasDiscordToken = !!session.discordAccessToken
  const isStatusEnabled = !!session.statusEnabled
  const userId = session.userId

  // Return INSTANTLY
  const response = NextResponse.json({
    ok: true,
    customStatus: { emoji, text },
    syncing: hasDiscordToken && isStatusEnabled,
    message: hasDiscordToken && isStatusEnabled
      ? (text ? `Custom status set: ${emoji || ''} ${text} & syncing` : 'Custom status cleared & syncing')
      : (text ? `Custom status set: ${emoji || ''} ${text}` : 'Custom status cleared'),
  })

  // Background push
  if (hasDiscordToken && isStatusEnabled) {
    after(async () => {
      try {
        await daemonPushUpdate(userId)
      } catch (e) {
        console.error('[rpc/custom-status] Background push failed:', e)
      }
    })
  }

  return response
}
