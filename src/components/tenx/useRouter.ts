// 10X RPC — path-based router hook (useSyncExternalStore, History API)
'use client'
import { useSyncExternalStore, useCallback } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'dashboard' }
  | { name: 'profile' }
  | { name: 'config' }
  | { name: 'oauth-consent' }
  | { name: 'admin' }
  | { name: 'checkout' }

export function parsePath(pathname: string): Route {
  const clean = pathname.replace(/^\//, '').trim()
  if (!clean) return { name: 'home' }
  const parts = clean.split('/')
  if (parts[0] === 'dashboard') return { name: 'dashboard' }
  if (parts[0] === 'profile') return { name: 'profile' }
  if (parts[0] === 'config') return { name: 'config' }
  if (parts[0] === 'oauth-consent' || parts[0] === 'login') return { name: 'oauth-consent' }
  if (parts[0] === 'admin') return { name: 'admin' }
  if (parts[0] === 'checkout') return { name: 'checkout' }
  return { name: 'home' }
}

export function toPath(route: Route): string {
  switch (route.name) {
    case 'home': return '/'
    case 'dashboard': return '/dashboard'
    case 'profile': return '/profile'
    case 'config': return '/config'
    case 'oauth-consent': return '/oauth-consent'
    case 'admin': return '/admin'
    case 'checkout': return '/checkout'
  }
}

// Subscribe to popstate (browser back/forward).
function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

// Client snapshot — reads the live pathname.
function getSnapshot(): string {
  return window.location.pathname
}

// Server snapshot — always "/" so SSR renders the home route.
function getServerSnapshot(): string {
  return '/'
}

export function useRouter() {
  const pathname = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const route = parsePath(pathname)
  const navigate = useCallback((next: Route) => {
    if (typeof window !== 'undefined') {
      const path = toPath(next)
      window.history.pushState({}, '', path)
      // Dispatch a popstate event so useSyncExternalStore picks up the change
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }, [])
  return { route, navigate, mounted: true }
}
