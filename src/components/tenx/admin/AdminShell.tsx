// 10X RPC — Admin shell with tabbed sidebar navigation
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from '../useRouter'
import { BackButton } from '../ui'
import {
  LayoutDashboard, Users, CreditCard, Crown, Megaphone, Send,
  Settings, ScrollText, HeartPulse, RefreshCw, Shield, Tag, Bell,
  BarChart3, Flag, Webhook, UserCog, Activity, ShieldBan, KeyRound, Wrench, Download,
  Search, X, Menu, ChevronRight
} from 'lucide-react'
import { OverviewTab } from './OverviewTab'
import { UsersTab } from './UsersTab'
import { PaymentsTab } from './PaymentsTab'
import { SubscriptionsTab } from './SubscriptionsTab'
import { AnnouncementsTab } from './AnnouncementsTab'
import { BroadcastTab } from './BroadcastTab'
import { SettingsTab } from './SettingsTab'
import { AuditLogsTab } from './AuditLogsTab'
import { HealthTab } from './HealthTab'
import { PlansTab } from './PlansTab'
import { NotificationsTab } from './NotificationsTab'
import { AnalyticsTab } from './AnalyticsTab'
import { FeatureFlagsTab } from './FeatureFlagsTab'
import { WebhooksTab } from './WebhooksTab'
import { ImpersonateTab } from './ImpersonateTab'
import { ActivityTab } from './ActivityTab'
import { IpBlocklistTab } from './IpBlocklistTab'
import { ApiKeysTab } from './ApiKeysTab'
import { MaintenanceTab } from './MaintenanceTab'
import { ExportCenterTab } from './ExportCenterTab'

export type AdminTab =
  | 'overview'
  | 'analytics'
  | 'activity'
  | 'users'
  | 'payments'
  | 'subscriptions'
  | 'plans'
  | 'announcements'
  | 'broadcast'
  | 'notifications'
  | 'impersonate'
  | 'feature-flags'
  | 'webhooks'
  | 'ip-blocklist'
  | 'api-keys'
  | 'maintenance'
  | 'export'
  | 'settings'
  | 'audit-logs'
  | 'health'

type AdminCategory = 'insights' | 'users-billing' | 'communication' | 'security' | 'system'

interface TabDef {
  id: AdminTab
  label: string
  icon: typeof LayoutDashboard
  desc: string
  category: AdminCategory
}

const CATEGORY_META: Record<AdminCategory, { label: string; icon: typeof LayoutDashboard }> = {
  'insights':       { label: 'Insights',       icon: BarChart3 },
  'users-billing':  { label: 'Users & Billing', icon: Users },
  'communication':  { label: 'Communication', icon: Megaphone },
  'security':       { label: 'Security',      icon: Shield },
  'system':         { label: 'System',        icon: Settings },
}

const CATEGORY_ORDER: AdminCategory[] = ['insights', 'users-billing', 'communication', 'security', 'system']

