// 10X RPC — Discord image resolver (frontend / serverless)
//
// This module now delegates to the unified `parseImageUrl` in image-utils.ts.
// The `resolveImageToAssetId` function is kept for backwards compatibility
// (rpc-manager.ts imports it) but just calls `parseImageUrl` under the hood.
//
// The unified implementation:
//   - Discord CDN URLs → mp: prefix (preserves .gif + signed query params)
//   - External HTTPS URLs → mp:external/<base64url> (preserves GIF animation)
//   - Asset IDs / mp: prefixes → pass through
//
// GIF support: Discord CDN URLs keep .gif in the path; external URLs go
// through the media proxy which preserves the content-type.

import { parseImageUrl } from './image-utils'

/**
 * Convert an image reference to a Discord-acceptable large_image value.
 *
 * This is now a thin wrapper around `parseImageUrl` from image-utils.ts.
 * Kept for backwards compatibility — rpc-manager.ts imports it.
 *
 * @param image The image reference (URL, asset ID, or mp: prefix)
 */
export async function resolveImageToAssetId(
  image: string | null | undefined
): Promise<string | null> {
  return parseImageUrl(image)
}

// ── Legacy stubs (kept for backwards compatibility, no longer used) ─────

export interface UploadedAsset {
  key: string
  assetId: string
  url: string
}

export async function uploadImageAsAsset(
  _imageUrl: string,
  _keyName?: string
): Promise<UploadedAsset | null> {
  // Deprecated — use resolveImageToAssetId() instead.
  return null
}

export async function listAppAssets(): Promise<Array<{ key: string; asset_id: string }>> {
  return []
}
