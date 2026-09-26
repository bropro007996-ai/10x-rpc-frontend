// 10X RPC — /api/admin/user-action — per-user admin actions (admin only)
// Actions: sync, stop-rpc, extend-trial, delete-user, toggle-status,
//          toggle-games-rpc, apply-template, ban (suspend), unban (unsuspend)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { CONFIG } from '@/lib/config'
import { daemonSyncUser, daemonStopUserRpc } from '@/lib/daemon-bridge'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function isAdmin(discordId: string): boolean {
  return CONFIG.admin.discordIds.includes(discordId)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  if (!isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Parse body safely — handle edge cases where body might be malformed
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
  }

  // Handle both 'action' as a top-level field AND 'action' nested inside the body
  // (the api-client sends { userId, action, ...data } — but some callers send { userId, action: 'foo', days: 30 })
  const userId = body.userId
  const action = body.action

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ ok: false, error: 'missing userId' }, { status: 400 })
  }
  if (!action || typeof action !== 'string') {
    return NextResponse.json({ ok: false, error: 'missing action' }, { status: 400 })
  }

  // Allowed actions
  const ALLOWED_ACTIONS = [
    'sync', 'stop-rpc', 'extend-trial', 'delete-user',
    'toggle-status', 'toggle-games-rpc', 'apply-template',
    'ban', 'unban', 'reset-workspace',
  ]
  if (!ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: `unknown action: ${action}` }, { status: 400 })
  }

  try {
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, discordId: true, username: true },
    })
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 })
    }

    // Don't allow actions on other admins (security)
    if (isAdmin(targetUser.discordId) && targetUser.id !== session.userId && action === 'delete-user') {
      return NextResponse.json({ ok: false, error: 'cannot delete admin user' }, { status: 403 })
    }

    switch (action) {
      case 'sync': {
        const result = await daemonSyncUser(userId)
        await db.auditLog.create({
          data: {
            action: 'admin_user_sync',
            actor: session.userId,
            target: userId,
            metadata: JSON.stringify({ username: targetUser.username }),
          },
        })
        return NextResponse.json({ ok: result.ok, message: result.message || 'Synced' })
      }

      case 'stop-rpc': {
        await db.session.updateMany({
          where: { userId },
          data: { rpcEnabled: false, gamesRpcEnabled: false },
        })
        await db.rpcConfig.updateMany({
          where: { userId },
          data: { enabled: false },
        })
        await db.gameRpcConfig.updateMany({
          where: { userId },
          data: { enabled: false },
        })
        const result = await daemonStopUserRpc(userId)
        await db.auditLog.create({
          data: {
            action: 'admin_stop_rpc',
            actor: session.userId,
            target: userId,
            metadata: JSON.stringify({ username: targetUser.username }),
          },
        })
        return NextResponse.json({ ok: true, message: 'RPC stopped & cleared' })
      }

      case 'toggle-status': {
        const s = await db.session.findFirst({
          where: { userId, discordAccessToken: { not: null }, expiresAt: { gt: new Date() } },
          orderBy: { discordTokenExpiresAt: 'desc' },
        })
        const newStatus = body.enable !== undefined ? !!body.enable : !s?.statusEnabled
        await db.session.updateMany({
          where: { userId },
          data: { statusEnabled: newStatus },
        })
        if (s?.discordAccessToken) {
          await daemonSyncUser(userId)
        }
        return NextResponse.json({ ok: true, message: `Status ${newStatus ? 'enabled' : 'disabled'}`, statusEnabled: newStatus })
      }

      case 'toggle-games-rpc': {
        const s = await db.session.findFirst({
          where: { userId, discordAccessToken: { not: null }, expiresAt: { gt: new Date() } },
          orderBy: { discordTokenExpiresAt: 'desc' },
        })
        const newGamesRpc = body.enable !== undefined ? !!body.enable : !s?.gamesRpcEnabled
        await db.session.updateMany({
          where: { userId },
          data: { gamesRpcEnabled: newGamesRpc },
        })
        await db.gameRpcConfig.updateMany({
          where: { userId },
          data: { enabled: newGamesRpc },
        })
        if (s?.discordAccessToken) {
          await daemonSyncUser(userId)
        }
        return NextResponse.json({ ok: true, message: `Games RPC ${newGamesRpc ? 'enabled' : 'disabled'}`, gamesRpcEnabled: newGamesRpc })
      }

      case 'extend-trial': {
        const days = Number(body.days) || 30
        const trial = await db.trial.findUnique({ where: { userId } })
        const now = new Date()
        const baseDate = trial?.endsAt && trial.endsAt > now ? trial.endsAt : now
        const newEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000)
        if (trial) {
          await db.trial.update({
            where: { userId },
            data: { endsAt: newEnd, active: true },
          })
        } else {
          await db.trial.create({
            data: { userId, endsAt: newEnd, active: true },
          })
        }
        await db.auditLog.create({
          data: {
            action: 'admin_extend_trial',
            actor: session.userId,
            target: userId,
            metadata: JSON.stringify({ username: targetUser.username, days, newEnd: newEnd.toISOString() }),
          },
        })
        return NextResponse.json({
          ok: true,
          message: `Trial extended by ${days} days`,
          newEndDate: newEnd.toISOString(),
        })
      }

      case 'ban': {
        // Suspend the user's subscription + trial
        const now = new Date()
        const sub = await db.subscription.findUnique({ where: { userId } })
        if (sub) {
          const gracePeriodEnd = sub.endsAt > now
            ? new Date(sub.endsAt.getTime() + 7 * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          await db.subscription.update({
            where: { userId },
            data: {
              status: 'suspended',
              suspendedAt: now,
              gracePeriodEnd,
            },
          })
        } else {
          // No subscription record — create one in suspended state
          await db.subscription.create({
            data: {
              userId,
              plan: 'suspended',
              status: 'suspended',
              startsAt: now,
              endsAt: now,
              suspendedAt: now,
              gracePeriodEnd: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
              amountPaid: 0,
              currency: 'inr',
            },
          })
        }
        // Also deactivate the trial so the user can't use trial access while suspended
        const trial = await db.trial.findUnique({ where: { userId } })
        if (trial && trial.active) {
          await db.trial.update({
            where: { userId },
            data: { active: false },
          })
        }
        // Stop RPC
        await db.session.updateMany({
          where: { userId },
          data: { rpcEnabled: false, gamesRpcEnabled: false, statusEnabled: false },
        })
        await db.rpcConfig.updateMany({
          where: { userId },
          data: { enabled: false },
        })
        await db.gameRpcConfig.updateMany({
          where: { userId },
          data: { enabled: false },
        })
        await daemonStopUserRpc(userId)
        await db.auditLog.create({
          data: {
            action: 'admin_suspend_user',
            actor: session.userId,
            target: userId,
            metadata: JSON.stringify({ username: targetUser.username }),
          },
        })
        return NextResponse.json({ ok: true, message: `User ${targetUser.username} suspended` })
      }

      case 'unban': {
        // Unsuspend — reactivate subscription + trial
        const now = new Date()
        const sub = await db.subscription.findUnique({ where: { userId } })
        if (sub) {
          const newEnd = sub.gracePeriodEnd && sub.gracePeriodEnd > now
            ? sub.endsAt > now ? sub.endsAt : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          await db.subscription.update({
            where: { userId },
            data: {
              status: 'active',
              suspendedAt: null,
              gracePeriodEnd: null,
              endsAt: newEnd,
            },
          })
        }
        // Reactivate trial as well
        const trial = await db.trial.findUnique({ where: { userId } })
        if (trial) {
          await db.trial.update({
            where: { userId },
            data: { active: true, endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
          })
        }
        await db.auditLog.create({
          data: {
            action: 'admin_unsuspend_user',
            actor: session.userId,
            target: userId,
            metadata: JSON.stringify({ username: targetUser.username }),
          },
        })
        return NextResponse.json({ ok: true, message: `User ${targetUser.username} unsuspended` })
      }

      case 'reset-workspace': {
        // Reset RPC config + game config to defaults
        await db.rpcConfig.updateMany({
          where: { userId },
          data: {
            name: '10X RPC',
            type: 'PLAYING',
            state: null,
            details: null,
            largeImage: null,
            largeText: null,
            smallImage: null,
            smallText: null,
            button1Label: null,
            button1Url: null,
            button2Label: null,
            button2Url: null,
            partyCurrent: null,
            partyMax: null,
            enabled: false,
          },
        })
        await db.gameRpcConfig.updateMany({
          where: { userId },
          data: { enabled: false },
        })
        await db.session.updateMany({
          where: { userId },
          data: {
            rpcEnabled: false,
            gamesRpcEnabled: false,
            customStatus: null,
            customStatusEmoji: null,
            vrStatusActive: false,
          },
        })
        await daemonStopUserRpc(userId)
        await db.auditLog.create({
          data: {
            action: 'admin_reset_workspace',
            actor: session.userId,
            target: userId,
            metadata: JSON.stringify({ username: targetUser.username }),
          },
        })
        return NextResponse.json({ ok: true, message: `Workspace reset for ${targetUser.username}` })
      }

      case 'delete-user': {
        // Cascade delete — removes sessions, rpcConfigs, trials, etc.
        await db.user.delete({ where: { id: userId } })
        await db.auditLog.create({
          data: {
            action: 'admin_delete_user',
            actor: session.userId,
            target: userId,
            metadata: JSON.stringify({ username: targetUser.username }),
          },
        })
        return NextResponse.json({ ok: true, message: 'User deleted' })
      }

      case 'apply-template': {
        const tpl = body.template
        if (!tpl?.name) {
          return NextResponse.json({ ok: false, error: 'missing template' }, { status: 400 })
        }
        const existing = await db.rpcConfig.findFirst({ where: { userId } })
        const tplData = {
          name: tpl.name,
          type: tpl.type || 'PLAYING',
          state: tpl.state || null,
          details: tpl.details || null,
        }
        if (existing) {
          await db.rpcConfig.update({ where: { id: existing.id }, data: tplData })
        } else {
          await db.rpcConfig.create({ data: { userId, ...tplData } })
        }
        await daemonSyncUser(userId)
        return NextResponse.json({ ok: true, message: `Template "${tpl.name}" applied` })
      }

      default:
        return NextResponse.json({ ok: false, error: `unknown action: ${action}` }, { status: 400 })
    }
  } catch (e) {
    console.error('admin/user-action error:', e)
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'unknown error',
    }, { status: 500 })
  }
}
