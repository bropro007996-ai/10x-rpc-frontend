// 10X RPC — Activity Feed component (recent activity + notifications)
'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { Activity, Bell, Check, Clock, Zap } from 'lucide-react'

interface ActivityItem {
  id: string
  action: string
  actor: string | null
  timestamp: string
}

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

export function ActivityFeed() {
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [tab, setTab] = useState<'activity' | 'notifications'>('activity')
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const [logRes, notifRes] = await Promise.all([
        fetch('/api/activity-log', { credentials: 'include' }).then(r => r.json()),
        api.subscriptionStatus().catch(() => null),
      ])
      if (logRes.ok) {
        setActivity(logRes.activity || [])
        setNotifications(logRes.notifications || [])
        setUnread((logRes.notifications || []).filter((n: NotificationItem) => !n.read).length)
      }
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 30000)
    return () => clearInterval(t)
  }, [])

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
        credentials: 'include',
      })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnread(0)
      toast.success('All notifications marked as read')
    } catch { toast.error('Failed to mark as read') }
  }

  const clearNotification = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear', id }),
        credentials: 'include',
      })
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch {}
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#13111d]/95 via-[#0e0d14]/95 to-[#0a0a0f] border border-white/10 rounded-[28px] p-6 shadow-2xl backdrop-blur-xl">
      <div className="absolute -top-16 -right-12 w-48 h-48 bg-purple-900/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        {/* Header + Tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('activity')}
              className={`flex items-center gap-1.5 text-sm font-bold transition-colors ${tab === 'activity' ? 'text-purple-300' : 'text-white/40 hover:text-white/60'}`}
            >
              <Activity className="w-4 h-4" />
              Activity
            </button>
            <span className="text-white/20">|</span>
            <button
              onClick={() => setTab('notifications')}
              className={`flex items-center gap-1.5 text-sm font-bold transition-colors ${tab === 'notifications' ? 'text-purple-300' : 'text-white/40 hover:text-white/60'}`}
            >
              <Bell className="w-4 h-4" />
              Notifications
              {unread > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {unread}
                </span>
              )}
            </button>
          </div>
          {tab === 'notifications' && unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-[10px] text-purple-300 hover:text-white flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              Mark all read
            </button>
          )}
        </div>

        {/* Content */}
        <div className="max-h-64 overflow-y-auto styled-scroll space-y-2">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
              <p className="text-xs text-white/40 mt-2">Loading...</p>
            </div>
          ) : tab === 'activity' ? (
            activity.length > 0 ? (
              activity.map(item => (
                <div key={item.id} className="glass-card-inner p-2.5 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{formatAction(item.action)}</p>
                    <p className="text-[10px] text-white/30">
                      {item.actor === 'system' ? 'System' : 'Admin'} • {timeAgo(item.timestamp)}
                    </p>
                  </div>
                  <Clock className="w-3 h-3 text-white/20 shrink-0" />
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/40">No recent activity</p>
              </div>
            )
          ) : (
            notifications.length > 0 ? (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`glass-card-inner p-2.5 flex items-start gap-2.5 group ${!n.read ? 'border-purple-500/20' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    n.type === 'payment_success' || n.type === 'subscription_activated' ? 'bg-green-500/15' :
                    n.type === 'payment_failed' || n.type === 'suspended' ? 'bg-red-500/15' :
                    'bg-blue-500/15'
                  }`}>
                    <span className="text-xs">
                      {n.type === 'payment_success' ? '✅' :
                       n.type === 'payment_failed' ? '❌' :
                       n.type === 'subscription_activated' ? '🎉' :
                       n.type === 'suspended' ? '⚠️' :
                       n.type === 'expiry_warning' ? '⏰' :
                       'ℹ️'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white">{n.title}</p>
                    <p className="text-[10px] text-white/50 truncate">{n.message}</p>
                    <p className="text-[10px] text-white/25 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0 mt-1" />}
                  <button
                    onClick={() => clearNotification(n.id)}
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 text-xs transition-all"
                  >
                    ✕
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Bell className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/40">No notifications yet</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
