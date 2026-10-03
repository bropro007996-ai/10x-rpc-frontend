// 10X RPC — Admin Maintenance tab (schedule and manage maintenance windows)
'use client'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, type AdminMaintenanceWindow } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, useAdminFetch, formatDateTime, timeAgo } from './shared'
import { Wrench, Plus, Trash2, X, Check, AlertTriangle, Clock, Calendar, CheckCircle2, Ban } from 'lucide-react'

interface MaintenanceTabProps {
  refreshKey: number
}

interface MwForm {
  title: string
  message: string
  startsAt: string  // datetime-local format
  endsAt: string    // datetime-local format
}

function toLocalDatetime(d: Date): string {
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function defaultStart(): string {
  return toLocalDatetime(new Date(Date.now() + 60 * 60 * 1000)) // 1 hour from now
}
function defaultEnd(): string {
  return toLocalDatetime(new Date(Date.now() + 3 * 60 * 60 * 1000)) // 3 hours from now
}

const EMPTY_FORM: MwForm = {
  title: '',
  message: '',
  startsAt: defaultStart(),
  endsAt: defaultEnd(),
}

const STATUS_META: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  scheduled: { color: 'bg-blue-500/20 text-blue-300', icon: Clock,          label: 'Scheduled' },
  active:    { color: 'bg-red-500/20 text-red-300 animate-pulse', icon: AlertTriangle, label: 'Active' },
  ended:     { color: 'bg-white/5 text-white/40',     icon: CheckCircle2,  label: 'Ended' },
  resolved:  { color: 'bg-green-500/20 text-green-300', icon: CheckCircle2, label: 'Resolved' },
}

export function MaintenanceTab({ refreshKey }: MaintenanceTabProps) {
  const fetcher = useCallback(() => api.adminMaintenance(), [])
  const { data, loading, error, refetch } = useAdminFetch(fetcher, [refreshKey])

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<MwForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)

  const windows = data?.windows ?? []

  const handleCreate = async () => {
    if (!form.title.trim() || !form.message.trim()) { toast.error('Title and message are required'); return }
    setBusy(true)
    try {
      // Convert local datetime to ISO
      const startsAt = new Date(form.startsAt).toISOString()
      const endsAt = new Date(form.endsAt).toISOString()
      await api.adminCreateMaintenance({ title: form.title.trim(), message: form.message.trim(), startsAt, endsAt })
      toast.success('Maintenance window scheduled')
      setShowForm(false)
      setForm(EMPTY_FORM)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleResolve = async (w: AdminMaintenanceWindow) => {
    if (!confirm(`Mark "${w.title}" as resolved?`)) return
    setBusy(true)
    try {
      await api.adminUpdateMaintenance(w.id, 'resolve')
      toast.success('Maintenance marked as resolved')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleCancel = async (w: AdminMaintenanceWindow) => {
    if (!confirm(`Cancel "${w.title}"?`)) return
    setBusy(true)
    try {
      await api.adminUpdateMaintenance(w.id, 'cancel')
      toast.success('Maintenance cancelled')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleDelete = async (w: AdminMaintenanceWindow) => {
    if (!confirm(`Delete maintenance window "${w.title}"?`)) return
    setBusy(true)
    try {
      await api.adminDeleteMaintenance(w.id)
      toast.success('Deleted')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const activeWindow = windows.find(w => w.status === 'active')

  return (
    <div className="space-y-4">
      {/* Active maintenance banner */}
      {activeWindow && (
        <div className="glass-card p-3 border-red-500/40 bg-red-500/10">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-red-300">🔴 Maintenance Active: {activeWindow.title}</p>
              <p className="text-[10px] text-white/60 mt-1">{activeWindow.message}</p>
              <p className="text-[10px] text-white/40 mt-1">Ends {formatDateTime(activeWindow.endsAt)}</p>
            </div>
            <button
              onClick={() => handleResolve(activeWindow)}
              disabled={busy}
              className="flex-shrink-0 bg-green-500/15 border border-green-500/30 text-green-300 font-medium rounded-lg px-2 py-1 text-[10px] hover:bg-green-500/25 disabled:opacity-50"
            >
              Resolve
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-purple-300">{windows.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-red-400">{data?.activeCount ?? 0}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Active</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-blue-400">{data?.scheduledCount ?? 0}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Scheduled</div>
        </div>
      </div>

      <AdminCard>
        <AdminSectionTitle
          icon={<Wrench className="w-4 h-4" />}
          right={
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-xs purple-gradient text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 hover:opacity-90"
            >
              <Plus className="w-3 h-3" />Schedule
            </button>
          }
        >
          Maintenance Windows
        </AdminSectionTitle>

        {showForm && (
          <div className="mb-4 p-3 glass-card-inner space-y-3 border-purple-500/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-white">Schedule Maintenance Window</p>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Database migration"
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
                maxLength={120}
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Message *</label>
              <textarea
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="Message shown to users during maintenance..."
                rows={3}
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none resize-y"
                maxLength={500}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Starts At</label>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={e => setForm({ ...form, startsAt: e.target.value })}
                  className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 focus-visible:ring-purple-500/40 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Ends At</label>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={e => setForm({ ...form, endsAt: e.target.value })}
                  className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 focus-visible:ring-purple-500/40 outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={busy}
              className="purple-gradient text-white font-semibold rounded-xl px-3 py-2 text-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy ? 'Scheduling...' : (<><Check className="w-3 h-3" />Schedule Window</>)}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={refetch} />
        ) : windows.length === 0 ? (
          <AdminEmptyState icon="🔧" title="No maintenance windows" hint="Schedule a window to plan downtime in advance." />
        ) : (
          <div className="space-y-2">
            {windows.map(w => {
              const meta = STATUS_META[w.status] || STATUS_META.ended
              const Icon = meta.icon
              return (
                <div key={w.id} className={`glass-card-inner p-3 space-y-2 ${w.status === 'active' ? 'border-red-500/30' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${meta.color.split(' ')[1] || 'text-white/60'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">{w.title}</p>
                        <p className="text-[10px] text-white/40 line-clamp-1">{w.message}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${meta.color}`}>
                      {meta.label.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-white/40 flex-wrap">
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-2.5 h-2.5" />
                      {formatDateTime(w.startsAt)}
                    </span>
                    <span>→</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDateTime(w.endsAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 pt-1 border-t border-white/5">
                    {(w.status === 'active' || w.status === 'scheduled') && (
                      <button
                        onClick={() => handleResolve(w)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 bg-green-500/15 border border-green-500/30 text-green-200 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-green-500/25 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3 h-3" />Resolve
                      </button>
                    )}
                    {w.status === 'scheduled' && (
                      <button
                        onClick={() => handleCancel(w)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 bg-orange-500/15 border border-orange-500/30 text-orange-200 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-orange-500/25 disabled:opacity-50"
                      >
                        <Ban className="w-3 h-3" />Cancel
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(w)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] font-medium px-2 py-1 rounded-lg hover:bg-red-500/20 disabled:opacity-50 ml-auto"
                    >
                      <Trash2 className="w-3 h-3" />Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
