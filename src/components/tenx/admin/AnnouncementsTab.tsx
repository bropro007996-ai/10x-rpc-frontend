// 10X RPC — Admin Announcements tab (CRUD for site-wide announcements)
'use client'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, type AdminAnnouncement } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, formatDateTime, timeAgo, useAdminFetch } from './shared'
import { Megaphone, Plus, Trash2, Power, Edit3, X, Check } from 'lucide-react'

const ANNOUNCEMENT_TYPES = [
  { id: 'info', label: 'Info', color: 'bg-blue-500/20 text-blue-300', dot: 'bg-blue-400' },
  { id: 'update', label: 'Update', color: 'bg-purple-500/20 text-purple-300', dot: 'bg-purple-400' },
  { id: 'warning', label: 'Warning', color: 'bg-yellow-500/20 text-yellow-300', dot: 'bg-yellow-400' },
  { id: 'maintenance', label: 'Maintenance', color: 'bg-red-500/20 text-red-300', dot: 'bg-red-400' },
] as const

interface AnnouncementsTabProps {
  refreshKey: number
}

export function AnnouncementsTab({ refreshKey }: AnnouncementsTabProps) {
  const fetcher = useCallback(() => api.adminAnnouncements(), [])
  const { data, loading, error, refetch } = useAdminFetch(fetcher, [refreshKey])

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AdminAnnouncement | null>(null)
  const [formType, setFormType] = useState<'info' | 'update' | 'warning' | 'maintenance'>('info')
  const [formTitle, setFormTitle] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [formActive, setFormActive] = useState(true)
  const [busy, setBusy] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setFormType('info')
    setFormTitle('')
    setFormMessage('')
    setFormActive(true)
    setShowForm(true)
  }

  const openEdit = (a: AdminAnnouncement) => {
    setEditing(a)
    setFormType(a.type)
    setFormTitle(a.title)
    setFormMessage(a.message)
    setFormActive(a.isActive)
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formMessage.trim()) {
      toast.error('Title and message are required')
      return
    }
    setBusy(true)
    try {
      if (editing) {
        const r = await api.adminUpdateAnnouncement(editing.id, {
          type: formType, title: formTitle, message: formMessage, isActive: formActive,
        })
        if (r.ok) toast.success('Announcement updated')
      } else {
        const r = await api.adminCreateAnnouncement({
          type: formType, title: formTitle, message: formMessage, isActive: formActive,
        })
        if (r.ok) toast.success('Announcement created')
      }
      setShowForm(false)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleDelete = async (a: AdminAnnouncement) => {
    if (!confirm(`Delete "${a.title}"?`)) return
    setBusy(true)
    try {
      await api.adminDeleteAnnouncement(a.id)
      toast.success('Announcement deleted')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleToggle = async (a: AdminAnnouncement) => {
    setBusy(true)
    try {
      await api.adminUpdateAnnouncement(a.id, { isActive: !a.isActive })
      toast.success(`Announcement ${!a.isActive ? 'enabled' : 'disabled'}`)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const announcements = data?.announcements ?? []
  const activeCount = announcements.filter(a => a.isActive).length

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-purple-300">{announcements.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-green-400">{activeCount}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Active</div>
        </div>
      </div>

      <AdminCard>
        <AdminSectionTitle
          icon={<Megaphone className="w-4 h-4" />}
          right={
            <button
              onClick={openCreate}
              className="text-xs purple-gradient text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 hover:opacity-90"
            >
              <Plus className="w-3 h-3" />New
            </button>
          }
        >
          Announcements
        </AdminSectionTitle>

        {showForm && (
          <div className="mb-4 p-3 glass-card-inner space-y-3 border-purple-500/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-white">{editing ? 'Edit Announcement' : 'New Announcement'}</p>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type selector */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1.5">Type</label>
              <div className="grid grid-cols-4 gap-1.5">
                {ANNOUNCEMENT_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setFormType(t.id)}
                    className={`text-[10px] font-medium px-2 py-1.5 rounded-lg border transition-all ${
                      formType === t.id ? `${t.color} border-current` : 'bg-white/5 text-white/50 border-white/8'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="e.g. Scheduled maintenance"
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
                maxLength={120}
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Message</label>
              <textarea
                value={formMessage}
                onChange={e => setFormMessage(e.target.value)}
                placeholder="Announcement body..."
                rows={3}
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none resize-y"
                maxLength={500}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formActive}
                onChange={e => setFormActive(e.target.checked)}
                className="accent-purple-500"
              />
              Active (visible to users)
            </label>

            <button
              onClick={handleSubmit}
              disabled={busy}
              className="purple-gradient text-white font-semibold rounded-xl px-3 py-2 text-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy ? '...' : (<><Check className="w-3 h-3" />{editing ? 'Update' : 'Create'}</>)}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={refetch} />
        ) : announcements.length === 0 ? (
          <AdminEmptyState icon="📢" title="No announcements yet" hint="Create your first announcement to broadcast to users." />
        ) : (
          <div className="space-y-2 max-h-[65vh] overflow-y-auto styled-scroll pr-1">
            {announcements.map(a => {
              const typeMeta = ANNOUNCEMENT_TYPES.find(t => t.id === a.type) || ANNOUNCEMENT_TYPES[0]
              return (
                <div key={a.id} className={`glass-card-inner p-3 space-y-1.5 ${!a.isActive ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full ${typeMeta.dot} flex-shrink-0`} />
                      <span className="text-xs font-medium text-white truncate">{a.title}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${typeMeta.color}`}>{typeMeta.label.toUpperCase()}</span>
                    </div>
                  </div>
                  <p className="text-xs text-white/60 line-clamp-2">{a.message}</p>
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-[10px] text-white/40">{timeAgo(a.createdAt)} · {a.isActive ? '✓ Active' : 'Paused'}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleToggle(a)} disabled={busy} title={a.isActive ? 'Disable' : 'Enable'} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-50">
                        <Power className="w-3 h-3" />
                      </button>
                      <button onClick={() => openEdit(a)} disabled={busy} title="Edit" className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-50">
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(a)} disabled={busy} title="Delete" className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 disabled:opacity-50">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
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
