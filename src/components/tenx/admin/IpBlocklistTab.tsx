// 10X RPC — Admin IP Blocklist tab (block/unblock IPs)
'use client'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, type AdminIpBlock } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, useAdminFetch, timeAgo } from './shared'
import { ShieldBan, Plus, Trash2, Globe, Ban, CheckCircle2, AlertTriangle } from 'lucide-react'

interface IpBlocklistTabProps {
  refreshKey: number
}

export function IpBlocklistTab({ refreshKey }: IpBlocklistTabProps) {
  const fetcher = useCallback(() => api.adminIpBlocklist(), [])
  const { data, loading, error, refetch } = useAdminFetch(fetcher, [refreshKey])

  const [ip, setIp] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const blocks = data?.blocks ?? []
  const activeCount = data?.activeCount ?? 0

  const handleAdd = async () => {
    if (!ip.trim()) { toast.error('IP address is required'); return }
    setBusy(true)
    try {
      await api.adminAddIpBlock(ip.trim(), reason.trim() || undefined)
      toast.success(`Blocked ${ip}`)
      setIp('')
      setReason('')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleRemove = async (block: AdminIpBlock) => {
    if (!confirm(`Unblock ${block.ip}?`)) return
    setBusy(true)
    try {
      await api.adminRemoveIpBlock(block.id)
      toast.success(`Unblocked ${block.ip}`)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="glass-card p-3 border-red-500/30 bg-red-500/5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-red-300">IP Blocklist</p>
            <p className="text-white/60 mt-1">
              Blocked IPs will be denied access to the site. Use with caution — blocking
              shared/corporate IPs may affect multiple users.
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-purple-300">{blocks.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total Blocks</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-red-400">{activeCount}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Active</div>
        </div>
      </div>

      {/* Add new block */}
      <AdminCard>
        <AdminSectionTitle icon={<Plus className="w-4 h-4" />}>Block an IP Address</AdminSectionTitle>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">IP Address *</label>
            <input
              type="text"
              value={ip}
              onChange={e => setIp(e.target.value)}
              placeholder="e.g. 192.168.1.1 or ::1"
              className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Spamming, abuse, bot activity"
              className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
              maxLength={200}
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={busy || !ip.trim()}
            className="bg-red-500/15 border border-red-500/30 text-red-300 font-semibold rounded-xl px-3 py-2 text-xs hover:bg-red-500/25 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Ban className="w-3 h-3" />
            {busy ? 'Blocking...' : 'Block IP'}
          </button>
        </div>
      </AdminCard>

      {/* Blocklist */}
      <AdminCard>
        <AdminSectionTitle icon={<ShieldBan className="w-4 h-4" />}>
          Blocked IPs ({blocks.length})
        </AdminSectionTitle>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={refetch} />
        ) : blocks.length === 0 ? (
          <AdminEmptyState
            icon="🛡️"
            title="No blocked IPs"
            hint="The blocklist is empty. Add an IP above to block it."
          />
        ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto styled-scroll pr-1">
            {blocks.map(b => (
              <div key={b.id} className={`glass-card-inner p-3 flex items-center gap-3 ${!b.isActive ? 'opacity-50' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${b.isActive ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-white/40'}`}>
                  <Globe className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono text-white">{b.ip}</code>
                    {b.isActive ? (
                      <span className="inline-flex items-center gap-0.5 bg-red-500/20 text-red-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                        <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />
                        BLOCKED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 bg-green-500/20 text-green-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-2 h-2" />
                        INACTIVE
                      </span>
                    )}
                  </div>
                  {b.reason && <p className="text-[10px] text-white/50 mt-0.5 truncate">📝 {b.reason}</p>}
                  <p className="text-[10px] text-white/30 mt-0.5">
                    Blocked {timeAgo(b.createdAt)} by <span className="font-mono">{b.blockedBy?.slice(0, 12) || 'unknown'}...</span>
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(b)}
                  disabled={busy}
                  title="Unblock"
                  className="flex-shrink-0 p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-300 disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
