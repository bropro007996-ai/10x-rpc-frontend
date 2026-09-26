// 10X RPC — Games RPC form (spoofing real Discord games, separate from Normal RPC)
'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api, type GameRpcConfig, type SpoofGame } from '@/lib/api-client'
import { PurpleSwitch } from './ui'
import { Gamepad2, ChevronDown } from 'lucide-react'

const DEFAULT_CONFIG: GameRpcConfig = {
  gameSlug: '',
  enabled: false,
  state: '',
  details: '',
  largeImage: '',
  largeText: '',
  smallImage: '',
  smallText: '',
  button1Label: '',
  button1Url: '',
  button2Label: '',
  button2Url: '',
  partyCurrent: null,
  partyMax: null,
  startMinsAgo: 0,
  endTotalMins: null,
}

export function GamesRpcForm({
  initial,
  gamesRpcEnabled,
  onSaved,
  onToggle,
}: {
  initial: GameRpcConfig | null | undefined
  gamesRpcEnabled: boolean
  onSaved?: () => void
  onToggle?: (v: boolean) => void
}) {
  const [cfg, setCfg] = useState<GameRpcConfig>(initial || DEFAULT_CONFIG)
  const [games, setGames] = useState<SpoofGame[]>([])
  const [enabled, setEnabled] = useState<boolean>(gamesRpcEnabled)
  const [saving, setSaving] = useState(false)
  const [gameSelectorOpen, setGameSelectorOpen] = useState(false)

  // Fetch games list on mount
  useEffect(() => {
    let cancelled = false
    api
      .gamesList()
      .then((res) => {
        if (!cancelled) setGames(res.games || [])
      })
      .catch((err) => {
        console.error('Failed to load games list:', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Sync cfg + enabled when props change
  useEffect(() => {
    if (initial) {
      setCfg({
        gameSlug: initial.gameSlug ?? '',
        enabled: initial.enabled ?? false,
        state: initial.state ?? '',
        details: initial.details ?? '',
        largeImage: initial.largeImage ?? '',
        largeText: initial.largeText ?? '',
        smallImage: initial.smallImage ?? '',
        smallText: initial.smallText ?? '',
        button1Label: initial.button1Label ?? '',
        button1Url: initial.button1Url ?? '',
        button2Label: initial.button2Label ?? '',
        button2Url: initial.button2Url ?? '',
        partyCurrent: initial.partyCurrent ?? null,
        partyMax: initial.partyMax ?? null,
        startMinsAgo: initial.startMinsAgo ?? 0,
        endTotalMins: initial.endTotalMins ?? null,
      })
    }
  }, [initial])

  useEffect(() => {
    setEnabled(gamesRpcEnabled)
  }, [gamesRpcEnabled])

  const set = <K extends keyof GameRpcConfig>(key: K, value: GameRpcConfig[K]) => {
    setCfg((prev) => ({ ...prev, [key]: value }))
  }

  const selectedGame = games.find((g) => g.slug === cfg.gameSlug) || null

  const handleSelectGame = (game: SpoofGame) => {
    setCfg((prev) => ({
      ...prev,
      gameSlug: game.slug,
      state: game.defaultState || prev.state,
      details: game.defaultDetails || prev.details,
      partyCurrent: game.defaultPartyCurrent ?? prev.partyCurrent,
      partyMax: game.defaultPartyMax ?? prev.partyMax,
      largeImage: '', // reset to use game's official icon
    }))
    setGameSelectorOpen(false)
    toast.success(`Selected ${game.name}`, { duration: 2000 })
  }

  const handleSave = async () => {
    const errors: string[] = []
    if ((cfg.state || '').length > 128) errors.push('State too long (max 128)')
    if ((cfg.details || '').length > 128) errors.push('Details too long (max 128)')
    if ((cfg.button1Label || '').length > 32) errors.push('Button 1 label too long (max 32)')
    if ((cfg.button2Label || '').length > 32) errors.push('Button 2 label too long (max 32)')
    if (cfg.button1Url && !/^https?:\/\//i.test(cfg.button1Url))
      errors.push('Button 1 URL must start with http:// or https://')
    if (cfg.button2Url && !/^https?:\/\//i.test(cfg.button2Url))
      errors.push('Button 2 URL must start with http:// or https://')
    if (cfg.button1Label && !cfg.button1Url) errors.push('Button 1 URL required when label is set')
    if (cfg.button2Label && !cfg.button2Url) errors.push('Button 2 URL required when label is set')
    if (cfg.partyCurrent != null && cfg.partyMax != null && cfg.partyCurrent > cfg.partyMax) {
      errors.push('Party size cannot exceed party max')
    }
    if (cfg.startMinsAgo != null && cfg.startMinsAgo < 0) errors.push('Start time cannot be negative')
    if (cfg.endTotalMins != null && cfg.endTotalMins < 1) errors.push('End time must be at least 1 minute')
    if (errors.length > 0) {
      errors.forEach((e) => toast.error(e))
      return
    }

    setSaving(true)
    try {
      const res = await api.gamesRpcSave({ ...cfg, enabled })
      if (res.ok) {
        toast.success(
          enabled
            ? 'Games RPC updated & live on Discord'
            : 'Configuration saved (Games RPC is OFF)',
          { duration: 2500 }
        )
        onSaved?.()
      } else {
        toast.error('Failed to save configuration')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to save Games RPC')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (v: boolean) => {
    setEnabled(v)
    try {
      const res = await api.gamesRpcToggle(v)
      if (res.ok) {
        toast.success(
          v
            ? 'Games RPC enabled & live on Discord'
            : 'Games RPC stopped & cleared from Discord',
          { duration: 2500 }
        )
        onToggle?.(v)
        onSaved?.()
      } else {
        setEnabled(!v)
        toast.error('Failed to toggle Games RPC')
      }
    } catch (e) {
      console.error(e)
      setEnabled(!v)
      toast.error('Failed to toggle Games RPC')
    }
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#13111d]/95 via-[#0e0d14]/95 to-[#0a0a0f] border border-white/10 rounded-[28px] p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
      {/* Ambient violet glow at top */}
      <div className="absolute -top-16 left-1/4 -translate-x-1/2 w-64 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-16 right-0 w-48 h-48 bg-purple-900/10 rounded-full blur-2xl pointer-events-none" />

      {/* Centered Card Title */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 mb-6 pt-1">
        <div className="flex items-center gap-2.5">
          <Gamepad2 className="w-6 h-6 text-purple-400 stroke-[2.2]" />
          <h2 className="text-xl font-bold text-white tracking-tight">GAMES RPC</h2>
        </div>
        <p className="text-xs text-white/50">Spoof real Discord games</p>
      </div>

      {/* Form Fields */}
      <div className="relative z-10 space-y-4">
        {/* 1. SELECT GAME */}
        <FormField label="SELECT GAME">
          <div className="relative">
            <button
              type="button"
              onClick={() => setGameSelectorOpen((v) => !v)}
              className="w-full h-12 bg-[#12131a] border border-white/10 hover:border-white/20 focus:border-purple-500/50 rounded-xl px-4 text-sm text-white flex items-center justify-between cursor-pointer transition-colors"
            >
              {selectedGame ? (
                <span className="flex items-center gap-2.5 text-white/90 font-medium min-w-0">
                  <img
                    src={selectedGame.img}
                    alt=""
                    className="w-8 h-8 rounded-lg object-cover shrink-0"
                    onError={(e) => { e.currentTarget.src = '/game-icons/placeholder.png' }}
                  />
                  <span className="truncate">{selectedGame.name}</span>
                </span>
              ) : (
                <span className="text-white/50">Choose a game to spoof...</span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-white/50 transition-transform shrink-0 ml-2 ${
                  gameSelectorOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {gameSelectorOpen && (
              <>
                {/* Click-away backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setGameSelectorOpen(false)}
                />
                <div className="absolute left-0 top-full mt-2 w-full max-h-64 overflow-y-auto styled-scroll bg-[#161720]/98 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl z-50 grid grid-cols-2 gap-1.5">
                  {games.length === 0 && (
                    <div className="col-span-2 text-center text-xs text-white/40 py-4">
                      Loading games...
                    </div>
                  )}
                  {games.map((g) => {
                    const isSelected = cfg.gameSlug === g.slug
                    return (
                      <button
                        key={g.slug}
                        type="button"
                        onClick={() => handleSelectGame(g)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-colors text-left ${
                          isSelected
                            ? 'bg-[#6b21a8] text-white font-medium shadow-sm'
                            : 'text-white/80 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <img
                          src={g.img}
                          alt=""
                          className="w-8 h-8 rounded-lg object-cover shrink-0"
                          onError={(e) => { e.currentTarget.src = '/game-icons/placeholder.png' }}
                        />
                        <span className="truncate">{g.name}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </FormField>

        {/* Form fields only visible when a game is selected */}
        {selectedGame && (
          <>
            {/* 2. STATE */}
            <FormField label="STATE">
              <input
                type="text"
                value={cfg.state || ''}
                onChange={(e) => set('state', e.target.value)}
                placeholder="e.g. Mining diamonds"
                className="w-full h-12 bg-[#12131a] border border-white/10 hover:border-white/20 focus:border-purple-500/50 rounded-xl px-4 text-sm text-white placeholder:text-white/35 outline-none transition-colors"
                maxLength={128}
              />
            </FormField>

            {/* 3. DETAILS */}
            <FormField label="DETAILS">
              <input
                type="text"
                value={cfg.details || ''}
                onChange={(e) => set('details', e.target.value)}
                placeholder="e.g. Survival Mode"
                className="w-full h-12 bg-[#12131a] border border-white/10 hover:border-white/20 focus:border-purple-500/50 rounded-xl px-4 text-sm text-white placeholder:text-white/35 outline-none transition-colors"
                maxLength={128}
              />
            </FormField>

            {/* 4. LARGE IMAGE URL */}
            <FormField label="LARGE IMAGE URL">
              <input
                type="text"
                value={cfg.largeImage || ''}
                onChange={(e) => set('largeImage', e.target.value)}
                placeholder="Leave empty to use game's official icon"
                className="w-full h-12 bg-[#12131a] border border-white/10 hover:border-white/20 focus:border-purple-500/50 rounded-xl px-4 text-sm text-white placeholder:text-white/35 outline-none transition-colors"
              />
            </FormField>

            {/* 5. BUTTON 1 LABEL */}
            <FormField label="BUTTON 1 LABEL">
              <input
                type="text"
                value={cfg.button1Label || ''}
                onChange={(e) => set('button1Label', e.target.value)}
                placeholder="e.g. View Repo"
                className="w-full h-12 bg-[#12131a] border border-white/10 hover:border-white/20 focus:border-purple-500/50 rounded-xl px-4 text-sm text-white placeholder:text-white/35 outline-none transition-colors"
                maxLength={32}
              />
            </FormField>

            {/* 6. BUTTON 1 URL */}
            <FormField label="BUTTON 1 URL">
              <input
                type="text"
                value={cfg.button1Url || ''}
                onChange={(e) => set('button1Url', e.target.value)}
                placeholder="https://github.com/..."
                className="w-full h-12 bg-[#12131a] border border-white/10 hover:border-white/20 focus:border-purple-500/50 rounded-xl px-4 text-sm text-white placeholder:text-white/35 outline-none transition-colors"
              />
            </FormField>

            {/* 7. BUTTON 2 LABEL */}
            <FormField label="BUTTON 2 LABEL">
              <input
                type="text"
                value={cfg.button2Label || ''}
                onChange={(e) => set('button2Label', e.target.value)}
                placeholder="e.g. Join Server"
                className="w-full h-12 bg-[#12131a] border border-white/10 hover:border-white/20 focus:border-purple-500/50 rounded-xl px-4 text-sm text-white placeholder:text-white/35 outline-none transition-colors"
                maxLength={32}
              />
            </FormField>

            {/* 8. BUTTON 2 URL */}
            <FormField label="BUTTON 2 URL">
              <input
                type="text"
                value={cfg.button2Url || ''}
                onChange={(e) => set('button2Url', e.target.value)}
                placeholder="https://discord.gg/..."
                className="w-full h-12 bg-[#12131a] border border-white/10 hover:border-white/20 focus:border-purple-500/50 rounded-xl px-4 text-sm text-white placeholder:text-white/35 outline-none transition-colors"
              />
            </FormField>

            {/* 9. PARTY SIZE + PARTY MAX */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="PARTY SIZE">
                <input
                  type="number"
                  min="0"
                  value={cfg.partyCurrent ?? ''}
                  onChange={(e) =>
                    set('partyCurrent', e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="e.g. 1"
                  className="w-full h-12 bg-[#12131a] border border-white/10 hover:border-white/20 focus:border-purple-500/50 rounded-xl px-4 text-sm text-white placeholder:text-white/35 outline-none transition-colors"
                />
              </FormField>

              <FormField label="PARTY MAX">
                <input
                  type="number"
                  min="1"
                  value={cfg.partyMax ?? ''}
                  onChange={(e) =>
                    set('partyMax', e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="e.g. 8"
                  className="w-full h-12 bg-[#12131a] border border-white/10 hover:border-white/20 focus:border-purple-500/50 rounded-xl px-4 text-sm text-white placeholder:text-white/35 outline-none transition-colors"
                />
              </FormField>
            </div>

            {/* 10. START TIME + END TIME */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="START TIME (MINS AGO)">
                <input
                  type="number"
                  min="0"
                  value={cfg.startMinsAgo ?? ''}
                  onChange={(e) =>
                    set('startMinsAgo', e.target.value ? Number(e.target.value) : 0)
                  }
                  placeholder="1"
                  className="w-full h-12 bg-[#12131a] border border-white/10 hover:border-white/20 focus:border-purple-500/50 rounded-xl px-4 text-sm text-white placeholder:text-white/35 outline-none transition-colors"
                />
              </FormField>

              <FormField label="END TIME (TOTAL MINS)">
                <input
                  type="number"
                  min="1"
                  value={cfg.endTotalMins ?? ''}
                  onChange={(e) =>
                    set('endTotalMins', e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="e.g. 34"
                  className="w-full h-12 bg-[#12131a] border border-white/10 hover:border-white/20 focus:border-purple-500/50 rounded-xl px-4 text-sm text-white placeholder:text-white/35 outline-none transition-colors"
                />
              </FormField>
            </div>
          </>
        )}

        {/* Divider line before ENABLE GAMES RPC */}
        <div className="border-t border-white/10 pt-6 mt-2">
          {/* ENABLE GAMES RPC Toggle Row */}
          <div className="flex items-center justify-between px-1 mb-5">
            <span className="text-xs font-extrabold tracking-widest text-[#a855f7] uppercase">
              ENABLE GAMES RPC
            </span>
            <PurpleSwitch checked={enabled} onCheckedChange={handleToggle} />
          </div>

          {/* Centered UPDATE Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-[#1e1f26] hover:bg-[#282933] border border-white/10 text-white font-medium text-xs tracking-widest uppercase px-8 py-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? 'SAVING...' : 'UPDATE'}
            </button>
          </div>

          {/* Priority note */}
          <p className="text-center text-xs text-white/40 mt-4 px-2 leading-relaxed">
            Games RPC takes priority over Normal RPC. Only one shows on Discord at a time.
          </p>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold tracking-wider text-[#a855f7] uppercase block">
        {label}
      </label>
      {children}
    </div>
  )
}
