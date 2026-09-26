// 10X RPC — /api/admin/users — list all users with their RPC state (admin only)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'
import { avatarUrl } from '@/lib/discord-oauth'

export const dynamic = 'force-dynamic'

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: 'forbidden', message: 'Admin access required' }, { status: 403 })
  }

  const users = await db.user.findMany({
    include: {
      sessions: {
        where: { expiresAt: { gt: new Date() } },
        take: 1,
      },
      trial: true,
      rpcConfigs: { take: 1 },
      gameRpcConfigs: { take: 1 },
      globalConfig: true,
      subscriptions: { take: 1, orderBy: { createdAt: 'desc' } },
      payments: { where: { status: { in: ['verified', 'captured'] } }, select: { amount: true, createdAt: true }, take: 5 },
    },
  })

  const userList = users.map(u => {
    const s = u.sessions[0]
    const trial = u.trial
    const rpc = u.rpcConfigs[0]
    const gameRpc = u.gameRpcConfigs[0]
    const sub = u.subscriptions[0]
    const payments = u.payments || []
    const now = new Date()
    const totalSpent = payments.reduce((sum, p) => sum + (p.amount || 0), 0)
    const lastPayment = payments.length > 0 ? payments[0] : null
    return {
      id: u.id,
      discordId: u.discordId,
      username: u.username,
      avatar: avatarUrl({ id: u.discordId, avatar: u.avatar, discriminator: u.discriminator || '0' }),
      createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
      trial: trial ? {
        active: trial.active && trial.endsAt > now,
        endsAt: trial.endsAt instanceof Date ? trial.endsAt.toISOString() : null,
        daysLeft: Math.max(0, Math.ceil((trial.endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))),
      } : null,
      rpc: s ? {
        rpcEnabled: s.rpcEnabled,
        gamesRpcEnabled: s.gamesRpcEnabled,
        gatewayReady: s.gatewayReady,
        userStatus: s.userStatus,
        customStatus: s.customStatus,
        customStatusEmoji: s.customStatusEmoji,
        vrStatusActive: s.vrStatusActive,
        hasDiscordToken: !!s.discordAccessToken,
        lastPresenceUpdate: s.lastPresenceUpdate instanceof Date ? s.lastPresenceUpdate.toISOString() : null,
        sleepTimerActive: s.sleepTimerActive && s.sleepTimerEndsAt && s.sleepTimerEndsAt > now,
        sleepTimerEndsAt: s.sleepTimerEndsAt instanceof Date ? s.sleepTimerEndsAt.toISOString() : null,
      } : null,
      rpcConfig: rpc ? {
        name: rpc.name,
        type: rpc.type,
        platform: rpc.platform,
        enabled: rpc.enabled,
      } : null,
      gameRpcConfig: gameRpc ? {
        gameSlug: gameRpc.gameSlug,
        enabled: gameRpc.enabled,
      } : null,
      globalConfig: u.globalConfig ? {
        city: u.globalConfig.city,
        timezone: u.globalConfig.timezone,
      } : null,
      subscription: sub ? {
        plan: sub.plan,
        status: sub.status,
        endsAt: sub.endsAt instanceof Date ? sub.endsAt.toISOString() : String(sub.endsAt),
        daysLeft: Math.max(0, Math.ceil((sub.endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))),
        amountPaid: sub.amountPaid,
        currency: sub.currency,
        suspendedAt: sub.suspendedAt instanceof Date ? sub.suspendedAt.toISOString() : null,
        gracePeriodEnd: sub.gracePeriodEnd instanceof Date ? sub.gracePeriodEnd.toISOString() : null,
      } : null,
      paymentSummary: {
        totalSpent,
        paymentCount: payments.length,
        lastPaymentDate: lastPayment ? (lastPayment.createdAt instanceof Date ? lastPayment.createdAt.toISOString() : String(lastPayment.createdAt)) : null,
      },
      isAdmin: isAdmin(u.discordId),
    }
  })

  return NextResponse.json({
    ok: true,
    totalUsers: userList.length,
    activeRpcUsers: userList.filter(u => u.rpc?.rpcEnabled).length,
    users: userList,
  })
}
