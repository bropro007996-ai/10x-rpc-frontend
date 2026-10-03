// 10X RPC — Discord image resolver (frontend / serverless)
//
// Converts image references into Discord's expected `large_image` / `small_image`
// format. Mirrors the Discord Gaming SDK's `parseImage()` spec:
//
//   1. Discord CDN URLs (cdn.discordapp.com / media.discordapp.net) → `mp:` prefix.
//      Preserves the FULL URL including query params — attachment URLs REQUIRE
//      signed params (?ex=...&hm=...) for authentication. Emoji/app-asset URLs
//      work with or without params. Preserves .gif extension → animated GIFs render.
//
//   2. External HTTPS URLs (Giphy, Imgur, Tenor, etc.) →
//      `mp:external/<base64url-of-FULL-url>`. This is what Discord's OWN client
//      does for external images. The media proxy fetches the image and serves
//      it through Discord's CDN, PRESERVING the GIF animation (content-type
//      is passed through). This is critical — uploading as an app asset strips
//      animation (converts GIF → PNG).
//
//   3. Asset IDs / keys / mp:-prefixed values → passed through unchanged.
//
// GIF support: Discord CDN URLs keep .gif in the path; external URLs are
// encoded as mp:external/<base64url> which the media proxy fetches with the
// correct content-type. Both approaches preserve animation.

import { CONFIG } from './config'

/**
 * Convert an image reference to a Discord-acceptable large_image value.
 *
 * @param image The image reference (URL, asset ID, or mp: prefix)
 * @param _applicationId Optional application ID (unused on the frontend —
 *   the backend's parseImage approach doesn't need it. Kept for API
 *   compatibility with the old uploadImageAsAsset function signature.)
 */
export async function resolveImageToAssetId(
  image: string | null | undefined,
  _applicationId?: string
): Promise<string | null> {
  if (!image) return null
  const trimmed = image.trim()
  if (!trimmed) return null

  // Already a Discord asset ID/key or mp: prefixed — return as-is
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  // It's an HTTP(S) URL — parse it
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()

  // Discord CDN URLs → mp: prefix (preserves .gif extension + query params)
  if (host === 'cdn.discordapp.com' || host === 'media.discordapp.net') {
    // Keep the FULL URL including query params.
    // Attachment URLs REQUIRE signed params (?ex=...&hm=...) for auth.
    // Emoji/app-asset URLs work with or without params.
    // The .gif extension is preserved in the path → animated GIFs render.
    const converted = trimmed
      .replace('https://cdn.discordapp.com/', 'mp:')
      .replace('http://cdn.discordapp.com/', 'mp:')
      .replace('https://media.discordapp.net/', 'mp:')
      .replace('http://media.discordapp.net/', 'mp:')

    if (converted.startsWith('mp:')) {
      return converted
    }
  }

  // External HTTPS URL (Giphy, Imgur, Tenor, etc.) →
  // Encode as mp:external/<base64url-of-FULL-url>.
  // This is what Discord's own client does. The media proxy:
  //   - Fetches the image from the external URL
  //   - Serves it through Discord's CDN
  //   - PRESERVES the content-type (GIFs stay animated!)
  // This is critical: the old approach uploaded as an app asset, which
  // converted GIFs to static PNGs. mp:external/ preserves animation.
  try {
    const b64 = Buffer.from(trimmed).toString('base64url')
    return `mp:external/${b64}`
  } catch {
    return null
  }
}

// ── Legacy app-asset uploader (kept for reference, no longer used) ────────
// The uploadImageAsAsset() approach was removed because:
//   1. App assets are converted to PNG — GIFs lose animation
//   2. Assets are tied to CONFIG.discord.clientId — breaks when the user
//      sets a custom application_id
//   3. The mp:external/ approach is simpler, preserves animation, and works
//      with any application_id
//
// The functions below are kept as stubs in case other code imports them.

export interface UploadedAsset {
  key: string
  assetId: string
  url: string
}

export async function uploadImageAsAsset(
  _imageUrl: string,
  _keyName?: string
): Promise<UploadedAsset | null> {
  // Deprecated — use resolveImageToAssetId() instead, which uses mp:external/
  // to preserve GIF animation and works with any application_id.
  return null
}

export async function listAppAssets(): Promise<Array<{ key: string; asset_id: string }>> {
  if (!CONFIG.discord.botToken || !CONFIG.discord.clientId) return []
  try {
    const res = await fetch(
      `${CONFIG.discord.apiBase}/applications/${CONFIG.discord.clientId}/assets`,
      { headers: { Authorization: `Bot ${CONFIG.discord.botToken}` } }
    )
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}
