// 10X RPC — Admin Overview tab (stats, plan distribution, daemon, bulk control, templates)
'use client'
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { api, type AdminUser } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminStatPill, AdminEmptyState, formatMoney } from './shared'
import {
  Activity, Users, IndianRupee, Crown, BarChart3, Server, Power, LayoutGrid, Zap
} from 'lucide-react'

interface DaemonInfo {
  running: boolean
  uptimeSeconds?: number
  activeConnections?: number
  totalTrackedUsers?: number
  users?: Array<{ userId: string; connected: boolean; platform: string; lastStatus: string; lastConnectedAt?: string }>
}

interface StatsInfo {
  totalUsers: number
  activeSubscriptions: number
  totalRevenue: number
  trialUsers: number
  expiredSubs: number
  planBreakdown: Record<string, number>
}

const RPC_TEMPLATES = [
  { icon: '🎮', name: 'Gaming', state: 'In a match', details: 'Ranked', type: 'PLAYING' },
  { icon: '💻', name: 'VS Code', state: 'Editing', details: 'Working on project', type: 'PLAYING' },
  { icon: '🎵', name: 'Spotify', state: 'Listening', details: 'Playlist', type: 'LISTENING' },
  { icon: '📺', name: 'Twitch', state: 'Live', details: 'Streaming', type: 'STREAMING' },
  { icon: '😴', name: 'Away', state: 'AFK', details: 'Be right back', type: 'PLAYING' },
  { icon: '🎯', name: '10X RPC', state: 'Custom', details: 'Custom', type: 'PLAYING' },
]

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-purple-500',
  plus: 'bg-blue-500',
  pro: 'bg-amber-500',
  lifetime: 'bg-orange-500',
}

interface OverviewTabProps {
  refreshKey: number
}

