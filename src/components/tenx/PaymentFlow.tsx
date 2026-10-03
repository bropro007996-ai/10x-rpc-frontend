// 10X RPC — Payment flow state machine (Order Summary → Processing → Success / Failed / Cancelled)
// Wraps the existing Razorpay API (api.razorpayCreateOrder + api.razorpayVerify).
// This component does NOT modify any existing file — it's a standalone flow used by the UI shell.
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ShieldCheck,
  ArrowLeft,
  Lock,
  Loader2,
  Check,
  X,
  AlertTriangle,
  Clock,
  Calendar,
  Sparkles,
  RefreshCw,
  User,
  Tag,
  Zap,
} from 'lucide-react'
import { api, type AdminPlan } from '@/lib/api-client'

type FlowState = 'summary' | 'processing' | 'success' | 'failed' | 'cancelled'

interface PaymentFlowProps {
  plan: AdminPlan
  /** Called after the server verifies the payment successfully. */
  onSuccess?: () => void
  /** Called when the user dismisses the Razorpay modal (cancellation). */
  onCancel?: () => void
  /** Called when the user clicks "Back to Plans". */
  onBack: () => void
}

interface Profile {
  username: string
  avatar: string | null
}

export function PaymentFlow({ plan, onSuccess, onCancel, onBack }: PaymentFlowProps) {
  const [state, setState] = useState<FlowState>('summary')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Refs to keep handler callbacks stable across re-renders without re-opening Razorpay.
  const onSuccessRef = useRef(onSuccess)
  const onCancelRef = useRef(onCancel)
  onSuccessRef.current = onSuccess
  onCancelRef.current = onCancel

  // Load Discord profile once.
  useEffect(() => {
    let cancelled = false
    api
      .me()
      .then((me) => {
        if (cancelled) return
        if (me.user) {
          setProfile({ username: me.user.username, avatar: me.user.avatar || null })
        }
      })
      .catch(() => {
        /* Profile is optional — fail silently. */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-redirect to /dashboard after 3 seconds on success.
  useEffect(() => {
    if (state !== 'success') return
    const t = window.setTimeout(() => {
      window.location.href = '/dashboard'
    }, 3000)
    return () => window.clearTimeout(t)
  }, [state])

  const openRazorpay = useCallback(async () => {
    if (creatingOrder) return
    if (typeof window === 'undefined' || !(window as any).Razorpay) {
      toast.error('Razorpay checkout is still loading. Please try again in a moment.')
      return
    }
    setCreatingOrder(true)
    setErrorMessage(null)
    try {
      // Step 1: Server creates the Razorpay order (amount comes from DB — never trusted from frontend).
      const orderRes = await api.razorpayCreateOrder(plan.id)
      if (!orderRes.ok || !orderRes.orderId) {
        toast.error(orderRes.error || 'Failed to create payment order')
        setErrorMessage(orderRes.error || 'Failed to create payment order')
        return
      }
      setOrderId(orderRes.orderId)

      // Step 2: Open Razorpay checkout.
      const rzp = new (window as any).Razorpay({
        key: orderRes.keyId,
        amount: orderRes.amount, // paise — from DB via backend
        currency: orderRes.currency,
        name: '10X RPC',
        description: orderRes.planName,
        order_id: orderRes.orderId,
        prefill: { name: orderRes.userEmail },
        theme: { color: '#a855f7' },
        // Step 3 (success path): verify payment server-side.
        handler: async (response: any) => {
          const pid = response?.razorpay_payment_id || null
          setPaymentId(pid)
          setState('processing')
          try {
            const verifyRes = await api.razorpayVerify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              planId: plan.id,
            })
            if (verifyRes.ok) {
              const serverEndsAt =
                (verifyRes as any)?.status?.endsAt as string | undefined
              if (serverEndsAt) {
                setExpiresAt(serverEndsAt)
              } else {
                // Fallback: compute locally from plan duration.
                const end = new Date(
                  Date.now() + plan.durationDays * 24 * 60 * 60 * 1000,
                )
                setExpiresAt(end.toISOString())
              }
              setState('success')
              toast.success(verifyRes.message || 'Subscription activated!', {
                duration: 4000,
              })
              onSuccessRef.current?.()
            } else {
              setErrorMessage(verifyRes.error || 'Payment verification failed')
              setState('failed')
              toast.error(verifyRes.error || 'Payment verification failed')
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Payment verification failed'
            setErrorMessage(msg)
            setState('failed')
            toast.error(msg)
          }
        },
        // Step 3 (dismiss path): user closed the Razorpay modal.
        modal: {
          ondismiss: () => {
            setState('cancelled')
            onCancelRef.current?.()
          },
        },
      })

      // Step 3 (failure path): Razorpay reported a payment failure.
      rzp.on('payment.failed', (resp: any) => {
        const desc = resp?.error?.description || 'Payment could not be completed'
        setErrorMessage(desc)
        setPaymentId(resp?.error?.metadata?.payment_id || null)
        setState('failed')
        toast.error(`Payment failed: ${desc}`)
      })

      rzp.open()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to start payment'
      setErrorMessage(msg)
      toast.error(msg)
    } finally {
      setCreatingOrder(false)
    }
  }, [creatingOrder, plan.id, plan.durationDays])

  // ── Renderers ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0b10] text-white flex items-center justify-center p-4 sm:p-6">
      {/* Ambient purple glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-800/15 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {state === 'summary' && (
          <SummaryView
            plan={plan}
            profile={profile}
            creatingOrder={creatingOrder}
            onPay={openRazorpay}
            onBack={onBack}
          />
        )}
        {state === 'processing' && (
          <ProcessingView orderId={orderId} planName={plan.name} />
        )}
        {state === 'success' && (
          <SuccessView
            plan={plan}
            expiresAt={expiresAt}
            paymentId={paymentId}
          />
        )}
        {state === 'failed' && (
          <FailedView
            errorMessage={errorMessage}
            onRetry={openRazorpay}
            onBack={onBack}
          />
        )}
        {state === 'cancelled' && (
          <CancelledView onRetry={openRazorpay} onBack={onBack} />
        )}
      </div>
    </div>
  )
}

// ── Summary ─────────────────────────────────────────────────────────────────
function SummaryView({
  plan,
  profile,
  creatingOrder,
  onPay,
  onBack,
}: {
  plan: AdminPlan
  profile: Profile | null
  creatingOrder: boolean
  onPay: () => void
  onBack: () => void
}) {
  const original = plan.originalPriceDisplay
  const effective = plan.effectivePriceDisplay
  return (
    <GlassCard>
      <Header
        icon={<ShieldCheck className="w-5 h-5 text-purple-400" />}
        title="Order Summary"
        subtitle="Review your plan before paying"
      />

      {/* Discord profile */}
      <div className="glass-card-inner p-4 mb-4 flex items-center gap-3">
        {profile?.avatar ? (
          <img
            src={profile.avatar}
            alt={profile.username}
            className="w-12 h-12 rounded-full ring-2 ring-purple-500/30 object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <User className="w-5 h-5 text-white/40" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold">
            Signed in as
          </p>
          <p className="text-sm font-semibold text-white truncate">
            {profile?.username || 'Discord user'}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          VERIFIED
        </span>
      </div>

      {/* Plan card */}
      <div className="glass-card-inner p-4 mb-4 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-700/10 rounded-full blur-2xl pointer-events-none" />
        {plan.badge && (
          <div className="absolute top-3 right-3 purple-gradient text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            {plan.badge}
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-purple-400" />
          <p className="text-xs uppercase tracking-wider text-purple-400 font-semibold">
            Selected Plan
          </p>
        </div>
        <p className="text-lg font-black text-white mb-1">{plan.name}</p>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-black text-white">{effective}</span>
          {plan.offerActive && original && (
            <span className="text-base font-mono text-white/40 line-through">
              {original}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/50">
          <Clock className="w-3.5 h-3.5" />
          <span>
            {plan.durationDays} day{plan.durationDays === 1 ? '' : 's'} access
          </span>
        </div>
        {plan.offerActive && plan.discountPercent > 0 && (
          <div className="inline-flex items-center gap-1 bg-green-500/20 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full mt-3">
            <Tag className="w-2.5 h-2.5" />
            {plan.discountPercent}% OFF APPLIED
          </div>
        )}
      </div>

      {/* Secure payment banner */}
      <div className="flex items-center gap-2 mb-5 px-3 py-2.5 rounded-xl bg-purple-500/5 border border-purple-500/15">
        <Lock className="w-4 h-4 text-purple-300 flex-shrink-0" />
        <p className="text-xs text-purple-200/80">
          Secure payment via Razorpay. Your card details never touch our servers.
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={onPay}
          disabled={creatingOrder}
          className="w-full purple-gradient text-white font-bold rounded-xl py-3 text-sm shadow-lg shadow-purple-900/40 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {creatingOrder ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Preparing checkout…
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              Pay Securely
            </>
          )}
        </button>
        <button
          onClick={onBack}
          disabled={creatingOrder}
          className="w-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-xl py-2.5 text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Plans
        </button>
      </div>
    </GlassCard>
  )
}

// ── Processing ──────────────────────────────────────────────────────────────
function ProcessingView({
  orderId,
  planName,
}: {
  orderId: string | null
  planName: string
}) {
  return (
    <GlassCard>
      <div className="flex flex-col items-center text-center py-4">
        {/* Animated spinner */}
        <div className="relative w-20 h-20 mb-5">
          <div className="absolute inset-0 rounded-full border-4 border-purple-500/10" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" />
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-300/60 animate-spin [animation-direction:reverse] [animation-duration:1.6s]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-purple-300 animate-spin" />
          </div>
        </div>

        <h2 className="text-lg font-bold text-white mb-1">Confirming Your Payment</h2>
        <p className="text-xs text-white/50 mb-1">
          Your payment is being securely verified.
        </p>
        <p className="text-xs text-white/40 mb-4">
          Activating <span className="text-purple-300 font-semibold">{planName}</span>…
        </p>

        {/* Warning */}
        <div className="w-full flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200/90 text-left leading-relaxed">
            Please do not refresh or start another payment. Verification usually
            completes in a few seconds.
          </p>
        </div>

        {/* Internal order id */}
        {orderId && (
          <div className="w-full glass-card-inner p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">
              Internal Order ID
            </p>
            <p className="text-xs font-mono text-white/70 break-all">{orderId}</p>
          </div>
        )}
      </div>
    </GlassCard>
  )
}

// ── Success ─────────────────────────────────────────────────────────────────
function SuccessView({
  plan,
  expiresAt,
  paymentId,
}: {
  plan: AdminPlan
  expiresAt: string | null
  paymentId: string | null
}) {
  const activatedAt = new Date()
  const expiry = expiresAt ? new Date(expiresAt) : null

  return (
    <GlassCard>
      <div className="flex flex-col items-center text-center py-4">
        {/* Animated green check */}
        <div className="relative mb-5">
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-20 h-20 rounded-full bg-emerald-500/20 animate-ping [animation-duration:1.6s]" />
          </span>
          <div
            className="relative w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center"
            style={{ animation: 'pfPop 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28)' }}
          >
            <Check
              className="w-10 h-10 text-emerald-400"
              strokeWidth={3}
              style={{ animation: 'pfDraw 0.4s ease-out 0.15s both' }}
            />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-1">Payment Successful</h2>
        <p className="text-xs text-emerald-300/90 mb-5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Subscription Activated
        </p>

        {/* Details */}
        <div className="w-full glass-card-inner p-4 space-y-3 text-left mb-5">
          <DetailRow label="Plan" value={plan.name} icon={<Zap className="w-3.5 h-3.5" />} />
          <DetailRow
            label="Duration"
            value={`${plan.durationDays} day${plan.durationDays === 1 ? '' : 's'}`}
            icon={<Clock className="w-3.5 h-3.5" />}
          />
          <DetailRow
            label="Activated on"
            value={formatDate(activatedAt)}
            icon={<Calendar className="w-3.5 h-3.5" />}
          />
          {expiry && (
            <DetailRow
              label="Expires on"
              value={formatDate(expiry)}
              icon={<Calendar className="w-3.5 h-3.5" />}
            />
          )}
          {paymentId && (
            <div className="pt-2 border-t border-white/5">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">
                Payment Reference
              </p>
              <p className="text-[11px] font-mono text-white/50 break-all">{paymentId}</p>
            </div>
          )}
        </div>

        <p className="text-[11px] text-white/40 mb-4">
          Redirecting to your dashboard in a few seconds…
        </p>

        <button
          onClick={() => {
            window.location.href = '/dashboard'
          }}
          className="w-full purple-gradient text-white font-bold rounded-xl py-3 text-sm shadow-lg shadow-purple-900/40 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Open Dashboard
        </button>
      </div>

      <style>{`
        @keyframes pfPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pfDraw {
          0% { stroke-dasharray: 30; stroke-dashoffset: 30; opacity: 0; }
          100% { stroke-dasharray: 30; stroke-dashoffset: 0; opacity: 1; }
        }
      `}</style>
    </GlassCard>
  )
}

// ── Failed ──────────────────────────────────────────────────────────────────
function FailedView({
  errorMessage,
  onRetry,
  onBack,
}: {
  errorMessage: string | null
  onRetry: () => void
  onBack: () => void
}) {
  return (
    <GlassCard>
      <div className="flex flex-col items-center text-center py-4">
        <div className="relative mb-5">
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-20 h-20 rounded-full bg-red-500/15 animate-ping [animation-duration:1.6s] opacity-60" />
          </span>
          <div
            className="relative w-20 h-20 rounded-full bg-red-500/15 border-2 border-red-500/40 flex items-center justify-center"
            style={{ animation: 'pfPop 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)' }}
          >
            <X className="w-10 h-10 text-red-400" strokeWidth={3} />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Payment Failed</h2>
        <p className="text-xs text-white/60 mb-4 max-w-xs leading-relaxed">
          Your payment could not be completed. No subscription has been activated.
        </p>

        {errorMessage && (
          <div className="w-full glass-card-inner p-3 mb-5 text-left">
            <p className="text-[10px] uppercase tracking-wider text-red-400 font-semibold mb-1">
              Reason
            </p>
            <p className="text-xs text-white/70 break-words">{errorMessage}</p>
          </div>
        )}

        <div className="w-full space-y-2">
          <button
            onClick={onRetry}
            className="w-full purple-gradient text-white font-bold rounded-xl py-3 text-sm shadow-lg shadow-purple-900/40 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Payment
          </button>
          <button
            onClick={onBack}
            className="w-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-xl py-2.5 text-sm transition-all flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Plans
          </button>
        </div>
      </div>
    </GlassCard>
  )
}

// ── Cancelled ──────────────────────────────────────────────────────────────
function CancelledView({
  onRetry,
  onBack,
}: {
  onRetry: () => void
  onBack: () => void
}) {
  return (
    <GlassCard>
      <div className="flex flex-col items-center text-center py-4">
        <div className="relative mb-5">
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-20 h-20 rounded-full bg-amber-500/15 animate-ping [animation-duration:1.8s] opacity-50" />
          </span>
          <div
            className="relative w-20 h-20 rounded-full bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center"
            style={{ animation: 'pfPop 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)' }}
          >
            <AlertTriangle className="w-10 h-10 text-amber-400" strokeWidth={2.5} />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Payment Cancelled</h2>
        <p className="text-xs text-white/60 mb-6 max-w-xs leading-relaxed">
          You closed the payment window before completing the checkout. No charge
          has been made.
        </p>

        <div className="w-full space-y-2">
          <button
            onClick={onRetry}
            className="w-full purple-gradient text-white font-bold rounded-xl py-3 text-sm shadow-lg shadow-purple-900/40 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <button
            onClick={onBack}
            className="w-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-xl py-2.5 text-sm transition-all flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Plans
          </button>
        </div>
      </div>
    </GlassCard>
  )
}

// ── Shared pieces ───────────────────────────────────────────────────────────
function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-card p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-700/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function Header({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h1 className="text-lg font-bold text-white">{title}</h1>
      </div>
      {subtitle && <p className="text-xs text-white/50">{subtitle}</p>}
    </div>
  )
}

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-xs text-white/50">
        {icon}
        {label}
      </span>
      <span className="text-xs font-semibold text-white text-right">{value}</span>
    </div>
  )
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
