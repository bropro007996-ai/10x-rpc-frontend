// 10X RPC — /api/uptime — public system status aggregator
// Checks: the Next.js app (self), Neon Postgres, Discord API.
// No auth required — this is a public status endpoint.
//
// Previously this also checked an external Render backend daemon; that backend
// has been removed — the Next.js app now owns the RPC daemon in-process.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

interface ServiceStatus {
  name: string
  status: 'operational' | 'degraded' | 'down' | 'pending'
  latencyMs: number | null
  message: string
  detail?: string
}

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now()
  try {
    await db.user.count()
    const latency = Date.now() - start
    return {
      name: 'Neon Postgres Database',
      status: 'operational',
      latencyMs: latency,
      message: 'Connected',
    }
  } catch (e) {
    return {
      name: 'Neon Postgres Database',
      status: 'down',
      latencyMs: null,
      message: e instanceof Error ? e.message.slice(0, 80) : 'query failed',
    }
  }
}

async function checkDiscord(): Promise<ServiceStatus> {
  const start = Date.now()
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(`${CONFIG.discord.apiBase}/gateway`, {
      signal: ctrl.signal,
      cache: 'no-store',
    })
    clearTimeout(t)
    const latency = Date.now() - start
    if (!res.ok) {
      return {
        name: 'Discord API',
        status: 'degraded',
        latencyMs: latency,
        message: `HTTP ${res.status}`,
      }
    }
    return {
      name: 'Discord API',
      status: 'operational',
      latencyMs: latency,
      message: 'Gateway reachable',
    }
  } catch (e) {
    return {
      name: 'Discord API',
      status: 'down',
      latencyMs: null,
      message: e instanceof Error ? e.message.slice(0, 80) : 'fetch failed',
    }
  }
}

export async function GET() {
  const t0 = Date.now()
  const [database, discord] = await Promise.all([
    checkDatabase(),
    checkDiscord(),
  ])

  const self: ServiceStatus = {
    name: '10X RPC App',
    status: 'operational',
    latencyMs: 1,
    message: 'Serving requests',
  }

  const services = [self, database, discord]

  const anyDown = services.some((s) => s.status === 'down')
  const anyDegraded = services.some((s) => s.status === 'degraded')
  const overall: 'operational' | 'degraded' | 'partial_outage' =
    anyDown ? 'partial_outage' : anyDegraded ? 'degraded' : 'operational'

  return NextResponse.json(
    {
      overall,
      services,
      checkedAt: new Date().toISOString(),
      elapsedMs: Date.now() - t0,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}
