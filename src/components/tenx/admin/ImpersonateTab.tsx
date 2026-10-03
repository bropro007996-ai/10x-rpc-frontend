// 10X RPC — Admin Impersonate tab (login as any user for support/debugging)
'use client'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, type AdminUser } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, useAdminFetch, timeAgo } from './shared'
import { UserCog, Search, LogIn, AlertTriangle, ShieldCheck, UserRound } from 'lucide-react'

interface ImpersonateTabProps {
  refreshKey: number
}

export function ImpersonateTab({ refreshKey }: ImpersonateTabProps) {
  const fetcher = useCallback(() => api.adminUsers(), [])
  const { data, loading, error, refetch } = useAdminFetch(fetcher, [refreshKey])

  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [impersonating, setImpersonating] = useState<string | null>(null)

  const users = data?.users ?? []
  const filtered = users.filter(u =>
    !search ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.discordId.includes(search)
  )

  const handleImpersonate = async (user: AdminUser) => {
    if (user.isAdmin) {
      toast.error('Cannot impersonate admin users')
      return
    }
    if (!confirm(`Impersonate ${user.username}? You will be logged in as this user for up to 2 hours. Your admin session will be restored when you end impersonation.`)) return
    setBusy(true)
    try {
      const r = await api.adminImpersonate(user.id)
      toast.success(`Now impersonating ${user.username}. Redirecting...`)
      setImpersonating(user.id)
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 1500)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleEndImpersonation = async () => {
    setBusy(true)
    try {
      await api.adminEndImpersonation()
      toast.success('Impersonation ended. Admin session restored.')
      setImpersonating(null)
      setTimeout(() => window.location.reload(), 1000)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="glass-card p-3 border-amber-500/30 bg-amber-500/5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-amber-300">Impersonation Mode</p>
            <p className="text-white/60 mt-1">
              When you impersonate a user, you'll be logged in as them for up to <strong>2 hours</strong>.
              All actions taken during impersonation are logged to the audit trail.
              Your admin session is automatically restored when impersonation ends.
            </p>
          </div>
        </div>
      </div>

      {/* End impersonation button (only shown if actively impersonating) */}
      {impersonating && (
        <AdminCard className="border-green-500/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-semibold text-green-300">Impersonation Active</span>
            </div>
            <button
              onClick={handleEndImpersonation}
              disabled={busy}
              className="bg-green-500/15 border border-green-500/30 text-green-300 font-semibold rounded-xl px-3 py-1.5 text-xs hover:bg-green-500/25 disabled:opacity-50 flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3 h-3" />
              {busy ? '...' : 'End & Restore Admin'}
            </button>
          </div>
        </AdminCard>
      )}

      <AdminCard>
        <AdminSectionTitle icon={<UserCog className="w-4 h-4" />}>
          Impersonate a User
        </AdminSectionTitle>

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

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <AdminEmptyState icon="👤" title="No users found" />
        ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto styled-scroll pr-1">
            {filtered.map(u => (
              <div
                key={u.id}
                className={`glass-card-inner p-3 flex items-center gap-3 ${u.isAdmin ? 'opacity-50' : ''}`}
              >
                {u.avatar ? (
                  <img src={u.avatar} alt={u.username} className="w-9 h-9 rounded-full flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <UserRound className="w-4 h-4 text-purple-300" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-white truncate">{u.username}</span>
                    {u.isAdmin && (
                      <span className="bg-purple-500/20 text-purple-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                        ADMIN (blocked)
                      </span>
                    )}
                    {u.rpc?.rpcEnabled && (
                      <span className="bg-green-500/20 text-green-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                        RPC LIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/40 font-mono">{u.discordId}</p>
                  <p className="text-[10px] text-white/30">Joined {timeAgo(u.createdAt)}</p>
                </div>
                <button
                  onClick={() => handleImpersonate(u)}
                  disabled={busy || u.isAdmin}
                  title={u.isAdmin ? 'Admins cannot be impersonated' : 'Impersonate this user'}
                  className="flex-shrink-0 purple-gradient text-white font-semibold rounded-xl px-3 py-1.5 text-xs hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
                >
                  <LogIn className="w-3 h-3" />
                  Impersonate
                </button>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
