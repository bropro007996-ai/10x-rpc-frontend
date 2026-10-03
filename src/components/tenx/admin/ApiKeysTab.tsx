// 10X RPC — Admin API Keys tab (programmatic access tokens)
'use client'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, type AdminApiKey } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, useAdminFetch, timeAgo, formatDateTime } from './shared'
import { KeyRound, Plus, Trash2, Copy, X, Check, AlertTriangle, Clock, Globe } from 'lucide-react'

interface ApiKeysTabProps {
  refreshKey: number
}

interface KeyForm {
  name: string
  permissions: Set<string>
  expiresInDays: number
}

const EMPTY_FORM: KeyForm = {
  name: '',
  permissions: new Set(),
  expiresInDays: 0, // 0 = no expiry
}

export function ApiKeysTab({ refreshKey }: ApiKeysTabProps) {
  const fetcher = useCallback(() => api.adminApiKeys(), [])
  const { data, loading, error, refetch } = useAdminFetch(fetcher, [refreshKey])

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<KeyForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [newRawKey, setNewRawKey] = useState<string | null>(null)

  const keys = data?.keys ?? []
  const availableScopes = data?.availableScopes ?? []

  const toggleScope = (scope: string) => {
    setForm(prev => {
      const next = new Set(prev.permissions)
      if (next.has(scope)) next.delete(scope)
      else next.add(scope)
      return { ...prev, permissions: next }
    })
  }

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setBusy(true)
    try {
      const r = await api.adminCreateApiKey({
        name: form.name.trim(),
        permissions: Array.from(form.permissions),
        expiresInDays: form.expiresInDays > 0 ? form.expiresInDays : undefined,
      })
      setNewRawKey(r.rawKey)
      toast.success('API key created — save it now!')
      setShowForm(false)
      setForm(EMPTY_FORM)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleDelete = async (k: AdminApiKey) => {
    if (!confirm(`Revoke API key "${k.name}"? This cannot be undone.`)) return
    setBusy(true)
    try {
      await api.adminDeleteApiKey(k.id)
      toast.success('API key revoked')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key).then(() => toast.success('Copied to clipboard'))
  }

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="glass-card p-3 border-amber-500/30 bg-amber-500/5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-amber-300">API Keys</p>
            <p className="text-white/60 mt-1">
              Keys are shown <strong>only once</strong> at creation time. Store them securely —
              they grant programmatic access to admin endpoints. Keys are stored as SHA-256 hashes
              and cannot be recovered.
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-purple-300">{keys.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total Keys</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-green-400">{data?.activeCount ?? 0}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Active</div>
        </div>
      </div>

      {/* Newly created key banner */}
      {newRawKey && (
        <AdminCard className="border-green-500/40 bg-green-500/5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-xs font-semibold text-green-300">API Key Created</span>
            </div>
            <button onClick={() => setNewRawKey(null)} className="text-white/40 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-white/60 mb-2">Copy this key now — it will not be shown again:</p>
          <div className="flex items-center gap-2 bg-black/30 border border-green-500/30 rounded-lg p-2 font-mono text-xs text-green-300 break-all">
            <span className="flex-1">{newRawKey}</span>
            <button
              onClick={() => copyKey(newRawKey)}
              className="flex-shrink-0 p-1.5 rounded bg-green-500/20 hover:bg-green-500/30 text-green-300"
              title="Copy"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </AdminCard>
      )}

      <AdminCard>
        <AdminSectionTitle
          icon={<KeyRound className="w-4 h-4" />}
          right={
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-xs purple-gradient text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 hover:opacity-90"
            >
              <Plus className="w-3 h-3" />New Key
            </button>
          }
        >
          API Keys
        </AdminSectionTitle>

        {showForm && (
          <div className="mb-4 p-3 glass-card-inner space-y-3 border-purple-500/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-white">Create New API Key</p>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Slack integration, CI/CD bot"
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
                maxLength={60}
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1.5">Permissions (scopes)</label>
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto styled-scroll pr-1">
                {availableScopes.map(scope => (
                  <label
                    key={scope}
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg cursor-pointer text-[10px] transition-colors ${
                      form.permissions.has(scope) ? 'bg-purple-500/10 border border-purple-500/20 text-purple-200' : 'border border-white/8 text-white/60 hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.permissions.has(scope)}
                      onChange={() => toggleScope(scope)}
                      className="accent-purple-500"
                    />
                    <span className="font-mono">{scope}</span>
                  </label>
                ))}
              </div>
              {form.permissions.size === 0 && (
                <p className="text-[10px] text-amber-400 mt-1">⚠ No permissions selected — key will be read-only with no access</p>
              )}
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Expiry (days, 0 = never)</label>
              <input
                type="number"
                min={0}
                max={3650}
                value={form.expiresInDays}
                onChange={e => setForm({ ...form, expiresInDays: Number(e.target.value) })}
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 focus-visible:ring-purple-500/40 outline-none"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={busy || !form.name.trim()}
              className="purple-gradient text-white font-semibold rounded-xl px-3 py-2 text-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy ? 'Creating...' : (<><Check className="w-3 h-3" />Create Key</>)}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={refetch} />
        ) : keys.length === 0 ? (
          <AdminEmptyState icon="🔑" title="No API keys yet" hint="Create an API key for programmatic access to admin endpoints." />
        ) : (
          <div className="space-y-2">
            {keys.map(k => (
              <div key={k.id} className={`glass-card-inner p-3 space-y-2 ${!k.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <KeyRound className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{k.name}</p>
                      <p className="text-[10px] text-white/40 font-mono">{k.prefix}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleDelete(k)}
                      disabled={busy}
                      title="Revoke"
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Permissions */}
                {k.permissions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {k.permissions.map(p => (
                      <span key={p} className="text-[9px] font-mono bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center gap-3 text-[10px] text-white/40 flex-wrap pt-1 border-t border-white/5">
                  {k.expiresAt && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(k.expiresAt) > new Date() ? `expires ${timeAgo(k.expiresAt)}` : 'expired'}
                    </span>
                  )}
                  {k.lastUsedAt && (
                    <span className="flex items-center gap-0.5">
                      last used {timeAgo(k.lastUsedAt)}
                      {k.lastUsedIp && (
                        <span className="flex items-center gap-0.5">
                          <Globe className="w-2.5 h-2.5" />
                          {k.lastUsedIp}
                        </span>
                      )}
                    </span>
                  )}
                  <span>created {timeAgo(k.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
