// 10X RPC — Admin Broadcast tab (mass notify users)
'use client'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, type AdminUser } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle } from './shared'
import { Send, Users, AlertTriangle, CheckCircle2, Search } from 'lucide-react'
import { useEffect, useState as useReactState } from 'react'

const NOTIF_TYPES = [
  { id: 'info', label: 'Info', color: 'bg-blue-500/20 text-blue-300' },
  { id: 'success', label: 'Success', color: 'bg-green-500/20 text-green-300' },
  { id: 'warning', label: 'Warning', color: 'bg-yellow-500/20 text-yellow-300' },
  { id: 'error', label: 'Error', color: 'bg-red-500/20 text-red-300' },
] as const

interface BroadcastTabProps {
  refreshKey: number
}

export function BroadcastTab({ refreshKey }: BroadcastTabProps) {
  const [users, setUsers] = useReactState<AdminUser[]>([])
  const [loading, setLoading] = useReactState(true)
  const [selected, setSelected] = useReactState<Set<string>>(new Set())
  const [search, setSearch] = useReactState('')
  const [notifType, setNotifType] = useState<'info' | 'success' | 'warning' | 'error'>('info')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentResult, setSentResult] = useState<{ sent: number; invalid: number } | null>(null)
  const [selectAllFiltered, setSelectAllFiltered] = useReactState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await api.adminUsers()
      setUsers(res.users)
    } catch (e) {
      console.error('Failed to load users for broadcast:', e)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh, refreshKey])

  const filtered = users.filter(u =>
    !search || u.username.toLowerCase().includes(search.toLowerCase()) || u.discordId.includes(search)
  )

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectAllFiltered) {
      setSelected(new Set())
      setSelectAllFiltered(false)
    } else {
      setSelected(new Set(filtered.map(u => u.id)))
      setSelectAllFiltered(true)
    }
  }

  const handleSend = async () => {
    if (selected.size === 0) { toast.error('Select at least one recipient'); return }
    if (!title.trim() || !message.trim()) { toast.error('Title and message are required'); return }
    setBusy(true)
    setSentResult(null)
    try {
      const r = await api.adminSendNotification({
        userIds: Array.from(selected),
        type: notifType,
        title: title.trim(),
        message: message.trim(),
      })
      setSentResult({ sent: r.sent, invalid: r.invalid })
      toast.success(`Sent to ${r.sent} user${r.sent === 1 ? '' : 's'}`)
      // Reset
      setTitle('')
      setMessage('')
      setSelected(new Set())
      setSelectAllFiltered(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {/* Recipient selector */}
      <AdminCard>
        <AdminSectionTitle
          icon={<Users className="w-4 h-4" />}
          right={
            <span className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-full">
              {selected.size} selected
            </span>
          }
        >
          Recipients
        </AdminSectionTitle>

        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search recipients..."
            className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl pl-9 pr-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
          />
        </div>

        <div className="flex items-center justify-between mb-2">
          <button
            onClick={selectAll}
            className="text-[10px] text-purple-300 hover:text-purple-200 font-medium"
          >
            {selectAllFiltered ? 'Deselect all' : `Select all filtered (${filtered.length})`}
          </button>
          {selected.size > 0 && (
            <button
              onClick={() => { setSelected(new Set()); setSelectAllFiltered(false) }}
              className="text-[10px] text-white/40 hover:text-white/70"
            >
              Clear selection
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto styled-scroll pr-1">
            {filtered.map(u => (
              <label
                key={u.id}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  selected.has(u.id) ? 'bg-purple-500/10 border border-purple-500/20' : 'border border-transparent hover:bg-white/5'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(u.id)}
                  onChange={() => toggle(u.id)}
                  className="accent-purple-500"
                />
                <img src={u.avatar} alt="" className="w-6 h-6 rounded-full" />
                <span className="text-xs text-white truncate flex-1">{u.username}</span>
                {u.isAdmin && <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">ADMIN</span>}
              </label>
            ))}
          </div>
        )}
      </AdminCard>

      {/* Compose */}
      <AdminCard>
        <AdminSectionTitle icon={<Send className="w-4 h-4" />}>Compose Notification</AdminSectionTitle>

        <div className="space-y-3">
          {/* Type */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1.5">Type</label>
            <div className="grid grid-cols-4 gap-1.5">
              {NOTIF_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setNotifType(t.id as any)}
                  className={`text-[10px] font-medium px-2 py-1.5 rounded-lg border transition-all ${
                    notifType === t.id ? `${t.color} border-current` : 'bg-white/5 text-white/50 border-white/8'
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
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. New feature available!"
              className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
              maxLength={120}
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write your message..."
              rows={4}
              className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none resize-y"
              maxLength={1000}
            />
          </div>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={busy || selected.size === 0 || !title.trim() || !message.trim()}
            className="purple-gradient text-white font-semibold rounded-xl px-4 py-2.5 text-xs hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
          >
            {busy ? 'Sending...' : (<><Send className="w-3.5 h-3.5" />Send to {selected.size} user{selected.size === 1 ? '' : 's'}</>)}
          </button>

          {sentResult && (
            <div className="glass-card-inner p-3 border-green-500/30 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="text-green-300 font-semibold">Broadcast sent successfully</p>
                <p className="text-white/60 mt-0.5">
                  Delivered to <strong className="text-white">{sentResult.sent}</strong> recipient{sentResult.sent === 1 ? '' : 's'}
                  {sentResult.invalid > 0 && (
                    <span className="text-yellow-400"> · {sentResult.invalid} invalid ID{sentResult.invalid === 1 ? '' : 's'} skipped</span>
                  )}
                </p>
              </div>
            </div>
          )}

          <p className="text-[10px] text-white/40 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />
            Notifications are stored in the database and surfaced to recipients on their next dashboard visit.
          </p>
        </div>
      </AdminCard>
    </div>
  )
}
