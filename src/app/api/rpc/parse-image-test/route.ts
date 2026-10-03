// 10X RPC — /api/rpc/parse-image-test — diagnostic endpoint (auth required)
// Shows what parseImage() + parseCustomEmoji() produce for given inputs, AND
// builds a full sample activity payload so you can verify the exact OP-3
// structure that would be sent to Discord's gateway.
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { parseImage, parseCustomEmoji, buildActivityPayload } from '@/lib/rpc-manager'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  const url = new URL(req.url)
  const image = url.searchParams.get('image')
  const emoji = url.searchParams.get('emoji')

  // Parse the image — catch INVALID_URL throws
  let parsedImage: string | null = null
  let imageError: string | null = null
  if (image != null) {
    try {
      parsedImage = parseImage(image)
    } catch (e) {
      imageError = e instanceof Error ? e.message : 'unknown_error'
    }
  }

  const parsedEmoji = emoji != null ? parseCustomEmoji(emoji) : null

  // Build a sample full activity payload to show the exact OP-3 structure
  let sampleActivity: Record<string, unknown> | null = null
  let buildError: string | null = null
  try {
    sampleActivity = await buildActivityPayload({
      name: '10X RPC',
      type: 'PLAYING',
      platform: 'desktop',
      state: 'Editing page.tsx',
      details: 'Workspace: 10X RPC',
      largeImage: image || undefined,
      largeText: 'Large Image Text',
      smallImage: undefined,
      smallText: undefined,
      button1Label: 'View Repo',
      button1Url: 'https://github.com',
      button2Label: undefined,
      button2Url: undefined,
      partyCurrent: 1,
      partyMax: 5,
      partyId: undefined,
      partySecret: undefined,
      startMinsAgo: 0,
      endTotalMins: 30,
      enabled: true,
    }, { timezone: 'UTC', rpcStartedAt: Date.now() })
  } catch (e) {
    buildError = e instanceof Error ? e.message : 'unknown_error'
  }

  return NextResponse.json({
    ok: true,
    input: { image, emoji },
    parsedImage,
    imageError,
    parsedEmoji,
    sampleActivity,
    buildError,
    note: 'parsedImage is what gets set as assets.large_image. If imageError is "INVALID_URL", the image is omitted (not set) to prevent Discord from dropping the entire assets block. sampleActivity shows the full OP-3 activity payload structure.',
  })
}
