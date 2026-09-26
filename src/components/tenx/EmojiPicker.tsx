// 10X RPC — EmojiPicker — categorized emoji picker with search + recents
// Replaces the simple cycling button with a full popup emoji selector.
'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { Search, X, Clock } from 'lucide-react'

// === Emoji categories ===
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
      '🎮','🕹️','👾','🕹️','🎯','🏆','🥇','🥈','🥉','🏅','🎖️','🎗️','🔥','⚡','💥','💫',
      '🚀','🌟','⭐','✨','🎉','🎊','🎈','🎁','🏆','👑','💎','💠','🔮','⚔️','🛡️','🏹',
      '🗡️','🔪','🔫','💣','🧨','⚡','💥','🔥','☄️','🌈','☀️','🌙',' Cosmic',
    ].filter(e => e.length > 0 && !e.includes('Cosmic')),
  },
  {
    id: 'animals',
    label: 'Animals',
    icon: '🐱',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔',
      '🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋',
      '🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🕸️','🦂','🐢','🐍','🦎','🦖','🦕',
      '🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓',
    ],
  },
  {
    id: 'food',
    label: 'Food',
    icon: '🍔',
    emojis: [
      '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥',
      '🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠',
      '🥐','🥯','🍞','🥖','🥨','🧀','🧈','🥚','🍳','🧇','🥓','🥩','🍗','🍖','🦴','🌭',
      '🍔','🍟','🍕','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲',
      '🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨',
    ],
  },
  {
    id: 'activities',
    label: 'Activities',
    icon: '⚽',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍',
      '🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌',
      '🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽',
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

// All emojis flattened for search
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

interface EmojiPickerProps {
  /** Currently selected emoji (null = none) */
  value: string | null
  /** Called when user picks an emoji */
  onChange: (emoji: string) => void
  /** Called when user clears the emoji (clicks the X) */
  onClear?: () => void
  /** Whether the picker is open */
  open: boolean
  /** Called when the picker should close */
  onClose: () => void
}

export function EmojiPicker({ value, onChange, onClear, open, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('frequent')
  const [recents, setRecents] = useState<string[]>(() => {
    // Initialize from localStorage lazily (avoids setState-in-effect lint)
    if (typeof window === 'undefined') return []
    return loadRecents()
  })
  const pickerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Focus search when opened
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [open])

  // Outside click handler
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onClose])

  // Escape key closes
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const handlePick = (emoji: string) => {
    onChange(emoji)
    saveRecents(emoji)
    setRecents(loadRecents())
    onClose()
  }

  const handleClear = () => {
    if (onClear) {
      onClear()
      onClose()
    }
  }

  // Filter emojis by search
  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase().trim()
    // Simple search: filter all emojis (could add keyword matching later)
    return ALL_EMOJIS.filter(e => e.includes(q) || e.startsWith(q))
  }, [search])

  if (!open) return null

  const displayCategories = filteredEmojis
    ? [{ id: 'search', label: 'Search Results', icon: '🔍', emojis: filteredEmojis }]
    : EMOJI_CATEGORIES.map(c =>
        c.id === 'frequent'
          ? { ...c, emojis: recents.length > 0 ? recents : c.emojis }
          : c
      )

  const activeCat = displayCategories.find(c => c.id === activeCategory) || displayCategories[0]

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden"
        onClick={onClose}
      />

      <div
        ref={pickerRef}
        className="absolute z-50 bottom-full mb-2 left-0 sm:left-auto sm:right-0 w-[320px] max-w-[calc(100vw-2rem)] bg-[#181922]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
      >
        {/* Header with search */}
        <div className="p-3 border-b border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search emoji..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-purple-500/40"
              />
            </div>
            {value && onClear && (
              <button
                onClick={handleClear}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                title="Remove emoji"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category tabs */}
          {!filteredEmojis && (
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
              {displayCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-base transition-all ${
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
        </div>

        {/* Emoji grid */}
        <div className="p-3 max-h-[240px] overflow-y-auto custom-scrollbar">
          {activeCat && activeCat.emojis.length > 0 ? (
            <>
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {activeCat.id === 'frequent' && recents.length > 0 && (
                  <Clock className="w-3 h-3" />
                )}
                {activeCat.label}
                <span className="text-white/20">({activeCat.emojis.length})</span>
              </div>
              <div className="grid grid-cols-8 gap-1">
                {activeCat.emojis.map((emoji, i) => (
                  <button
                    key={`${emoji}-${i}`}
                    onClick={() => handlePick(emoji)}
                    className={`aspect-square flex items-center justify-center text-lg rounded-lg transition-all hover:scale-125 hover:bg-white/10 active:scale-95 ${
                      value === emoji ? 'bg-purple-500/20 ring-1 ring-purple-500/50' : ''
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

        {/* Footer */}
        <div className="p-2 border-t border-white/10 flex items-center justify-between text-[10px] text-white/30">
          <span>Click an emoji to select</span>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            Close
          </button>
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
    </>
  )
}
