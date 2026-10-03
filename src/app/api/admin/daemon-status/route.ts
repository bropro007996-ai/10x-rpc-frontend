// 10X RPC — /api/admin/daemon-status — get the in-process daemon's internal state (admin only)
//
// Previously this fetched /debug-daemon from an external Render backend; that
// backend has been removed. The daemon now runs in-process inside the Next.js
// app via ensureDaemonRunning() (see src/lib/rpc-daemon.ts). On Vercel
// serverless the daemon is ephemeral (per-instance), so this endpoint reports
// whether the daemon is currently running in this process + its uptime.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { CONFIG } from '@/lib/config'
import { getRpcDaemon } from '@/lib/rpc-daemon'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const daemon = getRpcDaemon()
    const status = daemon.getStatus()
    return NextResponse.json({
      ok: true,
      daemon: {
        running: status.running,
        uptimeSeconds: status.uptimeSeconds,
        lastTickAt: status.lastTickAt,
        activeConnections: status.activeConnections,
        totalTrackedUsers: status.totalTrackedUsers,
        message: status.running
          ? 'In-process daemon running'
          : 'Daemon not started (serverless / no Discord creds)',
      },
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'fetch failed',
    })
  }
}
