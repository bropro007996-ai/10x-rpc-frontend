// 10X RPC — /uptime — public system status page
'use client'
import { useEffect, useState, useCallback } from 'react'

type Status = 'operational' | 'degraded' | 'down' | 'pending'

interface ServiceStatus {
  name: string
  status: Status
  latencyMs: number | null
  message: string
  detail?: string
}

interface UptimeData {
  overall: 'operational' | 'degraded' | 'partial_outage' | 'pending'
  services: ServiceStatus[]
  checkedAt: string
  elapsedMs: number
}

const STATUS_META: Record<Status, { label: string; color: string; dot: string; glow: string }> = {
  operational: { label: 'Operational', color: 'text-emerald-400', dot: 'bg-emerald-400', glow: 'shadow-emerald-500/40' },
  degraded: { label: 'Degraded', color: 'text-amber-400', dot: 'bg-amber-400', glow: 'shadow-amber-500/40' },
  down: { label: 'Down', color: 'text-red-400', dot: 'bg-red-400', glow: 'shadow-red-500/40' },
  pending: { label: 'Pending', color: 'text-sky-400', dot: 'bg-sky-400', glow: 'shadow-sky-500/40' },
}

const OVERALL_META: Record<string, { title: string; sub: string; color: string; dot: string; ring: string }> = {
  operational: { title: 'All Systems Operational', sub: 'Every service is running smoothly.', color: 'text-emerald-300', dot: 'bg-emerald-400', ring: 'border-emerald-500/30' },
  degraded: { title: 'Degraded Performance', sub: 'Some services are slower than usual.', color: 'text-amber-300', dot: 'bg-amber-400', ring: 'border-amber-500/30' },
  partial_outage: { title: 'Partial Outage', sub: 'One or more services are down.', color: 'text-red-300', dot: 'bg-red-400', ring: 'border-red-500/30' },
  pending: { title: 'Deployment Incomplete', sub: 'Some services are not yet deployed.', color: 'text-sky-300', dot: 'bg-sky-400', ring: 'border-sky-500/30' },
}

const SERVICE_ICONS: Record<string, string> = {
  'Vercel Frontend': '▲',
  'Render Backend (24/7 Daemon)': '🛰️',
  'Neon Postgres Database': '🗄️',
  'Discord API': '🎮',
}

