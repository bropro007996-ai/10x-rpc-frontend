// 10X RPC — Expiry warning banner (shows on dashboard when subscription is near expiry)
'use client'
import { useState } from 'react'
import { AlertTriangle, X, Zap, Crown } from 'lucide-react'
import type { Me } from '@/lib/api-client'
import { useRouter } from './useRouter'

const DISMISS_KEY = 'tenx:expiry-warning-dismissed'
const DISMISS_TTL = 24 * 60 * 60 * 1000 // 24 hours — banner reappears after this

interface ExpiryWarningProps {
  /** Logged-in user payload (from /api/me). */
  me: Me
}

type UrgencyLevel = 'expired' | 'critical' | 'urgent' | 'warning'

/** Pick the urgency bucket for a given daysLeft value. */
function levelFor(daysLeft: number): UrgencyLevel {
  if (daysLeft <= 0) return 'expired'
  if (daysLeft === 1) return 'critical'
  if (daysLeft <= 3) return 'urgent'
  return 'warning' // 4–7 days
}

interface LevelStyle {
  container: string
  iconWrap: string
  title: string
  /** Full banner body copy (already includes the day count). */
  message: string
  pulse: boolean
}

const LEVEL_STYLES: Record<UrgencyLevel, LevelStyle> = {
  expired: {
    container: 'bg-red-950/60 border-red-500/40',
    iconWrap: 'bg-red-500/20 text-red-300',
    title: 'text-red-100',
    message: 'Your subscription has expired. Renew now to restore uninterrupted access.',
    pulse: false,
  },
  critical: {
    container: 'bg-red-950/60 border-red-500/40',
    iconWrap: 'bg-red-500/20 text-red-300',
    title: 'text-red-100',
    message: 'Your subscription expires in 1 day. Renew now to protect uninterrupted access.',
    pulse: true,
  },
  urgent: {
    container: 'bg-orange-950/60 border-orange-500/40',
    iconWrap: 'bg-orange-500/20 text-orange-300',
    title: 'text-orange-100',
    message: 'Your subscription expires in 3 days. Renew now to protect uninterrupted access.',
    pulse: false,
  },
  warning: {
    container: 'bg-amber-950/60 border-amber-500/40',
    iconWrap: 'bg-amber-500/20 text-amber-300',
    title: 'text-amber-100',
    message: 'Your subscription expires in 7 days. Renew now to protect uninterrupted access.',
    pulse: false,
  },
}

/** Read the dismissal timestamp from localStorage (client-only; 0 on SSR). */
function readDismissedAt(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    const ts = raw ? Number(raw) : 0
    return Number.isFinite(ts) && ts > 0 ? ts : 0
  } catch {
    return 0
  }
}

export function ExpiryWarning({ me }: ExpiryWarningProps) {
  const { navigate } = useRouter()

  const sub = me.subscription
  const active = !!sub?.active
  const isTrial = !!sub?.isTrial
  const isLifetime = !!sub?.isLifetime
  const daysLeft = sub?.daysLeft ?? 0

  // Only show for genuinely subscribed users (not trial-only, not lifetime) when ≤7 days remain.
  const eligible =
    active && !isLifetime && !isTrial && daysLeft >= 0 && daysLeft <= 7

  // Lazy-init the dismissed timestamp from localStorage. The parent (DashboardPage)
  // only mounts ExpiryWarning after a client-side async fetch, so there is no SSR
  // for this subtree — reading localStorage here is hydration-safe.
  const [dismissedAt, setDismissedAt] = useState<number>(() => readDismissedAt())

  // Re-evaluated on every render; the dashboard polls `me` every 4 minutes, so a
  // 24h-elapsed dismissal naturally re-shows the banner on the next poll tick.
  const isDismissed =
    dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_TTL
  const shouldRender = eligible && !isDismissed

  const dismiss = () => {
    const ts = Date.now()
    try {
      window.localStorage.setItem(DISMISS_KEY, String(ts))
    } catch {
      // ignore persistence errors
    }
    setDismissedAt(ts)
  }

  /** Navigate to the dashboard and scroll to the SubscriptionPanel (#subscription). */
  const goToPlans = () => {
    navigate({ name: 'dashboard' })
    setTimeout(() => {
      const el = document.getElementById('subscription')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 220)
  }

  if (!shouldRender) return null

  const level = levelFor(daysLeft)
  const s = LEVEL_STYLES[level]

  return (
    <div
      role="alert"
      aria-live="polite"
      className="animate-in fade-in-0 slide-in-from-top-8 duration-500 ease-out"
    >
      <div
        className={`${s.container} backdrop-blur-xl border rounded-2xl shadow-2xl ${
          s.pulse ? 'animate-pulse' : ''
        }`}
      >
        <div className="flex items-start gap-3 p-4">
          {/* Icon */}
          <div
            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${s.iconWrap}`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${s.title}`}>
              {level === 'expired' ? 'Subscription Expired' : 'Subscription Expiring Soon'}
            </p>
            <p className="text-xs text-white/70 mt-0.5 leading-relaxed">{s.message}</p>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={goToPlans}
                className="purple-gradient text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg shadow-purple-900/30 hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Crown className="w-3.5 h-3.5" />
                Renew Now
              </button>
              <button
                type="button"
                onClick={goToPlans}
                className="bg-white/5 border border-white/10 text-white/80 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                Upgrade Plan
              </button>
            </div>
          </div>

          {/* Dismiss */}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss warning"
            className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
