# Task: Admin API Routes for 10X RPC Premium Admin Panel

**Task ID:** `admin-api-routes`
**Agent:** Z.ai Code (single-agent task)
**Status:** ✅ Complete
**Date:** 2025

## Objective

Create the complete set of admin API routes under `src/app/api/admin/` for the premium
admin panel. All routes authenticate + authorize server-side using the existing `isAdmin`
pattern from `src/lib/config.ts`.

## Reference Files Read

- `src/app/api/admin/users/route.ts` — list users pattern (auth + isAdmin check + DB query)
- `src/app/api/admin/stats/route.ts` — minimal stats pattern (Promise.all aggregations)
- `src/app/api/admin/user-action/route.ts` — POST action pattern (body parsing + switch + audit)
- `src/app/api/admin/daemon-status/route.ts` — external fetch pattern with AbortController timeout
- `src/app/api/admin/force-rpc/route.ts` — long-running admin op pattern
- `src/app/api/payments/list/route.ts` — user-facing payments shape (mirror in admin route)
- `src/app/api/notifications/route.ts` — notification create/update pattern
- `src/lib/session.ts` — `getSession()` returns `session.user.discordId` and `session.userId`
- `src/lib/config.ts` — `CONFIG.admin.discordIds`, `CONFIG.render.backendUrl`, `CONFIG.render.healthPath`
- `src/lib/db.ts` — Prisma client singleton
- `src/lib/subscription.ts` — `activatePlan` pattern (used as reference, NOT directly imported)
- `prisma/schema.prisma` — models: User, Subscription, Payment, AuditLog, Announcement,
  SiteSettings (singleton, id="singleton"), Notification, Trial, Plan

## Files Created

1. `src/app/api/admin/payments/route.ts` — GET list with filters (`status`, `search`)
   + server-side pagination (`take`/`skip`). Search matches username, discordId,
   internalOrderId, razorpayOrderId, razorpayPaymentId. Includes joined user info.
   Caps `take` at 100.

2. `src/app/api/admin/subscriptions/route.ts` — GET list with status filter supporting
   `active | suspended | expired | cancelled | pending | expiring_soon`. Treats
   `suspended` as alias for `suspended` ∪ `cancelled` (column is `String`, not enum).
   `expiring_soon` = active + endsAt ≤ now+7days. Includes user info + daysLeft.

3. `src/app/api/admin/audit-logs/route.ts` — GET list with filters (`action`, `actor`,
   `target`) using case-insensitive `contains` matching. Pagination `take`/`skip`.
   Caps `take` at 200.

4. `src/app/api/admin/announcements/route.ts`
   - GET: list announcements, optional `active=true` filter + pagination
   - POST: create announcement (`type` ∈ info|update|warning|maintenance, `title`,
     `message`, `isActive`). Writes `announcement_created` audit log.

5. `src/app/api/admin/announcements/[id]/route.ts`
   - PUT: partial update of any subset of {type, title, message, isActive}
   - DELETE: remove announcement (404 if missing). Both log to audit trail.
   - Uses Next.js 16 `params: Promise<{ id }>` async-params pattern.

6. `src/app/api/admin/settings/route.ts`
   - GET: returns singleton row (auto-creates via `create` if missing)
   - PUT: `upsert` on `id: 'singleton'` so it always exists. Validates at least
     one field is provided. Writes `settings_changed` audit log.

7. `src/app/api/admin/health/route.ts` — runs 3 checks in parallel:
   - `database`: `db.user.count()` (with latencyMs)
   - `razorpay`: checks `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` env vars set
   - `daemon`: `fetch(${backendUrl}/health)` with 8s AbortController timeout
   Returns `{ database, razorpay, daemon, overall }` where `overall.ok = AND`
   of the three. `maxDuration = 15`.

8. `src/app/api/admin/send-notification/route.ts` — POST: validates `userIds[]`,
   `type`, `title`, `message` (all required). Validates users exist; reports
   `invalid` count back. Uses `db.notification.createMany` for batch insert.
   Logs `notification_sent` audit entry with recipient count.

9. `src/app/api/admin/grant-access/route.ts` — POST: validates `userId`, `planId`,
   `durationDays` (>0). Looks up target user (404 if missing). Computes
   `finalEndsAt` extending from existing sub's end if still active, else from now.
   Upserts `Subscription` with `status='active'`. Also upserts `Trial` row to keep
   `/api/me` + daemon consistent (mirrors `activatePlan`'s side effect).
   Writes `admin_access_grant` audit log including `reason` if provided.

## Patterns Used (Consistent Across All Routes)

- `import { NextResponse } from 'next/server'`
- `import { getSession } from '@/lib/session'`
- `import { db } from '@/lib/db'`
- `import { CONFIG } from '@/lib/config'`
- `export const dynamic = 'force-dynamic'` (all routes)
- Local `isAdmin(discordId)` helper:
  ```ts
  function isAdmin(discordId: string): boolean {
    return CONFIG.admin.discordIds.includes(discordId)
  }
  ```
- Auth check order: 401 (no session) → 403 (not admin) → business logic
- `try/catch` around all DB + body-parse logic; 500 with `e.message` on error
- `req.json().catch(() => ({}))` for safe body parsing
- All dates serialized via `.toISOString()`
- `take` clamped via `Math.min(Math.max(..., 1), cap)` to prevent abuse
- Prisma `Prisma.XWhereInput` typing for filter objects (type-safe AND flexible)
- Mutation endpoints (POST/PUT/DELETE/grant-access) write to `AuditLog` model

## Lint Result

`bun run lint` — ✅ passes clean, zero errors/warnings.

## Notes for Future Agents

- The `Subscription.status` column is `String` (not enum), so we can safely query
  for `status IN ['suspended', 'cancelled']` even though the schema comment only
  lists `active | expired | cancelled | pending`.
- `SiteSettings` uses `@id @default("singleton")` — every upsert must include
  `id: 'singleton'` in `where` + `create`.
- For Next.js 16 dynamic routes, params are async: `params: Promise<{ id: string }>`
  — must be `await`ed inside the handler.
- `db.notification.createMany` returns `{ count }` only (no records), so it's the
  right tool for broadcast fan-out.
- `db.auditLog.create` is fire-and-forget for non-critical paths; if it throws,
  the main mutation has already succeeded — wrapping in a try/catch inside the
  route's outer try is sufficient (the outer catch returns 500 but the DB write
  is already committed — acceptable for admin-only audit logging).
