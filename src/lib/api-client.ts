// 10X RPC — frontend API client
export interface Me {
  authenticated: boolean
  user?: {
    id: string
    username: string
    discriminator: string
    avatar: string
    backgroundUrl?: string | null
  }
  session?: {
    statusEnabled?: boolean
    rpcEnabled: boolean
    gamesRpcEnabled: boolean
    gatewayReady: boolean
    userStatus: string
    customStatus: string | null
    customStatusEmoji: string | null
    statusPlatform?: string
    vrStatusActive: boolean
    sleepTimerActive: boolean
    sleepTimerEndsAt: string | null
    hasDiscordToken?: boolean
    lastPresenceUpdate?: string | null
  }
  trial?: {
    active: boolean
    endsAt: string | null
    msLeft: number
    daysLeft: number
  }
  globalConfig?: {
    city: string | null
    timezone: string
  } | null
  rpcConfig?: RpcConfig | null
  gameRpcConfig?: GameRpcConfig | null
  app?: { name: string; tagline: string }
  subscription?: {
    active: boolean
    plan: string
    planName: string
    endsAt: string | null
    daysLeft: number
    isTrial: boolean
    isLifetime: boolean
    autoRenew: boolean
  }
}

export interface RpcConfig {
  id?: string
  name?: string
  type?: string
  platform?: string
  state?: string | null
  details?: string | null
  largeImage?: string | null
  largeText?: string | null
  smallImage?: string | null
  smallText?: string | null
  button1Label?: string | null
  button1Url?: string | null
  button2Label?: string | null
  button2Url?: string | null
  partyCurrent?: number | null
  partyMax?: number | null
  partyId?: string | null
  partySecret?: string | null
  startMinsAgo?: number
  endTotalMins?: number | null
  enabled?: boolean
}

// ===== Games RPC (completely separate from Normal RPC) =====
export interface SpoofGame {
  slug: string
  appId: string
  name: string
  img: string
  defaultState: string
  defaultDetails: string
  defaultPartyMax: number
  defaultPartyCurrent: number
}

export interface GameRpcConfig {
  id?: string
  gameSlug?: string
  enabled?: boolean
  state?: string | null
  details?: string | null
  largeImage?: string | null
  largeText?: string | null
  smallImage?: string | null
  smallText?: string | null
  button1Label?: string | null
  button1Url?: string | null
  button2Label?: string | null
  button2Url?: string | null
  partyCurrent?: number | null
  partyMax?: number | null
  startMinsAgo?: number
  endTotalMins?: number | null
}

export interface PlaceholderEntry {
  token: string
  desc: string
}

export interface AdminUser {
  id: string
  discordId: string
  username: string
  avatar: string
  createdAt: string
  trial: {
    active: boolean
    endsAt: string | null
    daysLeft: number
  } | null
  rpc: {
    rpcEnabled: boolean
    gatewayReady: boolean
    userStatus: string
    customStatus: string | null
    customStatusEmoji: string | null
    vrStatusActive: boolean
    hasDiscordToken: boolean
    lastPresenceUpdate: string | null
    sleepTimerActive: boolean
    sleepTimerEndsAt: string | null
  } | null
  rpcConfig: {
    name: string
    type: string
    platform: string
    enabled: boolean
  } | null
  globalConfig: {
    city: string | null
    timezone: string
  } | null
  isAdmin: boolean
}

export interface AdminPayment {
  id: string
  userId: string
  planId: string
  planName: string
  amount: number
  currency: string
  status: string
  razorpayOrderId: string | null
  razorpayPaymentId: string | null
  internalOrderId: string | null
  verifiedAt: Date | string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    discordId: string
    username: string
    avatar: string
    discriminator: string
  } | null
}

export interface AdminSubscription {
  id: string
  userId: string
  plan: string
  status: string
  paymentId: string | null
  amountPaid: number
  currency: string
  startsAt: string
  endsAt: string
  daysLeft: number
  autoRenew: boolean
  createdAt: string
  updatedAt: string
  user: {
    id: string
    discordId: string
    username: string
    avatar: string
    discriminator: string
    createdAt: string
  } | null
}

