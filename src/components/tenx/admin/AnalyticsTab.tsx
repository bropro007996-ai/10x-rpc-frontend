// 10X RPC — Admin Analytics tab (visual charts using Recharts)
'use client'
import { useCallback, useState } from 'react'
import { api, type AdminAnalytics } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, useAdminFetch, formatMoney, timeAgo } from './shared'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { BarChart3, TrendingUp, IndianRupee, Users, Bell, Activity, Crown, Star } from 'lucide-react'

const PLAN_COLORS = ['#a855f7', '#3b82f6', '#f59e0b', '#f97316', '#10b981', '#ec4899', '#6b7280']
const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  expired: '#ef4444',
  cancelled: '#f59e0b',
  suspended: '#a855f7',
  pending: '#3b82f6',
}

interface AnalyticsTabProps {
  refreshKey: number
}

const DAY_OPTIONS = [7, 14, 30, 60, 90]

export function AnalyticsTab({ refreshKey }: AnalyticsTabProps) {
  const [days, setDays] = useState(30)
  const fetcher = useCallback(() => api.adminAnalytics(days), [days])
  const { data, loading, error, refetch } = useAdminFetch(fetcher, [days, refreshKey])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
      </div>
    )
  }
  if (error) return <AdminErrorState message={error} onRetry={refetch} />
  if (!data) return null

  const ts = data.timeSeries
  const totalSignups = ts.reduce((s, d) => s + d.signups, 0)
  const totalRevenue = ts.reduce((s, d) => s + d.revenue, 0)
  const totalPayments = ts.reduce((s, d) => s + d.payments, 0)
  const totalNotifs = ts.reduce((s, d) => s + d.notifications, 0)

  // Format data for charts — use short date labels
  const chartData = ts.map(d => ({
    ...d,
    label: d.date.slice(5), // MM-DD
    revenueRupees: d.revenue / 100,
  }))

  const pieData = data.planBreakdown.map(p => ({ name: p.plan, value: p.count }))
  const statusData = data.subStatusBreakdown.map(s => ({ name: s.status, value: s.count }))

  return (
    <div className="space-y-4">
      {/* Day range selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[10px] uppercase tracking-wider text-white/40 mr-1">Range:</span>
        {DAY_OPTIONS.map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
              days === d ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-white/50 border border-white/8'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Kpi icon={<Users className="w-3.5 h-3.5" />} label="Total Users" value={data.summary.totalUsers} color="text-purple-300" />
        <Kpi icon={<TrendingUp className="w-3.5 h-3.5" />} label={`Signups (${days}d)`} value={totalSignups} color="text-green-400" />
        <Kpi icon={<IndianRupee className="w-3.5 h-3.5" />} label="Revenue (all)" value={formatMoney(data.summary.totalRevenue)} color="text-amber-400" />
        <Kpi icon={<Crown className="w-3.5 h-3.5" />} label="Active Subs" value={data.summary.activeSubs} color="text-blue-400" />
        <Kpi icon={<Bell className="w-3.5 h-3.5" />} label={`Notifs (${days}d)`} value={totalNotifs} color="text-pink-400" />
      </div>

      {/* Signups chart */}
      <AdminCard>
        <AdminSectionTitle icon={<TrendingUp className="w-4 h-4" />}>
          User Signups — Last {days} days
        </AdminSectionTitle>
        {totalSignups === 0 ? (
          <AdminEmptyState icon="📈" title="No signups in this period" />
        ) : (
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <defs>
                  <linearGradient id="signupsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#16171d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                />
                <Area type="monotone" dataKey="signups" stroke="#a855f7" strokeWidth={2} fill="url(#signupsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </AdminCard>

      {/* Revenue chart */}
      <AdminCard>
        <AdminSectionTitle icon={<IndianRupee className="w-4 h-4" />}>
          Revenue — Last {days} days
        </AdminSectionTitle>
        {totalRevenue === 0 ? (
          <AdminEmptyState icon="💰" title="No revenue in this period" />
        ) : (
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#16171d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                  formatter={(v: any) => [`₹${v}`, 'Revenue']}
                />
                <Bar dataKey="revenueRupees" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </AdminCard>

      {/* Pie charts row */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Plan distribution */}
        <AdminCard>
          <AdminSectionTitle icon={<Crown className="w-4 h-4" />}>Plan Distribution</AdminSectionTitle>
          {pieData.length === 0 ? (
            <AdminEmptyState icon="👑" title="No subscriptions" />
          ) : (
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30} paddingAngle={2}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#16171d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>

        {/* Sub status distribution */}
        <AdminCard>
          <AdminSectionTitle icon={<Activity className="w-4 h-4" />}>Sub Status</AdminSectionTitle>
          {statusData.length === 0 ? (
            <AdminEmptyState icon="📊" title="No subscriptions" />
          ) : (
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30} paddingAngle={2}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#16171d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>
      </div>

      {/* Recent activity */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Recent users */}
        <AdminCard>
          <AdminSectionTitle icon={<Users className="w-4 h-4" />}>Recent Signups</AdminSectionTitle>
          {data.recentUsers.length === 0 ? (
            <AdminEmptyState icon="👤" title="No users yet" />
          ) : (
            <div className="space-y-2">
              {data.recentUsers.map(u => (
                <div key={u.id} className="flex items-center gap-2">
                  {u.avatar ? (
                    <img src={u.avatar} alt={u.username} className="w-7 h-7 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] text-purple-300 font-bold">
                      {u.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white truncate">{u.username}</p>
                    <p className="text-[10px] text-white/40 font-mono">{u.discordId.slice(0, 12)}...</p>
                  </div>
                  <span className="text-[10px] text-white/30 flex-shrink-0">{timeAgo(u.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </AdminCard>

        {/* Top payments */}
        <AdminCard>
          <AdminSectionTitle icon={<Star className="w-4 h-4" />}>Top Payments</AdminSectionTitle>
          {data.topPayments.length === 0 ? (
            <AdminEmptyState icon="💳" title="No payments yet" />
          ) : (
            <div className="space-y-2">
              {data.topPayments.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  {p.user?.avatar ? (
                    <img src={p.user.avatar} alt={p.user.username} className="w-7 h-7 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] text-amber-300 font-bold">
                      ₹
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white truncate">{p.user?.username || 'Unknown'}</p>
                    <p className="text-[10px] text-white/40">{p.planName}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-400 flex-shrink-0">{formatMoney(p.amount, p.currency)}</span>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="glass-card-inner p-3 text-center">
      <div className={`flex items-center justify-center gap-1.5 mb-1 ${color}`}>
        {icon}
        <span className="text-lg font-bold">{value}</span>
      </div>
      <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
    </div>
  )
}
