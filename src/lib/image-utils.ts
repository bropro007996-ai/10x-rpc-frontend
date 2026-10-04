// 10X RPC — Unified image URL parser
//
// This module is the SINGLE source of truth for how image/GIF URLs are
// converted to Discord's expected `large_image` / `small_image` format.
// It is shared between the frontend (rpc-manager.ts) and can be copied
// verbatim to the backend (backend/src/rpc-manager.ts).
//
// ── Requirements (DO NOT VIOLATE) ──────────────────────────────────────
//
//  1. Discord CDN URLs (cdn.discordapp.com / media.discordapp.net) MUST
//     always work. They are converted to `mp:` prefix, preserving:
//       - The full path (including .gif extension → animation works)
//       - The full query string (?ex=...&is=...&hm=... signed params
//         required by attachment URLs for authentication)
//     Stripping query params breaks attachment URLs → NEVER strip them.
//
//  2. External HTTPS URLs (Giphy, Imgur, Tenor, Cloudflare, S3, etc.)
//     SHOULD work. They are encoded as `mp:external/<base64url-of-FULL-url>`.
//     Discord's media proxy fetches the image and preserves the content-type
//     (GIFs stay animated). This is what Discord's OWN client does.
//
//  3. If an external source fails (blocks access, requires auth, returns
//     invalid response), Discord's media proxy will show a placeholder.
//     This is acceptable — it does NOT affect Discord URL functionality.
//
//  4. Animated GIFs MUST remain animated. We do NOT download + re-upload
//     as app assets (that converts GIF → PNG). The mp:external/ approach
//     preserves animation through Discord's media proxy.
//
//  5. We do NOT hardcode file extensions. The URL is accepted regardless
//     of whether it ends in .gif, .png, .jpg, .webp, .avif, or has no
//     extension at all. Discord's proxy determines the content-type from
//     the response headers.
//
//  6. Redirects are handled by Discord's media proxy (it follows 3xx).
//     We don't need to resolve them client-side.
//
//  7. URL-encoded characters, cache-busting params, signed CDN params —
//     all preserved in the base64url encoding for external URLs, and
//     preserved as-is for Discord CDN URLs.
//
// ── Priority ───────────────────────────────────────────────────────────
//
//  1. Discord URLs → MUST WORK (mp: prefix)
//  2. External URLs → SHOULD WORK (mp:external/)
//  3. Asset IDs / mp: prefixes → pass through unchanged
//  4. Invalid input → return null (graceful, no throw)

/**
 * Parse an image reference into Discord's expected `large_image` format.
 *
 * Returns:
 *   - `mp:<path>?<query>` for Discord CDN URLs (preserves .gif + signed params)
 *   - `mp:external/<base64url>` for external HTTPS URLs (preserves animation)
 *   - The original string for asset IDs, mp: prefixes, youtube:/spotify:/twitch:
 *   - `null` for invalid/null/empty input
 *
 * This function NEVER throws. It returns null on any parse failure.
 */
export function parseImageUrl(image: string | null | undefined): string | null {
  if (image == null) return null
  if (typeof image !== 'string') return null
  const trimmed = image.trim()
  if (!trimmed) return null

  // ── Already-prefixed values → pass through (KEEP query strings) ──────
  // mp:emojis/123.gif, mp:external/<b64>, mp:app-assets/123/456.png,
  // youtube:, spotify:, twitch: prefixes
  if (
    trimmed.startsWith('mp:') ||
    trimmed.startsWith('youtube:') ||
    trimmed.startsWith('spotify:') ||
    trimmed.startsWith('twitch:')
  ) {
    return trimmed
  }

  // ── `external/...` path → prefix with `mp:` ─────────────────────────
  if (trimmed.startsWith('external/')) {
    return `mp:${trimmed}`
  }

  // ── Asset ID (17–19 digit Discord snowflake) → pass through ─────────
  if (/^[0-9]{17,19}$/.test(trimmed)) {
    return trimmed
  }

  // ── Check if it's an HTTP(S) URL ────────────────────────────────────
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
  //
  // We do NOT strip anything. The full URL is converted to mp: prefix.
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
  //   - URLs without a visible file extension (Discord's proxy uses Content-Type)
  //   - URLs with query parameters, cache-busting params, URL-encoded chars
  //   - URLs that redirect (Discord's proxy follows 3xx redirects)
  //
  // The FULL URL (including query params + fragments) is base64url-encoded.
  // Discord's media proxy:
  //   - Fetches the image from the external URL (follows redirects)
  //   - Determines the content-type from the response headers
  //   - Serves it through Discord's CDN
  //   - PRESERVES the content-type (GIFs stay animated!)
  //
  // If the external source blocks access, requires auth, or returns an
  // invalid response, Discord shows a placeholder. This does NOT affect
  // Discord URL functionality.
  try {
    const b64 = Buffer.from(trimmed).toString('base64url')
    return `mp:external/${b64}`
  } catch {
    return null
  }
}

/**
 * Check if a string is a valid HTTP(S) URL.
 * Used by the frontend to decide whether to render an <img> tag vs. a fallback.
 *
 * This does NOT check if the image actually loads — it only checks the URL
 * format. The browser's <img onError> handler handles load failures.
 */
export function isHttpUrl(s: string | null | undefined): boolean {
  if (!s) return false
  try {
    const url = new URL(s.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Check if a string looks like a Discord CDN URL.
 * Used to show the attachment-expiry warning in the form.
 */
export function isDiscordCdnUrl(s: string | null | undefined): boolean {
  if (!s) return false
  return /https?:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\//i.test(s)
}

/**
 * Check if a string is a Discord ATTACHMENT URL (requires signed params).
 * Attachment URLs expire (~24h). Used to warn users in the form.
 */
export function isDiscordAttachmentUrl(s: string | null | undefined): boolean {
  if (!s) return false
  return (
    /https?:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\//i.test(s) &&
    !s.includes('/emojis/') &&
    !s.includes('/app-icons/') &&
    !s.includes('/app-assets/')
  )
}
