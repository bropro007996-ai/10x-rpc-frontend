// 10X RPC — Navigation menu component (upgraded with more features)
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from './useRouter'
import {
  Home, LayoutDashboard, User, Settings, Shield, Activity,
  Receipt, LogOut, Menu, X, Server, Bell, CreditCard, Crown, Gamepad2,
  Clock, Zap, RefreshCw, ExternalLink, Moon, Image, Palette, Sparkles,
  TrendingUp, Gift, Heart, ChevronRight
} from 'lucide-react'

interface NavMenuProps {
  isAdmin?: boolean
  onLogout?: () => void
}

interface MenuItem {
  label: string
  icon: typeof Home
  route?: { name: 'dashboard' | 'profile' | 'config' | 'admin' | 'home' }
  href?: string
  badge?: string
  scrollTarget?: string
}

interface MenuSection {
  title: string
  items: MenuItem[]
}

export function NavMenu({ isAdmin, onLogout }: NavMenuProps) {
  const { navigate, route } = useRouter()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const sections: MenuSection[] = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, route: { name: 'dashboard' as const } },
        { label: 'Profile', icon: User, route: { name: 'profile' as const } },
      ],
    },
    {
      title: 'RPC & Status',
      items: [
        { label: 'RPC Settings', icon: Settings, route: { name: 'config' as const } },
        { label: 'Games RPC', icon: Gamepad2, scrollTarget: 'games-rpc' },
        { label: 'Sleep Timer', icon: Moon, scrollTarget: 'sleep-timer' },
        { label: 'Custom Status', icon: Sparkles, scrollTarget: 'custom-status' },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Subscription', icon: Crown, scrollTarget: 'subscription' },
        { label: 'Payment History', icon: Receipt, scrollTarget: 'payment-history' },
        { label: 'Activity Log', icon: Activity, scrollTarget: 'activity-log' },
        { label: 'Notifications', icon: Bell, scrollTarget: 'notifications' },
      ],
    },
    {
      title: 'Personalization',
      items: [
        { label: 'Background', icon: Image, scrollTarget: 'background' },
        { label: 'Weather', icon: Palette, scrollTarget: 'weather' },
      ],
    },
    {
      title: 'System',
      items: [
        { label: 'System Status', icon: Server, href: '/uptime' },
        ...(isAdmin ? [{ label: 'Admin Panel', icon: Shield, route: { name: 'admin' as const } as const, badge: '20 tabs' }] : []),
      ],
    },
  ]

  // Close on route change
  useEffect(() => {
    const handler = () => setOpen(false)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    setTimeout(() => document.addEventListener('click', handler), 0)
    return () => document.removeEventListener('click', handler)
  }, [open])

  const handleItemClick = (item: MenuItem) => {
    setOpen(false)
    if (item.route) {
      navigate(item.route)
    } else if (item.href) {
      window.open(item.href, '_blank', 'noopener,noreferrer')
    } else if (item.scrollTarget) {
      // If we're not on the dashboard, navigate there first, then scroll
      if (route.name !== 'dashboard') {
        navigate({ name: 'dashboard' })
        setTimeout(() => {
          document.getElementById(item.scrollTarget!)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 500)
      } else {
        document.getElementById(item.scrollTarget!)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  const isActive = (item: MenuItem): boolean => {
    if (item.route) {
      return route.name === item.route.name
    }
    return false
  }

  return (
    <>
      {/* Menu Button */}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors text-xs font-medium"
      >
        {open ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
        Menu
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Menu panel */}
          <div
            ref={menuRef}
            className="absolute top-full right-0 mt-2 w-72 max-h-[80vh] overflow-y-auto styled-scroll bg-[#16171d]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl z-50"
          >
            {/* Search hint at top */}
            <div className="px-3 py-2 mb-1 bg-white/5 rounded-xl border border-white/5">
              <p className="text-[10px] text-white/40 flex items-center gap-1.5">
                <span className="text-purple-400">✦</span>
                Press <kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px] font-mono">Esc</kbd> to close
              </p>
            </div>

            {/* Section groups */}
            {sections.map((section, si) => (
              <div key={si}>
                {/* Section title */}
                <p className="text-[9px] uppercase tracking-widest text-purple-400/60 font-bold px-3 py-1.5 mt-1">
                  {section.title}
                </p>

                {/* Section items */}
                {section.items.map((item, ii) => {
                  const Icon = item.icon
                  const active = isActive(item)
                  return (
                    <button
                      key={`${si}-${ii}`}
                      onClick={() => handleItemClick(item)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors group ${
                        active
                          ? 'bg-purple-500/15 text-white border border-purple-500/20'
                          : 'text-white/80 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${active ? 'text-purple-300' : 'text-purple-400/70 group-hover:text-purple-300'} transition-colors`} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <span className="text-[8px] font-bold bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                      {active && <ChevronRight className="w-3 h-3 text-purple-300" />}
                    </button>
                  )
                })}

                {/* Divider between sections */}
                {si < sections.length - 1 && <div className="h-px bg-white/5 my-1" />}
              </div>
            ))}

            {/* Divider */}
            <div className="h-px bg-white/5 my-1" />

            {/* Discord Server link */}
            <a
              href="https://discord.gg/jr27qeCZU"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/80 hover:text-white hover:bg-white/5 text-xs transition-colors group"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-purple-400/70 group-hover:text-purple-300 transition-colors">
                <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span>Discord Server</span>
              <ExternalLink className="w-3 h-3 text-white/20 ml-auto" />
            </a>

            {/* Home link */}
            <button
              onClick={() => { navigate({ name: 'home' }); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/80 hover:text-white hover:bg-white/5 text-xs transition-colors group"
            >
              <Home className="w-3.5 h-3.5 text-purple-400/70 group-hover:text-purple-300 transition-colors" />
              <span>Home</span>
            </button>

            {/* Divider */}
            <div className="h-px bg-white/5 my-1" />

            {/* Logout */}
            {onLogout && (
              <button
                onClick={() => { onLogout(); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}
