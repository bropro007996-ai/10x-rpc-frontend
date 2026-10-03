// 10X RPC — Admin Activity Feed tab (real-time recent activity)
'use client'
import { useCallback, useState } from 'react'
import { api, type AdminActivityEvent } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, useAdminFetch, timeAgo, formatDateTime } from './shared'
import { Activity, Search, RefreshCw } from 'lucide-react'

const CATEGORIES = ['all', 'user', 'payment', 'rpc', 'admin', 'system'] as const
type CategoryFilter = typeof CATEGORIES[number]

const CATEGORY_META: Record<string, { color: string; label: string }> = {
  user:    { color: 'bg-blue-500/20 text-blue-300',     label: 'User' },
  payment: { color: 'bg-amber-500/20 text-amber-300',   label: 'Payment' },
  rpc:     { color: 'bg-cyan-500/20 text-cyan-300',     label: 'RPC' },
  admin:   { color: 'bg-purple-500/20 text-purple-300', label: 'Admin' },
  system:  { color: 'bg-white/5 text-white/60',          label: 'System' },
}

interface ActivityTabProps {
  refreshKey: number
}

export function ActivityTab({ refreshKey }: ActivityTabProps) {
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')

  const fetcher = useCallback(() => api.adminActivity({
    take: 100,
    category: category === 'all' ? undefined : category,
  }), [category])
  const { data, loading, error, refetch } = useAdminFetch(fetcher, [refreshKey, category])

  const allEvents = data?.events ?? []
  const events = search
    ? allEvents.filter(e =>
        e.type.toLowerCase().includes(search.toLowerCase()) ||
        (e.username || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.ip || '').includes(search)
      )
    : allEvents

  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-purple-300">{total}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total Events</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-blue-400">{allEvents.filter(e => e.category === 'user').length}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">User Events</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-purple-400">{allEvents.filter(e => e.category === 'admin').length}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Admin Events</div>
        </div>
      </div>

      <AdminCard>
        <AdminSectionTitle
          icon={<Activity className="w-4 h-4" />}
          right={
            <button
              onClick={refetch}
              disabled={loading}
              className="text-xs bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          }
        >
          Activity Feed
        </AdminSectionTitle>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by type, username, or IP..."
            className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl pl-9 pr-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
          />
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-[10px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                category === c ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-white/50 border border-white/8'
              }`}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Top event types (chips) */}
        {data?.types && data.types.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3 pb-3 border-b border-white/5">
            {data.types.slice(0, 8).map(t => (
              <button
                key={t.type}
                onClick={() => setSearch(t.type)}
                className="text-[9px] font-mono bg-white/5 text-white/60 px-1.5 py-0.5 rounded hover:bg-white/10"
                title={`${t.count} events`}
              >
                {t.type} ({t.count})
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={refetch} />
        ) : events.length === 0 ? (
          <AdminEmptyState
            icon="📡"
            title="No activity yet"
            hint="User logins, RPC toggles, payments, and admin actions will appear here."
          />
        ) : (
          <div className="space-y-1 max-h-[70vh] overflow-y-auto styled-scroll pr-1">
            {events.map(e => <ActivityRow key={e.id} event={e} />)}
          </div>
        )}
      </AdminCard>
    </div>
  )
}

function ActivityRow({ event }: { event: AdminActivityEvent }) {
  const meta = CATEGORY_META[event.category] || CATEGORY_META.system
  let metadata: any = null
  try { metadata = event.metadata ? JSON.parse(event.metadata) : null } catch {}

  return (
    <div className="glass-card-inner p-2.5">
      <div className="flex items-start gap-2">
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${meta.color}`}>
          {meta.label.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <code className="text-xs font-mono text-white truncate">{event.type}</code>
              {event.username && (
                <span className="text-[10px] text-white/40 truncate">by {event.username}</span>
              )}
            </div>
            <span className="text-[10px] text-white/40 flex-shrink-0" title={formatDateTime(event.createdAt)}>
              {timeAgo(event.createdAt)}
            </span>
          </div>
          {(event.ip || metadata) && (
            <div className="flex items-center gap-2 mt-1 text-[10px] text-white/40 flex-wrap">
              {event.ip && <span className="font-mono">🌐 {event.ip}</span>}
              {metadata && (
                <span className="font-mono text-white/30 truncate max-w-full">
                  {typeof metadata === 'object' ? JSON.stringify(metadata) : String(metadata)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
