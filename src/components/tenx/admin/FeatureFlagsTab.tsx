// 10X RPC — Admin Feature Flags tab (global feature toggles)
'use client'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, type AdminFeatureFlag } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, useAdminFetch, timeAgo } from './shared'
import { Flag, Power, Shield, Zap, CreditCard, Gamepad2, Sparkles } from 'lucide-react'

const CATEGORY_META: Record<string, { icon: typeof Flag; color: string; label: string }> = {
  general:  { icon: Flag,       color: 'text-purple-300 bg-purple-500/15', label: 'General' },
  payments: { icon: CreditCard, color: 'text-amber-300 bg-amber-500/15',   label: 'Payments' },
  rpc:      { icon: Zap,        color: 'text-cyan-300 bg-cyan-500/15',     label: 'RPC' },
  beta:     { icon: Sparkles,   color: 'text-pink-300 bg-pink-500/15',     label: 'Beta' },
  security: { icon: Shield,     color: 'text-red-300 bg-red-500/15',       label: 'Security' },
}

interface FeatureFlagsTabProps {
  refreshKey: number
}

export function FeatureFlagsTab({ refreshKey }: FeatureFlagsTabProps) {
  const fetcher = useCallback(() => api.adminFeatureFlags(), [])
  const { data, loading, error, refetch } = useAdminFetch(fetcher, [refreshKey])

  const [busyKey, setBusyKey] = useState<string | null>(null)

  const handleToggle = async (flag: AdminFeatureFlag) => {
    setBusyKey(flag.key)
    try {
      await api.adminUpdateFeatureFlag(flag.key, { enabled: !flag.enabled })
      toast.success(`"${flag.label}" ${!flag.enabled ? 'enabled' : 'disabled'}`)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusyKey(null) }
  }

  const flags = data?.flags ?? []

  // Group by category
  const grouped = flags.reduce<Record<string, AdminFeatureFlag[]>>((acc, f) => {
    const cat = f.category || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(f)
    return acc
  }, {})

  const enabledCount = flags.filter(f => f.enabled).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
      </div>
    )
  }
  if (error) return <AdminErrorState message={error} onRetry={refetch} />

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-purple-300">{flags.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total Flags</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-green-400">{enabledCount}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Enabled</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-white/40">{flags.length - enabledCount}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Disabled</div>
        </div>
      </div>

      {/* Flag groups */}
      {flags.length === 0 ? (
        <AdminCard>
          <AdminEmptyState icon="🚩" title="No feature flags" hint="Flags will be auto-created on first load." />
        </AdminCard>
      ) : (
        Object.entries(grouped).map(([category, catFlags]) => {
          const meta = CATEGORY_META[category] || CATEGORY_META.general
          const Icon = meta.icon
          const catEnabled = catFlags.filter(f => f.enabled).length
          return (
            <AdminCard key={category}>
              <AdminSectionTitle
                icon={<Icon className="w-4 h-4" />}
                right={
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${meta.color}`}>
                    {catEnabled}/{catFlags.length} ON
                  </span>
                }
              >
                {meta.label}
              </AdminSectionTitle>
              <div className="space-y-2">
                {catFlags.map(flag => (
                  <div
                    key={flag.id}
                    className={`glass-card-inner p-3 flex items-start justify-between gap-3 transition-colors ${flag.enabled ? 'border-purple-500/30' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-white">{flag.label}</span>
                        <code className="text-[10px] text-white/40 font-mono bg-white/5 px-1.5 py-0.5 rounded">{flag.key}</code>
                      </div>
                      {flag.description && (
                        <p className="text-[11px] text-white/50 mt-1">{flag.description}</p>
                      )}
                      <p className="text-[10px] text-white/30 mt-1">
                        Updated {timeAgo(flag.updatedAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggle(flag)}
                      disabled={busyKey === flag.key}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                        flag.enabled ? 'bg-purple-500' : 'bg-white/10'
                      }`}
                      role="switch"
                      aria-checked={flag.enabled}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          flag.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </AdminCard>
          )
        })
      )}
    </div>
  )
}
