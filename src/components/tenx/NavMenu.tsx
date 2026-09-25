// 10X RPC — Navigation menu component (slide-down menu for all pages)
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from './useRouter'
import {
  Home, LayoutDashboard, User, Settings, Shield, Activity,
  Receipt, LogOut, Menu, X, Server, Bell, CreditCard, Crown, Gamepad2,
  Clock, Zap, RefreshCw, ExternalLink, HelpCircle
} from 'lucide-react'

interface NavMenuProps {
  isAdmin?: boolean
  onLogout?: () => void
}

export function NavMenu({ isAdmin, onLogout }: NavMenuProps) {
  const { navigate } = useRouter()
  const [open, setOpen] = useState(false)

  // Section groups for organized menu
  const sections = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, route: { name: 'dashboard' as const } },
        { label: 'Profile', icon: User, route: { name: 'profile' as const } },
      ],
    },
    {
      title: 'RPC',
      items: [
        { label: 'Settings', icon: Settings, route: { name: 'config' as const } },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Subscription', icon: Crown, href: '/dashboard' },
        { label: 'Payment History', icon: Receipt, href: '/dashboard' },
        { label: 'Activity Log', icon: Activity, href: '/dashboard' },
        { label: 'Notifications', icon: Bell, href: '/dashboard' },
      ],
    },
    {
      title: 'System',
      items: [
        { label: 'System Status', icon: Server, href: '/uptime' },
        ...(isAdmin ? [{ label: 'Admin Panel', icon: Shield, route: { name: 'admin' as const } }] : []),
      ],
    },
  ]

  // Close on route change
  useEffect(() => {
    const handler = () => setOpen(false)
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

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

          {/* Menu panel — wider with sections */}
          <div className="absolute top-full right-0 mt-2 w-64 max-h-[70vh] overflow-y-auto styled-scroll bg-[#16171d]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl z-50">

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
                  if ('href' in item && item.href) {
                    return (
                      <a
                        key={`${si}-${ii}`}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/80 hover:text-white hover:bg-white/5 text-xs transition-colors"
                      >
                        <Icon className="w-3.5 h-3.5 text-purple-400" />
                        <span>{item.label}</span>
                      </a>
                    )
                  }
                  return (
                    <button
                      key={`${si}-${ii}`}
                      onClick={() => {
                        navigate((item as any).route)
                        setOpen(false)
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/80 hover:text-white hover:bg-white/5 text-xs transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5 text-purple-400" />
                      <span>{item.label}</span>
                    </button>
                  )
                })}

                {/* Divider between sections */}
                {si < sections.length - 1 && <div className="h-px bg-white/5 my-1" />}
              </div>
            ))}

            {/* Divider */}
            <div className="h-px bg-white/5 my-1" />

            {/* External links */}
            <a
              href="https://discord.gg/jr27qeCZU"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/80 hover:text-white hover:bg-white/5 text-xs transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-purple-400">
                <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span>Discord Server</span>
              <ExternalLink className="w-3 h-3 text-white/20 ml-auto" />
            </a>

            <a
              href="https://10-x.shop"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/80 hover:text-white hover:bg-white/5 text-xs transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
              <span>10-X Shop</span>
              <ExternalLink className="w-3 h-3 text-white/20 ml-auto" />
            </a>

            {/* Home link */}
            <button
              onClick={() => { navigate({ name: 'home' }); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/80 hover:text-white hover:bg-white/5 text-xs transition-colors"
            >
              <Home className="w-3.5 h-3.5 text-purple-400" />
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
