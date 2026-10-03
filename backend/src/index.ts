// 10X RPC Backend — Main entry point
// Runs the 24/7 RPC daemon + an HTTP API server that the Vercel frontend calls.
//
// Architecture:
//   ┌──────────────────────┐        ┌──────────────────────────────────┐
//   │  Vercel Frontend     │        │  Orihost Backend (this process)  │
//   │  (Next.js serverless)│        │  (24/7 long-lived Node.js)       │
//   │                      │──HTTP──│                                  │
//   │  /api/* routes       │  API   │  /health  → health check         │
//   │  call backend via    │        │  /sync-user?userId=xxx           │
//   │  fetch(backendUrl)   │        │  /stop-rpc?userId=xxx             │
//   └──────────────────────┘        │  /force-push?userId=xxx           │
//                                   │                                  │
//                                   │  24/7 Discord Gateway WebSocket  │
//                                   │  connections (in-memory)         │
//                                   └──────────────────────────────────┘
//
// The Vercel frontend sets BACKEND_URL env var → daemon-bridge.ts calls
// this backend's HTTP endpoints instead of running the daemon in-process.

import http from 'node:http'
import { CONFIG } from './config.js'
import { db } from './db.js'
import { getRpcDaemon } from './rpc-daemon.js'

const daemon = getRpcDaemon()

// Start the 24/7 daemon tick loop
daemon.start().catch((err: unknown) => {
  console.error('[Backend] Failed to start daemon:', err)
})
console.log('[Backend] 24/7 RPC daemon starting...')

// ── HTTP API server ──────────────────────────────────────────────────────
// The Vercel frontend calls these endpoints to trigger presence pushes.
// Authentication: the BACKEND_SECRET env var must match (if set).

function authenticate(req: http.IncomingMessage): boolean {
  if (!CONFIG.backendSecret) return true // No secret set → allow all (dev mode)
  const auth = req.headers['authorization'] || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return token === CONFIG.backendSecret
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
  })
  res.end(json)
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => resolve(data))
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${CONFIG.port}`)
  const path = url.pathname
  const method = req.method || 'GET'

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.end()
    return
  }

  try {
    // ── /health — public health check (used by uptime monitoring + Vercel keep-awake) ──
    if (path === '/health' && method === 'GET') {
      const status = daemon.getStatus()
      sendJson(res, 200, {
        ok: true,
        service: '10x-rpc-backend',
        uptime: Math.floor(process.uptime()),
        daemon: {
          running: status.running,
          uptimeSeconds: status.uptimeSeconds,
          lastTickAt: status.lastTickAt,
          activeConnections: status.activeConnections,
          totalTrackedUsers: status.totalTrackedUsers,
        },
        timestamp: new Date().toISOString(),
      })
      return
    }

    // ── Auth check for all other endpoints ──
    if (!authenticate(req)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' })
      return
    }

    // ── /sync-user?userId=xxx — sync presence for a user ──
    if (path === '/sync-user' && method === 'POST') {
      const userId = url.searchParams.get('userId')
      if (!userId) {
        sendJson(res, 400, { ok: false, error: 'missing userId' })
        return
      }
      const result = await daemon.syncUser(userId)
      sendJson(res, 200, { ok: result.ok, message: result.message, method: result.method })
      return
    }

    // ── /stop-rpc?userId=xxx — stop RPC for a user (clear presence) ──
    if (path === '/stop-rpc' && method === 'POST') {
      const userId = url.searchParams.get('userId')
      if (!userId) {
        sendJson(res, 400, { ok: false, error: 'missing userId' })
        return
      }
      await daemon.stopUserRpc(userId)
      sendJson(res, 200, { ok: true, message: 'RPC stopped' })
      return
    }

    // ── /force-push?userId=xxx — force reconnect + push ──
    if (path === '/force-push' && method === 'POST') {
      const userId = url.searchParams.get('userId')
      if (!userId) {
        sendJson(res, 400, { ok: false, error: 'missing userId' })
        return
      }
      daemon.disconnectUser(userId)
      await new Promise(r => setTimeout(r, 100))
      const result = await daemon.syncUser(userId)
      sendJson(res, 200, { ok: result.ok, message: result.message, method: result.method })
      return
    }

    // ── /push-update?userId=xxx — fast path: reuse socket, just push OP 3 ──
    if (path === '/push-update' && method === 'POST') {
      const userId = url.searchParams.get('userId')
      if (!userId) {
        sendJson(res, 400, { ok: false, error: 'missing userId' })
        return
      }
      const result = await daemon.pushUpdate(userId)
      sendJson(res, 200, { ok: result.ok, message: result.message, method: result.method })
      return
    }

    // ── /debug-daemon — admin debug endpoint ──
    if (path === '/debug-daemon' && method === 'GET') {
      const status = daemon.getStatus()
      sendJson(res, 200, {
        running: status.running,
        uptimeSeconds: status.uptimeSeconds,
        lastTickAt: status.lastTickAt,
        activeConnections: status.activeConnections,
        totalTrackedUsers: status.totalTrackedUsers,
        users: status.users,
      })
      return
    }

    // 404
    sendJson(res, 404, { ok: false, error: 'not_found', path })
  } catch (err) {
    console.error('[Backend] Request error:', err)
    sendJson(res, 500, { ok: false, error: 'internal_error', message: err instanceof Error ? err.message : 'unknown' })
  }
})

server.listen(CONFIG.port, () => {
  console.log(`[Backend] HTTP API server listening on port ${CONFIG.port}`)
  console.log(`[Backend] Health check: http://localhost:${CONFIG.port}/health`)
  console.log(`[Backend] Endpoints: /health, /sync-user, /stop-rpc, /force-push, /push-update, /debug-daemon`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Backend] SIGTERM received, shutting down...')
  server.close(() => {
    daemon.stop()
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('[Backend] SIGINT received, shutting down...')
  server.close(() => {
    daemon.stop()
    process.exit(0)
  })
})

// Keep the process alive
process.on('uncaughtException', (err) => {
  console.error('[Backend] Uncaught exception:', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[Backend] Unhandled rejection:', err)
})
