// 10X RPC — Admin dashboard page (/admin) — uses AdminShell with tabbed menu
'use client'
import { useEffect, useState, useCallback } from 'react'
import { AdminShell } from './admin/AdminShell'
import { Card } from './ui'
import { useRouter } from './useRouter'

export function AdminPage() {
  const { navigate } = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const checkAccess = useCallback(async () => {
    try {
      // The shell's tab fetchers will surface the actual data.
      // Here we just verify the user is an admin by hitting a cheap admin endpoint.
      const res = await fetch('/api/admin/stats', { credentials: 'include' })
      if (res.status === 401) {
        setError('Please sign in first.')
      } else if (res.status === 403) {
        setError('You are not an admin.')
      } else if (!res.ok) {
        setError('Failed to load admin panel')
      } else {
        setError(null)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAccess()
  }, [checkAccess])

  // Auto-refresh trigger (broadcast to all tabs via refreshKey)
  const refresh = useCallback(() => {
    setRefreshing(true)
    setRefreshKey(k => k + 1)
    setTimeout(() => setRefreshing(false), 500)
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(() => setRefreshKey(k => k + 1), 30000)
    return () => clearInterval(t)
  }, [autoRefresh])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-10 h-10 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin mb-3" />
          <p className="text-white/60 text-sm">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate({ name: 'dashboard' })}
            className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors"
          >
            <span>←</span> Back
          </button>
          <h1 className="text-2xl font-bold text-white">Admin</h1>
          <div className="w-16" />
        </div>
        <Card>
          <div className="text-center space-y-3 py-8">
            <div className="text-4xl">🔒</div>
            <p className="text-white/70 font-medium">Access Denied</p>
            <p className="text-sm text-white/50 max-w-xs mx-auto">{error}</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <AdminShell
      refreshKey={refreshKey}
      onRefresh={refresh}
      refreshing={refreshing}
      autoRefresh={autoRefresh}
      onToggleAuto={setAutoRefresh}
    />
  )
}
