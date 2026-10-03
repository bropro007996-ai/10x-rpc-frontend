// 10X RPC — Activity logger helper (call from anywhere to record user/admin actions)
import { db } from '../db'
import { headers } from 'next/headers'

async function getClientIp(): Promise<string | null> {
  try {
    const h = await headers()
    return (
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      h.get('cf-connecting-ip') ||
      null
    )
  } catch {
    return null
  }
}

export interface ActivityPayload {
  userId?: string | null
  username?: string | null
  type: string          // login | logout | rpc_enabled | rpc_disabled | payment | signup | etc.
  category?: string     // user | payment | rpc | admin | system (default: user)
  metadata?: Record<string, unknown> | null
  ip?: string | null
}

export async function logActivity(payload: ActivityPayload): Promise<void> {
  try {
    await db.activityEvent.create({
      data: {
        userId: payload.userId || null,
        username: payload.username || null,
        type: payload.type,
        category: payload.category || 'user',
        ip: payload.ip !== undefined ? payload.ip : await getClientIp(),
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      },
    })
  } catch (e) {
    // Non-blocking — activity logging should never break the main flow
    console.error('logActivity error:', e)
  }
}
