// 10X RPC — Admin Users tab (upgraded: stats, sort, bulk select, CSV export, subscription info)
'use client'
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { api, type AdminUser } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, formatMoney, timeAgo } from './shared'
import {
  Search, RefreshCw, Power, Activity, Clock, Trash2, Crown, Gift, Ban,
  CheckCircle2, UserCog, Download, Copy, ChevronDown, Users as UsersIcon,
  Zap, ShieldCheck, AlertTriangle, X
} from 'lucide-react'

type FilterType = 'all' | 'active-rpc' | 'verified' | 'no-token' | 'trial' | 'expired' | 'paid' | 'admins'
type SortType = 'newest' | 'oldest' | 'name' | 'trial-desc' | 'trial-asc'

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active-rpc', label: 'Active RPC' },
  { id: 'verified', label: 'Verified' },
  { id: 'no-token', label: 'No Token' },
  { id: 'trial', label: 'Trial' },
  { id: 'expired', label: 'Expired' },
  { id: 'paid', label: 'Paid Sub' },
  { id: 'admins', label: 'Admins' },
]

const SORTS: { id: SortType; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'name', label: 'A→Z' },
  { id: 'trial-desc', label: 'Most Days' },
  { id: 'trial-asc', label: 'Least Days' },
]

interface UsersTabProps {
  refreshKey: number
}

