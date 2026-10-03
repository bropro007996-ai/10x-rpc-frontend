// 10X RPC — Admin Export Center tab (download data as CSV/JSON)
'use client'
import { AdminCard, AdminSectionTitle } from './shared'
import { Download, FileText, Database, CreditCard, Crown, Activity, ScrollText, FileJson } from 'lucide-react'
import { toast } from 'sonner'

interface ExportCenterTabProps {
  refreshKey: number
}

interface ExportEntity {
  id: string
  label: string
  desc: string
  icon: typeof Database
  color: string
}

const ENTITIES: ExportEntity[] = [
  { id: 'users',         label: 'Users',          desc: 'All user accounts + trial + RPC config',  icon: Database,    color: 'text-purple-300' },
  { id: 'payments',      label: 'Payments',       desc: 'All payment transactions (last 1000)',     icon: CreditCard,  color: 'text-amber-300' },
  { id: 'subscriptions', label: 'Subscriptions',  desc: 'All subscriptions (last 1000)',            icon: Crown,        color: 'text-blue-300' },
  { id: 'activity',      label: 'Activity Events', desc: 'Recent activity events (last 1000)',     icon: Activity,     color: 'text-cyan-300' },
  { id: 'audit-logs',    label: 'Audit Logs',     desc: 'Admin audit trail (last 1000)',            icon: ScrollText,   color: 'text-pink-300' },
]

export function ExportCenterTab({ refreshKey }: ExportCenterTabProps) {
  const handleDownload = async (entity: string, format: 'csv' | 'json') => {
    try {
      const url = `/api/admin/export?entity=${entity}&format=${format}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${entity}-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(downloadUrl)
      toast.success(`Exported ${entity} as ${format.toUpperCase()}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    }
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="glass-card p-3 border-blue-500/30 bg-blue-500/5">
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-blue-300">Data Export Center</p>
            <p className="text-white/60 mt-1">
              Download any data entity as CSV (for spreadsheets) or JSON (for programmatic use).
              All exports are logged to the audit trail. Maximum 1000 rows per export.
            </p>
          </div>
        </div>
      </div>

      {/* Entity grid */}
      <div className="grid sm:grid-cols-2 gap-3">
        {ENTITIES.map(entity => {
          const Icon = entity.icon
          return (
            <AdminCard key={entity.id}>
              <div className="flex items-start gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 ${entity.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white">{entity.label}</h4>
                  <p className="text-[10px] text-white/50 mt-0.5">{entity.desc}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleDownload(entity.id, 'csv')}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-white text-[10px] font-medium px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  CSV
                </button>
                <button
                  onClick={() => handleDownload(entity.id, 'json')}
                  className="bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-200 text-[10px] font-medium px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                >
                  <FileJson className="w-3 h-3" />
                  JSON
                </button>
              </div>
            </AdminCard>
          )
        })}
      </div>

      {/* Note about pagination */}
      <AdminCard>
        <AdminSectionTitle icon={<FileText className="w-4 h-4" />}>
          Export Notes
        </AdminSectionTitle>
        <div className="space-y-2 text-xs text-white/60">
          <p>• Each export returns up to <strong>1000 rows</strong>, sorted by most recent first.</p>
          <p>• CSV format uses comma-separated values with quoted fields (RFC 4180 compliant).</p>
          <p>• JSON format returns <code className="bg-white/5 px-1 py-0.5 rounded">{`{ ok, entity, count, rows }`}</code>.</p>
          <p>• Sensitive fields (secrets, hashed tokens) are never included in exports.</p>
          <p>• All export actions are recorded in the audit trail with entity name + row count.</p>
        </div>
      </AdminCard>
    </div>
  )
}
