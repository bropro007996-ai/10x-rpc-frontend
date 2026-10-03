// 10X RPC — /api/vr-status/enable — toggle VR (Meta Quest) status
// Uses daemonForcePush which awaits the actual WebSocket connection + READY +
// OP 3 presence push, so the response reflects whether Discord actually
// received the VR status update. Essential on Vercel serverless where the
// process is killed after the response is sent.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { daemonForcePush } from '@/lib/daemon-bridge'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

    const body = await req.json() as { active?: boolean }
    const active = !!body.active

    // Update session state in database (Status fields only)
    await db.session.updateMany({
      where: { userId: session.userId },
      data: {
        vrStatusActive: active,
        statusPlatform: active ? 'meta_quest' : (session.statusPlatform === 'meta_quest' ? 'mobile' : session.statusPlatform),
        lastPresenceUpdate: new Date(),
      },
    })

    // Force-push to daemon (disconnects + reconnects + pushes fresh state).
    // This is needed because changing the platform requires a NEW IDENTIFY
    // (the device badge is set in IDENTIFY properties, not in OP 3).
    let presenceResult: { ok: boolean; method: string; message?: string } | null = null
    if (session.discordAccessToken) {
      presenceResult = await daemonForcePush(session.userId)
    }

    return NextResponse.json({
      ok: true,
      vrStatusActive: active,
      result: presenceResult,
      message: presenceResult?.ok
        ? 'VR status synced to Discord'
        : `VR status saved but push failed: ${presenceResult?.message || 'unknown'}`,
    })
  } catch (e: any) {
    console.error('Error in /api/vr-status/enable:', e)
    return NextResponse.json({
      ok: false,
      error: 'vr_toggle_failed',
      message: e?.message || 'Failed to toggle VR status',
    }, { status: 500 })
  }
}
