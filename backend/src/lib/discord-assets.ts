// 10X RPC Backend — Discord app asset uploader + image resolver
//
// Downloads images from URLs and uploads them as Discord app assets via the
// bot token. Returns the asset ID, which is used as large_image/small_image
// in RPC activities.
//
// The main Discord Gateway (gateway.discord.gg) does NOT support mp: prefixes
// or external URLs as large_image. It requires either:
//   1. An asset ID (uploaded to the Discord app via the bot token) — this file
//   2. A plain asset key
//
// This module uploads images to the Discord app and returns the numeric asset
// ID. This works on the main gateway. GIFs are preserved if the upload keeps
// the .gif extension.

import { CONFIG } from './config.js'

export interface UploadedAsset {
  key: string
  assetId: string
  url: string
}

const UPLOAD_API = `${CONFIG.discord.apiBase}/applications/${CONFIG.discord.clientId}/assets`
const LIST_API = `${CONFIG.discord.apiBase}/applications/${CONFIG.discord.clientId}/assets`

// In-memory cache of already-uploaded asset keys by URL hash (avoids re-uploading)
const assetCache = new Map<string, UploadedAsset>()

/**
 * List all assets currently uploaded to the Discord app.
 */
export async function listAppAssets(): Promise<Array<{ key: string; asset_id: string }>> {
  if (!CONFIG.discord.botToken || !CONFIG.discord.clientId) return []
  try {
    const res = await fetch(LIST_API, {
      headers: { Authorization: `Bot ${CONFIG.discord.botToken}` },
    })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

/**
 * Upload an image to the Discord app and return the asset ID.
 * If the URL was already uploaded, returns the cached asset ID (no re-upload).
 */
export async function uploadImageAsAsset(
  imageUrl: string,
  keyName?: string
): Promise<UploadedAsset | null> {
  if (!CONFIG.discord.botToken) return null
  if (!CONFIG.discord.clientId) return null

  const trimmed = imageUrl.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null

  // Cache hit — return existing asset
  const cacheKey = trimmed
  const cached = assetCache.get(cacheKey)
  if (cached) return cached

  const key = keyName || hashUrl(trimmed)

  // Check if an asset with this key already exists
  try {
    const listRes = await fetch(LIST_API, {
      headers: { Authorization: `Bot ${CONFIG.discord.botToken}` },
    })
    if (listRes.ok) {
      const existing = await listRes.json()
      const found = existing.find((a: any) => a.key === key)
      if (found) {
        if (found.visibility !== 'public') {
          await setAssetPublic(found.key)
        }
        const result: UploadedAsset = {
          key: found.key,
          assetId: found.asset_id,
          url: `https://cdn.discordapp.com/app-assets/${CONFIG.discord.clientId}/${found.asset_id}.png`,
        }
        assetCache.set(cacheKey, result)
        return result
      }
    }
  } catch {
    // Non-fatal — proceed with upload
  }

  try {
    // 1. Download the image
    const imgRes = await fetch(trimmed)
    if (!imgRes.ok) {
      console.error(`[uploadImageAsAsset] Failed to download ${trimmed}: HTTP ${imgRes.status}`)
      return null
    }
    const imgBuf = Buffer.from(await imgRes.arrayBuffer())
    const contentType = imgRes.headers.get('content-type') || 'image/png'
    const ext = contentType.includes('jpeg') || contentType.includes('jpg')
      ? 'jpg'
      : contentType.includes('gif')
      ? 'gif'
      : 'png'
    const filename = `${key}.${ext}`

    // 2. Request an upload URL from Discord
    const uploadReqRes = await fetch(`${UPLOAD_API}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${CONFIG.discord.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename,
        file_size: imgBuf.length,
        is_public: true,
      }),
    })
    if (!uploadReqRes.ok) {
      console.error(`[uploadImageAsAsset] Upload request failed: HTTP ${uploadReqRes.status}`)
      return null
    }
    const { upload_url, upload_filename } = await uploadReqRes.json()
    if (!upload_url || !upload_filename) return null

    // 3. Upload the image bytes to Google Cloud Storage
    const putRes = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: imgBuf,
    })
    if (!putRes.ok) {
      console.error(`[uploadImageAsAsset] GCS upload failed: HTTP ${putRes.status}`)
      return null
    }

    // 4. Register the asset with Discord
    const createRes = await fetch(UPLOAD_API, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${CONFIG.discord.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        upload_filename,
      }),
    })
    if (!createRes.ok) {
      // Maybe the asset was already created by a concurrent request — check
      const listRes2 = await fetch(LIST_API, {
        headers: { Authorization: `Bot ${CONFIG.discord.botToken}` },
      })
      if (listRes2.ok) {
        const existing = await listRes2.json()
        const found = existing.find((a: any) => a.key === key)
        if (found) {
          const result: UploadedAsset = {
            key: found.key,
            assetId: found.asset_id,
            url: `https://cdn.discordapp.com/app-assets/${CONFIG.discord.clientId}/${found.asset_id}.png`,
          }
          assetCache.set(cacheKey, result)
          return result
        }
      }
      console.error(`[uploadImageAsAsset] Create asset failed: HTTP ${createRes.status}`)
      return null
    }
    const asset = await createRes.json()

    // 5. Set the asset's visibility to PUBLIC
    await setAssetPublic(asset.key)

    const result: UploadedAsset = {
      key: asset.key,
      assetId: asset.asset_id,
      url: `https://cdn.discordapp.com/app-assets/${CONFIG.discord.clientId}/${asset.asset_id}.png`,
    }

    assetCache.set(cacheKey, result)
    console.log(`[uploadImageAsAsset] Uploaded ${trimmed} → asset ID ${asset.asset_id}`)
    return result
  } catch (e) {
    console.error('[uploadImageAsAsset] Error:', e)
    return null
  }
}

