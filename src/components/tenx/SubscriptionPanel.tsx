// 10X RPC — Subscription panel (dynamic plans from DB, INR pricing, offers)
'use client'
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { api, type AdminPlan } from '@/lib/api-client'
import { useRouter } from './useRouter'
import { Crown, Check, Clock, Zap, X, Gift, Tag } from 'lucide-react'

interface SubStatus {
  active: boolean
  plan: string
  planName: string
  endsAt: string | null
  daysLeft: number
  isTrial: boolean
  isLifetime: boolean
  autoRenew: boolean
}

export function SubscriptionPanel() {
  const { navigate } = useRouter()
  const [status, setStatus] = useState<SubStatus | null>(null)
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [trialStatus, setTrialStatus] = useState<{ canStartTrial: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)
  const [startingTrial, setStartingTrial] = useState(false)
  const [showPlans, setShowPlans] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [subRes, plansRes, trialRes] = await Promise.all([
        api.subscriptionStatus(),
        api.publicPlans(),
        api.getTrialStatus().catch(() => null),
      ])
      setStatus(subRes.status)
      setPlans(plansRes.plans)
      if (trialRes) setTrialStatus({ canStartTrial: trialRes.canStartTrial, message: trialRes.message })
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleStartTrial = async () => {
    setStartingTrial(true)
    try {
      const r = await api.startTrial()
      if (r.ok) {
        toast.success(r.message || 'Trial activated! 30 days of full access.', { duration: 4000 })
        await refresh()
      } else {
        toast.error(r.message || 'Failed to start trial')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally { setStartingTrial(false) }
  }

  const handleActivate = (plan: AdminPlan) => {
    // Store the selected plan and navigate to checkout page
    // The checkout page handles Order Summary → Razorpay → Success/Failed/Cancelled
    try {
      sessionStorage.setItem('checkout_plan', JSON.stringify(plan))
    } catch {}
    navigate({ name: 'checkout' })
  }

  const handleCancel = async () => {
    if (!confirm('Cancel your subscription? Access continues until the current period ends.')) return
    setBuying(true)
    try {
      const r = await api.subscriptionCancel()
      if (r.ok) {
        toast.success(r.message, { duration: 4000 })
        await refresh()
      } else {
        toast.error(r.message)
      }
    } finally { setBuying(false) }
  }

  if (loading) return null
  if (!status) return null

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#13111d]/95 via-[#0e0d14]/95 to-[#0a0a0f] border border-white/10 rounded-[28px] p-6 shadow-2xl backdrop-blur-xl">
      <div className="absolute -top-16 -right-12 w-48 h-48 bg-purple-900/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        {/* Current plan */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            Subscription
          </h2>
          {status.active ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ACTIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
              EXPIRED
            </span>
          )}
        </div>

        {/* Status card */}
        <div className="glass-card-inner p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-purple-400 font-semibold mb-1">Current Plan</p>
              <p className="text-2xl font-black text-white">{status.planName}</p>
            </div>
            <div className="text-right">
              {status.isLifetime ? (
                <p className="text-3xl font-black text-amber-400">∞</p>
              ) : (
                <>
                  <p className="text-3xl font-black text-white">{status.daysLeft}</p>
                  <p className="text-xs text-white/40">days left</p>
                </>
              )}
            </div>
          </div>
          {status.endsAt && !status.isLifetime && (
            <p className="text-xs text-white/40 mt-2">Expires: {new Date(status.endsAt).toLocaleDateString()}</p>
          )}
        </div>

        {/* Trial CTA — only shown if user can start a trial */}
        {trialStatus?.canStartTrial && !status.active && (
          <div className="glass-card-inner p-3 mb-3 border-emerald-500/30 bg-emerald-500/5">
            <div className="flex items-start gap-2">
              <Gift className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-emerald-300">30-Day Free Trial Available</p>
                <p className="text-[10px] text-white/50 mt-0.5">
                  Get full access for 30 days — no payment required. One-time only.
                </p>
              </div>
              <button
                onClick={handleStartTrial}
                disabled={startingTrial}
                className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold rounded-lg px-3 py-1.5 text-xs hover:bg-emerald-500/25 disabled:opacity-50 flex-shrink-0"
              >
                {startingTrial ? '...' : 'Start Trial'}
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!status.isLifetime && (
            <button
              onClick={() => setShowPlans(!showPlans)}
              className="flex-1 purple-gradient text-white font-semibold rounded-xl px-4 py-2.5 shadow-lg shadow-purple-900/30 hover:opacity-90 active:scale-[0.98] transition-all text-sm"
            >
              {status.isTrial ? 'Upgrade Plan' : 'Extend / Upgrade'}
            </button>
          )}
          {status.active && !status.isTrial && !status.isLifetime && status.autoRenew && (
            <button
              onClick={handleCancel}
              disabled={buying}
              className="bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Plan cards — dynamic from DB */}
        {showPlans && (
          <div className="mt-4 space-y-3">
            {plans.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-4">No plans available yet. Check back soon.</p>
            ) : (
              plans.map(plan => (
                <div
                  key={plan.id}
                  className={`glass-card-inner p-4 ${plan.isPopular ? 'border-purple-500/40' : ''} relative overflow-hidden`}
                >
                  {/* Offer tag (top-right) */}
                  {plan.offerActive && plan.pricing.offerTag && (
                    <div className="absolute top-3 right-3 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      🏷️ {plan.pricing.offerTag}
                    </div>
                  )}
                  {plan.badge && !plan.offerActive && (
                    <div className="absolute top-3 right-3 purple-gradient text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {plan.badge}
                    </div>
                  )}

                  {/* Plan name */}
                  <p className="text-sm text-white/50 mb-1">{plan.name}</p>

                  {/* Price — crossed out original when offer active */}
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-3xl font-black text-white">{plan.effectivePriceDisplay}</span>
                    {plan.offerActive && plan.originalPriceDisplay && (
                      <span className="text-lg font-mono text-white/40 line-through">{plan.originalPriceDisplay}</span>
                    )}
                    <span className="text-sm text-white/50">{plan.durationDays} days</span>
                  </div>

                  {/* Discount badge */}
                  {plan.offerActive && plan.discountPercent > 0 && (
                    <div className="inline-flex items-center gap-1 bg-green-500/20 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full mb-3">
                      <Tag className="w-2.5 h-2.5" />
                      {plan.discountPercent}% OFF
                    </div>
                  )}

                  {/* Offer text */}
                  {plan.offerActive && plan.pricing.offerText && (
                    <p className="text-xs text-amber-300/80 mb-2 italic">"{plan.pricing.offerText}"</p>
                  )}

                  {/* Description */}
                  {plan.description && <p className="text-xs text-white/60 mb-3">{plan.description}</p>}

                  {/* Features */}
                  <ul className="space-y-1.5 mb-4">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-white/70">
                        <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Buy button */}
                  <button
                    onClick={() => handleActivate(plan)}
                    disabled={buying}
                    className={`w-full font-bold rounded-xl py-2.5 text-sm transition-all active:scale-[0.98] disabled:opacity-50 ${
                      plan.isPopular
                        ? 'purple-gradient text-white shadow-lg shadow-purple-900/30 hover:opacity-90'
                        : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                    }`}
                  >
                    {buying ? 'Processing...' : `Buy ${plan.name}`}
                  </button>
                </div>
              ))
            )}
            <p className="text-xs text-white/30 text-center">
              🔒 Payments secured by Razorpay. Prices in INR (₹).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