export interface AdminAuditLog {
  id: string
  action: string
  target: string | null
  actor: string
  metadata: string | null
  createdAt: string
}

export interface AdminAnnouncement {
  id: string
  type: 'info' | 'update' | 'warning' | 'maintenance'
  title: string
  message: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminSettings {
  id: string
  siteName: string
  heroTitle: string
  heroSubtitle: string
  discordInvite: string
  supportText: string | null
  maintenanceMode: boolean
  createdAt: string
  updatedAt: string
}

export interface PlanPricing {
  effectivePriceInr: number
  offerActive: boolean
  originalPriceInr: number | null
  discountPercent: number
  offerTag: string | null
  offerText: string | null
  offerStartsAt: string | null
  offerEndsAt: string | null
}

export interface AdminPlan {
  id: string
  name: string
  slug: string
  // Raw pricing fields (admin-editable)
  priceInr: number
  originalPriceInr: number | null
  offerPriceInr: number | null
  offerEnabled: boolean
  offerTag: string | null
  offerText: string | null
  offerStartsAt: string | null
  offerEndsAt: string | null
  // Plan config
  durationDays: number
  durationUnit: string
  description: string | null
  features: string[]
  // State
  isActive: boolean
  isVisible: boolean
  isArchived: boolean
  isPopular: boolean
  isRecommended: boolean
  badge: string | null
  displayOrder: number
  createdAt: string
  updatedAt: string
  // Computed pricing (server-driven)
  pricing: PlanPricing
  effectivePriceInr: number
  effectivePriceDisplay: string
  originalPriceDisplay: string | null
  discountPercent: number
  offerActive: boolean
}

export interface AdminNotificationLog {
  id: string
  userId: string
  type: string
  title: string
  message: string
  metadata: string | null
  readAt: string | null
  createdAt: string
  user: {
    id: string
    discordId: string
    username: string
    avatar: string
  } | null
}

export interface AdminFeatureFlag {
  id: string
  key: string
  label: string
  description: string | null
  enabled: boolean
  category: string
  updatedAt: string
  createdAt: string
}

export interface AdminWebhook {
  id: string
  url: string
  secret: string | null
  hasSecret: boolean
  events: string[]
  isActive: boolean
  description: string | null
  lastTriggeredAt: string | null
  lastStatus: string | null
  deliveryCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminAnalytics {
  ok: boolean
  days: number
  timeSeries: Array<{
    date: string
    signups: number
    revenue: number
    payments: number
    notifications: number
  }>
  planBreakdown: Array<{ plan: string; count: number }>
  subStatusBreakdown: Array<{ status: string; count: number }>
  recentUsers: Array<{
    id: string
    username: string
    discordId: string
    avatar: string | null
    createdAt: string
  }>
  topPayments: Array<{
    id: string
    amount: number
    currency: string
    planName: string
    createdAt: string
    user: { id: string; username: string; discordId: string; avatar: string | null } | null
  }>
  summary: {
    totalUsers: number
    totalPayments: number
    totalRevenue: number
    totalSubs: number
    activeSubs: number
  }
}

export interface AdminActivityEvent {
  id: string
  userId: string | null
  username: string | null
  type: string
  category: string
  ip: string | null
  metadata: string | null
  createdAt: string
}

export interface AdminIpBlock {
  id: string
  ip: string
  reason: string | null
  blockedBy: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminApiKey {
  id: string
  name: string
  prefix: string
  permissions: string[]
  lastUsedAt: string | null
  lastUsedIp: string | null
  isActive: boolean
  createdBy: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminMaintenanceWindow {
  id: string
  title: string
  message: string
  startsAt: string
  endsAt: string
  isActive: boolean
  isResolved: boolean
  createdBy: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  status: 'scheduled' | 'active' | 'ended' | 'resolved'
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const isGet = !init?.method || init.method.toUpperCase() === 'GET'
  const maxAttempts = isGet ? 3 : 1
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...init,
      })
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('not_authenticated')
        }
        if (isGet && attempt < maxAttempts && (res.status === 500 || res.status === 503)) {
          await new Promise(r => setTimeout(r, 600 * attempt))
          continue
        }
        const text = await res.text().catch(() => '')
        let msg = text
        try { msg = JSON.parse(text).error || text } catch {}
        throw new Error(msg || `Request failed: ${res.status}`)
      }
      return (await res.json()) as T
    } catch (err: any) {
      if (err?.message === 'not_authenticated') {
        throw err
      }
      lastError = err
      if (isGet && attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 600 * attempt))
        continue
      }
      throw err
    }
  }
  throw lastError || new Error('Request failed')
}