export function UsersTab({ refreshKey }: UsersTabProps) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<SortType>('newest')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [grantUserId, setGrantUserId] = useState<string | null>(null)
  const [grantPlan, setGrantPlan] = useState('plus')
  const [grantDays, setGrantDays] = useState(30)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.adminUsers()
      setUsers(res.users)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh, refreshKey])

  const handleUserAction = async (userId: string, action: string, data?: Record<string, unknown>) => {
    setBusy(true)
    try {
      const r = await api.adminUserAction(userId, action, data)
      if (r.ok) toast.success(r.message || `Action "${action}" completed`)
      else toast.error(r.error || 'Action failed')
      refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(false) }
  }

  const handleBulkAction = async (action: string) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) { toast.error('No users selected'); return }
    if (!confirm(`Apply "${action}" to ${ids.length} user(s)?`)) return
    setBusy(true)
    let success = 0
    let fail = 0
    for (const id of ids) {
      try {
        const r = await api.adminUserAction(id, action)
        if (r.ok) success++
        else fail++
      } catch { fail++ }
    }
    toast.success(`Bulk "${action}": ${success} succeeded${fail > 0 ? `, ${fail} failed` : ''}`)
    setSelectedIds(new Set())
    setShowBulkActions(false)
    setBusy(false)
    refresh()
  }

  const handleGrantAccess = async () => {
    if (!grantUserId) return
    setBusy(true)
    try {
      const r = await api.adminGrantAccess({
        userId: grantUserId,
        planId: grantPlan,
        durationDays: grantDays,
        reason: 'Admin grant',
      })
      if (r.ok) toast.success(r.message || 'Access granted')
      else toast.error('Grant failed')
      setGrantUserId(null)
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleExportCsv = () => {
    const rows = [
      ['Username', 'Discord ID', 'RPC Enabled', 'Verified', 'Trial Days', 'Plan', 'Sub Status', 'Amount Paid', 'Created'],
      ...filteredUsers.map(u => [
        u.username,
        u.discordId,
        u.rpc?.rpcEnabled ? 'yes' : 'no',
        u.rpc?.hasDiscordToken ? 'yes' : 'no',
        String(u.trial?.daysLeft ?? 0),
        u.subscription?.plan || '',
        u.subscription?.status || '',
        u.subscription ? formatMoney(u.subscription.amountPaid, u.subscription.currency) : '',
        new Date(u.createdAt).toISOString(),
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filteredUsers.length} users`)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    if (selectedIds.size === filteredUsers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredUsers.map(u => u.id)))
    }
  }

  // Filter + search + sort
  const filteredUsers = users
    .filter(u => {
      if (searchQuery && !u.username.toLowerCase().includes(searchQuery.toLowerCase()) && !u.discordId.includes(searchQuery)) return false
      switch (filter) {
        case 'active-rpc': return u.rpc?.rpcEnabled
        case 'verified': return u.rpc?.hasDiscordToken
        case 'no-token': return u.rpc && !u.rpc.hasDiscordToken
        case 'trial': return u.trial?.active && (u.trial.daysLeft ?? 0) > 0
        case 'expired': return !u.trial?.active || (u.trial.daysLeft ?? 0) === 0
        case 'paid': return u.subscription?.status === 'active'
        case 'admins': return u.isAdmin
        default: return true
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'name': return a.username.localeCompare(b.username)
        case 'trial-desc': return (b.trial?.daysLeft ?? 0) - (a.trial?.daysLeft ?? 0)
        case 'trial-asc': return (a.trial?.daysLeft ?? 0) - (b.trial?.daysLeft ?? 0)
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

  // Stats
  const stats = {
    total: users.length,
    activeRpc: users.filter(u => u.rpc?.rpcEnabled).length,
    verified: users.filter(u => u.rpc?.hasDiscordToken).length,
    trialActive: users.filter(u => u.trial?.active && (u.trial.daysLeft ?? 0) > 0).length,
    paidSubs: users.filter(u => u.subscription?.status === 'active').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="inline-block w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin mb-2" />
        <p className="text-xs text-white/50 ml-3">Loading users...</p>
      </div>
    )
  }

  if (error) return <AdminErrorState message={error} onRetry={refresh} />

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-purple-300">{stats.total}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-green-400">{stats.activeRpc}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">RPC Live</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-blue-400">{stats.verified}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Verified</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-amber-400">{stats.trialActive}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Trial</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-cyan-400">{stats.paidSubs}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Paid</div>
        </div>
      </div>

      <AdminCard>
        <AdminSectionTitle
          icon={<UserCog className="w-4 h-4" />}
          right={
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full font-semibold">
                  {selectedIds.size} selected
                </span>
              )}
              <button
                onClick={handleExportCsv}
                className="text-xs bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 flex items-center gap-1"
              >
                <Download className="w-3 h-3" />CSV
              </button>
            </div>
          }
        >
          Users ({filteredUsers.length} / {users.length})
        </AdminSectionTitle>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by username or Discord ID..."
            className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl pl-9 pr-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
          />
        </div>

        {/* Filters + Sort */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-[10px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                filter === f.id ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-white/50 border border-white/8'
              }`}
            >
              {f.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Sort + Bulk select toggle */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors ${
                showBulkActions ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-white/50 border border-white/8'
              }`}
            >
              ☑ Bulk Select
            </button>
            {showBulkActions && filteredUsers.length > 0 && (
              <button
                onClick={selectAllFiltered}
                className="text-[10px] text-purple-300 hover:text-white"
              >
                {selectedIds.size === filteredUsers.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortType)}
            className="bg-[#13141a] border border-white/8 text-white text-[10px] rounded-lg px-2 py-1 outline-none"
          >
            {SORTS.map(s => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
          </select>
        </div>

        {/* Bulk actions bar */}
        {showBulkActions && selectedIds.size > 0 && (
          <div className="mb-3 p-2 glass-card-inner flex flex-wrap items-center gap-1.5 border-purple-500/30">
            <span className="text-[10px] text-purple-300 font-bold mr-2">Bulk Actions:</span>
            <button onClick={() => handleBulkAction('sync')} disabled={busy} className="inline-flex items-center gap-1 bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[10px] px-2 py-1 rounded-lg hover:bg-purple-500/25 disabled:opacity-50"><RefreshCw className="w-3 h-3" />Sync</button>
            <button onClick={() => handleBulkAction('stop-rpc')} disabled={busy} className="inline-flex items-center gap-1 bg-red-500/15 border border-red-500/30 text-red-200 text-[10px] px-2 py-1 rounded-lg hover:bg-red-500/25 disabled:opacity-50"><Power className="w-3 h-3" />Stop RPC</button>
            <button onClick={() => handleBulkAction('extend-trial', { days: 30 })} disabled={busy} className="inline-flex items-center gap-1 bg-green-500/15 border border-green-500/30 text-green-200 text-[10px] px-2 py-1 rounded-lg hover:bg-green-500/25 disabled:opacity-50"><Clock className="w-3 h-3" />+30d</button>
            <button onClick={() => { setSelectedIds(new Set()); setShowBulkActions(false) }} className="ml-auto text-white/40 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* User list */}
        {filteredUsers.length === 0 ? (
          <AdminEmptyState icon="👤" title="No users match" hint="Try a different search or filter." />
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto styled-scroll pr-1">
            {filteredUsers.map(u => (
              <UserRow
                key={u.id}
                user={u}
                expanded={expandedUser === u.id}
                isGrantTarget={grantUserId === u.id}
                isSelected={selectedIds.has(u.id)}
                showCheckbox={showBulkActions}
                onToggle={() => {
                  setExpandedUser(expandedUser === u.id ? null : u.id)
                  setGrantUserId(u.id)
                }}
                onAction={handleUserAction}
                onCopyId={() => { navigator.clipboard.writeText(u.id); toast.success('User ID copied') }}
                onToggleSelect={() => toggleSelect(u.id)}
                busy={busy}
              />
            ))}
          </div>
        )}
      </AdminCard>

      {/* Grant access panel */}
      {grantUserId && (
        <AdminCard>
          <AdminSectionTitle icon={<Gift className="w-4 h-4" />}>
            Grant Access — {users.find(u => u.id === grantUserId)?.username}
          </AdminSectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Plan</label>
              <select
                value={grantPlan}
                onChange={e => setGrantPlan(e.target.value)}
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 outline-none focus-visible:ring-purple-500/40"
              >
                <option value="trial">Trial</option>
                <option value="plus">Plus</option>
                <option value="pro">Pro</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Duration (days)</label>
              <input
                type="number"
                min={1}
                max={3650}
                value={grantDays}
                onChange={e => setGrantDays(Math.max(1, Number(e.target.value)))}
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 outline-none focus-visible:ring-purple-500/40"
              />
            </div>
            <button
              onClick={handleGrantAccess}
              disabled={busy}
              className="purple-gradient text-white font-semibold rounded-xl px-3 py-2 text-xs hover:opacity-90 disabled:opacity-50"
            >
              {busy ? '...' : 'Grant'}
            </button>
          </div>
        </AdminCard>
      )}
    </div>
  )
}

function UserRow({ user, expanded, isGrantTarget, isSelected, showCheckbox, onToggle, onAction, onCopyId, onToggleSelect, busy }: {
  user: AdminUser
  expanded: boolean
  isGrantTarget: boolean
  isSelected: boolean
  showCheckbox: boolean
  onToggle: () => void
  onAction: (action: string, data?: Record<string, unknown>) => void
  onCopyId: () => void
  onToggleSelect: () => void
  busy: boolean
}) {
  const rpc = user.rpc
  const sub = user.subscription
  return (
    <div className={`glass-card-inner p-3 space-y-2 ${isGrantTarget ? 'border-purple-500/40' : ''} ${isSelected ? 'bg-purple-500/5' : ''}`}>
      <div className="flex items-center gap-3">
        {/* Checkbox (bulk select mode) */}
        {showCheckbox && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="accent-purple-500 w-4 h-4 flex-shrink-0"
          />
        )}
        <img src={user.avatar} alt={user.username} className="w-10 h-10 rounded-full" onError={(e) => { e.currentTarget.src = '/game-icons/placeholder.png' }} />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">{user.username}</span>
            {user.isAdmin && (
              <span className="inline-flex items-center gap-1 bg-purple-500/20 text-purple-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                <Crown className="w-2.5 h-2.5" />ADMIN
              </span>
            )}
            {sub?.status === 'active' && (
              <span className="bg-cyan-500/20 text-cyan-300 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase">{sub.plan}</span>
            )}
            {isGrantTarget && <span className="bg-amber-500/20 text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">🎯 TARGET</span>}
            <ChevronDown className={`w-3 h-3 text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
          <p className="text-xs text-white/40 font-mono">{user.discordId}</p>
        </div>
        <div className="flex flex-col gap-1 items-end">
          {rpc?.rpcEnabled ? (
            <span className="inline-flex items-center gap-1 bg-green-500/20 text-green-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />RPC LIVE
            </span>
          ) : <span className="bg-white/5 text-white/40 text-[10px] font-semibold px-2 py-0.5 rounded-full">RPC OFF</span>}
          {rpc?.hasDiscordToken
            ? <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-300 text-[10px] font-semibold px-2 py-0.5 rounded-full"><CheckCircle2 className="w-2.5 h-2.5" />VERIFIED</span>
            : <span className="bg-yellow-500/10 text-yellow-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">⚠ NO TOKEN</span>}
        </div>
      </div>
      {/* Info row */}
      <div className="flex items-center gap-3 text-xs text-white/50 flex-wrap">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{user.trial?.daysLeft ?? 0}d</span>
        {rpc?.customStatus && <span>💬 {rpc.customStatusEmoji} {rpc.customStatus}</span>}
        {user.rpcConfig && <span>🎮 {user.rpcConfig.name}</span>}
        {sub?.status === 'active' && <span className="text-cyan-400">💰 {formatMoney(sub.amountPaid, sub.currency)} · {sub.daysLeft}d left</span>}
        <span className="text-white/30 ml-auto">{timeAgo(user.createdAt)}</span>
      </div>
      {expanded && (
        <div className="pt-2 mt-2 border-t border-white/5 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => onAction('sync')} disabled={busy} className="inline-flex items-center gap-1 bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-purple-500/25 disabled:opacity-50"><RefreshCw className="w-3 h-3" />Sync</button>
            <button onClick={() => onAction('stop-rpc')} disabled={busy} className="inline-flex items-center gap-1 bg-red-500/15 border border-red-500/30 text-red-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-500/25 disabled:opacity-50"><Power className="w-3 h-3" />Stop RPC</button>
            <button onClick={() => onAction('toggle-status', { enable: !rpc?.rpcEnabled })} disabled={busy} className="inline-flex items-center gap-1 bg-blue-500/15 border border-blue-500/30 text-blue-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-blue-500/25 disabled:opacity-50"><Activity className="w-3 h-3" />Toggle Status</button>
            <button onClick={() => onAction('extend-trial', { days: 30 })} disabled={busy} className="inline-flex items-center gap-1 bg-green-500/15 border border-green-500/30 text-green-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-green-500/25 disabled:opacity-50"><Clock className="w-3 h-3" />+30d Trial</button>
            <button onClick={() => onAction('ban')} disabled={busy} className="inline-flex items-center gap-1 bg-orange-500/15 border border-orange-500/30 text-orange-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-orange-500/25 disabled:opacity-50"><Ban className="w-3 h-3" />Ban</button>
            <button onClick={onCopyId} disabled={busy} className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-white/70 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-white disabled:opacity-50"><Copy className="w-3 h-3" />Copy ID</button>
            <button onClick={() => { if (confirm(`Delete ${user.username}? This cannot be undone.`)) onAction('delete-user') }} disabled={busy} className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/20 text-red-300/80 text-[10px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 disabled:opacity-50"><Trash2 className="w-3 h-3" />Delete</button>
          </div>
          {/* Expanded info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] text-white/40 font-mono">
            <div>ID: {user.id.slice(0, 16)}...</div>
            <div>Created: {new Date(user.createdAt).toLocaleDateString()}</div>
            {rpc && <><div>Gateway: {rpc.gatewayReady ? '✓' : '✗'}</div><div>VR: {rpc.vrStatusActive ? '✓' : '✗'}</div></>}
            {sub && <><div>Sub Plan: {sub.plan}</div><div>Sub Ends: {new Date(sub.endsAt).toLocaleDateString()}</div></>}
            {user.globalConfig && <><div>City: {user.globalConfig.city || '—'}</div><div>TZ: {user.globalConfig.timezone}</div></>}
          </div>
        </div>
      )}
    </div>
  )
}