const TABS: TabDef[] = [
  // Insights
  { id: 'overview',      label: 'Overview',      icon: LayoutDashboard, desc: 'Stats, daemon & bulk control', category: 'insights' },
  { id: 'analytics',     label: 'Analytics',     icon: BarChart3,       desc: 'Charts & growth metrics',      category: 'insights' },
  { id: 'activity',      label: 'Activity',      icon: Activity,        desc: 'Real-time event feed',         category: 'insights' },
  // Users & Billing
  { id: 'users',         label: 'Users',         icon: Users,           desc: 'Manage user accounts',         category: 'users-billing' },
  { id: 'payments',      label: 'Payments',      icon: CreditCard,     desc: 'All payment transactions',     category: 'users-billing' },
  { id: 'subscriptions', label: 'Subscriptions', icon: Crown,           desc: 'Active & expired subs',        category: 'users-billing' },
  { id: 'plans',         label: 'Plans',         icon: Tag,             desc: 'Subscription plan CRUD',       category: 'users-billing' },
  // Communication
  { id: 'announcements', label: 'Announcements', icon: Megaphone,      desc: 'Site-wide announcements',     category: 'communication' },
  { id: 'broadcast',     label: 'Broadcast',    icon: Send,           desc: 'Mass notify users',            category: 'communication' },
  { id: 'notifications', label: 'Notifications', icon: Bell,            desc: 'Sent notification log',        category: 'communication' },
  // Security
  { id: 'impersonate',   label: 'Impersonate',   icon: UserCog,         desc: 'Login as any user',            category: 'security' },
  { id: 'feature-flags', label: 'Feature Flags', icon: Flag,            desc: 'Global feature toggles',       category: 'security' },
  { id: 'webhooks',      label: 'Webhooks',      icon: Webhook,         desc: 'Outgoing webhook config',      category: 'security' },
  { id: 'ip-blocklist',  label: 'IP Blocklist',  icon: ShieldBan,       desc: 'Block malicious IPs',           category: 'security' },
  { id: 'api-keys',      label: 'API Keys',      icon: KeyRound,        desc: 'Programmatic access tokens',   category: 'security' },
  // System
  { id: 'maintenance',   label: 'Maintenance',   icon: Wrench,          desc: 'Schedule downtime windows',    category: 'system' },
  { id: 'export',        label: 'Export',        icon: Download,         desc: 'Download data (CSV/JSON)',     category: 'system' },
  { id: 'settings',      label: 'Settings',      icon: Settings,        desc: 'Site configuration',           category: 'system' },
  { id: 'audit-logs',    label: 'Audit Logs',    icon: ScrollText,      desc: 'Admin action history',         category: 'system' },
  { id: 'health',        label: 'System Health', icon: HeartPulse,      desc: 'Service status',               category: 'system' },
]

interface AdminShellProps {
  /** Refresh trigger — when this changes, the active tab refetches */
  refreshKey: number
  onRefresh: () => void
  refreshing: boolean
  autoRefresh: boolean
  onToggleAuto: (v: boolean) => void
}

