// 10X RPC — Admin Audit Logs tab (filterable admin action history)
'use client'
import { useCallback, useState } from 'react'
import { api, type AdminAuditLog } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, timeAgo, formatDateTime, useAdminFetch } from './shared'
import { ScrollText, Search } from 'lucide-react'

const ACTION_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'announcement', label: 'Announcements' },
  { id: 'settings', label: 'Settings' },
  { id: 'notification', label: 'Notifications' },
  { id: 'access_grant', label: 'Grants' },
  { id: 'user', label: 'User Actions' },
] as const
type ActionFilter = typeof ACTION_FILTERS[number]['id']

interface AuditLogsTabProps {
  refreshKey: number
}

export function AuditLogsTab({ refreshKey }: AuditLogsTabProps) {
  const [action, setAction] = useState<ActionFilter>('all')
  const [actor, setActor] = useState('')
  const [target, setTarget] = useState('')

  const fetcher = useCallback(() => api.adminAuditLogs({
    action: action === 'all' ? undefined : action,
    actor: actor.trim() || undefined,
    target: target.trim() || undefined,
    take: 100,
  }), [action, actor, target])

  const { data, loading, error, refetch } = useAdminFetch(fetcher, [action, actor, target, refreshKey])

  const logs = data?.logs ?? []

  return (
    <div className="space-y-4">
      <AdminCard>
        <AdminSectionTitle icon={<ScrollText className="w-4 h-4" />}>
          Audit Logs ({data?.total ?? 0})
        </AdminSectionTitle>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
            <input
              type="text"
              value={actor}
              onChange={e => setActor(e.target.value)}
              placeholder="Filter by actor..."
              className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl pl-9 pr-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
            <input
              type="text"
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder="Filter by target..."
              className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl pl-9 pr-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
            />
          </div>
          <div className="relative">
            <select
              value={action}
              onChange={e => setAction(e.target.value as ActionFilter)}
              className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 outline-none focus-visible:ring-purple-500/40"
            >
              {ACTION_FILTERS.map(a => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={refetch} />
        ) : logs.length === 0 ? (
          <AdminEmptyState icon="📜" title="No audit logs" hint="Admin actions will appear here." />
        ) : (
          <div className="space-y-1.5 max-h-[70vh] overflow-y-auto styled-scroll pr-1">
            {logs.map(l => <LogRow key={l.id} log={l} />)}
          </div>
        )}
      </AdminCard>
    </div>
  )
}

function LogRow({ log }: { log: AdminAuditLog }) {
  const actionMeta = getActionMeta(log.action)
  return (
    <div className="glass-card-inner p-2.5">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${actionMeta.color}`}>
          {log.action.toUpperCase()}
        </span>
        <span className="text-[10px] text-white/40 ml-auto" title={formatDateTime(log.createdAt)}>
          {timeAgo(log.createdAt)}
        </span>
      </div>
      <div className="text-[10px] text-white/60 font-mono flex items-center gap-3">
        <span>actor: <span className="text-purple-300">{log.actor.slice(0, 12)}</span></span>
        {log.target && <span>target: <span className="text-cyan-300">{log.target.slice(0, 16)}</span></span>}
      </div>
      {log.metadata && (
        <pre className="text-[10px] text-white/40 font-mono mt-1 truncate overflow-hidden" title={log.metadata}>
          {log.metadata.length > 100 ? log.metadata.slice(0, 100) + '...' : log.metadata}
        </pre>
      )}
    </div>
  )
}

function getActionMeta(action: string): { color: string } {
  if (action.includes('announcement')) return { color: 'bg-purple-500/20 text-purple-300' }
  if (action.includes('settings')) return { color: 'bg-blue-500/20 text-blue-300' }
  if (action.includes('notification')) return { color: 'bg-cyan-500/20 text-cyan-300' }
  if (action.includes('grant') || action.includes('access')) return { color: 'bg-green-500/20 text-green-300' }
  if (action.includes('delete') || action.includes('ban')) return { color: 'bg-red-500/20 text-red-300' }
  if (action.includes('user')) return { color: 'bg-amber-500/20 text-amber-300' }
  return { color: 'bg-white/5 text-white/60' }
}
