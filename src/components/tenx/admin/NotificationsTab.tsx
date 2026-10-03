// 10X RPC — Admin Notifications tab (view all sent notifications)
'use client'
import { useCallback, useState } from 'react'
import { api, type AdminNotificationLog } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, timeAgo, formatDateTime, useAdminFetch } from './shared'
import { Bell, Search, CheckCheck, Clock, Mail, AlertCircle, CheckCircle2, Info } from 'lucide-react'

const TYPE_META: Record<string, { color: string; icon: typeof Info }> = {
  info:    { color: 'bg-blue-500/20 text-blue-300',     icon: Info },
  success: { color: 'bg-green-500/20 text-green-300',   icon: CheckCircle2 },
  warning: { color: 'bg-yellow-500/20 text-yellow-300', icon: AlertCircle },
  error:   { color: 'bg-red-500/20 text-red-300',       icon: AlertCircle },
}

interface NotificationsTabProps {
  refreshKey: number
}

export function NotificationsTab({ refreshKey }: NotificationsTabProps) {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [search, setSearch] = useState('')

  const fetcher = useCallback(() => api.adminNotifications({ take: 100, unreadOnly }), [unreadOnly])
  const { data, loading, error, refetch } = useAdminFetch(fetcher, [refreshKey, unreadOnly])

  const allNotifications = data?.notifications ?? []
  const notifications = search
    ? allNotifications.filter(n =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.message.toLowerCase().includes(search.toLowerCase()) ||
        (n.user?.username || '').toLowerCase().includes(search.toLowerCase())
      )
    : allNotifications

  const total = data?.total ?? 0
  const unread = data?.unread ?? 0

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-purple-300">{total}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-amber-400">{unread}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Unread</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-green-400">{total - unread}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Read</div>
        </div>
      </div>

      <AdminCard>
        <AdminSectionTitle icon={<Bell className="w-4 h-4" />}>
          Notification History
        </AdminSectionTitle>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, message, or recipient..."
            className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl pl-9 pr-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
          />
        </div>

        {/* Filter toggle */}
        <div className="flex items-center gap-1.5 mb-3">
          <button
            onClick={() => setUnreadOnly(false)}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
              !unreadOnly ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-white/50 border border-white/8'
            }`}
          >
            ALL ({total})
          </button>
          <button
            onClick={() => setUnreadOnly(true)}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
              unreadOnly ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-white/50 border border-white/8'
            }`}
          >
            UNREAD ({unread})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={refetch} />
        ) : notifications.length === 0 ? (
          <AdminEmptyState
            icon="🔔"
            title={unreadOnly ? 'No unread notifications' : 'No notifications sent'}
            hint={unreadOnly ? 'All notifications have been read.' : 'Use the Broadcast tab to send notifications.'}
          />
        ) : (
          <div className="space-y-1.5 max-h-[70vh] overflow-y-auto styled-scroll pr-1">
            {notifications.map(n => <NotificationRow key={n.id} n={n} />)}
          </div>
        )}
      </AdminCard>
    </div>
  )
}

function NotificationRow({ n }: { n: AdminNotificationLog }) {
  const meta = TYPE_META[n.type] || TYPE_META.info
  const Icon = meta.icon
  return (
    <div className={`glass-card-inner p-3 space-y-1.5 ${n.readAt ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 ${meta.color}`}>
            <Icon className="w-3 h-3" />
          </span>
          <span className="text-xs font-medium text-white truncate">{n.title}</span>
          {!n.readAt && (
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse flex-shrink-0" title="Unread" />
          )}
        </div>
        <span className="text-[10px] text-white/40 flex-shrink-0" title={formatDateTime(n.createdAt)}>
          {timeAgo(n.createdAt)}
        </span>
      </div>
      <p className="text-xs text-white/60 line-clamp-2 pl-7">{n.message}</p>
      <div className="flex items-center gap-2 text-[10px] text-white/40 pl-7">
        {n.user ? (
          <span className="flex items-center gap-1">
            <img src={n.user.avatar} alt="" className="w-3.5 h-3.5 rounded-full" />
            <span className="text-white/60">{n.user.username}</span>
          </span>
        ) : (
          <span>Unknown user</span>
        )}
        <span>·</span>
        <span className="flex items-center gap-0.5">
          {n.readAt ? (
            <><CheckCheck className="w-2.5 h-2.5 text-green-400" />{timeAgo(n.readAt)}</>
          ) : (
            <><Clock className="w-2.5 h-2.5 text-amber-400" />unread</>
          )}
        </span>
      </div>
    </div>
  )
}
