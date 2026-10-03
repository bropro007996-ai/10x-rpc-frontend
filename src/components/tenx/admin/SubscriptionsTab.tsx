// 10X RPC — Admin Subscriptions tab (active, expiring, cancelled, etc.)
'use client'
import { useCallback } from 'react'
import { api, type AdminSubscription } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, formatMoney, formatDateTime, useAdminFetch } from './shared'
import { Crown, Search } from 'lucide-react'
import { useState } from 'react'

const STATUS_FILTERS = ['all', 'active', 'expiring_soon', 'expired', 'cancelled', 'pending'] as const
type StatusFilter = typeof STATUS_FILTERS[number]

interface SubscriptionsTabProps {
  refreshKey: number
}

export function SubscriptionsTab({ refreshKey }: SubscriptionsTabProps) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const fetcher = useCallback(() => api.adminSubscriptions({
    status: status === 'all' ? undefined : status,
    search: search.trim() || undefined,
  }), [status, search])

  const { data, loading, error, refetch } = useAdminFetch(fetcher, [status, search, refreshKey])

  const subs = data?.subscriptions ?? []
  const activeCount = subs.filter(s => s.status === 'active').length
  const totalRevenue = subs.reduce((sum, s) => sum + (s.amountPaid || 0), 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-blue-400">{data?.total ?? 0}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-green-400">{activeCount}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Active</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-amber-400">{formatMoney(totalRevenue)}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Revenue</div>
        </div>
      </div>

      <AdminCard>
        <AdminSectionTitle icon={<Crown className="w-4 h-4" />}>Subscriptions</AdminSectionTitle>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by username or Discord ID..."
            className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl pl-9 pr-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
          />
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`text-[10px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                status === s ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-white/50 border border-white/8'
              }`}
            >
              {s.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={refetch} />
        ) : subs.length === 0 ? (
          <AdminEmptyState icon="👑" title="No subscriptions found" hint="Try a different filter or search query." />
        ) : (
          <div className="space-y-2 max-h-[65vh] overflow-y-auto styled-scroll pr-1">
            {subs.map(s => <SubRow key={s.id} sub={s} />)}
          </div>
        )}
      </AdminCard>
    </div>
  )
}

function SubRow({ sub }: { sub: AdminSubscription }) {
  const statusColor =
    sub.status === 'active'
      ? sub.daysLeft <= 7
        ? 'bg-yellow-500/20 text-yellow-300'
        : 'bg-green-500/20 text-green-300'
      : sub.status === 'expired' || sub.status === 'cancelled'
      ? 'bg-red-500/20 text-red-300'
      : 'bg-white/5 text-white/50'

  return (
    <div className="glass-card-inner p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {sub.user?.avatar && (
            <img src={sub.user.avatar} alt={sub.user.username} className="w-7 h-7 rounded-full flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-xs font-medium text-white truncate">{sub.user?.username || 'Unknown user'}</div>
            <div className="text-[10px] text-white/40 font-mono">{sub.user?.discordId || sub.userId.slice(0, 12)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold text-white capitalize">{sub.plan}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
            {sub.status.toUpperCase()}
            {sub.status === 'active' && ` · ${sub.daysLeft}d`}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span>Starts: {formatDateTime(sub.startsAt)}</span>
        <span>Ends: {formatDateTime(sub.endsAt)}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span>{sub.autoRenew ? '🔄 Auto-renew on' : '⏸ No auto-renew'}</span>
        {sub.amountPaid > 0 && <span className="font-mono">{formatMoney(sub.amountPaid, sub.currency)}</span>}
      </div>
    </div>
  )
}
