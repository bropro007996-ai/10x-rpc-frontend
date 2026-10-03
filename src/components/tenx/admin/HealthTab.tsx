// 10X RPC — Admin System Health tab (database, razorpay, daemon checks)
'use client'
import { useCallback } from 'react'
import { api } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, formatDateTime, useAdminFetch } from './shared'
import { HeartPulse, Database, CreditCard, Server, RefreshCw, Activity } from 'lucide-react'
import { useState } from 'react'

interface HealthTabProps {
  refreshKey: number
}

export function HealthTab({ refreshKey }: HealthTabProps) {
  const fetcher = useCallback(() => api.adminHealth(), [])
  const { data, loading, error, refetch } = useAdminFetch(fetcher, [refreshKey])
  const [daemonData, setDaemonData] = useState<any>(null)

  // Also fetch daemon status in parallel — done via useEffect below to avoid race
  // For simplicity we re-fetch daemon whenever health is fetched
  const daemonFetcher = useCallback(() => api.adminDaemonStatus().catch(() => ({ ok: false })), [])
  const daemon = useAdminFetch(daemonFetcher, [refreshKey])

  const health = data?.health
  const overallOk = health?.overall?.ok

  return (
    <div className="space-y-4">
      {/* Overall banner */}
      <AdminCard className={overallOk === false ? 'border-red-500/40' : overallOk === true ? 'border-green-500/40' : ''}>
        <AdminSectionTitle icon={<HeartPulse className="w-4 h-4" />}>
          Overall Status
        </AdminSectionTitle>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={refetch} />
        ) : health ? (
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${overallOk ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <div>
              <p className={`text-sm font-semibold ${overallOk ? 'text-green-400' : 'text-red-400'}`}>
                {overallOk ? 'All systems operational' : 'One or more systems degraded'}
              </p>
              <p className="text-[10px] text-white/40">
                Last checked: {formatDateTime(data.checkedAt)}
              </p>
            </div>
          </div>
        ) : null}
      </AdminCard>

      {/* Service cards */}
      <div className="grid sm:grid-cols-2 gap-3">
        <ServiceCard
          icon={<Database className="w-4 h-4" />}
          title="Database"
          ok={health?.database?.ok}
          message={health?.database?.message}
          latencyMs={health?.database?.latencyMs}
          loading={loading}
        />
        <ServiceCard
          icon={<CreditCard className="w-4 h-4" />}
          title="Razorpay"
          ok={health?.razorpay?.ok}
          message={health?.razorpay?.message}
          loading={loading}
        />
        <ServiceCard
          icon={<Server className="w-4 h-4" />}
          title="RPC Daemon"
          ok={health?.daemon?.ok}
          message={health?.daemon?.message}
          latencyMs={health?.daemon?.latencyMs}
          loading={loading}
        />
        <ServiceCard
          icon={<Activity className="w-4 h-4" />}
          title="Daemon Runtime"
          ok={daemon.data?.ok && daemon.data?.daemon?.running}
          message={
            daemon.loading
              ? 'Loading...'
              : daemon.data?.ok && daemon.data.daemon
              ? `Uptime ${formatUptime(daemon.data.daemon.uptimeSeconds || 0)} · ${daemon.data.daemon.activeConnections || 0} connections`
              : 'Daemon offline'
          }
          loading={daemon.loading}
        />
      </div>

      {/* Daemon detail */}
      {!daemon.loading && daemon.data?.ok && daemon.data.daemon && daemon.data.daemon.users && daemon.data.daemon.users.length > 0 && (
        <AdminCard>
          <AdminSectionTitle icon={<Server className="w-4 h-4" />}>Active Sessions</AdminSectionTitle>
          <div className="space-y-1">
            {daemon.data.daemon.users.map((u: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${u.connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-white/70 font-mono">{u.userId.slice(0, 12)}...</span>
                <span className="text-white/40">{u.platform}</span>
                <span className="text-white/30 ml-auto">{u.lastStatus}</span>
              </div>
            ))}
          </div>
        </AdminCard>
      )}
    </div>
  )
}

function ServiceCard({ icon, title, ok, message, latencyMs, loading }: {
  icon: React.ReactNode
  title: string
  ok?: boolean
  message?: string
  latencyMs?: number
  loading: boolean
}) {
  return (
    <div className={`glass-card p-4 ${ok === false ? 'border-red-500/30' : ok === true ? 'border-green-500/30' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-purple-400">{icon}</span>
          <span className="text-xs font-bold text-white">{title}</span>
        </div>
        {!loading && (
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${ok ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className={`text-[10px] font-semibold ${ok ? 'text-green-400' : 'text-red-400'}`}>
              {ok ? 'OK' : 'DOWN'}
            </span>
          </div>
        )}
      </div>
      {loading ? (
        <div className="h-3 w-3 rounded-full border border-purple-500/30 border-t-purple-500 animate-spin" />
      ) : (
        <>
          <p className="text-xs text-white/70 break-words">{message}</p>
          {latencyMs !== undefined && latencyMs > 0 && (
            <p className="text-[10px] text-white/40 font-mono mt-1">{latencyMs}ms</p>
          )}
        </>
      )}
    </div>
  )
}

function formatUptime(seconds: number): string {
  if (!seconds) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
