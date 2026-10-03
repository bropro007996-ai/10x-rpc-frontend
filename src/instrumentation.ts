// Next.js Server Lifecycle Hook — Instrumentation
//
// 10X RPC runs entirely on Vercel serverless — there is NO separate backend
// server. The RPC daemon runs IN-PROCESS inside each serverless function
// invocation via ensureDaemonRunning() (see src/lib/rpc-daemon.ts).
//
// On Vercel (serverless), we skip the 24/7 tick loop entirely — serverless
// functions are short-lived and cannot maintain persistent WebSocket
// connections. API routes do best-effort immediate presence pushes via
// daemonForcePush/daemonSyncUser, which open a WebSocket, IDENTIFY, push
// presence (OP 3), and resolve when done.
//
// The 24/7 tick loop below only starts on a long-lived process (local dev
// with Discord creds, or self-hosted). On Vercel it never runs.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const hasDiscordCreds = !!(
      process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
    )

    if (!hasDiscordCreds) {
      console.log('[Instrumentation] DEMO mode (no Discord credentials). Daemon skipped.')
      return
    }

    // Vercel sets VERCEL=1 automatically. On serverless, skip the 24/7 loop.
    const isServerless =
      process.env.VERCEL === '1' ||
      process.env.DEPLOYMENT_MODE === 'serverless'

    if (isServerless) {
      console.log('[Instrumentation] Serverless (Vercel) detected. 24/7 tick loop skipped — API routes do immediate presence pushes.')
      return
    }

    // Long-lived process (local dev / self-hosted): start the 24/7 tick loop
    try {
      const { getRpcDaemon } = await import('@/lib/rpc-daemon')
      getRpcDaemon().start().catch((err: unknown) => {
        console.error('[Instrumentation] Failed to start 10X RPC Daemon:', err)
      })
      console.log('[Instrumentation] 24/7 daemon started (long-lived process).')
    } catch (err) {
      console.error('[Instrumentation] Error importing rpc-daemon:', err)
    }
  }
}
