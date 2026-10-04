// 10X RPC — Unified image URL parser (backend, Gaming SDK gateway version)
//
// This version uses mp: prefixes for ALL URLs because the Gaming SDK gateway
// (gateway.gaming-sdk.com) supports mp: prefixes for both Discord CDN URLs
// AND external URLs. This PRESERVES GIF animation (the media proxy fetches
// the image with the correct content-type).
//
// Priority:
// 1. Discord CDN URLs → mp: prefix (preserves .gif + signed query params)
// 2. External HTTPS URLs → mp:external/<base64url-of-FULL-url>
//    (media proxy fetches + preserves content-type → GIFs stay animated)
// 3. Asset IDs / mp: prefixes → pass through
// 4. Invalid input → null (graceful, no throw)

/**
 * Parse an image reference into Discord's expected `large_image` format.
 *
 * This is a SYNC function (no upload needed — mp:external/ is computed locally).
 */
export function parseImageUrl(image: string | null | undefined): string | null {
  if (image == null) return null
  if (typeof image !== 'string') return null
  const trimmed = image.trim()
  if (!trimmed) return null

  // Already-prefixed values → pass through (KEEP query strings)
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

  // Not a URL → treat as a Discord asset key, pass through
  if (!parsedUrl) {
    return trimmed
  }

  // Only http and https are supported
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return null
  }

  const host = parsedUrl.hostname.toLowerCase()

  // ── Discord CDN URLs → mp: prefix (HIGHEST PRIORITY — MUST WORK) ────
  //
  // cdn.discordapp.com — emojis, app-icons, app-assets, attachments, banners
  // media.discordapp.net — alternate CDN for the same assets
  //
  // CRITICAL: Keep the FULL URL including query params!
  //   - Attachment URLs REQUIRE signed params (?ex=...&is=...&hm=...) for auth
  //   - Emoji URLs work with or without params (params are harmless)
  //   - App-asset URLs work with or without params
  //   - The .gif extension in the path → animated GIFs render correctly
  if (host === 'cdn.discordapp.com' || host === 'media.discordapp.net') {
    const converted = trimmed
      .replace('https://cdn.discordapp.com/', 'mp:')
      .replace('http://cdn.discordapp.com/', 'mp:')
      .replace('https://media.discordapp.net/', 'mp:')
      .replace('http://media.discordapp.net/', 'mp:')
    if (converted.startsWith('mp:')) {
      return converted
    }
  }

  // ── External HTTPS URL → mp:external/<base64url-of-FULL-url> ────────
  //
  // This handles ALL other valid image/GIF sources:
  //   - Image-hosting services (Giphy, Imgur, Tenor, etc.)
  //   - Other CDNs (Cloudflare, AWS S3, Akamai, etc.)
  //   - Website-hosted images
  //   - Direct GIF/PNG/JPG/JPEG/WEBP/AVIF URLs
  //   - URLs without a visible file extension
  //   - URLs with query parameters, cache-busting params, URL-encoded chars
  //   - URLs that redirect (Discord's proxy follows 3xx redirects)
  //
  // The Gaming SDK gateway's media proxy:
  //   - Fetches the image from the external URL (follows redirects)
  //   - Determines the content-type from the response headers
  //   - Serves it through Discord's CDN
  //   - PRESERVES the content-type (GIFs stay animated!)
  try {
    const b64 = Buffer.from(trimmed).toString('base64url')
    return `mp:external/${b64}`
  } catch {
    return null
  }
}

/**
 * ASYNC version — for backwards compatibility with rpc-manager.ts.
 * Since we're using the Gaming SDK gateway, this just calls the sync version.
 * No asset upload needed — mp:external/ is computed locally and preserves GIFs.
 */
export async function parseImageUrlAsync(image: string | null | undefined): Promise<string | null> {
  return parseImageUrl(image)
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
