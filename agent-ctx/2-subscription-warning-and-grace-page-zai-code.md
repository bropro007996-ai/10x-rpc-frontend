# Task 2 — zai-code (subscription-warning-and-grace-page)

## Goal
Create two new subscription-system components without modifying any existing files:
1. `src/components/tenx/ExpiryWarning.tsx` — dashboard warning banner
2. `src/components/tenx/GracePeriodPage.tsx` — full-screen expired/grace-period page

## Context gathered
- **Project**: 10X RPC Discord Rich Presence — Next.js 16 + Tailwind 4 dark theme + Prisma (SQLite) + shadcn/ui (New York).
- **Custom CSS utilities** in `src/app/globals.css`: `glass-card`, `glass-card-inner`, `purple-gradient`, `purple-glow`, `text-glow`. Background `#0a0b0f` with purple radial gradients.
- **`tw-animate-css`** is imported → `animate-in`, `fade-in-0`, `slide-in-from-top-N`, `slide-in-from-bottom-N`, `duration-N` utilities available.
- **`useRouter`** hook (`src/components/tenx/useRouter.ts`) exposes `{ navigate }` over the Route union: `{ home, dashboard, profile, config, oauth-consent, admin }`. Navigation pushes history state and dispatches a synthetic `popstate` event.
- **`Me` type** (`src/lib/api-client.ts`) has optional `subscription?: { active, plan, planName, endsAt, daysLeft, isTrial, isLifetime, autoRenew }`.
- **`DashboardPage.tsx`** renders sections with id anchors (`#subscription`, `#profile`, `#rpc-settings`, `#games-rpc`) and polls `me` every 4 minutes — useful for re-evaluating time-based logic.
- Existing components avoid blue/indigo colors. Discord link in `DashboardPage` is themed purple (`bg-purple-500/15 border-purple-500/30 text-purple-300`), not Discord blurple.

## ExpiryWarning.tsx — design
- Props: `{ me: Me }`.
- Eligibility gate: `subscription.active && !isTrial && !isLifetime && 0 <= daysLeft <= 7`.
- Urgency buckets (`levelFor`):
  - `expired`  (daysLeft ≤ 0) → red banner, copy "Your subscription has expired. Renew now to restore uninterrupted access."
  - `critical` (daysLeft = 1) → red pulsing, copy "...expires in 1 day. Renew now to protect uninterrupted access."
  - `urgent`   (daysLeft 2–3) → orange, copy "...expires in 3 days..."
  - `warning`  (daysLeft 4–7) → amber, copy "...expires in 7 days..."
- Dismissal: X button writes `Date.now()` to localStorage key `tenx:expiry-warning-dismissed`. TTL 24h. Reappears automatically because:
  1. `dismissedAt` is read lazily in `useState` initializer (client-only; returns 0 on SSR).
  2. `isDismissed = dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_TTL` is recomputed every render — the dashboard's 4-minute `me` polling triggers re-renders, so a stale dismissal naturally re-shows the banner.
- **No `useEffect` setState** — passes `react-hooks/set-state-in-effect` lint rule (initial attempt failed with `setMounted(true)`).
- Entrance: `animate-in fade-in-0 slide-in-from-top-8 duration-500 ease-out`.
- Buttons: "Renew Now" (Crown, purple-gradient) + "Upgrade Plan" (Zap, glass) — both navigate to dashboard then smooth-scroll `#subscription` into view.
- a11y: `role="alert"`, `aria-live="polite"`, `aria-label="Dismiss warning"`.

## GracePeriodPage.tsx — design
- Props: `{ expiresAt: string }` (ISO date of subscription expiry).
- Grace window = `new Date(expiresAt).getTime() + 7 * 24 * 60 * 60 * 1000`.
- Live countdown: `setInterval(tick, 1000)` updates `{ days, hours, minutes, seconds }`; re-syncs when `expiresAt` changes (effect deps).
- Layout: `min-h-screen bg-[#0a0b10]` with ambient purple/red radial blur glow.
  - Suspended badge (red, pulsing dot, uppercase tracked).
  - Red `AlertTriangle` icon tile + heading "Your Subscription Has Expired".
  - Body copy: "Your previous configuration is temporarily preserved. Renew before the countdown reaches zero to restore your workspace."
  - `glass-card` countdown card: 4-unit grid (Days/Hours/Minutes/Seconds) using `glass-card-inner` tiles, `font-mono tabular-nums`, 2-digit zero-pad.
  - Amber warning panel: "If you do not renew before the grace period ends, your preserved workspace and configuration will be permanently deleted."
  - Buttons (grid 1col on mobile, 2col on sm+): "Renew Now" (Crown, purple-gradient → dashboard), "View Plans" (Eye, glass → dashboard + scroll #subscription).
  - Discord/Support: external `<a>` to `https://discord.gg/jr27qeCZU` (Gift icon + ExternalLink), purple-themed.
  - Staggered entrance animations: badge (fade), heading (slide-from-bottom-2), card + buttons + Discord (slide-from-bottom-4).

## Lint & runtime
- Initial `bun run lint` → 1 error: `react-hooks/set-state-in-effect` on `setMounted(true)` inside `useEffect`. Fixed by removing the mounted guard entirely (parent only mounts these components after client-side async fetch, so SSR for them is a non-issue) and using a lazy `useState` initializer for `dismissedAt` instead.
- Re-ran `bun run lint` → **clean**.
- `dev.log` → no errors; Next.js 16.1.3 turbopack Ready, demo mode active.

## Files created (only new files; no edits to existing)
- `src/components/tenx/ExpiryWarning.tsx`
- `src/components/tenx/GracePeriodPage.tsx`

## Wiring notes (for next agent)
- Render `<ExpiryWarning me={me} />` near the top of the dashboard content area (above `<QuickStats>` or `<ProfileSection>`) — it returns `null` when ineligible.
- Render `<GracePeriodPage expiresAt={me.subscription?.endsAt ?? new Date(0).toISOString()} />` (full-screen replacement) when `me.subscription?.active === false` AND now is within the 7-day grace window. Otherwise fall back to normal dashboard.
- Both components rely on `useRouter` from `./useRouter` (same dir).
EOF