async function setAssetPublic(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${UPLOAD_API}/${key}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bot ${CONFIG.discord.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ visibility: 'public' }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Convert an image reference to a Discord-acceptable large_image value.
 *
 *   1. Discord CDN emoji URLs → mp: prefix (preserves .gif extension)
 *      These work on the main gateway for emoji URLs.
 *   2. Discord CDN app-asset URLs → mp: prefix
 *   3. External URLs → download + upload as Discord app asset → return asset ID
 *      This is REQUIRED for the main gateway (gateway.discord.gg) because it
 *      does NOT support mp:external or arbitrary URLs as large_image.
 *   4. Asset IDs / keys → passed through unchanged.
 */
export async function resolveImageToAssetId(
  image: string | null | undefined
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
  const path = url.pathname

  // Discord CDN emoji URLs → mp: prefix (works on the main gateway for emojis)
  if ((host === 'cdn.discordapp.com' || host === 'media.discordapp.net') && path.includes('/emojis/')) {
    const converted = trimmed
      .replace('https://cdn.discordapp.com/', 'mp:')
      .replace('http://cdn.discordapp.com/', 'mp:')
      .replace('https://media.discordapp.net/', 'mp:')
      .replace('http://media.discordapp.net/', 'mp:')
    if (converted.startsWith('mp:')) return converted
  }

  // Discord CDN app-asset URLs → mp: prefix
  if ((host === 'cdn.discordapp.com' || host === 'media.discordapp.net') && path.includes('/app-assets/')) {
    const converted = trimmed
      .replace('https://cdn.discordapp.com/', 'mp:')
      .replace('http://cdn.discordapp.com/', 'mp:')
      .replace('https://media.discordapp.net/', 'mp:')
      .replace('http://media.discordapp.net/', 'mp:')
    if (converted.startsWith('mp:')) return converted
  }

  // For ALL other URLs (Discord attachments, Giphy, Imgur, Tenor, external sites):
  // Download + upload as a Discord app asset → return the numeric asset ID.
  // This is REQUIRED because the main Discord Gateway does NOT support
  // mp:external or arbitrary URLs as large_image.
  try {
    const asset = await uploadImageAsAsset(trimmed)
    if (asset) {
      return asset.assetId
    }
  } catch (e) {
    console.error('[resolveImageToAssetId] Upload failed:', e)
  }

  return null
}

function hashUrl(url: string): string {
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0
  }
  return `10xrpc_${Math.abs(hash).toString(36).substring(0, 12)}`
}
