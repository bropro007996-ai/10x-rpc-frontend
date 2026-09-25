// 10X RPC — Admin shared atoms
'use client'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { useState, useEffect, useCallback, useReducer } from 'react'

export function AdminCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('glass-card p-4 sm:p-5 shadow-xl', className)}>
      {children}
    </div>
  )
}

export function AdminSectionTitle({ icon, children, right }: { icon?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 gap-2">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        {icon && <span className="text-purple-400">{icon}</span>}
        {children}
      </h3>
      {right}
    </div>
  )
}

export function AdminEmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-3xl mb-2 opacity-60">{icon}</div>
      <p className="text-sm font-medium text-white/70">{title}</p>
      {hint && <p className="text-xs text-white/40 mt-1 max-w-xs mx-auto">{hint}</p>}
    </div>
  )
}

export function AdminErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-3xl mb-2">⚠️</div>
      <p className="text-sm font-medium text-red-300">Failed to load</p>
      <p className="text-xs text-white/40 mt-1 max-w-xs mx-auto">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-white/80 hover:bg-white/10"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function AdminStatPill({ label, value, color = 'text-white' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="glass-card-inner p-3 text-center">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  )
}

/** Generic data fetcher hook for admin tabs */
export function useAdminFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[]
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  type State =
    | { status: 'loading'; data: T | null; error: string | null }
    | { status: 'ok'; data: T; error: null }
    | { status: 'error'; data: null; error: string }

  type Action =
    | { type: 'loading' }
    | { type: 'ok'; data: T }
    | { type: 'error'; error: string }
    | { type: 'reset' }

  const reducer = (state: State, action: Action): State => {
    switch (action.type) {
      case 'loading': return { status: 'loading', data: state.data, error: state.error }
      case 'ok': return { status: 'ok', data: action.data, error: null }
      case 'error': return { status: 'error', data: null, error: action.error }
      case 'reset': return { status: 'loading', data: null, error: null }
    }
  }

  const [state, dispatch] = useReducer(reducer, { status: 'loading', data: null, error: null } as State)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    dispatch({ type: 'reset' })
    fetcher()
      .then(d => { if (!cancelled) dispatch({ type: 'ok', data: d }) })
      .catch(e => { if (!cancelled) dispatch({ type: 'error', error: e instanceof Error ? e.message : 'Failed to load' }) })
    return () => { cancelled = true }
  }, [...deps, tick])

  return {
    data: state.data,
    loading: state.status === 'loading',
    error: state.error,
    refetch,
  }
}

export function formatMoney(amount: number, currency: string = 'inr'): string {
  const symbol = currency.toLowerCase() === 'inr' ? '₹' : currency.toUpperCase() + ' '
  return `${symbol}${(amount / 100).toFixed(0)}`
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const sec = Math.floor(diff / 1000)
    if (sec < 60) return `${sec}s ago`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.floor(hr / 24)
    if (day < 30) return `${day}d ago`
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}
