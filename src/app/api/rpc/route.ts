// 10X RPC — /api/rpc — Save & Load RPC Config (Database as Single Source of Truth)
// INSTANT UPDATE: Returns immediately after DB write. Discord push runs in
// background via after().
import { NextResponse, after } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { daemonPushUpdate } from '@/lib/daemon-bridge'
import { resolveRpcActivityName } from '@/lib/constants'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export interface RpcSaveInput {
  name?: string
  type?: string
  platform?: string
  applicationId?: string | null
  state?: string | null
  details?: string | null
  largeImage?: string | null
  largeText?: string | null
  smallImage?: string | null
  smallText?: string | null
  button1Label?: string | null
  button1Url?: string | null
  button2Label?: string | null
  button2Url?: string | null
  partyCurrent?: number | null
  partyMax?: number | null
  partyId?: string | null
  partySecret?: string | null
  startMinsAgo?: number | null
  endTotalMins?: number | null
  enabled?: boolean
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

    const body: RpcSaveInput = await req.json()
    // NOTE: the `enabled` field from the body is IGNORED for session/config state.
    // The toggle state is controlled exclusively by /api/rpc/toggle (which enforces
    // mutual exclusivity with Games RPC). The save route only persists CONFIG fields.
    // This prevents the "UPDATE" button from accidentally toggling RPC on/off or
    // creating a state where both Normal RPC and Games RPC are enabled simultaneously.
    const platform = body.platform || 'desktop'
    const name = resolveRpcActivityName(body.name, platform)

    const data = {
      name,
      type: body.type || 'PLAYING',
      platform,
      applicationId: body.applicationId?.trim() || null,
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
      partyCurrent: typeof body.partyCurrent === 'number' ? body.partyCurrent : null,
      partyMax: typeof body.partyMax === 'number' ? body.partyMax : null,
      partyId: body.partyId?.trim() || null,
      partySecret: body.partySecret?.trim() || null,
      startMinsAgo: typeof body.startMinsAgo === 'number' ? body.startMinsAgo : 0,
      endTotalMins: typeof body.endTotalMins === 'number' ? body.endTotalMins : null,
    }

    // 1. Save ONLY config fields to the Database. Do NOT touch rpcConfig.enabled —
    //    that flag is managed exclusively by /api/rpc/toggle.
    const existing = await db.rpcConfig.findFirst({ where: { userId: session.userId } })
    let rpcConfig
    if (existing) {
      rpcConfig = await db.rpcConfig.update({ where: { id: existing.id }, data })
    } else {
      rpcConfig = await db.rpcConfig.create({ data: { userId: session.userId, ...data, enabled: false } })
    }

    // 2. Do NOT update session.rpcEnabled — that is controlled by /api/rpc/toggle.
    //    Only update the timestamp so the UI can show "last updated".
    await db.session.updateMany({
      where: { userId: session.userId },
      data: { lastPresenceUpdate: new Date() },
    })

    // 3. Check if RPC is currently enabled (for the response + background push)
    const currentSession = await db.session.findFirst({ where: { userId: session.userId } })
    const isRpcCurrentlyEnabled = !!currentSession?.rpcEnabled
    const userId = session.userId
    const hasDiscordToken = !!session.discordAccessToken

    // 4. Return INSTANTLY — the DB write is committed, state is saved.
    const response = NextResponse.json({
      ok: true,
      rpcConfig,
      enabled: isRpcCurrentlyEnabled,
      syncing: hasDiscordToken && isRpcCurrentlyEnabled,
      message: isRpcCurrentlyEnabled
        ? 'Rich Presence updated & syncing to Discord'
        : 'Configuration saved (RPC is OFF)',
    })

    // 5. Background push: schedule the Discord push AFTER the response is sent.
    //    RPC config changes (name, state, details, images, buttons) only change
    //    the OP 3 activity payload — no reconnect needed, just OP 3.
    if (hasDiscordToken && isRpcCurrentlyEnabled) {
      after(async () => {
        try {
          await daemonPushUpdate(userId)
        } catch (e) {
          console.error('[rpc/save] Background push failed:', e)
        }
      })
    }

    return response
  } catch (e: any) {
    console.error('Error saving RPC config:', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to save RPC config' }, { status: 500 })
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let rpcConfig = await db.rpcConfig.findFirst({ where: { userId: session.userId } })
  if (!rpcConfig) {
    // Initialize in DB so database is always populated as single source of truth
    rpcConfig = await db.rpcConfig.create({
      data: {
        userId: session.userId,
        name: '10X RPC',
        type: 'PLAYING',
        platform: 'desktop',
        applicationId: null,
        state: null,
        details: null,
        largeImage: null,
        largeText: null,
        smallImage: null,
        smallText: null,
        button1Label: null,
        button1Url: null,
        button2Label: null,
        button2Url: null,
        partyCurrent: null,
        partyMax: null,
        partyId: null,
        partySecret: null,
        startMinsAgo: 0,
        endTotalMins: null,
        enabled: false,
      },
    })
  }

  return NextResponse.json({ rpcConfig })
}
