// 10X RPC — Profile page (#/profile) — full user profile with stats + settings
'use client'
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { api, type Me } from '@/lib/api-client'
import { useRouter } from './useRouter'
import { Card, PrimaryButton, GhostButton, BackButton, Badge, PurpleSwitch } from './ui'
import { Crown, Zap, Wifi, WifiOff, Clock, Activity, Server, Settings, LogOut, Image as ImageIcon } from 'lucide-react'

export function ProfilePage({ initial }: { initial?: Me }) {
  const { navigate } = useRouter()
  const [me, setMe] = useState<Me | null>(initial || null)
  const [loading, setLoading] = useState(!initial)
  const [saving, setSaving] = useState(false)
  const [bgUrl, setBgUrl] = useState(initial?.user?.backgroundUrl || '')
  const [showBgModal, setShowBgModal] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const m = await api.me()
      setMe(m)
      setBgUrl(m.user?.backgroundUrl || '')
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleLogout = async () => {
    try {
      await api.logout()
      window.location.href = '/'
    } catch { toast.error('Logout failed') }
  }

  const handleSaveBg = async () => {
    const trimmed = bgUrl.trim()
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast.error('URL must start with http:// or https://')
      return
    }
    setSaving(true)
    try {
      await api.background(trimmed || null)
      toast.success('Background updated', { duration: 2000 })
      setShowBgModal(false)
      refresh()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block w-10 h-10 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
      </div>
    )
  }

  if (!me?.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md text-center">
          <img src="/logo.png" alt="10X RPC" className="w-14 h-14 rounded-2xl object-cover mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Sign in Required</h1>
          <p className="text-sm text-white/60 mb-6">Sign in with Discord to view your profile.</p>
          <PrimaryButton onClick={() => navigate({ name: 'oauth-consent' })}>Sign in with Discord</PrimaryButton>
        </div>
      </div>
    )
  }

  const sub = me.subscription
  const trial = me.trial
  const session = me.session
  const now = Date.now()
  const lastUpdate = session?.lastPresenceUpdate ? new Date(session.lastPresenceUpdate).toLocaleString() : 'Never'

  return (
    <div className="min-h-screen px-4 sm:px-6 py-6 max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <BackButton onClick={() => navigate({ name: 'dashboard' })} />
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      </div>

      {/* Profile Card */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#13111d]/95 via-[#0e0d14]/95 to-[#0a0a0f] border border-white/10 rounded-[28px] p-6 shadow-2xl backdrop-blur-xl mb-6">
        <div className="absolute -top-16 -left-12 w-56 h-56 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-16 -right-12 w-48 h-48 bg-purple-900/10 rounded-full blur-2xl pointer-events-none" />

        {me.user?.backgroundUrl && (
          <>
            <img src={me.user.backgroundUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0e0d14]/75 via-[#0e0d14]/90 to-[#0a0a0f] pointer-events-none" />
          </>
        )}

        <div className="relative z-10">
          {/* Avatar + Status */}
          <div className="flex flex-col items-center mb-4">
            <div className="relative">
              <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-white/10 shadow-2xl ring-1 ring-white/5">
                <img src={me.user?.avatar} alt={me.user?.username} className="w-full h-full object-cover" />
              </div>
              {session?.rpcEnabled && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#13111d] flex items-center justify-center text-[10px] animate-pulse">
                  ●
                </div>
              )}
            </div>
          </div>

          {/* Name + Badges */}
          <div className="text-center mb-3">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-white">{me.user?.username}</h2>
              {sub && sub.active && (
                <Badge className={
                  sub.isLifetime ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                  sub.plan === 'pro' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                  sub.plan === 'plus' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                  'bg-purple-500/15 text-purple-400 border-purple-500/30'
                }>
                  {sub.isLifetime && <Crown className="w-3 h-3" />}
                  {sub.planName?.toUpperCase()}
                </Badge>
              )}
              {!sub?.active && (
                <Badge className="bg-red-500/15 text-red-400 border-red-500/30">EXPIRED</Badge>
              )}
            </div>
            <p className="text-xs text-white/40 font-mono mt-1">ID: {me.user?.id}</p>
          </div>

          {/* Edit background button */}
          <div className="text-center mb-4">
            <button
              onClick={() => setShowBgModal(true)}
              className="inline-flex items-center gap-1.5 text-xs text-purple-300 hover:text-white bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <ImageIcon className="w-3.5 h-3.5" /> Set Background
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        <StatBox icon={<Activity className="w-4 h-4" />} label="RPC" value={session?.rpcEnabled ? 'ON' : 'OFF'} color={session?.rpcEnabled ? 'text-green-400' : 'text-white/40'} />
        <StatBox icon={<Wifi className="w-4 h-4" />} label="Gateway" value={session?.gatewayReady ? 'Connected' : 'Off'} color={session?.gatewayReady ? 'text-green-400' : 'text-red-400'} />
        <StatBox icon={<Crown className="w-4 h-4" />} label="Plan" value={sub?.planName || 'Trial'} color="text-amber-400" />
        <StatBox icon={<Clock className="w-4 h-4" />} label="Days Left" value={sub?.isLifetime ? '∞' : (sub?.daysLeft ?? trial?.daysLeft ?? 0).toString()} color="text-purple-300" />
      </div>

      {/* Session Details */}
      <Card className="mb-6">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Settings className="w-4 h-4 text-purple-400" />Session Details</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <DetailRow label="Discord Status" value={session?.userStatus?.toUpperCase() || 'ONLINE'} />
          <DetailRow label="Custom Status" value={session?.customStatus ? `${session.customStatusEmoji || ''} ${session.customStatus}` : 'None'} />
          <DetailRow label="Status Platform" value={session?.statusPlatform || 'mobile'} />
          <DetailRow label="Has Discord Token" value={session?.hasDiscordToken ? '✓ Yes' : '✗ No'} />
          <DetailRow label="Gateway Ready" value={session?.gatewayReady ? '✓ Yes' : '✗ No'} />
          <DetailRow label="VR Active" value={session?.vrStatusActive ? '✓ Yes' : '✗ No'} />
          <DetailRow label="Sleep Timer" value={session?.sleepTimerActive ? 'Active' : 'Off'} />
          <DetailRow label="Last Update" value={lastUpdate} />
        </div>
      </Card>

      {/* RPC Config Summary */}
      {me.rpcConfig && (
        <Card className="mb-6">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-purple-400" />RPC Configuration</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <DetailRow label="Name" value={me.rpcConfig.name || '10X RPC'} />
            <DetailRow label="Type" value={me.rpcConfig.type || 'PLAYING'} />
            <DetailRow label="Platform" value={me.rpcConfig.platform || 'desktop'} />
            <DetailRow label="State" value={me.rpcConfig.state || 'None'} />
            <DetailRow label="Details" value={me.rpcConfig.details || 'None'} />
            <DetailRow label="Button 1" value={me.rpcConfig.button1Label || 'None'} />
            <DetailRow label="Button 2" value={me.rpcConfig.button2Label || 'None'} />
            <DetailRow label="Enabled" value={me.rpcConfig.enabled ? '✓ Yes' : '✗ No'} />
          </div>
        </Card>
      )}

      {/* Games RPC Summary */}
      {me.gameRpcConfig && (
        <Card className="mb-6">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-purple-400" />Games RPC</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <DetailRow label="Game" value={me.gameRpcConfig.gameSlug || 'minecraft'} />
            <DetailRow label="Enabled" value={me.gameRpcConfig.enabled ? '✓ Yes' : '✗ No'} />
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <h3 className="font-bold text-white mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <PrimaryButton onClick={() => navigate({ name: 'dashboard' })} className="text-xs">← Dashboard</PrimaryButton>
          <GhostButton onClick={() => navigate({ name: 'config' })} className="text-xs">⚙️ Settings</GhostButton>
          {me.user?.discordId === '824940038617694279' || me.user?.discordId === '1526539220586467351' ? (
            <GhostButton onClick={() => navigate({ name: 'admin' })} className="text-xs">🔧 Admin</GhostButton>
          ) : null}
        </div>
      </Card>

      {/* Background Modal */}
      {showBgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowBgModal(false)}>
          <div className="glass-card w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white text-center">Set Background</h2>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-purple-400 font-semibold">Image URL</label>
              <input
                type="url"
                value={bgUrl}
                onChange={e => setBgUrl(e.target.value)}
                placeholder="https://example.com/bg.jpg"
                className="w-full bg-[#13141a] border border-white/8 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500/40 placeholder:text-white/40"
              />
            </div>
            {bgUrl && /^https?:\/\//.test(bgUrl) && (
              <div className="relative h-32 rounded-xl overflow-hidden bg-[#13141a]">
                <img src={bgUrl} alt="Preview" className="w-full h-full object-cover opacity-50" />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              {me.user?.backgroundUrl && (
                <button onClick={async () => { await api.background(null); setBgUrl(''); toast.success('Cleared'); setShowBgModal(false); refresh() }} disabled={saving} className="text-sm text-red-400 hover:text-red-300 px-4 py-2.5">Clear</button>
              )}
              <button onClick={() => setShowBgModal(false)} disabled={saving} className="flex-1 text-sm text-white/70 hover:text-white px-4 py-2.5">Cancel</button>
              <button onClick={handleSaveBg} disabled={saving} className="flex-1 purple-gradient text-white font-bold rounded-xl px-4 py-2.5 text-sm hover:opacity-90 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="glass-card-inner p-3 text-center">
      <div className={`flex items-center justify-center gap-1.5 mb-1 ${color}`}>
        {icon}
        <span className="text-sm font-bold">{value}</span>
      </div>
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-white/40 uppercase tracking-wider text-[10px] mb-0.5">{label}</p>
      <p className="text-white font-medium text-xs truncate">{value}</p>
    </div>
  )
}
