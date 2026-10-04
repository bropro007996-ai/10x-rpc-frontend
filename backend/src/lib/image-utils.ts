// 10X RPC — Unified image URL parser (backend version with asset upload)
//
// This is the BACKEND version. It uses a HYBRID approach:
//   - Discord CDN emoji URLs → mp: prefix (preserves .gif, works on main gateway)
//   - Discord CDN app-asset URLs → mp: prefix (works on main gateway)
//   - Everything else (external URLs, Discord attachments) → upload as Discord
//     app asset via the bot token → returns numeric asset ID that works on
//     the main gateway.
//
// Note: GIFs uploaded as app assets are converted to PNG (animation lost).
// For animated GIFs, users should use Discord CDN emoji URLs (mp:emojis/123.gif).

import { CONFIG } from './config.js'
import { uploadImageAsAsset } from './discord-assets.js'

// In-memory cache: URL → resolved large_image value (avoids re-uploading)
const resolveCache = new Map<string, string | null>()

/**
 * Parse an image reference into Discord's expected `large_image` format.
 *
 * SYNC version — used for already-prefixed values, asset IDs, and Discord CDN
 * emoji/app-asset URLs. Returns null for external URLs (use parseImageUrlAsync).
 */
export function parseImageUrl(image: string | null | undefined): string | null {
  if (image == null) return null
  if (typeof image !== 'string') return null
  const trimmed = image.trim()
  if (!trimmed) return null

  // Already-prefixed values → pass through
  if (
    trimmed.startsWith('mp:') ||
    trimmed.startsWith('youtube:') ||
    trimmed.startsWith('spotify:') ||
    trimmed.startsWith('twitch:')
  ) {
    return trimmed
  }

  // `external/...` path → prefix with `mp:`
  if (trimmed.startsWith('external/')) {
    return `mp:${trimmed}`
  }

  // Asset ID (17–19 digit Discord snowflake) → pass through
  if (/^[0-9]{17,19}$/.test(trimmed)) {
    return trimmed
  }

  // Check if it's an HTTP(S) URL
  let parsedUrl: URL | null = null
  try {
    if (URL.canParse(trimmed)) {
      parsedUrl = new URL(trimmed)
    }
  } catch {
    parsedUrl = null
  }

  if (!parsedUrl) {
    // Not a URL → treat as asset key, pass through
    return trimmed
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return null
  }

  const host = parsedUrl.hostname.toLowerCase()
  const path = parsedUrl.pathname

  // Discord CDN emoji URLs → mp: prefix (preserves .gif, works on main gateway)
  // These are PUBLIC assets — the mp: prefix works for emojis on the main gateway.
  if ((host === 'cdn.discordapp.com' || host === 'media.discordapp.net') && path.includes('/emojis/')) {
    const converted = trimmed
      .replace('https://cdn.discordapp.com/', 'mp:')
      .replace('http://cdn.discordapp.com/', 'mp:')
      .replace('https://media.discordapp.net/', 'mp:')
      .replace('http://media.discordapp.net/', 'mp:')
    if (converted.startsWith('mp:')) return converted
  }

  // Discord CDN app-asset URLs → mp: prefix (works on main gateway)
  if ((host === 'cdn.discordapp.com' || host === 'media.discordapp.net') && path.includes('/app-assets/')) {
    const converted = trimmed
      .replace('https://cdn.discordapp.com/', 'mp:')
      .replace('http://cdn.discordapp.com/', 'mp:')
      .replace('https://media.discordapp.net/', 'mp:')
      .replace('http://media.discordapp.net/', 'mp:')
    if (converted.startsWith('mp:')) return converted
  }

  // Discord CDN app-icon URLs → mp: prefix (works on main gateway)
  if ((host === 'cdn.discordapp.com' || host === 'media.discordapp.net') && path.includes('/app-icons/')) {
    const converted = trimmed
      .replace('https://cdn.discordapp.com/', 'mp:')
      .replace('http://cdn.discordapp.com/', 'mp:')
      .replace('https://media.discordapp.net/', 'mp:')
      .replace('http://media.discordapp.net/', 'mp:')
    if (converted.startsWith('mp:')) return converted
  }

  // For EVERYTHING ELSE (external URLs, Discord attachments, etc.):
  // Return null — the caller should use parseImageUrlAsync() which uploads
  // as an app asset and returns the numeric asset ID.
  return null
}

/**
 * ASYNC version — resolves external URLs by uploading as Discord app assets.
 *
 * Priority:
 * 1. Discord CDN emoji/app-asset/app-icon URLs → mp: prefix (sync, works on main gateway)
 * 2. External URLs (Giphy, Imgur, etc.) → upload as app asset → numeric asset ID
 * 3. Discord CDN attachment URLs → upload as app asset → numeric asset ID (attachments need auth)
 * 4. Asset IDs, mp: prefixes → pass through
 * 5. Invalid input → null (graceful)
 */
export async function parseImageUrlAsync(image: string | null | undefined): Promise<string | null> {
  if (image == null) return null
  if (typeof image !== 'string') return null
  const trimmed = image.trim()
  if (!trimmed) return null

  // Check cache first
  const cached = resolveCache.get(trimmed)
  if (cached !== undefined) return cached

  // Try the sync version first (handles mp: prefixes, asset IDs, Discord CDN emojis)
  const syncResult = parseImageUrl(trimmed)
  if (syncResult !== null) {
    resolveCache.set(trimmed, syncResult)
    return syncResult
  }

  // If sync returned null, it's an external URL or Discord attachment.
  // Upload as a Discord app asset → returns numeric asset ID.
  if (!CONFIG.discord.botToken || !CONFIG.discord.clientId) {
    resolveCache.set(trimmed, null)
    return null
  }

  try {
    const asset = await uploadImageAsAsset(trimmed)
    if (asset) {
      resolveCache.set(trimmed, asset.assetId)
      return asset.assetId
    }
  } catch (e) {
    console.error('[parseImageUrlAsync] Upload failed:', e)
  }

  resolveCache.set(trimmed, null)
  return null
}

export function isHttpUrl(s: string | null | undefined): boolean {
  if (!s) return false
  try {
    const url = new URL(s.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function isDiscordCdnUrl(s: string | null | undefined): boolean {
  if (!s) return false
  return /https?:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\//i.test(s)
}

export function isDiscordAttachmentUrl(s: string | null | undefined): boolean {
  if (!s) return false
  return (
    /https?:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\//i.test(s) &&
    !s.includes('/emojis/') &&
    !s.includes('/app-icons/') &&
    !s.includes('/app-assets/')
  )
}
