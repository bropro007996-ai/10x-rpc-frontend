// 10X RPC — /api/games-rpc/list — public catalog of spoofable games
import { NextResponse } from 'next/server'
import { SPOOF_GAMES } from '@/lib/spoof-games'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    games: SPOOF_GAMES.map(g => ({
      slug: g.slug,
      appId: g.app_id,
      name: g.name,
      img: g.img,
      defaultState: g.defaultState,
      defaultDetails: g.defaultDetails,
      defaultPartyMax: g.defaultPartyMax,
      defaultPartyCurrent: g.defaultPartyCurrent,
    })),
  })
}
