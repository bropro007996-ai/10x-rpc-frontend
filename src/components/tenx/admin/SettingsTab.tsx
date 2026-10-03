// 10X RPC — Admin Settings tab (site-wide configuration + maintenance mode)
'use client'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, type AdminSettings } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminErrorState, useAdminFetch } from './shared'
import { Settings, Save, AlertTriangle, Power } from 'lucide-react'
import { useEffect } from 'react'

interface SettingsTabProps {
  refreshKey: number
}

export function SettingsTab({ refreshKey }: SettingsTabProps) {
  const fetcher = useCallback(() => api.adminSettings(), [])
  const { data, loading, error, refetch } = useAdminFetch(fetcher, [refreshKey])

  const [form, setForm] = useState<AdminSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (data?.settings) {
      setForm(data.settings)
      setDirty(false)
    }
  }, [data])

  const update = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) => {
    setForm(prev => prev ? { ...prev, [key]: value } : prev)
    setDirty(true)
  }

  const handleSave = async () => {
    if (!form) return
    setBusy(true)
    try {
      await api.adminUpdateSettings({
        siteName: form.siteName,
        heroTitle: form.heroTitle,
        heroSubtitle: form.heroSubtitle,
        discordInvite: form.discordInvite,
        supportText: form.supportText,
        maintenanceMode: form.maintenanceMode,
      })
      toast.success('Settings saved')
      setDirty(false)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally { setBusy(false) }
  }

  const handleToggleMaintenance = async () => {
    if (!form) return
    const next = !form.maintenanceMode
    if (next && !confirm('Enable maintenance mode? The site will be inaccessible to non-admins.')) return
    setBusy(true)
    try {
      await api.adminUpdateSettings({ maintenanceMode: next })
      toast.success(`Maintenance mode ${next ? 'enabled' : 'disabled'}`)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
      </div>
    )
  }
  if (error) return <AdminErrorState message={error} onRetry={refetch} />
  if (!form) return null

  return (
    <div className="space-y-4">
      {/* Maintenance mode banner */}
      <AdminCard className={form.maintenanceMode ? 'border-red-500/40' : ''}>
        <AdminSectionTitle icon={<Power className="w-4 h-4" />}>
          Maintenance Mode
        </AdminSectionTitle>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-white/70">
              {form.maintenanceMode
                ? '🔴 Site is currently in maintenance mode. Only admins can access it.'
                : '🟢 Site is operational and accessible to all users.'}
            </p>
          </div>
          <button
            onClick={handleToggleMaintenance}
            disabled={busy}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50 ${
              form.maintenanceMode
                ? 'bg-green-500/15 border border-green-500/30 text-green-300 hover:bg-green-500/25'
                : 'bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25'
            }`}
          >
            <Power className="w-3 h-3" />
            {form.maintenanceMode ? 'Disable' : 'Enable'}
          </button>
        </div>
        {form.maintenanceMode && (
          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-red-300">Regular users will see a maintenance page. Admins retain full access.</p>
          </div>
        )}
      </AdminCard>

      {/* Site config */}
      <AdminCard>
        <AdminSectionTitle
          icon={<Settings className="w-4 h-4" />}
          right={
            <button
              onClick={handleSave}
              disabled={busy || !dirty}
              className="purple-gradient text-white font-semibold rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-40"
            >
              <Save className="w-3 h-3" />
              {busy ? 'Saving...' : 'Save'}
            </button>
          }
        >
          Site Configuration
        </AdminSectionTitle>

        <div className="space-y-3">
          <Field
            label="Site Name"
            value={form.siteName}
            onChange={v => update('siteName', v)}
            placeholder="10X RPC"
          />
          <Field
            label="Hero Title"
            value={form.heroTitle}
            onChange={v => update('heroTitle', v)}
            placeholder="Welcome to 10X RPC"
          />
          <Field
            label="Hero Subtitle"
            value={form.heroSubtitle}
            onChange={v => update('heroSubtitle', v)}
            placeholder="Take control of your Discord presence"
          />
          <Field
            label="Discord Invite URL"
            value={form.discordInvite}
            onChange={v => update('discordInvite', v)}
            placeholder="https://discord.gg/..."
          />
          <div>
            <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Support Text</label>
            <textarea
              value={form.supportText || ''}
              onChange={e => update('supportText', e.target.value)}
              placeholder="Support info shown to users..."
              rows={3}
              className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none resize-y"
              maxLength={500}
            />
          </div>
        </div>
      </AdminCard>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
      />
    </div>
  )
}
