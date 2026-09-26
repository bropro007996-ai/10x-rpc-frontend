// 10X RPC — EmojiPickerPage — dedicated page for emoji + image selection
// Replaces the popup picker with a full-page experience.
// Users can browse emojis, search, select an emoji, or upload an image.
// After saving, automatically returns to the dashboard.
'use client'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from './useRouter'
import { api, type Me } from '@/lib/api-client'
import { toast } from 'sonner'
import {
  ArrowLeft, Search, X, Clock, Upload, ImageIcon, Smile,
  Check, Loader2, Trash2, Sparkles
} from 'lucide-react'

// === Emoji categories (reused from EmojiPicker) ===
interface EmojiCategory {
  id: string
  label: string
  icon: string
  emojis: string[]
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'frequent',
    label: 'Frequent',
    icon: '⭐',
    emojis: ['😋', '🔥', '🎮', '✨', '⚡', '🎧', '🚀', '💜'],
  },
  {
    id: 'smileys',
    label: 'Smileys',
    icon: '😀',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
      '😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨',
      '😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕',
      '🤢','🤮','🥵','🥶','😎','🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦',
      '😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠',
    ],
  },
  {
    id: 'gaming',
    label: 'Gaming',
    icon: '🎮',
    emojis: [
      '🎮','🕹️','👾','🎯','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','🔥','⚡','💥','💫',
      '🚀','🌟','⭐','✨','🎉','🎊','🎈','🎁','👑','💎','💠','🔮','⚔️','🛡️','🏹',
      '🗡️','🔪','🔫','💣','🧨','☄️','🌈','☀️','🌙',
    ],
  },
  {
    id: 'animals',
    label: 'Animals',
    icon: '🐱',
    emojis: [
      '🐶','🐱','🐭','hamster','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔',
      '🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋',
      '🐌','🐞','🐜','🕷️','🕸️','🦂','🐢','🐍','🦎','🐙','🦑','🦐','🦞','🦀','🐡','🐠',
      '🐟','🐬','🐳','🐋','🦈','🐊',
    ].filter(e => e.length > 0 && !e.includes('hamster')),
  },
  {
    id: 'food',
    label: 'Food',
    icon: '🍔',
    emojis: [
      '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥',
      '🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠',
      '🥐','🥯','🍞','🥖','🥨','🧀','🧈','🥚','🍳','🧇','🥓','🥩','🍗','🍖','🦴','🌭',
      '🍔','🍟','🍕','🥪','🥙','🌮','🌯','🥗','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤',
    ],
  },
  {
    id: 'activities',
    label: 'Activities',
    icon: '⚽',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍',
      '🏏','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿',
      '⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽',
      '🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','🎟️','🎪','🤹','🎭','🎨',
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols',
    icon: '💜',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
      '💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈',
      '♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️',
      '📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹',
    ],
  },
  {
    id: 'objects',
    label: 'Objects',
    icon: '💡',
    emojis: [
      '💡','🔦','🕯️','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','💎','⚖️','🪜',
      '🧰','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨',
      '🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','💈','⚗️','🔭',
      '🔬','🕳️','🩹','🩺','💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️','🧹','🧺','🧻','🚽',
    ],
  },
]

const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap(c => c.emojis)
const RECENTS_KEY = '10xrpc:recent-emojis'
const MAX_RECENTS = 16

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.slice(0, MAX_RECENTS) : []
  } catch {
    return []
  }
}

function saveRecents(emoji: string) {
  try {
    const current = loadRecents()
    const filtered = current.filter(e => e !== emoji)
    const updated = [emoji, ...filtered].slice(0, MAX_RECENTS)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(updated))
  } catch {
    // localStorage might be unavailable
  }
}

type SelectionMode = 'emoji' | 'image'

interface EmojiPickerPageProps {
  initial?: Me
}