export default function UptimePage() {
  const [data, setData] = useState<UptimeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/uptime', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: UptimeData = await res.json()
      setData(json)
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 30000) // auto-refresh every 30s
    return () => clearInterval(t)
  }, [refresh])

  const overall = data?.overall ?? 'operational'
  const overallMeta = OVERALL_META[overall]

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0b0f] text-white">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -right-32 w-[400px] h-[400px] bg-fuchsia-600/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        {/* Nav */}
        <nav className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6">
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl purple-gradient flex items-center justify-center font-black text-white shadow-lg group-hover:scale-105 transition-transform">10</div>
            <span className="text-lg sm:text-xl font-bold text-white">10X RPC</span>
          </a>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-white/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Auto-refresh 30s
            </span>
            <a
              href="/"
              className="text-xs sm:text-sm text-white/70 hover:text-white bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              ← Home
            </a>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 px-4 sm:px-8 pb-12">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8 sm:mb-12 pt-4 sm:pt-8">
              <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-3">
                System Status
              </h1>
              <p className="text-base sm:text-lg text-white/50 font-medium">
                Real-time health of 10X RPC services
              </p>
            </div>

            {/* Overall status banner */}
            <div
              className={`glass-card p-6 sm:p-8 mb-6 border ${overallMeta.ring} relative overflow-hidden`}
            >
              <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full ${overallMeta.dot} opacity-10 blur-3xl`} />
              <div className="relative flex items-center gap-4">
                <div className={`w-4 h-4 rounded-full ${overallMeta.dot} animate-pulse shadow-lg ${overall === 'operational' ? 'shadow-emerald-500/50' : overall === 'partial_outage' ? 'shadow-red-500/50' : 'shadow-amber-500/50'}`} />
                <div className="flex-1">
                  <h2 className={`text-xl sm:text-2xl font-black ${overallMeta.color}`}>
                    {loading ? 'Checking services…' : error ? 'Unable to fetch status' : overallMeta.title}
                  </h2>
                  <p className="text-sm text-white/50 mt-0.5">
                    {loading ? 'Polling all services' : error ? error : overallMeta.sub}
                  </p>
                </div>
              </div>
            </div>

            {/* Service cards */}
            <div className="space-y-3">
              {(data?.services ?? fallbackServices()).map((svc, i) => {
                const meta = STATUS_META[svc.status]
                const icon = SERVICE_ICONS[svc.name] ?? '⚙️'
                return (
                  <div
                    key={svc.name}
                    className="glass-card-inner p-4 sm:p-5 flex items-center gap-4 hover:border-purple-500/20 transition-colors"
                    style={{ animation: loading ? 'none' : `fadeUp 0.4s ease ${i * 0.05}s both` }}
                  >
                    {/* Icon */}
                    <div className="shrink-0 w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl">
                      {icon}
                    </div>

                    {/* Name + message */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-white truncate">{svc.name}</h3>
                      </div>
                      <p className="text-xs text-white/50 truncate mt-0.5">
                        {svc.detail || svc.message}
                      </p>
                    </div>

                    {/* Latency */}
                    <div className="hidden sm:flex flex-col items-end shrink-0">
                      <span className="text-xs text-white/40 uppercase tracking-wider">latency</span>
                      <span className="text-sm font-mono text-white/80">
                        {svc.latencyMs != null ? `${svc.latencyMs}ms` : '—'}
                      </span>
                    </div>

                    {/* Status badge */}
                    <div className="shrink-0 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${meta.dot} ${svc.status === 'operational' ? 'animate-pulse' : ''}`} />
                      <span className={`text-xs font-semibold ${meta.color} hidden sm:inline`}>{meta.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Last updated */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
              <div className="flex items-center gap-2">
                {loading ? (
                  <span className="inline-block w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                ) : (
                  <span>✓</span>
                )}
                <span>
                  {loading ? 'Checking…' : lastUpdated ? `Last updated ${formatTime(lastUpdated)}` : 'Not updated yet'}
                </span>
              </div>
              <button
                onClick={refresh}
                disabled={loading}
                className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
              >
                <span className={loading ? 'inline-block animate-spin' : ''}>↻</span>
                Refresh now
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="px-4 sm:px-8 py-8 border-t border-white/5 mt-auto">
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-white/60">
              <a href="/" className="hover:text-white">Home</a>
              <a href="https://discord.gg/JjsPqbWnrH" target="_blank" rel="noopener noreferrer" className="hover:text-white">Join Discord</a>
            </div>
            <p className="text-xs text-white/40">Copyright © 2026 10X RPC. All rights reserved.</p>
            <p className="text-xs text-white/30 max-w-md mx-auto">
              10X RPC is not affiliated with, endorsed, or sponsored by Discord Inc.
            </p>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function fallbackServices(): ServiceStatus[] {
  return [
    { name: 'Vercel Frontend', status: 'pending', latencyMs: null, message: 'Loading…' },
    { name: 'Render Backend (24/7 Daemon)', status: 'pending', latencyMs: null, message: 'Loading…' },
    { name: 'Neon Postgres Database', status: 'pending', latencyMs: null, message: 'Loading…' },
    { name: 'Discord API', status: 'pending', latencyMs: null, message: 'Loading…' },
  ]
}

function formatTime(date: Date): string {
  const now = Date.now()
  const diff = Math.floor((now - date.getTime()) / 1000)
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m}m ago`
  return date.toLocaleTimeString()
}
