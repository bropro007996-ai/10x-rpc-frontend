// 10X RPC — Grace period full-screen page (shown when subscription is expired but workspace is still preserved)
'use client'
import { useEffect, useState } from 'react'
import { Clock, AlertTriangle, Gift, Crown, Eye, ExternalLink, Power } from 'lucide-react'
import { useRouter } from './useRouter'

interface GracePeriodPageProps {
  /** ISO date string marking when the subscription expired (grace = expiry + 7 days). */
  expiresAt: string
}

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000 // 7 days of preserved workspace

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
}

function getTimeLeft(target: number): TimeLeft {
  const total = Math.max(0, target - Date.now())
  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
    total,
  }
}

export function GracePeriodPage({ expiresAt }: GracePeriodPageProps) {
  const { navigate } = useRouter()

  // Grace period ends 7 days after the subscription expired.
  const graceEndMs = new Date(expiresAt).getTime() + GRACE_PERIOD_MS
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => getTimeLeft(graceEndMs))

  useEffect(() => {
    const tick = () => setTimeLeft(getTimeLeft(graceEndMs))
    tick() // sync immediately on mount / when target changes
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [graceEndMs])

  /** "Renew Now" — go straight back to the dashboard. */
  const renewNow = () => {
    navigate({ name: 'dashboard' })
  }

  /** "View Plans" — go to dashboard then smooth-scroll to the SubscriptionPanel. */
  const viewPlans = () => {
    navigate({ name: 'dashboard' })
    setTimeout(() => {
      const el = document.getElementById('subscription')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 220)
  }

  const units = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ]

  return (
    <div className="min-h-screen w-full bg-[#0a0b10] text-white flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[640px] h-[640px] bg-purple-900/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 w-[420px] h-[420px] bg-red-900/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* Suspended badge */}
        <div className="flex justify-center mb-6 animate-in fade-in-0 duration-500">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Suspended
          </span>
        </div>

        {/* Heading */}
        <div className="text-center mb-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Your Subscription Has Expired
          </h1>
          <p className="text-sm sm:text-base text-white/60 mt-3 max-w-md mx-auto leading-relaxed">
            Your RPC, status, and game-status services have been automatically disabled because your subscription has expired.
          </p>
        </div>

        {/* RPC services disabled banner */}
        <div className="glass-card p-4 mb-5 animate-in fade-in-0 slide-in-from-bottom-3 duration-500 border-red-500/20">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center">
              <Power className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white mb-1">All RPC Services Disabled</p>
              <div className="space-y-1.5 mt-2">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  RPC (Rich Presence) — Stopped
                </div>
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  RPC Status — Disabled
                </div>
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Game Status — Disabled
                </div>
              </div>
              <p className="text-[11px] text-white/40 mt-2.5 leading-relaxed">
                Your saved configuration is temporarily preserved. Renew before the countdown reaches zero to restore your workspace.
              </p>
            </div>
          </div>
        </div>

        {/* Countdown card */}
        <div className="glass-card p-5 sm:p-7 mb-5 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
          <div className="flex items-center justify-center gap-2 mb-5 text-white/50 text-xs font-semibold uppercase tracking-wider">
            <Clock className="w-4 h-4 text-purple-400" />
            Grace period ends in
          </div>

          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {units.map((u, i) => (
              <div key={i} className="glass-card-inner p-3 sm:p-4 text-center">
                <div className="font-mono text-2xl sm:text-4xl font-black text-white tabular-nums">
                  {String(u.value).padStart(2, '0')}
                </div>
                <div className="text-[10px] sm:text-xs text-white/40 mt-1 uppercase tracking-wider">
                  {u.label}
                </div>
              </div>
            ))}
          </div>

          {/* Permanent deletion warning */}
          <div className="mt-5 flex items-start gap-2 text-xs text-amber-300/80 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              If you do not renew before the grace period ends, your preserved workspace and configuration will be permanently deleted.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
          <button
            type="button"
            onClick={renewNow}
            className="purple-gradient text-white font-bold rounded-xl px-4 py-3.5 shadow-lg shadow-purple-900/30 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Crown className="w-4 h-4" />
            Renew Now
          </button>
          <button
            type="button"
            onClick={viewPlans}
            className="bg-white/5 border border-white/10 text-white font-semibold rounded-xl px-4 py-3.5 hover:bg-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            View Plans
          </button>
        </div>

        {/* Discord / Support link — purple theme to match the dashboard */}
        <a
          href="https://discord.gg/JjsPqbWnrH"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-purple-500/10 border border-purple-500/30 text-purple-300 font-medium rounded-xl px-4 py-3 hover:bg-purple-500/20 active:scale-[0.98] transition-all animate-in fade-in-0 slide-in-from-bottom-4 duration-700"
        >
          <Gift className="w-4 h-4" />
          Join Discord / Support
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>

        {/* Footer note */}
        <p className="text-center text-[11px] text-white/30 mt-6">
          Need help? Reach out to our team on Discord — we&apos;re here 24/7.
        </p>
      </div>
    </div>
  )
}
