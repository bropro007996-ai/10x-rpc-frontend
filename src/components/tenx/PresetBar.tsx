// 10X RPC — RPC Presets for users (quick-save/load RPC configurations)
'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { api, type RpcConfig } from '@/lib/api-client'
import { Bookmark, Trash2, Save, Upload } from 'lucide-react'

interface SavedPreset {
  id: string
  name: string
  config: Partial<RpcConfig>
}

const STORAGE_KEY = '10xrpc_presets'

function loadPresets(): SavedPreset[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch { return [] }
}

function savePresets(presets: SavedPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch {}
}

const DEFAULT_PRESETS: SavedPreset[] = [
  { id: 'preset_gaming', name: '🎮 Gaming', config: { name: 'Gaming', type: 'PLAYING', state: 'In a match', details: 'Ranked Mode', startMinsAgo: 0, endTotalMins: 45 } },
  { id: 'preset_coding', name: '💻 Coding', config: { name: 'Visual Studio Code', type: 'PLAYING', state: 'Editing files', details: 'Workspace: Project', startMinsAgo: 0 } },
  { id: 'preset_music', name: '🎵 Music', config: { name: 'Spotify', type: 'LISTENING', state: 'Listening to playlist', details: 'Chill beats', startMinsAgo: 0 } },
  { id: 'preset_streaming', name: '📺 Streaming', config: { name: 'Twitch', type: 'STREAMING', state: 'Live now', details: 'Playing games', startMinsAgo: 0, endTotalMins: 120 } },
  { id: 'preset_afk', name: '😴 AFK', config: { name: 'Away', type: 'PLAYING', state: 'AFK', details: 'Be right back', startMinsAgo: 5 } },
]

export function PresetBar({ currentConfig, onApply }: {
  currentConfig: RpcConfig | null
  onApply: (config: Partial<RpcConfig>) => void
}) {
  const [presets, setPresets] = useState<SavedPreset[]>(() => {
    const saved = loadPresets()
    return saved.length > 0 ? saved : DEFAULT_PRESETS
  })
  const [showSave, setShowSave] = useState(false)
  const [presetName, setPresetName] = useState('')

  const handleApply = (preset: SavedPreset) => {
    onApply(preset.config)
    toast.success(`Preset "${preset.name}" loaded — click UPDATE to apply`, { duration: 3000 })
  }

  const handleSave = () => {
    if (!presetName.trim() || !currentConfig) return
    const newPreset: SavedPreset = {
      id: `preset_custom_${Date.now()}`,
      name: presetName.trim(),
      config: {
        name: currentConfig.name,
        type: currentConfig.type,
        platform: currentConfig.platform,
        state: currentConfig.state,
        details: currentConfig.details,
        button1Label: currentConfig.button1Label,
        button1Url: currentConfig.button1Url,
        button2Label: currentConfig.button2Label,
        button2Url: currentConfig.button2Url,
        largeImage: currentConfig.largeImage,
        largeText: currentConfig.largeText,
        startMinsAgo: currentConfig.startMinsAgo,
        endTotalMins: currentConfig.endTotalMins,
      },
    }
    const updated = [...presets.filter(p => p.id !== newPreset.id), newPreset]
    setPresets(updated)
    savePresets(updated)
    setPresetName('')
    setShowSave(false)
    toast.success(`Preset "${newPreset.name}" saved!`, { duration: 2000 })
  }

  const handleDelete = (id: string) => {
    const updated = presets.filter(p => p.id !== id)
    setPresets(updated)
    savePresets(updated)
    toast.info('Preset deleted')
  }

  return (
    <div className="glass-card-inner p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
          <Bookmark className="w-3.5 h-3.5" />
          RPC Presets
        </span>
        <button
          onClick={() => setShowSave(!showSave)}
          className="text-[10px] text-purple-300 hover:text-white flex items-center gap-1"
        >
          <Save className="w-3 h-3" />
          Save Current
        </button>
      </div>

      {/* Save bar */}
      {showSave && (
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            placeholder="Preset name..."
            className="flex-1 bg-[#13141a] border border-white/8 text-white text-xs rounded-lg px-3 py-2 placeholder:text-white/40"
            maxLength={30}
          />
          <button
            onClick={handleSave}
            disabled={!presetName.trim()}
            className="purple-gradient text-white text-xs font-medium rounded-lg px-3 py-2 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map(preset => (
          <div key={preset.id} className="flex items-center gap-0.5 group">
            <button
              onClick={() => handleApply(preset)}
              className="bg-[#181922] border border-white/8 hover:border-purple-500/30 text-white/80 hover:text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors"
            >
              {preset.name}
            </button>
            {preset.id.startsWith('preset_custom_') && (
              <button
                onClick={() => handleDelete(preset.id)}
                className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 transition-all p-0.5"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