export function AdminShell({ refreshKey, onRefresh, refreshing, autoRefresh, onToggleAuto }: AdminShellProps) {
  const { navigate } = useRouter()
  // Persist active tab in the URL hash so refreshes remember it
  const [active, setActive] = useState<AdminTab>(() => {
    if (typeof window === 'undefined') return 'overview'
    const h = window.location.hash.replace('#', '').replace(/^admin-/, '')
    return (TABS.find(t => t.id === h)?.id) || 'overview'
  })
  const [search, setSearch] = useState('')
  const [collapsedCats, setCollapsedCats] = useState<Set<AdminCategory>>(new Set())
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const newHash = `#admin-${active}`
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash)
    }
  }, [active])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  // Helper: select a tab and close the mobile menu (used by mobile drawer clicks)
  const selectTab = (tabId: AdminTab) => {
    setActive(tabId)
    setMobileMenuOpen(false)
    setSearch('')
  }

  // Keyboard shortcut: "/" focuses search, Escape clears it
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        document.getElementById('admin-menu-search')?.focus()
      }
      if (e.key === 'Escape' && document.activeElement?.id === 'admin-menu-search') {
        setSearch('')
        ;(document.activeElement as HTMLInputElement)?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const ActiveIcon = TABS.find(t => t.id === active)?.icon || LayoutDashboard

  // Filter tabs by search query
  const filteredTabs = search.trim()
    ? TABS.filter(t =>
        t.label.toLowerCase().includes(search.toLowerCase()) ||
        t.desc.toLowerCase().includes(search.toLowerCase()) ||
        t.id.includes(search.toLowerCase())
      )
    : TABS

  const toggleCategory = (cat: AdminCategory) => {
    setCollapsedCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div className="min-h-screen px-3 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto pb-24 lg:pb-12">
      {/* Header — sticky on mobile */}
      <header className="sticky top-0 z-30 -mx-3 sm:-mx-6 sm:static sm:mx-0 mb-4 sm:mb-6 px-3 sm:px-0 py-3 sm:py-0 bg-[#0a0b10]/95 sm:bg-transparent backdrop-blur-xl sm:backdrop-blur-none border-b sm:border-0 border-white/5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors flex-shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <BackButton onClick={() => navigate({ name: 'dashboard' })} />
            <div className="flex items-center gap-1.5 min-w-0">
              <img src="/logo.png" alt="10X RPC" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover flex-shrink-0" />
              <h1 className="text-base sm:text-2xl font-bold text-white truncate">Admin</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <label className="hidden sm:flex items-center gap-1 text-xs text-white/50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => onToggleAuto(e.target.checked)}
                className="accent-purple-500"
              />
              Auto
            </label>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Layout: sidebar + content */}
      <div className="grid lg:grid-cols-[220px_1fr] gap-4">
        {/* Desktop sidebar */}
        <aside className="hidden lg:sticky lg:top-4 lg:self-start lg:block">
          <nav className="hidden lg:flex flex-col gap-1 p-2 glass-card">
            {/* Search input */}
            <div className="relative mb-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
              <input
                id="admin-menu-search"
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tabs... (/)"
                className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-lg pl-7 pr-2 py-1.5 placeholder:text-white/30 focus-visible:ring-purple-500/40 outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Category-grouped tabs (or flat search results) */}
            {search.trim() ? (
              filteredTabs.length === 0 ? (
                <p className="text-[10px] text-white/40 px-3 py-4 text-center">No tabs match "{search}"</p>
              ) : (
                filteredTabs.map(tab => {
                  const Icon = tab.icon
                  const isActive = tab.id === active
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActive(tab.id); setSearch('') }}
                      className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                        isActive
                          ? 'bg-purple-500/15 border border-purple-500/30 text-white'
                          : 'border border-transparent text-white/70 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isActive ? 'text-purple-300' : 'text-purple-400/70'}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{tab.label}</div>
                        <div className="text-[10px] text-white/40 truncate">{tab.desc}</div>
                      </div>
                    </button>
                  )
                })
              )
            ) : (
              CATEGORY_ORDER.map(cat => {
                const catTabs = TABS.filter(t => t.category === cat)
                const CatIcon = CATEGORY_META[cat].icon
                const isCollapsed = collapsedCats.has(cat)
                return (
                  <div key={cat}>
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="w-full flex items-center gap-1.5 px-3 py-1.5 mt-1 text-[9px] uppercase tracking-widest text-purple-400/60 font-bold hover:text-purple-300 transition-colors"
                    >
                      <span className="text-[8px]">{isCollapsed ? '▶' : '▼'}</span>
                      <CatIcon className="w-3 h-3" />
                      {CATEGORY_META[cat].label}
                      <span className="text-white/20 ml-auto normal-case tracking-normal">{catTabs.length}</span>
                    </button>
                    {!isCollapsed && catTabs.map(tab => {
                      const Icon = tab.icon
                      const isActive = tab.id === active
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActive(tab.id)}
                          className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                            isActive
                              ? 'bg-purple-500/15 border border-purple-500/30 text-white'
                              : 'border border-transparent text-white/70 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isActive ? 'text-purple-300' : 'text-purple-400/70'}`} />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{tab.label}</div>
                            <div className="text-[10px] text-white/40 truncate">{tab.desc}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })
            )}
          </nav>
        </aside>

        {/* Mobile slide-out menu */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Drawer */}
            <div className="lg:hidden fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[320px] bg-[#0a0b10] border-r border-white/10 overflow-y-auto styled-scroll">
              {/* Drawer header */}
              <div className="sticky top-0 bg-[#0a0b10]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="10X RPC" className="w-7 h-7 rounded-lg object-cover" />
                  <span className="text-sm font-bold text-white">Admin Menu</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 -mr-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile search */}
              <div className="p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search tabs..."
                    className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl pl-9 pr-3 py-2.5 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
                  />
                </div>
              </div>

              {/* Mobile category tabs */}
              <div className="px-2 pb-6">
                {search.trim() ? (
                  filteredTabs.length === 0 ? (
                    <p className="text-xs text-white/40 px-3 py-6 text-center">No tabs match "{search}"</p>
                  ) : (
                    filteredTabs.map(tab => {
                      const Icon = tab.icon
                      const isActive = tab.id === active
                      return (
                        <button
                          key={tab.id}
                          onClick={() => selectTab(tab.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                            isActive
                              ? 'bg-purple-500/15 border border-purple-500/30 text-white'
                              : 'border border-transparent text-white/70 hover:bg-white/5'
                          }`}
                        >
                          <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-purple-300' : 'text-purple-400/70'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate">{tab.label}</div>
                            <div className="text-[10px] text-white/40 truncate">{tab.desc}</div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                        </button>
                      )
                    })
                  )
                ) : (
                  CATEGORY_ORDER.map(cat => {
                    const catTabs = TABS.filter(t => t.category === cat)
                    const CatIcon = CATEGORY_META[cat].icon
                    const isCollapsed = collapsedCats.has(cat)
                    return (
                      <div key={cat} className="mb-2">
                        <button
                          onClick={() => toggleCategory(cat)}
                          className="w-full flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-widest text-purple-400/60 font-bold hover:text-purple-300"
                        >
                          <span className="text-[9px]">{isCollapsed ? '▶' : '▼'}</span>
                          <CatIcon className="w-3 h-3" />
                          {CATEGORY_META[cat].label}
                          <span className="text-white/20 ml-auto normal-case tracking-normal">{catTabs.length}</span>
                        </button>
                        {!isCollapsed && catTabs.map(tab => {
                          const Icon = tab.icon
                          const isActive = tab.id === active
                          return (
                            <button
                              key={tab.id}
                              onClick={() => selectTab(tab.id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                                isActive
                                  ? 'bg-purple-500/15 border border-purple-500/30 text-white'
                                  : 'border border-transparent text-white/70 hover:bg-white/5'
                              }`}
                            >
                              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-purple-300' : 'text-purple-400/70'}`} />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold truncate">{tab.label}</div>
                                <div className="text-[10px] text-white/40 truncate">{tab.desc}</div>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                            </button>
                          )
                        })}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </>
        )}

        {/* Content */}
        <main className="min-w-0">
          {/* Tab title strip */}
          <div className="flex items-center gap-2 mb-4">
            <ActiveIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-white truncate">
              {TABS.find(t => t.id === active)?.label}
            </h2>
            <span className="text-xs text-white/40 hidden sm:inline">·</span>
            <span className="text-xs text-white/40 truncate hidden sm:inline">
              {TABS.find(t => t.id === active)?.desc}
            </span>
          </div>

          {active === 'overview' && <OverviewTab refreshKey={refreshKey} />}
          {active === 'analytics' && <AnalyticsTab refreshKey={refreshKey} />}
          {active === 'activity' && <ActivityTab refreshKey={refreshKey} />}
          {active === 'users' && <UsersTab refreshKey={refreshKey} />}
          {active === 'payments' && <PaymentsTab refreshKey={refreshKey} />}
          {active === 'subscriptions' && <SubscriptionsTab refreshKey={refreshKey} />}
          {active === 'plans' && <PlansTab refreshKey={refreshKey} />}
          {active === 'announcements' && <AnnouncementsTab refreshKey={refreshKey} />}
          {active === 'broadcast' && <BroadcastTab refreshKey={refreshKey} />}
          {active === 'notifications' && <NotificationsTab refreshKey={refreshKey} />}
          {active === 'impersonate' && <ImpersonateTab refreshKey={refreshKey} />}
          {active === 'feature-flags' && <FeatureFlagsTab refreshKey={refreshKey} />}
          {active === 'webhooks' && <WebhooksTab refreshKey={refreshKey} />}
          {active === 'ip-blocklist' && <IpBlocklistTab refreshKey={refreshKey} />}
          {active === 'api-keys' && <ApiKeysTab refreshKey={refreshKey} />}
          {active === 'maintenance' && <MaintenanceTab refreshKey={refreshKey} />}
          {active === 'export' && <ExportCenterTab refreshKey={refreshKey} />}
          {active === 'settings' && <SettingsTab refreshKey={refreshKey} />}
          {active === 'audit-logs' && <AuditLogsTab refreshKey={refreshKey} />}
          {active === 'health' && <HealthTab refreshKey={refreshKey} />}
        </main>
      </div>

      {/* Mobile bottom nav bar — quick access to top 5 tabs */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0a0b10]/95 backdrop-blur-xl border-t border-white/10">
        <div className="flex items-stretch justify-around px-1 py-1 safe-area-bottom">
          {[
            { id: 'overview' as const, label: 'Home', icon: LayoutDashboard },
            { id: 'users' as const, label: 'Users', icon: Users },
            { id: 'analytics' as const, label: 'Stats', icon: BarChart3 },
            { id: 'activity' as const, label: 'Feed', icon: Activity },
            { id: 'health' as const, label: 'Status', icon: HeartPulse },
          ].map(item => {
            const Icon = item.icon
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg min-w-[56px] transition-colors ${
                  isActive ? 'text-purple-300' : 'text-white/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
