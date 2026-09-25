// 10X RPC — Admin Plans tab (full CRUD with dynamic pricing + offers)
'use client'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { api, type AdminPlan } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, timeAgo, useAdminFetch } from './shared'
import { Tag, Plus, Trash2, Edit3, X, Check, Star, Eye, EyeOff, GripVertical, Archive, Gift } from 'lucide-react'

interface PlansTabProps {
  refreshKey: number
}

interface PlanForm {
  name: string
  slug: string
  priceInr: number          // base selling price (paise)
  originalPriceInr: string   // MRP (paise) — empty = null
  offerPriceInr: string      // discounted price (paise) — empty = null
  offerTag: string
  offerText: string
  offerStartsAt: string     // datetime-local
  offerEndsAt: string       // datetime-local
  durationDays: number
  description: string
  featuresText: string
  isActive: boolean
  isPopular: boolean
  badge: string
  displayOrder: number
}

const EMPTY_FORM: PlanForm = {
  name: '',
  slug: '',
  priceInr: 0,
  originalPriceInr: '',
  offerPriceInr: '',
  offerTag: '',
  offerText: '',
  offerStartsAt: '',
  offerEndsAt: '',
  durationDays: 30,
  description: '',
  featuresText: '',
  isActive: true,
  isPopular: false,
  badge: '',
  displayOrder: 0,
}

function toLocalDatetime(iso?: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - offset * 60 * 1000)
    return local.toISOString().slice(0, 16)
  } catch { return '' }
}