export function EmojiPickerPage({ initial }: EmojiPickerPageProps) {
  const { navigate } = useRouter()
  const [me, setMe] = useState<Me | null>(initial || null)
  const [loading, setLoading] = useState(!initial)
  const [mode, setMode] = useState<SelectionMode>('emoji')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('frequent')
  const [recents, setRecents] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    return loadRecents()
  })
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load current me to get the existing emoji/image
  const refresh = useCallback(async () => {
    try {
      const m = await api.me()
      setMe(m)
      setSelectedEmoji(m.session?.customStatusEmoji || null)
      setSelectedImage(m.session?.customStatusImage || null)
      // Default to image mode if user already has an image, else emoji mode
      if (m.session?.customStatusImage) {
        setMode('image')
      }
    } catch (e) {
      console.error('Failed to load session:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handlePickEmoji = (emoji: string) => {
    setSelectedEmoji(emoji)
    setSelectedImage(null) // Clear image when emoji is selected
    saveRecents(emoji)
    setRecents(loadRecents())
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 500KB)
    if (file.size > 500000) {
      toast.error('Image too large (max ~375KB)')
      return
    }

    setUploading(true)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setSelectedImage(dataUrl)
      setSelectedEmoji(null) // Clear emoji when image is selected
      setUploading(false)
      toast.success('Image loaded — click Save to apply')
    }
    reader.onerror = () => {
      toast.error('Failed to read image file')
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const handleClearSelection = () => {
    setSelectedEmoji(null)
    setSelectedImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!selectedEmoji && !selectedImage) {
      toast.error('Please select an emoji or image first')
      return
    }

    setSaving(true)
    try {
      // Preserve the existing custom status text
      const currentStatus = me?.session?.customStatus || null
      const currentUserStatus = me?.session?.userStatus || 'online'
      const currentPlatform = me?.session?.statusPlatform || 'mobile'

      const result = await api.statusUpdate({
        customStatusEmoji: selectedEmoji,
        customStatusImage: selectedImage,
        customStatus: currentStatus,
        userStatus: currentUserStatus,
        statusPlatform: currentPlatform,
      })

      if (result.ok) {
        toast.success('Selection saved!', { duration: 2000 })
        // Auto-return to dashboard after short delay
        setTimeout(() => {
          navigate({ name: 'dashboard' })
        }, 500)
      } else {
        toast.error(result.error || 'Failed to save')
      }
    } catch (e) {
      console.error('Save failed:', e)
      toast.error('Failed to save selection')
    } finally {
      setSaving(false)
    }
  }

  const handleClearSaved = async () => {
    setSaving(true)
    try {
      const result = await api.statusUpdate({
        customStatusEmoji: null,
        customStatusImage: null,
        customStatus: me?.session?.customStatus || null,
        userStatus: me?.session?.userStatus || 'online',
        statusPlatform: me?.session?.statusPlatform || 'mobile',
      })
      if (result.ok) {
        setSelectedEmoji(null)
        setSelectedImage(null)
        toast.success('Cleared', { duration: 2000 })
        setTimeout(() => navigate({ name: 'dashboard' }), 500)
      }
    } catch (e) {
      toast.error('Failed to clear')
    } finally {
      setSaving(false)
    }
  }

  // Filter emojis by search
  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase().trim()
    return ALL_EMOJIS.filter(e => e.includes(q) || e.startsWith(q))
  }, [search])

  const displayCategories = filteredEmojis
    ? [{ id: 'search', label: 'Search Results', icon: '🔍', emojis: filteredEmojis }]
    : EMOJI_CATEGORIES.map(c =>
        c.id === 'frequent'
          ? { ...c, emojis: recents.length > 0 ? recents : c.emojis }
          : c
      )

  const activeCat = displayCategories.find(c => c.id === activeCategory) || displayCategories[0]
  const currentSavedEmoji = me?.session?.customStatusEmoji || null
  const currentSavedImage = me?.session?.customStatusImage || null
  const hasExistingSelection = !!(selectedEmoji || selectedImage || currentSavedEmoji || currentSavedImage)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0b10]">
        <div className="text-center">
          <div className="inline-block w-10 h-10 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin mb-3" />
          <p className="text-white/60 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0b10] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0a0b10]/90 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate({ name: 'dashboard' })}
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Emoji & Image Picker
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
        {/* Mode toggle */}
        <div className="flex items-center gap-2 mb-6 bg-white/5 border border-white/10 rounded-xl p-1">
          <button
            onClick={() => setMode('emoji')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === 'emoji'
                ? 'purple-gradient text-white shadow-lg'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Smile className="w-4 h-4" />
            Emoji
          </button>
          <button
            onClick={() => setMode('image')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === 'image'
                ? 'purple-gradient text-white shadow-lg'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Custom Image
          </button>
        </div>

        {/* Preview card */}
        <div className="glass-card p-5 mb-6">
          <p className="text-xs uppercase tracking-wider text-purple-400 font-semibold mb-3">Preview</p>
          <div className="flex items-center justify-center min-h-[120px]">
            {selectedEmoji ? (
              <div className="text-center">
                <div className="text-7xl mb-2">{selectedEmoji}</div>
                <p className="text-xs text-white/40">Selected emoji</p>
              </div>
            ) : selectedImage ? (
              <div className="text-center">
                <img
                  src={selectedImage}
                  alt="Selected"
                  className="w-24 h-24 rounded-2xl object-cover mx-auto mb-2 border border-white/10 shadow-lg"
                />
                <p className="text-xs text-white/40">Selected image</p>
              </div>
            ) : currentSavedEmoji ? (
              <div className="text-center">
                <div className="text-7xl mb-2">{currentSavedEmoji}</div>
                <p className="text-xs text-white/40">Current saved emoji</p>
              </div>
            ) : currentSavedImage ? (
              <div className="text-center">
                <img
                  src={currentSavedImage}
                  alt="Current"
                  className="w-24 h-24 rounded-2xl object-cover mx-auto mb-2 border border-white/10 shadow-lg"
                />
                <p className="text-xs text-white/40">Current saved image</p>
              </div>
            ) : (
              <div className="text-center text-white/30">
                <div className="text-5xl mb-2 opacity-30">😊</div>
                <p className="text-xs">No selection yet</p>
              </div>
            )}
          </div>
        </div>

        {/* === EMOJI MODE === */}
        {mode === 'emoji' && (
          <div className="glass-card overflow-hidden">
            {/* Search bar */}
            <div className="p-4 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search emoji..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-purple-500/40"
                />
              </div>
            </div>

            {/* Category tabs */}
            {!filteredEmojis && (
              <div className="flex items-center gap-1 overflow-x-auto px-3 py-2 border-b border-white/10 scrollbar-hide">
                {displayCategories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-lg transition-all ${
                      activeCat?.id === cat.id
                        ? 'bg-purple-500/20 border border-purple-500/40 scale-105'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                    title={cat.label}
                  >
                    {cat.icon}
                  </button>
                ))}
              </div>
            )}

            {/* Emoji grid */}
            <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
              {activeCat && activeCat.emojis.length > 0 ? (
                <>
                  <div className="flex items-center gap-1.5 mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {activeCat.id === 'frequent' && recents.length > 0 && (
                      <Clock className="w-3 h-3" />
                    )}
                    {activeCat.label}
                    <span className="text-white/20">({activeCat.emojis.length})</span>
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
                    {activeCat.emojis.map((emoji, i) => (
                      <button
                        key={`${emoji}-${i}`}
                        onClick={() => handlePickEmoji(emoji)}
                        className={`aspect-square flex items-center justify-center text-2xl rounded-xl transition-all hover:scale-125 hover:bg-white/10 active:scale-95 ${
                          selectedEmoji === emoji ? 'bg-purple-500/20 ring-2 ring-purple-500/50' : ''
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-white/40 text-sm">
                  {search ? `No emojis found for "${search}"` : 'No emojis'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* === IMAGE MODE === */}
        {mode === 'image' && (
          <div className="glass-card p-6">
            <div className="text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-white/15 hover:border-purple-500/40 rounded-2xl p-8 transition-colors group disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="w-10 h-10 mx-auto mb-3 text-purple-400 animate-spin" />
                ) : (
                  <Upload className="w-10 h-10 mx-auto mb-3 text-white/40 group-hover:text-purple-400 transition-colors" />
                )}
                <p className="text-sm font-medium text-white/80 mb-1">
                  {uploading ? 'Loading...' : 'Click to upload image'}
                </p>
                <p className="text-xs text-white/40">
                  PNG, JPG, GIF, WebP — max ~375KB
                </p>
              </button>

              {selectedImage && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <img
                    src={selectedImage}
                    alt="Preview"
                    className="w-20 h-20 rounded-xl object-cover border border-white/10"
                  />
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0a0b10]/90 backdrop-blur-xl border-t border-white/10 p-4">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            {hasExistingSelection && (
              <button
                onClick={handleClearSaved}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            )}
            <button
              onClick={() => navigate({ name: 'dashboard' })}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (!selectedEmoji && !selectedImage)}
              className="flex-1 flex items-center justify-center gap-2 purple-gradient text-white font-bold rounded-xl py-3 text-sm shadow-lg shadow-purple-900/30 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Selection
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