export const api = {
  me: () => fetchJson<Me>('/api/me'),
  logout: () => fetchJson<{ ok: boolean; redirect: string }>('/api/logout', { method: 'POST' }),
  demoLogin: () => fetchJson<{ ok: boolean; demo: boolean; sessionToken?: string; redirect?: string }>('/api/demo-login', { method: 'POST' }),

  rpcSave: (data: RpcConfig) => fetchJson<{ ok: boolean; rpcConfig: RpcConfig }>('/api/rpc', {
    method: 'POST', body: JSON.stringify(data),
  }),
  rpcGet: () => fetchJson<{ rpcConfig: RpcConfig | null }>('/api/rpc'),
  rpcUpdate: () => fetchJson<{
    ok: boolean
    method?: string
    message?: string
    error?: string
    rpcEnabled?: boolean
    gatewayReady?: boolean
  }>('/api/rpc/update', { method: 'POST' }),
  rpcToggle: (enabled: boolean) => fetchJson<{
    ok: boolean
    enabled: boolean
    message?: string
    error?: string
  }>('/api/rpc/toggle', {
    method: 'POST', body: JSON.stringify({ enabled }),
  }),

  // ===== Games RPC (completely separate from Normal RPC) =====
  gamesList: () => fetchJson<{ games: SpoofGame[] }>('/api/games-rpc/list'),
  gamesRpcGet: () => fetchJson<{ gameRpcConfig: GameRpcConfig | null; gamesRpcEnabled: boolean }>('/api/games-rpc/config'),
  gamesRpcSave: (data: GameRpcConfig) => fetchJson<{ ok: boolean; gameRpcConfig: GameRpcConfig; gamesRpcEnabled: boolean }>(
    '/api/games-rpc/config', { method: 'POST', body: JSON.stringify(data) }
  ),
  gamesRpcToggle: (enabled: boolean) => fetchJson<{
    ok: boolean
    enabled: boolean
    message?: string
    error?: string
  }>('/api/games-rpc/toggle', {
    method: 'POST', body: JSON.stringify({ enabled }),
  }),

  customStatus: (emoji: string | null, text: string | null) =>
    fetchJson<{ ok: boolean }>('/api/rpc/custom-status', {
      method: 'POST', body: JSON.stringify({ emoji, text }),
    }),
  clearCustomStatus: () => fetchJson<{ ok: boolean }>('/api/rpc/clear', { method: 'POST' }),

  setStatus: (status: string) => fetchJson<{ ok: boolean; status: string }>('/api/rpc/status', {
    method: 'POST', body: JSON.stringify({ status }),
  }),
  statusUpdate: (data: {
    userStatus?: string
    customStatus?: string | null
    customStatusEmoji?: string | null
    statusPlatform?: string
  }) =>
    fetchJson<{
      ok: boolean
      statusEnabled: boolean
      userStatus: string
      customStatus: string | null
      customStatusEmoji: string | null
      statusPlatform: string
      message?: string
      error?: string
    }>('/api/status/update', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  statusToggle: (enabled: boolean) => fetchJson<{ ok: boolean; statusEnabled: boolean; userStatus?: string }>('/api/status/toggle', {
    method: 'POST', body: JSON.stringify({ enabled }),
  }),

  vrToggle: (active: boolean) => fetchJson<{ ok: boolean; vrStatusActive: boolean }>(
    '/api/vr-status/enable', { method: 'POST', body: JSON.stringify({ active }) }
  ),

  configSave: (city: string | null, timezone: string) => fetchJson<{ ok: boolean }>(
    '/api/config/save', { method: 'POST', body: JSON.stringify({ city, timezone }) }
  ),
  configAutoDetect: () => fetchJson<{ ok: boolean }>('/api/config/auto-detect', { method: 'POST' }),

  sleepTimer: (hours: number | null) => fetchJson<{ ok: boolean; active?: boolean; endsAt?: string }>(
    '/api/sleep-timer', { method: 'POST', body: JSON.stringify({ hours }) }
  ),

  weather: (city: string) => fetchJson<{ tempC: number; condition: string; emoji: string; city: string }>(
    `/api/weather?city=${encodeURIComponent(city)}`
  ),

  background: (url: string | null) => fetchJson<{ ok: boolean; backgroundUrl: string | null }>(
    '/api/background', { method: 'POST', body: JSON.stringify({ url }) }
  ),

  keepAlive: () => fetchJson<{
    ok: boolean
    totalActive: number
    successCount: number
    failCount: number
    results: Array<{ userId: string; username: string; ok: boolean; message: string }>
  }>('/api/rpc/keep-alive', { method: 'POST' }),

  adminUsers: () => fetchJson<{
    ok: boolean
    totalUsers: number
    activeRpcUsers: number
    users: AdminUser[]
  }>('/api/admin/users'),

  adminForceRpc: (enable: boolean) => fetchJson<{
    ok: boolean
    action: string
    totalUsers: number
    successCount: number
    failCount: number
    results: Array<{ userId: string; username: string; ok: boolean; message: string }>
  }>('/api/admin/force-rpc', { method: 'POST', body: JSON.stringify({ enable }) }),

  adminDaemonStatus: () => fetchJson<{
    ok: boolean
    daemon?: {
      running: boolean
      uptimeSeconds?: number
      activeConnections?: number
      totalTrackedUsers?: number
      users?: Array<{
        userId: string
        connected: boolean
        platform: string
        lastStatus: string
        lastConnectedAt?: string
      }>
    }
    error?: string
  }>('/api/admin/daemon-status'),

  adminUserAction: (userId: string, action: string, data?: Record<string, unknown>) => fetchJson<{
    ok: boolean
    message?: string
    error?: string
  }>('/api/admin/user-action', {
    method: 'POST',
    body: JSON.stringify({ userId, action, ...data }),
  }),

  adminStats: () => fetchJson<{
    ok: boolean
    stats: {
      totalUsers: number
      activeSubscriptions: number
      totalRevenue: number
      trialUsers: number
      expiredSubs: number
      planBreakdown: Record<string, number>
      plans: Array<{ id: string; name: string; price: number }>
    }
  }>('/api/admin/stats'),

  adminPayments: (params?: { status?: string; search?: string; take?: number; skip?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.search) qs.set('search', params.search)
    if (params?.take) qs.set('take', String(params.take))
    if (params?.skip) qs.set('skip', String(params.skip))
    return fetchJson<{ ok: boolean; payments: AdminPayment[]; total: number; take: number; skip: number }>(`/api/admin/payments?${qs}`)
  },

  adminSubscriptions: (params?: { status?: string; search?: string; take?: number; skip?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.search) qs.set('search', params.search)
    return fetchJson<{ ok: boolean; subscriptions: AdminSubscription[]; total: number; take: number; skip: number }>(`/api/admin/subscriptions?${qs}`)
  },

  adminAuditLogs: (params?: { action?: string; actor?: string; target?: string; take?: number; skip?: number }) => {
    const qs = new URLSearchParams()
    if (params?.action) qs.set('action', params.action)
    if (params?.actor) qs.set('actor', params.actor)
    if (params?.target) qs.set('target', params.target)
    if (params?.take) qs.set('take', String(params.take))
    if (params?.skip) qs.set('skip', String(params.skip))
    return fetchJson<{ ok: boolean; logs: AdminAuditLog[]; total: number; take: number; skip: number }>(`/api/admin/audit-logs?${qs}`)
  },

  adminHealth: () => fetchJson<{
    ok: boolean
    health: {
      database: { ok: boolean; message: string; latencyMs?: number }
      razorpay: { ok: boolean; message: string }
      daemon: { ok: boolean; message: string; latencyMs?: number }
      overall: { ok: boolean; message: string }
    }
    checkedAt: string
  }>('/api/admin/health'),

  adminAnnouncements: () => fetchJson<{ ok: boolean; announcements: AdminAnnouncement[] }>('/api/admin/announcements'),
  adminCreateAnnouncement: (data: { type: string; title: string; message: string; isActive?: boolean }) => fetchJson<{ ok: boolean; announcement: AdminAnnouncement }>(
    '/api/admin/announcements', { method: 'POST', body: JSON.stringify(data) }
  ),
  adminUpdateAnnouncement: (id: string, data: { type?: string; title?: string; message?: string; isActive?: boolean }) => fetchJson<{ ok: boolean; announcement: AdminAnnouncement }>(
    `/api/admin/announcements/${id}`, { method: 'PUT', body: JSON.stringify(data) }
  ),
  adminDeleteAnnouncement: (id: string) => fetchJson<{ ok: boolean; deleted: string }>(`/api/admin/announcements/${id}`, { method: 'DELETE' }),

  adminSettings: () => fetchJson<{ ok: boolean; settings: AdminSettings }>('/api/admin/settings'),
  adminUpdateSettings: (data: Partial<Omit<AdminSettings, 'id' | 'createdAt' | 'updatedAt'>>) => fetchJson<{ ok: boolean; settings: AdminSettings }>(
    '/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) }
  ),

  adminGrantAccess: (data: { userId: string; planId: string; durationDays: number; reason?: string }) => fetchJson<{ ok: boolean; message?: string }>(
    '/api/admin/grant-access', { method: 'POST', body: JSON.stringify(data) }
  ),

  adminSendNotification: (data: { userIds: string[]; type: string; title: string; message: string }) => fetchJson<{ ok: boolean; sent: number; invalid: number }>(
    '/api/admin/send-notification', { method: 'POST', body: JSON.stringify(data) }
  ),

  adminNotifications: (params?: { take?: number; skip?: number; unreadOnly?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.take) qs.set('take', String(params.take))
    if (params?.skip) qs.set('skip', String(params.skip))
    if (params?.unreadOnly) qs.set('unread', 'true')
    return fetchJson<{ ok: boolean; notifications: AdminNotificationLog[]; total: number; unread: number }>(`/api/admin/notifications?${qs}`)
  },

  adminAnalytics: (days: number = 30) => fetchJson<AdminAnalytics>(`/api/admin/analytics?days=${days}`),

  adminFeatureFlags: () => fetchJson<{ ok: boolean; flags: AdminFeatureFlag[] }>('/api/admin/feature-flags'),
  adminUpdateFeatureFlag: (key: string, data: { enabled?: boolean; label?: string; description?: string }) => fetchJson<{ ok: boolean; flag: AdminFeatureFlag }>(
    '/api/admin/feature-flags', { method: 'PUT', body: JSON.stringify({ key, ...data }) }
  ),

  adminWebhooks: () => fetchJson<{ ok: boolean; webhooks: AdminWebhook[]; availableEvents: string[] }>('/api/admin/webhooks'),
  adminCreateWebhook: (data: { url: string; secret?: string; events?: string[]; isActive?: boolean; description?: string }) => fetchJson<{ ok: boolean; webhook: AdminWebhook }>(
    '/api/admin/webhooks', { method: 'POST', body: JSON.stringify(data) }
  ),
  adminUpdateWebhook: (data: { id: string; url?: string; secret?: string | null; events?: string[]; isActive?: boolean; description?: string }) => fetchJson<{ ok: boolean; webhook: AdminWebhook }>(
    '/api/admin/webhooks', { method: 'PUT', body: JSON.stringify(data) }
  ),
  adminDeleteWebhook: (id: string) => fetchJson<{ ok: boolean }>(`/api/admin/webhooks?id=${id}`, { method: 'DELETE' }),
  adminTestWebhook: (id: string) => fetchJson<{ ok: boolean; result: { status: string; statusCode: number | null; latencyMs: number; response: string } }>(
    '/api/admin/webhooks/test', { method: 'POST', body: JSON.stringify({ id }) }
  ),

  adminImpersonate: (userId: string) => fetchJson<{ ok: boolean; message: string; user: { id: string; discordId: string; username: string; avatar: string | null }; expiresAt: string }>(
    '/api/admin/impersonate', { method: 'POST', body: JSON.stringify({ userId }) }
  ),
  adminEndImpersonation: () => fetchJson<{ ok: boolean; message: string }>(
    '/api/admin/impersonate', { method: 'DELETE' }
  ),

  adminActivity: (params?: { take?: number; skip?: number; category?: string; type?: string }) => {
    const qs = new URLSearchParams()
    if (params?.take) qs.set('take', String(params.take))
    if (params?.skip) qs.set('skip', String(params.skip))
    if (params?.category) qs.set('category', params.category)
    if (params?.type) qs.set('type', params.type)
    return fetchJson<{ ok: boolean; events: AdminActivityEvent[]; total: number; take: number; skip: number; types: Array<{ type: string; count: number }> }>(`/api/admin/activity?${qs}`)
  },

  adminIpBlocklist: () => fetchJson<{ ok: boolean; blocks: AdminIpBlock[]; activeCount: number }>('/api/admin/ip-blocklist'),
  adminAddIpBlock: (ip: string, reason?: string) => fetchJson<{ ok: boolean; block: AdminIpBlock }>(
    '/api/admin/ip-blocklist', { method: 'POST', body: JSON.stringify({ ip, reason }) }
  ),
  adminRemoveIpBlock: (id: string) => fetchJson<{ ok: boolean }>(`/api/admin/ip-blocklist?id=${id}`, { method: 'DELETE' }),

  adminApiKeys: () => fetchJson<{ ok: boolean; keys: AdminApiKey[]; availableScopes: string[]; activeCount: number }>('/api/admin/api-keys'),
  adminCreateApiKey: (data: { name: string; permissions?: string[]; expiresInDays?: number }) => fetchJson<{ ok: boolean; apiKey: AdminApiKey; rawKey: string; warning: string }>(
    '/api/admin/api-keys', { method: 'POST', body: JSON.stringify(data) }
  ),
  adminDeleteApiKey: (id: string) => fetchJson<{ ok: boolean }>(`/api/admin/api-keys?id=${id}`, { method: 'DELETE' }),

  adminMaintenance: () => fetchJson<{ ok: boolean; windows: AdminMaintenanceWindow[]; activeCount: number; scheduledCount: number }>('/api/admin/maintenance'),
  adminCreateMaintenance: (data: { title: string; message: string; startsAt: string; endsAt: string }) => fetchJson<{ ok: boolean; window: AdminMaintenanceWindow }>(
    '/api/admin/maintenance', { method: 'POST', body: JSON.stringify(data) }
  ),
  adminUpdateMaintenance: (id: string, action: 'resolve' | 'cancel') => fetchJson<{ ok: boolean; window: AdminMaintenanceWindow }>(
    '/api/admin/maintenance', { method: 'PUT', body: JSON.stringify({ id, action }) }
  ),
  adminDeleteMaintenance: (id: string) => fetchJson<{ ok: boolean }>(`/api/admin/maintenance?id=${id}`, { method: 'DELETE' }),

  adminExportUrl: (entity: string, format: 'csv' | 'json' = 'csv') => `/api/admin/export?entity=${entity}&format=${format}`,

  adminPlans: () => fetchJson<{ ok: boolean; plans: AdminPlan[] }>('/api/plans?all=true'),
  adminCreatePlan: (data: {
    name: string; slug: string; priceInr: number; durationDays: number;
    originalPriceInr?: number | null; offerPriceInr?: number | null; offerEnabled?: boolean;
    offerTag?: string | null; offerText?: string | null;
    offerStartsAt?: string | null; offerEndsAt?: string | null;
    durationUnit?: string;
    description?: string; features?: string[]; isActive?: boolean;
    isVisible?: boolean; isArchived?: boolean;
    displayOrder?: number; isPopular?: boolean; isRecommended?: boolean; badge?: string;
  }) => fetchJson<{ ok: boolean; plan: AdminPlan }>(
    '/api/plans', { method: 'POST', body: JSON.stringify(data) }
  ),
  adminUpdatePlan: (data: {
    id: string; name?: string; priceInr?: number; durationDays?: number;
    originalPriceInr?: number | null; offerPriceInr?: number | null; offerEnabled?: boolean;
    offerTag?: string | null; offerText?: string | null;
    offerStartsAt?: string | null; offerEndsAt?: string | null;
    durationUnit?: string;
    description?: string; features?: string[]; isActive?: boolean;
    isVisible?: boolean; isArchived?: boolean;
    displayOrder?: number; isPopular?: boolean; isRecommended?: boolean; badge?: string;
  }) => fetchJson<{ ok: boolean; plan: AdminPlan }>(
    '/api/plans', { method: 'PUT', body: JSON.stringify(data) }
  ),
  adminDeletePlan: (id: string, hard?: boolean) => fetchJson<{ ok: boolean; archived?: boolean; deleted?: boolean }>(
    `/api/plans?id=${id}${hard ? '&hard=true' : ''}`, { method: 'DELETE' }
  ),

  // Public plan listing (active plans only)
  publicPlans: () => fetchJson<{ ok: boolean; plans: AdminPlan[] }>('/api/plans'),

  // 30-day one-time free trial (backend-controlled)
  startTrial: () => fetchJson<{ ok: boolean; message?: string; endsAt?: string }>(
    '/api/trial', { method: 'POST' }
  ),
  getTrialStatus: () => fetchJson<{
    trial: { active: boolean; endsAt: string; startsAt: string; daysLeft: number; usedBefore: boolean } | null
    canStartTrial: boolean
    message: string
  }>('/api/trial'),

  placeholders: () => fetchJson<{ placeholders: PlaceholderEntry[] }>('/api/placeholders'),
  resolvePlaceholders: (text: string) => fetchJson<{ original: string; resolved: string }>(
    '/api/placeholders', { method: 'POST', body: JSON.stringify({ text }) }
  ),

  // ===== Subscription =====
  subscriptionStatus: () => fetchJson<{
    ok: boolean
    status: {
      active: boolean
      plan: string
      planName: string
      endsAt: string | null
      daysLeft: number
      isTrial: boolean
      isLifetime: boolean
      autoRenew: boolean
    }
    plans: Array<{
      id: string
      name: string
      price: number
      period: string
      durationDays: number
      features: string[]
      badge?: string
      highlighted?: boolean
    }>
  }>('/api/subscription/status'),

  subscriptionCreate: (planId: string, paymentId?: string) => fetchJson<{
    ok: boolean
    message?: string
    error?: string
    status?: {
      active: boolean
      plan: string
      planName: string
      endsAt: string | null
      daysLeft: number
      isTrial: boolean
      isLifetime: boolean
    }
  }>('/api/subscription/create', {
    method: 'POST',
    body: JSON.stringify({ planId, paymentId }),
  }),

  subscriptionCancel: () => fetchJson<{ ok: boolean; message: string }>(
    '/api/subscription/cancel', { method: 'POST' }
  ),

  razorpayCreateOrder: (planId: string) => fetchJson<{
    ok: boolean
    orderId: string
    amount: number
    currency: string
    keyId: string
    planId: string
    planName: string
    userEmail: string
    error?: string
  }>('/api/subscription/razorpay/create-order', {
    method: 'POST', body: JSON.stringify({ planId }),
  }),

  razorpayVerify: (data: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
    planId: string
  }) => fetchJson<{ ok: boolean; message?: string; error?: string; status?: any }>(
    '/api/subscription/razorpay/verify', {
    method: 'POST', body: JSON.stringify(data),
  }),
}