export function PlansTab({ refreshKey }: PlansTabProps) {
  const fetcher = useCallback(() => api.adminPlans(), [])
  const { data, loading, error, refetch } = useAdminFetch(fetcher, [refreshKey])

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AdminPlan | null>(null)
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)

  const plans = data?.plans ?? []

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (p: AdminPlan) => {
    setEditing(p)
    setForm({
      name: p.name,
      slug: p.slug,
      priceInr: p.priceInr,
      originalPriceInr: p.originalPriceInr ? String(p.originalPriceInr) : '',
      offerPriceInr: p.offerPriceInr ? String(p.offerPriceInr) : '',
      offerTag: p.offerTag || '',
      offerText: p.offerText || '',
      offerStartsAt: toLocalDatetime(p.offerStartsAt),
      offerEndsAt: toLocalDatetime(p.offerEndsAt),
      durationDays: p.durationDays,
      description: p.description || '',
      featuresText: p.features.join('\n'),
      isActive: p.isActive,
      isPopular: p.isPopular,
      badge: p.badge || '',
      displayOrder: p.displayOrder,
    })
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error('Name and slug are required')
      return
    }
    if (form.priceInr < 0) {
      toast.error('Base price cannot be negative')
      return
    }
    if (form.durationDays <= 0) {
      toast.error('Duration must be greater than 0')
      return
    }

    // Validate offer: if offerPrice is set, it must be <= originalPrice (or priceInr if no original)
    const originalPrice = form.originalPriceInr ? Number(form.originalPriceInr) : form.priceInr
    const offerPrice = form.offerPriceInr ? Number(form.offerPriceInr) : null
    if (offerPrice !== null && offerPrice > originalPrice) {
      toast.error('Offer price cannot be greater than original price')
      return
    }
    if (form.offerStartsAt && form.offerEndsAt && new Date(form.offerStartsAt) >= new Date(form.offerEndsAt)) {
      toast.error('Offer start must be before offer end')
      return
    }

    setBusy(true)
    try {
      const features = form.featuresText.split('\n').map(f => f.trim()).filter(Boolean)
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        priceInr: Math.round(form.priceInr),
        originalPriceInr: form.originalPriceInr ? Math.round(Number(form.originalPriceInr)) : null,
        offerPriceInr: form.offerPriceInr ? Math.round(Number(form.offerPriceInr)) : null,
        offerTag: form.offerTag || null,
        offerText: form.offerText || null,
        offerStartsAt: form.offerStartsAt || null,
        offerEndsAt: form.offerEndsAt || null,
        durationDays: form.durationDays,
        description: form.description || undefined,
        features,
        isActive: form.isActive,
        isPopular: form.isPopular,
        badge: form.badge || undefined,
        displayOrder: form.displayOrder,
      }
      if (editing) {
        await api.adminUpdatePlan({ id: editing.id, ...payload })
        toast.success('Plan updated')
      } else {
        await api.adminCreatePlan(payload)
        toast.success('Plan created')
      }
      setShowForm(false)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleDelete = async (p: AdminPlan) => {
    const msg = `Archive "${p.name}"? It will be hidden from the public list. Existing subscribers keep their access.`
    if (!confirm(msg)) return
    setBusy(true)
    try {
      await api.adminDeletePlan(p.id)
      toast.success('Plan archived')
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleToggleActive = async (p: AdminPlan) => {
    setBusy(true)
    try {
      await api.adminUpdatePlan({ id: p.id, isActive: !p.isActive })
      toast.success(`Plan ${!p.isActive ? 'activated' : 'deactivated'}`)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const handleTogglePopular = async (p: AdminPlan) => {
    setBusy(true)
    try {
      await api.adminUpdatePlan({ id: p.id, isPopular: !p.isPopular })
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  const activeCount = plans.filter(p => p.isActive && !p.isArchived).length
  const archivedCount = plans.filter(p => p.isArchived).length
  const offerCount = plans.filter(p => p.offerActive).length

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-purple-300">{plans.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-green-400">{activeCount}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Active</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-amber-400">{offerCount}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">On Offer</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-white/40">{archivedCount}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Archived</div>
        </div>
      </div>

      <AdminCard>
        <AdminSectionTitle
          icon={<Tag className="w-4 h-4" />}
          right={
            <button
              onClick={openCreate}
              className="text-xs purple-gradient text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 hover:opacity-90"
            >
              <Plus className="w-3 h-3" />New Plan
            </button>
          }
        >
          Subscription Plans
        </AdminSectionTitle>

        {showForm && (
          <div className="mb-4 p-3 glass-card-inner space-y-3 border-purple-500/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-white">{editing ? 'Edit Plan' : 'New Plan'}</p>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Basic info */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Plus (1 Month)" disabled={!!editing}
                  className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Slug * {!editing && '(immutable)'}</label>
                <input type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
                  placeholder="plus-1-month" disabled={!!editing}
                  className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none" />
              </div>
            </div>

            {/* Pricing — all in paise */}
            <div className="border-t border-white/5 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-2">💰 Pricing (all amounts in ₹ paise — ₹1 = 100 paise)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Base Price (paise) *</label>
                  <input type="number" min={0} value={form.priceInr}
                    onChange={e => setForm({ ...form, priceInr: Number(e.target.value) })}
                    placeholder="9900 (= ₹99)"
                    className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none" />
                  <p className="text-[9px] text-white/30 mt-0.5">₹{(form.priceInr / 100).toFixed(2)}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Original/MRP (paise)</label>
                  <input type="number" min={0} value={form.originalPriceInr}
                    onChange={e => setForm({ ...form, originalPriceInr: e.target.value })}
                    placeholder="19900 (= ₹199)"
                    className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none" />
                  <p className="text-[9px] text-white/30 mt-0.5">{form.originalPriceInr ? `₹${(Number(form.originalPriceInr) / 100).toFixed(2)} (crossed out)` : 'empty = no crossed-out price'}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Offer Price (paise)</label>
                  <input type="number" min={1} value={form.offerPriceInr}
                    onChange={e => setForm({ ...form, offerPriceInr: e.target.value })}
                    placeholder="4900 (= ₹49)"
                    className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none" />
                  <p className="text-[9px] text-white/30 mt-0.5">{form.offerPriceInr ? `₹${(Number(form.offerPriceInr) / 100).toFixed(2)}` : 'empty = no offer'}</p>
                </div>
              </div>
              {/* Live discount preview */}
              {form.offerPriceInr && (
                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs">
                  <span className="text-amber-300 font-semibold">Preview:</span>{' '}
                  <span className="text-white/40 line-through">
                    ₹{((form.originalPriceInr ? Number(form.originalPriceInr) : form.priceInr) / 100).toFixed(2)}
                  </span>{' '}
                  → <span className="text-amber-300 font-bold">₹{(Number(form.offerPriceInr) / 100).toFixed(2)}</span>{' '}
                  (<span className="text-green-400">
                    {Math.round((1 - Number(form.offerPriceInr) / (form.originalPriceInr ? Number(form.originalPriceInr) : form.priceInr)) * 100)}% OFF
                  </span>)
                </div>
              )}
            </div>

            {/* Offer config */}
            <div className="border-t border-white/5 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold mb-2">🏷️ Offer Details</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Offer Tag</label>
                  <input type="text" value={form.offerTag} onChange={e => setForm({ ...form, offerTag: e.target.value })}
                    placeholder="LIMITED TIME" maxLength={30}
                    className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Offer Text</label>
                  <input type="text" value={form.offerText} onChange={e => setForm({ ...form, offerText: e.target.value })}
                    placeholder="Early bird special — ends soon!" maxLength={120}
                    className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Offer Starts At</label>
                  <input type="datetime-local" value={form.offerStartsAt}
                    onChange={e => setForm({ ...form, offerStartsAt: e.target.value })}
                    className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 focus-visible:ring-purple-500/40 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Offer Ends At</label>
                  <input type="datetime-local" value={form.offerEndsAt}
                    onChange={e => setForm({ ...form, offerEndsAt: e.target.value })}
                    className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 focus-visible:ring-purple-500/40 outline-none" />
                </div>
              </div>
            </div>

            {/* Plan config */}
            <div className="border-t border-white/5 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-purple-400 font-bold mb-2">⚙️ Plan Config</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Duration (days)</label>
                  <input type="number" min={1} value={form.durationDays}
                    onChange={e => setForm({ ...form, durationDays: Number(e.target.value) })}
                    className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 focus-visible:ring-purple-500/40 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Display Order</label>
                  <input type="number" min={0} value={form.displayOrder}
                    onChange={e => setForm({ ...form, displayOrder: Number(e.target.value) })}
                    className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 focus-visible:ring-purple-500/40 outline-none" />
                </div>
              </div>
              <div className="mt-2">
                <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Description</label>
                <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Full access for 1 month"
                  className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none" />
              </div>
              <div className="mt-2">
                <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Features (one per line)</label>
                <textarea value={form.featuresText} onChange={e => setForm({ ...form, featuresText: e.target.value })}
                  placeholder={'Full feature access\nPriority support\nCustom Discord role'} rows={4}
                  className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none resize-y" />
              </div>
              <div className="mt-2">
                <label className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block mb-1">Badge (optional)</label>
                <input type="text" value={form.badge} onChange={e => setForm({ ...form, badge: e.target.value })}
                  placeholder="e.g. BEST VALUE" maxLength={30}
                  className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl px-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none" />
              </div>
              <div className="flex items-center gap-4 mt-3">
                <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer select-none">
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })}
                    className="accent-purple-500" />
                  Active
                </label>
                <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer select-none">
                  <input type="checkbox" checked={form.isPopular} onChange={e => setForm({ ...form, isPopular: e.target.checked })}
                    className="accent-purple-500" />
                  <Star className="w-3 h-3 text-amber-400" />
                  Popular / Recommended
                </label>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={busy}
              className="purple-gradient text-white font-semibold rounded-xl px-3 py-2 text-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
              {busy ? '...' : (<><Check className="w-3 h-3" />{editing ? 'Update Plan' : 'Create Plan'}</>)}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={refetch} />
        ) : plans.length === 0 ? (
          <AdminEmptyState icon="🏷️" title="No plans yet" hint="Create your first subscription plan." />
        ) : (
          <div className="space-y-2">
            {plans.map(p => (
              <div key={p.id} className={`glass-card-inner p-3 space-y-2 ${!p.isActive ? 'opacity-60' : ''} ${p.isArchived ? 'border-red-500/20' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="w-3 h-3 text-white/20 flex-shrink-0" />
                    <span className="text-sm font-medium text-white truncate">{p.name}</span>
                    {p.isPopular && (
                      <span className="inline-flex items-center gap-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                        <Star className="w-2.5 h-2.5" />POPULAR
                      </span>
                    )}
                    {p.badge && (
                      <span className="bg-purple-500/20 text-purple-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">{p.badge}</span>
                    )}
                    {p.isArchived && (
                      <span className="inline-flex items-center gap-0.5 bg-red-500/15 text-red-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                        <Archive className="w-2.5 h-2.5" />ARCHIVED
                      </span>
                    )}
                    {p.offerActive && (
                      <span className="inline-flex items-center gap-0.5 bg-green-500/20 text-green-300 text-[9px] font-semibold px-1.5 py-0.5 rounded-full animate-pulse">
                        🔥 OFFER LIVE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleToggleActive(p)} disabled={busy}
                      title={p.isActive ? 'Deactivate' : 'Activate'}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-50">
                      {p.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button onClick={() => handleTogglePopular(p)} disabled={busy}
                      title="Toggle popular"
                      className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 ${p.isPopular ? 'text-amber-400' : 'text-white/70 hover:text-white'}`}>
                      <Star className="w-3 h-3" />
                    </button>
                    <button onClick={() => openEdit(p)} disabled={busy} title="Edit"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-50">
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDelete(p)} disabled={busy} title="Archive"
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 disabled:opacity-50">
                      <Archive className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Price row */}
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="font-bold text-amber-400">{p.effectivePriceDisplay}</span>
                  {p.offerActive && p.originalPriceDisplay && (
                    <>
                      <span className="font-mono text-white/40 line-through">{p.originalPriceDisplay}</span>
                      <span className="bg-green-500/20 text-green-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        {p.discountPercent}% OFF
                      </span>
                    </>
                  )}
                  <span className="text-white/30">·</span>
                  <span className="text-white/50">{p.durationDays} days</span>
                  <span className="text-white/30">·</span>
                  <span className="font-mono text-white/40">/{p.slug}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-white/30">order #{p.displayOrder}</span>
                </div>

                {/* Offer info */}
                {p.offerActive && p.offerTag && (
                  <div className="text-[10px] bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                    <span className="text-amber-300 font-bold">🏷️ {p.offerTag}</span>
                    {p.offerText && <span className="text-white/60 ml-1">— {p.offerText}</span>}
                  </div>
                )}

                {/* Description + features */}
                {p.description && <p className="text-xs text-white/60">{p.description}</p>}
                {p.features.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 border-t border-white/5">
                    {p.features.map((f, i) => (
                      <span key={i} className="text-[10px] bg-white/5 text-white/50 px-1.5 py-0.5 rounded">{f}</span>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-white/30">Updated {timeAgo(p.updatedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {/* Trial info card */}
      <AdminCard>
        <AdminSectionTitle icon={<Gift className="w-4 h-4" />}>
          30-Day Free Trial
        </AdminSectionTitle>
        <p className="text-xs text-white/60">
          New users get a one-time 30-day free trial, controlled entirely by the backend.
          Once a trial expires, it cannot be re-used — the user must purchase a plan.
          Trial state persists across devices (stored in the <code className="bg-white/5 px-1 py-0.5 rounded">Trial</code> database table, not localStorage).
        </p>
        <div className="mt-2 text-[10px] text-white/40 flex items-center gap-2">
          <span className="bg-green-500/15 text-green-300 px-2 py-0.5 rounded-full font-semibold">✓ Backend-controlled</span>
          <span className="bg-green-500/15 text-green-300 px-2 py-0.5 rounded-full font-semibold">✓ One-time enforcement</span>
          <span className="bg-green-500/15 text-green-300 px-2 py-0.5 rounded-full font-semibold">✓ Cross-device</span>
        </div>
      </AdminCard>
    </div>
  )
}
