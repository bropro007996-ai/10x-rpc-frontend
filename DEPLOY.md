# 10X RPC — Split Deployment Guide (Vercel + Render + Neon)

This guide deploys the **10X RPC** Discord Rich Presence panel as a split deployment:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Neon Postgres (shared)                       │
│            Users / Sessions / RpcConfig / Trials / ...              │
└───────────────────────────▲───────────────────────────▲────────────┘
                            │                           │
                            │ read/write                │ read/write + 24/7 gateway
                            │                           │
            ┌───────────────┴───────────┐   ┌───────────┴────────────────┐
            │  Vercel (frontend)        │   │  Render (backend daemon)   │
            │  • Next.js UI + /api/*    │   │  • index.js health server  │
            │  • OAuth flow             │   │  • 24/7 Discord Gateway     │
            │  • DB reads/writes        │   │    WebSocket connections   │
            │  • best-effort immediate  │   │  • status rotator ticks    │
            │    presence push          │   │  • token refresh           │
            │  • serverless (short-lived)│   │  • sleep-timer enforcement │
            └────────────▲──────────────┘   └────────────────────────────┘
                         │
                         │ browser
                         │
                    ┌────┴────┐
                    │  User   │
                    └─────────┘
```

- **Frontend (Vercel)** — Next.js 16 app. Handles UI, OAuth callback (`/auth/callback`), all `/api/*` routes, DB reads/writes. Serverless & short-lived.
- **Backend (Render)** — Lightweight Node.js daemon (`index.js` + `scripts/rpc-daemon-standalone.ts`). Runs 24/7, maintains persistent Discord Gateway WebSocket connections for every active user, ticks the status rotator, refreshes expired OAuth tokens, enforces sleep timers.
- **Database (Neon Postgres)** — shared by both services. Free tier is fine.

---

## ⚠️ BEFORE YOU START: Rotate compromised credentials

The tokens previously shared in chat (GitHub PAT, Vercel token, Render key, Discord secret + bot token) are compromised. **Rotate every one of them** before proceeding:

| Service | Where to rotate |
|---------|-----------------|
| GitHub | Settings → Developer settings → Personal access tokens → Regenerate/Revoke |
| Vercel | Settings → Tokens → Delete + create new |
| Render | Account → API Keys → Regenerate |
| Discord bot token | Developer Portal → your app → Bot → **Reset Token** |
| Discord client secret | Developer Portal → your app → OAuth2 → Client Secret → **Reset Secret** |

Enter the **fresh** values directly in the Vercel/Render dashboards — never in a chat.

---

## Step 1 — Provision Neon Postgres

1. Go to <https://neon.tech> and sign up (free).
2. Create a project named `10x-rpc`.
3. In the Neon dashboard → **Connection Details**, copy **two** strings:
   - **Pooled connection** → this is `DATABASE_URL`
   - **Direct connection** → this is `DATABASE_URL_UNPOOLED`
4. Keep both strings handy — you'll paste them into Vercel and Render.

> Neon sleeps after inactivity on the free tier. The 10X RPC session layer already retries 3× on `P1001` (database waking up), and the Render daemon's 30-second tick keeps it warm while users are active.

---

## Step 2 — Configure Discord OAuth

In the **Discord Developer Portal** → your application (`1549299168562905148`):

### 2a. OAuth2 → Redirects
You will add **one** redirect URI here — it must point to the **frontend (Vercel)** because `/auth/callback` is a Next.js API route that lives in the frontend repo:

```
https://<YOUR-VERCEL-URL>/auth/callback
```

You won't know the exact Vercel URL until after Step 3, so do this **after** your first Vercel deploy. Vercel gives you a stable `https://<project>.vercel.app` URL immediately on first deploy — use that.

> The URI must match **character-for-character** (https, no trailing slash). Discord will reject the OAuth flow otherwise.

### 2b. OAuth2 → General
- Copy **Client ID** → `1549299168562905148`
- Copy **Client Secret** (after rotating it) → `DISCORD_CLIENT_SECRET`

### 2c. Bot
- Copy the bot token (after resetting it) → `DISCORD_BOT_TOKEN`

### 2d. OAuth2 → URL Generator (for reference)
Scopes: `openid identify sdk.social_layer_presence`
The `sdk.social_layer_presence` scope is required for the Gaming SDK gateway — do not change it.

---

## Step 3 — Deploy the Frontend to Vercel

### 3a. Push to GitHub
Push this project (or the original `Sanjay007yt/10X-RPC-WEBSITE-OAUTH_V2` repo) to a **private** GitHub repo you own.

### 3b. Switch to Postgres schema
On your local machine (or in the repo):
```bash
bash scripts/use-postgres.sh
git add prisma/schema.prisma prisma/schema.prod.prisma prisma/schema.sqlite.bak scripts/
git commit -m "switch prisma to postgres for production"
git push
```
This swaps the SQLite sandbox schema for the Neon Postgres schema (with the correct `binaryTargets` for Vercel's serverless + Render's container).

### 3c. Connect to Vercel
1. Go to <https://vercel.com> → **New Project**.
2. **Import** your GitHub repo.
3. Framework preset: **Next.js** (auto-detected).
4. **Build & Output Settings** — leave defaults. The `postinstall: prisma generate` hook in `package.json` runs automatically.
5. **Environment Variables** — add every value from `.env.production.example`:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Neon **pooled** connection string |
| `DATABASE_URL_UNPOOLED` | Neon **direct** connection string |
| `SESSION_SECRET` | `openssl rand -hex 32` output (use the SAME value on Render) |
| `DISCORD_CLIENT_ID` | `1549299168562905148` |
| `DISCORD_CLIENT_SECRET` | fresh secret from Discord |
| `DISCORD_BOT_TOKEN` | fresh bot token |
| `DISCORD_SERVER_ID` | `1549302358926823496` |
| `DISCORD_INVITE_URL` | `https://discord.gg/JjsPqbWnrH` |
| `DISCORD_OAUTH_SCOPE` | `openid identify sdk.social_layer_presence` |
| `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` (after first deploy) |
| `DISCORD_REDIRECT_URI` | `https://<your-project>.vercel.app/auth/callback` |

> Vercel auto-sets `VERCEL=1`, which the instrumentation detects to skip the 24/7 daemon tick loop (Render owns that). API routes still do best-effort immediate presence pushes.

6. **Deploy**. Note the URL (`https://<your-project>.vercel.app`).
7. Go back to **Step 2a** and add `https://<your-project>.vercel.app/auth/callback` to the Discord OAuth2 Redirects.

### 3d. Push the database schema to Neon
Run once (locally, with the Neon `DATABASE_URL` exported in your shell):
```bash
export DATABASE_URL="postgres://...pooler..."
export DATABASE_URL_UNPOOLED="postgres://...direct..."
bun run db:push
```
This creates all tables (`User`, `Session`, `RpcConfig`, `GameConfig`, `RotatorPreset`, `GlobalConfig`, `Trial`, `OAuthState`) in Neon.

> Vercel does NOT run `db:push` automatically — you must run this once yourself. Subsequent deploys don't need it unless the schema changes.

---

## Step 4 — Deploy the Backend to Render

The backend is the repo `Sanjay007yt/10X-RPC-WEBSITE-OAUTH-BACKEND-SERVER_V2`. It is a self-contained Node.js project (`index.js` + `scripts/rpc-daemon-standalone.ts` + `src/lib/*` + `prisma/schema.prisma` with `provider = "postgresql"`).

### 4a. (Optional) Add a Render Blueprint
A ready-to-use `render.yaml` is provided at the root of this guide's source — copy it into the **root of the backend repo** and commit. Then in Render: **New → Blueprint → select the backend repo**. Render auto-creates the web service with the right build/start commands and health check.

Alternatively, deploy manually:

### 4b. Create the Render web service
1. Go to <https://dashboard.render.com> → **New +** → **Web Service**.
2. Connect your GitHub and select the backend repo.
3. Settings:
   - **Name**: `10x-rpc-backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Health Check Path**: `/health`
   - **Plan**: Free (or Starter for no sleep)
4. **Environment Variables** — same set as Vercel (see table below), with the **same** `SESSION_SECRET`:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Neon pooled (same as Vercel) |
| `DATABASE_URL_UNPOOLED` | Neon direct (same as Vercel) |
| `SESSION_SECRET` | **identical** to Vercel's value |
| `DISCORD_CLIENT_ID` | `1549299168562905148` |
| `DISCORD_CLIENT_SECRET` | same fresh secret |
| `DISCORD_BOT_TOKEN` | same fresh bot token |
| `DISCORD_SERVER_ID` | `1549302358926823496` |
| `DISCORD_INVITE_URL` | `https://discord.gg/JjsPqbWnrH` |
| `DISCORD_OAUTH_SCOPE` | `openid identify sdk.social_layer_presence` |
| `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` (Vercel URL) |
| `DISCORD_REDIRECT_URI` | `https://<your-project>.vercel.app/auth/callback` (Vercel URL) |

5. **Create Web Service**. Render builds + deploys.
6. Watch the logs — you should see:
   ```
   [10X RPC Server] HTTP Health check listening on 0.0.0.0:$PORT
   [10X RPC Server] Prisma Client ready.
   [10X RPC Server] Launching 24/7 Discord RPC & Status Daemon...
   [10X RPC Standalone Daemon] Running 24/7. Press Ctrl+C to stop.
   ```

> Render's free tier sleeps after 15 min of inactivity. The frontend pings `/api/keep-awake` every 10 min while a dashboard is open, but for true 24/7 use the **Starter** plan ($7/mo) is recommended.

---

## Step 5 — Verify the deployment

1. Visit `https://<your-project>.vercel.app` → landing page should render.
2. Click **Start 30 Days Free** → OAuth consent → **Authorize** → Discord redirects back to `/auth/callback` → you land on `#/dashboard`.
3. In the dashboard, configure a Rich Presence → toggle **ENABLE RPC** → click **UPDATE**.
4. Open Discord — your status / rich presence should appear within ~5 seconds (immediate push from Vercel) or at worst within 30 seconds (Render daemon tick).
5. Check Render logs — you should see `[10X RPC Daemon] Presence sent via Gaming SDK gateway` for your user.
6. Close the browser tab. Wait 5 minutes. Your Discord presence should **persist** (Render daemon keeps the gateway alive 24/7).

---

## Architecture notes

### Why split Vercel + Render?
Discord's Gaming SDK gateway requires **persistent WebSocket connections** with heartbeats every ~41 seconds. Vercel serverless functions freeze between requests and can't hold WebSockets open — so a separate long-lived process (Render) is mandatory for 24/7 presence.

### How the two services stay in sync
Both read/write the same Neon Postgres DB. The Vercel API routes write state changes (e.g. `rpcEnabled: true`) to the DB immediately. The Render daemon's `tick()` runs every 30 seconds, calls `syncAllUsers()` which queries the DB for active sessions, and connects/disconnects gateway sockets to match. So worst-case latency between a UI toggle and Discord showing the change is ~30 seconds; the Vercel `ensureDaemonRunning().syncUser()` call usually makes it instant.

### Session cookie sharing
The session token is an HMAC-signed string stored in a single `Session` row in Neon. Both Vercel and Render verify it against the same `SESSION_SECRET` — **this is why `SESSION_SECRET` must be identical on both**. The cookie itself is set on the Vercel domain (where the browser lives); Render never serves the browser, only reads the DB.

### OAuth callback flow (cross-domain)
1. Vercel `/auth/discord` → Discord authorize URL (redirect_uri = Vercel `/auth/callback`)
2. User authorizes → Discord redirects to Vercel `/auth/callback?code=…&state=…`
3. Vercel `/auth/callback` exchanges code, upserts user + session in Neon, redirects to `${NEXT_PUBLIC_APP_URL}/set-session?token=…`
4. Vercel `/set-session` sets the httpOnly cookie → `#/dashboard`

Render is not involved in the OAuth round-trip — it only consumes the resulting Discord access token from the DB to maintain the gateway.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| OAuth error `invalid_scope` | Discord app missing `sdk.social_layer_presence` scope | Re-add scope in Developer Portal, re-authorize |
| OAuth error `invalid_redirect_uri` | Mismatch between Discord Redirects and `DISCORD_REDIRECT_URI` | Make them character-identical (https, no trailing slash) |
| `Authentication failed — Discord rejected the OAuth2 token` (gateway close 4004) | Wrong scope, or token refresh failing | Ensure scope is `openid identify sdk.social_layer_presence`; check Render logs for refresh errors |
| Dashboard loads but RPC never appears on Discord | Render daemon not running, or no Discord access token | Check Render logs; ensure user signed in via Discord (not Demo Mode) |
| `database connection error` / `P1001` | Neon sleeping | First request retries 3×; Render tick keeps it warm. Upgrade Neon for always-on. |
| Session lost on page refresh | `SESSION_SECRET` differs between Vercel and Render | Make `SESSION_SECRET` identical on both services |

---

## Rollback to single-app sandbox (SQLite)

This sandbox currently runs the merged app on SQLite in demo mode. To keep using it locally:
```bash
bash scripts/use-sqlite.sh
bun run db:push
bun run dev
```
The production (Vercel + Render) deployment uses Postgres and is completely independent of this sandbox.
