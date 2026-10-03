// 10X RPC — Daemon bridge helper
//
// Routes daemon operations to the Orihost backend server (24/7 long-lived process)
// when BACKEND_URL is set. Falls back to the in-process daemon when not set
// (sandbox/preview without backend).
//
// The Orihost backend maintains PERSISTENT Discord Gateway WebSocket connections
// that survive across requests — fixing the cold-start issue where each Vercel
// serverless function invocation had to reconnect.
//
// THREE push strategies (ordered by speed):
//   1. daemonPushUpdate  — FAST PATH (~50ms). Reuses an already-connected socket
//      and just sends OP 3. Use for: custom status text, userStatus, emoji, RPC config.
//   2. daemonSyncUser    — CONNECT-OR-PUSH (~50ms–5s). If already connected, pushes
//      OP 3. If not, connects + IDENTIFY + READY + push. Use for: initial sync, toggles.
//   3. daemonForcePush   — FULL RECONNECT (~3–6s). Disconnects + reconnects +
//      IDENTIFY + push. REQUIRED for: platform changes (mobile↔VR↔desktop).

import { ensureDaemonRunning } from './rpc-daemon'

export interface DaemonBridgeResult {
  ok: boolean
  method: 'backend-http' | 'local-daemon' | 'skipped'
  message?: string
}

// ── Backend HTTP helper ──────────────────────────────────────────────────

const BACKEND_URL = process.env.BACKEND_URL || ''
const BACKEND_SECRET = process.env.BACKEND_SECRET || ''

async function callBackend(
  endpoint: string,
  userId: string,
  method: 'POST' | 'GET' = 'POST'
): Promise<DaemonBridgeResult> {
  if (!BACKEND_URL) {
    // No backend configured → use in-process daemon (sandbox/preview)
    return { ok: false, method: 'skipped', message: 'BACKEND_URL not set' }
  }

  try {
    const url = `${BACKEND_URL}${endpoint}?userId=${encodeURIComponent(userId)}`
    const headers: Record<string, string> = { 'Accept': 'application/json' }
    if (BACKEND_SECRET) {
      headers['Authorization'] = `Bearer ${BACKEND_SECRET}`
    }

    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 15000)
    const res = await fetch(url, { method, headers, signal: ctrl.signal })
    clearTimeout(t)

    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      return {
        ok: !!data.ok,
        method: 'backend-http',
        message: data.message || (data.ok ? 'Synced via backend' : 'Backend returned not-ok'),
      }
    }
    return {
      ok: false,
      method: 'backend-http',
      message: `Backend returned ${res.status}`,
    }
  } catch (e) {
    return {
      ok: false,
      method: 'backend-http',
      message: e instanceof Error ? e.message : 'fetch failed',
    }
  }
}

// ── In-process daemon fallback ────────────────────────────────────────────

async function localPushUpdate(userId: string): Promise<DaemonBridgeResult> {
  try {
    const daemon = ensureDaemonRunning()
    const result = await daemon.pushUpdate(userId)
    return {
      ok: result.ok,
      method: 'local-daemon',
      message: result.message || (result.ok ? 'Update pushed' : 'Push failed'),
    }
  } catch (e) {
    return { ok: false, method: 'local-daemon', message: e instanceof Error ? e.message : 'failed' }
  }
}

async function localSyncUser(userId: string): Promise<DaemonBridgeResult> {
  try {
    const daemon = ensureDaemonRunning()
    const result = await daemon.syncUser(userId)
    return {
      ok: result.ok,
      method: 'local-daemon',
      message: result.message || (result.ok ? 'Synced' : 'Sync failed'),
    }
  } catch (e) {
    return { ok: false, method: 'local-daemon', message: e instanceof Error ? e.message : 'failed' }
  }
}

async function localStopUserRpc(userId: string): Promise<DaemonBridgeResult> {
  try {
    const daemon = ensureDaemonRunning()
    await daemon.stopUserRpc(userId)
    return { ok: true, method: 'local-daemon', message: 'RPC stopped' }
  } catch (e) {
    return { ok: false, method: 'local-daemon', message: e instanceof Error ? e.message : 'failed' }
  }
}

async function localForcePush(userId: string): Promise<DaemonBridgeResult> {
  try {
    const daemon = ensureDaemonRunning()
    daemon.disconnectUser(userId)
    // No sleep needed — disconnectUser calls cleanupSocket which uses
    // ws.terminate() (instant TCP reset, no handshake delay).
    const result = await daemon.syncUser(userId)
    return {
      ok: result.ok,
      method: 'local-daemon',
      message: result.message || (result.ok ? 'Force-pushed' : 'Force-push failed'),
    }
  } catch (e) {
    return { ok: false, method: 'local-daemon', message: e instanceof Error ? e.message : 'failed' }
  }
}

// ── Public API — routes to backend or in-process daemon ──────────────────

/**
 * FAST PATH: Push a presence update WITHOUT reconnecting.
 * Routes to the backend's /push-update endpoint (persistent socket reuse).
 */
export async function daemonPushUpdate(userId: string): Promise<DaemonBridgeResult> {
  if (BACKEND_URL) {
    return callBackend('/push-update', userId)
  }
  return localPushUpdate(userId)
}

/**
 * Sync presence for a user (connect or push).
 * Routes to the backend's /sync-user endpoint.
 */
export async function daemonSyncUser(userId: string): Promise<DaemonBridgeResult> {
  if (BACKEND_URL) {
    return callBackend('/sync-user', userId)
  }
  return localSyncUser(userId)
}

/**
 * Stop RPC for a user (clear Discord presence).
 * Routes to the backend's /stop-rpc endpoint.
 */
export async function daemonStopUserRpc(userId: string): Promise<DaemonBridgeResult> {
  if (BACKEND_URL) {
    return callBackend('/stop-rpc', userId)
  }
  return localStopUserRpc(userId)
}

/**
 * FULL RECONNECT: Disconnect + reconnect + IDENTIFY + push.
 * Routes to the backend's /force-push endpoint.
 * REQUIRED for platform changes (mobile↔VR↔desktop).
 */
export async function daemonForcePush(userId: string): Promise<DaemonBridgeResult> {
  if (BACKEND_URL) {
    return callBackend('/force-push', userId)
  }
  return localForcePush(userId)
}
