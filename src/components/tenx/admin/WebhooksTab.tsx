// 10X RPC — Admin Webhooks tab (CRUD + test)
'use client'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, type AdminWebhook } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, useAdminFetch, timeAgo } from './shared'
import { Webhook as WebhookIcon, Plus, Trash2, Edit3, X, Check, Send, Power, Clock, Activity } from 'lucide-react'

interface WebhooksTabProps {
  refreshKey: number
}

interface WebhookForm {
  url: string
  secret: string
  events: Set<string>
  isActive: boolean
  description: string
}

const EMPTY_FORM: WebhookForm = {
  url: '',
  secret: '',
  events: new Set(),
  isActive: true,
  description: '',
}

export function WebhooksTab({ refreshKey }: WebhooksTabProps) {
  const fetcher = useCallback(() => api.adminWebhooks(), [])
  const { data, loading, error, refetch } = useAdminFetch(fetcher, [refreshKey])

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AdminWebhook | null>(null)
  const [form, setForm] = useState<WebhookForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; result: any } | null>(null)

  const webhooks = data?.webhooks ?? []
  const availableEvents = data?.availableEvents ?? []

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (w: AdminWebhook) => {
    setEditing(w)
    setForm({
      url: w.url,
      secret: '', // don't prefill secret (it's masked)
      events: new Set(w.events),
      isActive: w.isActive,
      description: w.description || '',
    })
    setShowForm(true)
  }

  const toggleEvent = (event: string) => {
    setForm(prev => {
      const next = new Set(prev.events)
      if (next.has(event)) next.delete(event)
      else next.add(event)
      return { ...prev, events: next }
    })
  }

  const handleSubmit = async () => {
    if (!form.url.trim()) { toast.error('URL is required'); return }
    try { new URL(form.url) } catch { toast.error('Invalid URL'); return }

    setBusy(true)
    try {
      const events = Array.from(form.events)
      if (editing) {
        await api.adminUpdateWebhook({
          id: editing.id,
          url: form.url,
          events,
          isActive: form.isActive,
          description: form.description || undefined,
          // Only update secret if a new one was entered
          secret: form.secret ? form.secret : undefined,
        })
        toast.success('Webhook updated')
      } else {
        await api.adminCreateWebhook({
          url: form.url,
          secret: form.secret || undefined,
          events,
          isActive: form.isActive,
          description: form.description || undefined,
        })
        toast.success('Webhook created')
      }
      setShowForm(false)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleDelete = async (w: AdminWebhook) => {
    if (!confirm(`Delete webhook to ${new URL(w.url).host}?`)) return
    setBusy(true)
    try {
      await api.adminDeleteWebhook(w.id)
      toast.success('Webhook deleted')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleToggleActive = async (w: AdminWebhook) => {
    setBusy(true)
    try {
      await api.adminUpdateWebhook({ id: w.id, isActive: !w.isActive })
      toast.success(`Webhook ${!w.isActive ? 'activated' : 'deactivated'}`)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleTest = async (w: AdminWebhook) => {
    setTestingId(w.id)
    setTestResult(null)
    try {
      const r = await api.adminTestWebhook(w.id)
      setTestResult({ id: w.id, result: r.result })
      if (r.result.status === 'success') {
        toast.success(`Test delivered (HTTP ${r.result.statusCode}, ${r.result.latencyMs}ms)`)
      } else {
        toast.error(`Test failed (HTTP ${r.result.statusCode ?? 'N/A'})`)
      }
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Test failed')
    } finally { setTestingId(null) }
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-purple-300">{webhooks.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-green-400">{webhooks.filter(w => w.isActive).length}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Active</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-amber-400">{webhooks.reduce((s, w) => s + w.deliveryCount, 0)}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Deliveries</div>
        </div>
      </div>

      <AdminCard>
        <AdminSectionTitle
          icon={<WebhookIcon className="w-4 h-4" />}
          right={
            <button
              onClick={openCreate}
              className="text-xs purple-gradient text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 hover:opacity-90"
            >
              <Plus className="w-3 h-3" />New Webhook
            </button>
          }
        >
          Outgoing Webhooks
        </AdminSectionTitle>

        {showForm && (
          <div className="mb-4 p-3 glass-card-inner space-y-3 border-purple-500/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-white">{editing ? 'Edit Webhook' : 'New Webhook'}</p>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">URL *</label>
              <input
                type="url"
                value={form.url}
                onChange={e => setForm({ ...form, url: e.target.value })}
                placeholder="https://example.com/webhook"
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">
                Secret {editing && '(leave blank to keep existing)'}
              </label>
              <input
                type="text"
                value={form.secret}
                onChange={e => setForm({ ...form, secret: e.target.value })}
                placeholder="whsec_..."
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
              />
              <p className="text-[10px] text-white/30 mt-0.5">Sent in X-10XRPC-Signature header</p>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1.5">Events</label>
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto styled-scroll pr-1">
                {availableEvents.map(ev => (
                  <label
                    key={ev}
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg cursor-pointer text-[10px] transition-colors ${
                      form.events.has(ev) ? 'bg-purple-500/10 border border-purple-500/20 text-purple-200' : 'border border-white/8 text-white/60 hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.events.has(ev)}
                      onChange={() => toggleEvent(ev)}
                      className="accent-purple-500"
                    />
                    <span className="font-mono">{ev}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Slack notifications"
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
                maxLength={100}
              />
            </div>

            <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm({ ...form, isActive: e.target.checked })}
                className="accent-purple-500"
              />
              Active
            </label>

            <button
              onClick={handleSubmit}
              disabled={busy}
              className="purple-gradient text-white font-semibold rounded-xl px-3 py-2 text-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy ? '...' : (<><Check className="w-3 h-3" />{editing ? 'Update Webhook' : 'Create Webhook'}</>)}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={refetch} />
        ) : webhooks.length === 0 ? (
          <AdminEmptyState icon="🔗" title="No webhooks configured" hint="Create a webhook to receive real-time event notifications." />
        ) : (
          <div className="space-y-2">
            {webhooks.map(w => (
              <div key={w.id} className={`glass-card-inner p-3 space-y-2 ${!w.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${w.isActive ? 'bg-green-400 animate-pulse' : 'bg-white/30'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {w.description || new URL(w.url).host}
                      </p>
                      <p className="text-[10px] text-white/40 font-mono truncate">{w.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleTest(w)}
                      disabled={testingId === w.id || busy}
                      title="Send test"
                      className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 disabled:opacity-50"
                    >
                      {testingId === w.id ? <Clock className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => handleToggleActive(w)}
                      disabled={busy}
                      title={w.isActive ? 'Deactivate' : 'Activate'}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-50"
                    >
                      <Power className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => openEdit(w)}
                      disabled={busy}
                      title="Edit"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-50"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(w)}
                      disabled={busy}
                      title="Delete"
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Events */}
                {w.events.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {w.events.map(ev => (
                      <span key={ev} className="text-[9px] font-mono bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded">{ev}</span>
                    ))}
                  </div>
                )}

                {/* Meta row */}
                <div className="flex items-center gap-3 text-[10px] text-white/40 flex-wrap">
                  <span className="flex items-center gap-0.5">
                    <Activity className="w-2.5 h-2.5" />
                    {w.deliveryCount} {w.deliveryCount === 1 ? 'delivery' : 'deliveries'}
                  </span>
                  {w.hasSecret && <span>🔑 secret set</span>}
                  {w.lastTriggeredAt && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      last: {timeAgo(w.lastTriggeredAt)}
                      {w.lastStatus && (
                        <span className={w.lastStatus === 'success' ? 'text-green-400' : 'text-red-400'}>
                          {' '}({w.lastStatus})
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* Test result */}
                {testResult?.id === w.id && (
                  <div className={`glass-card-inner p-2 text-[10px] font-mono ${testResult.result.status === 'success' ? 'border-green-500/30 text-green-300' : 'border-red-500/30 text-red-300'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{testResult.result.status.toUpperCase()}</span>
                      {testResult.result.statusCode && <span>HTTP {testResult.result.statusCode}</span>}
                      <span className="text-white/40">{testResult.result.latencyMs}ms</span>
                    </div>
                    {testResult.result.response && (
                      <pre className="text-white/60 whitespace-pre-wrap break-words max-h-20 overflow-y-auto">{testResult.result.response}</pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  )
}