export function OverviewTab({ refreshKey }: OverviewTabProps) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [daemon, setDaemon] = useState<DaemonInfo | null>(null)
  const [stats, setStats] = useState<StatsInfo | null>(null)
  const [activeRpcCount, setActiveRpcCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [templateUserId, setTemplateUserId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [usersRes, daemonRes, statsRes] = await Promise.all([
        api.adminUsers(),
        api.adminDaemonStatus().catch(() => ({ ok: false })),
        api.adminStats().catch(() => ({ ok: false })),
      ])
      setUsers(usersRes.users)
      setActiveRpcCount(usersRes.activeRpcUsers)
      if (daemonRes.ok && 'daemon' in daemonRes && daemonRes.daemon) setDaemon(daemonRes.daemon)
      if (statsRes.ok && 'stats' in statsRes && statsRes.stats) setStats(statsRes.stats)
    } catch (e) {
      console.error('Overview fetch error:', e)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh, refreshKey])

  const handleForceEnable = async () => {
    setBusy(true)
    try {
      const r = await api.adminForceRpc(true)
      toast.success(`RPC force-enabled for ${r.successCount}/${r.totalUsers} users`)
      refresh()
    } catch { toast.error('Failed') } finally { setBusy(false) }
  }

  const handleForceDisable = async () => {
    setBusy(true)
    try {
      const r = await api.adminForceRpc(false)
      toast.success(`RPC force-disabled for ${r.successCount}/${r.totalUsers} users`)
      refresh()
    } finally { setBusy(false) }
  }

  const handleKeepAlive = async () => {
    setBusy(true)
    try {
      const r = await api.keepAlive()
      toast.success(`Keep-alive: ${r.successCount}/${r.totalActive} refreshed`)
      refresh()
    } catch { toast.error('Keep-alive failed') } finally { setBusy(false) }
  }

  const handleApplyTemplate = async (userId: string, tpl: typeof RPC_TEMPLATES[0]) => {
    setBusy(true)
    try {
      const r = await api.adminUserAction(userId, 'apply-template', { template: tpl })
      if (r.ok) toast.success(`Template "${tpl.name}" applied`)
      else toast.error(r.error || 'Failed')
      refresh()
    } catch { toast.error('Failed') } finally { setBusy(false) }
  }

  const handleExportCsv = () => {
    const rows = [
      ['Username', 'Discord ID', 'RPC Enabled', 'Verified', 'Plan', 'Trial Days Left', 'Created'],
      ...users.map(u => [
        u.username,
        u.discordId,
        u.rpc?.rpcEnabled ? 'yes' : 'no',
        u.rpc?.hasDiscordToken ? 'yes' : 'no',
        u.rpcConfig?.name || '',
        String(u.trial?.daysLeft ?? 0),
        new Date(u.createdAt).toISOString(),
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `10xrpc-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${users.length} users to CSV`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="inline-block w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin mb-2" />
        <p className="text-xs text-white/50 ml-3">Loading overview...</p>
      </div>
    )
  }

  const verifiedUsers = users.filter(u => u.rpc?.hasDiscordToken).length
  const daemonHealth = daemon?.running ? ((daemon.activeConnections ?? 0) > 0 ? 'healthy' : 'degraded') : 'down'

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <AdminStatPill label="Total Users" value={users.length} color="text-purple-300" />
        <AdminStatPill label="Active RPC" value={activeRpcCount} color="text-green-400" />
        <AdminStatPill label="Revenue" value={formatMoney(stats?.totalRevenue ?? 0)} color="text-amber-400" />
        <AdminStatPill label="Subs" value={stats?.activeSubscriptions ?? 0} color="text-blue-400" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <AdminStatPill label="Trial Users" value={stats?.trialUsers ?? 0} color="text-pink-400" />
        <AdminStatPill label="Expired Subs" value={stats?.expiredSubs ?? 0} color="text-red-400" />
        <AdminStatPill label="Verified" value={verifiedUsers} color="text-emerald-400" />
        <AdminStatPill label="Connections" value={daemon?.activeConnections ?? 0} color="text-cyan-400" />
      </div>

      {/* Plan Distribution */}
      {stats?.planBreakdown && (
        <AdminCard>
          <AdminSectionTitle icon={<BarChart3 className="w-4 h-4" />}>Plan Distribution</AdminSectionTitle>
          <div className="space-y-2">
            {Object.entries(stats.planBreakdown).map(([plan, count]) => (
              <div key={plan} className="flex items-center gap-3">
                <span className="text-xs text-white/60 w-16 capitalize">{plan}</span>
                <div className="flex-1 bg-white/5 rounded-full h-5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${PLAN_COLORS[plan] || 'bg-gray-500'} transition-all`}
                    style={{ width: `${users.length > 0 ? (count / users.length) * 100 : 0}%`, minWidth: count > 0 ? '2rem' : '0' }}
                  />
                </div>
                <span className="text-xs text-white/50 font-mono w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      {/* Daemon Status */}
      <AdminCard>
        <AdminSectionTitle
          icon={<Server className="w-4 h-4" />}
          right={
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${daemonHealth === 'healthy' ? 'bg-green-400 animate-pulse' : daemonHealth === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'}`} />
              <span className={`text-xs font-semibold ${daemonHealth === 'healthy' ? 'text-green-400' : daemonHealth === 'degraded' ? 'text-yellow-400' : 'text-red-400'}`}>
                {daemonHealth.toUpperCase()}
              </span>
            </div>
          }
        >
          Daemon Status
        </AdminSectionTitle>
        {daemon ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><p className="text-white/40 uppercase tracking-wider">Uptime</p><p className="text-white font-mono">{daemon.uptimeSeconds ? formatUptime(daemon.uptimeSeconds) : '—'}</p></div>
              <div><p className="text-white/40 uppercase tracking-wider">Connections</p><p className="text-white font-mono">{daemon.activeConnections ?? 0}</p></div>
              <div><p className="text-white/40 uppercase tracking-wider">Tracked</p><p className="text-white font-mono">{daemon.totalTrackedUsers ?? 0}</p></div>
              <div><p className="text-white/40 uppercase tracking-wider">Verified</p><p className="text-white font-mono">{verifiedUsers}</p></div>
            </div>
            {daemon.users && daemon.users.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                {daemon.users.map((u, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${u.connected ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="text-white/70 font-mono">{u.userId.slice(0, 12)}...</span>
                    <span className="text-white/40">{u.platform}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <AdminEmptyState icon="🔌" title="Daemon offline" hint="The 24/7 RPC daemon is not running or unreachable." />
        )}
      </AdminCard>

      {/* Bulk Actions */}
      <AdminCard>
        <AdminSectionTitle icon={<Power className="w-4 h-4" />}>Bulk Control</AdminSectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={handleForceEnable}
            disabled={busy}
            className="purple-gradient text-white font-semibold rounded-xl px-3 py-2 text-xs hover:opacity-90 disabled:opacity-50"
          >
            {busy ? '...' : 'Force Enable All'}
          </button>
          <button
            onClick={handleKeepAlive}
            disabled={busy}
            className="bg-white/5 border border-white/8 text-white font-medium rounded-xl px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-50"
          >
            {busy ? '...' : 'Keep-Alive'}
          </button>
          <button
            onClick={handleForceDisable}
            disabled={busy}
            className="bg-red-500/10 border border-red-500/20 text-red-300 font-medium rounded-xl px-3 py-2 text-xs hover:bg-red-500/20 disabled:opacity-50"
          >
            {busy ? '...' : 'Disable All'}
          </button>
        </div>
      </AdminCard>

      {/* RPC Templates */}
      <AdminCard>
        <AdminSectionTitle
          icon={<LayoutGrid className="w-4 h-4" />}
          right={
            <button
              onClick={handleExportCsv}
              className="text-xs bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
            >
              ⬇ Export CSV
            </button>
          }
        >
          RPC Templates
        </AdminSectionTitle>
        <p className="text-xs text-white/40 mb-3">Click a user in the Users tab to set target, then apply a template.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {RPC_TEMPLATES.map(tpl => (
            <button
              key={tpl.name}
              onClick={() => templateUserId ? handleApplyTemplate(templateUserId, tpl) : toast.info('Open the Users tab and select a target user first')}
              disabled={busy}
              className="glass-card-inner p-3 text-left hover:border-purple-500/30 transition-colors disabled:opacity-50"
            >
              <div className="text-xl mb-1">{tpl.icon}</div>
              <p className="text-xs font-semibold text-white">{tpl.name}</p>
              <p className="text-[10px] text-white/40">{tpl.state}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-white/30 mt-2">
          Target: {templateUserId ? users.find(u => u.id === templateUserId)?.username : 'None selected'}
        </p>
      </AdminCard>
    </div>
  )
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
