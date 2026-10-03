# 10X RPC Backend — 24/7 Daemon

A standalone Node.js backend that maintains persistent Discord Gateway WebSocket connections for all active users. Runs 24/7 on Orihost (Pterodactyl panel).

## Architecture

```
┌──────────────────────┐        ┌──────────────────────────────────┐
│  Vercel Frontend     │        │  Orihost Backend (this process)  │
│  (Next.js serverless)│        │  (24/7 long-lived Node.js)       │
│                      │──HTTP──│                                  │
│  /api/* routes       │  API   │  /health  → health check         │
│  call backend via    │        │  /sync-user?userId=xxx           │
│  fetch(backendUrl)   │        │  /stop-rpc?userId=xxx             │
│                      │        │  /force-push?userId=xxx           │
│                      │        │  /push-update?userId=xxx           │
└──────────────────────┘        │                                  │
                                │  24/7 Discord Gateway WebSocket  │
                                │  connections (in-memory)         │
                                └──────────────────────────────────┘
```

## Setup on Orihost (Pterodactyl Panel)

### 1. Create a server on Orihost

1. Log in to https://panel.orihost.com
2. Create a new server with:
   - **Egg**: Node.js (or Generic Node.js)
   - **Docker image**: `ghcr.io/pterodactyl/yolks:nodejs_20`
   - **Memory**: 512 MB minimum (1 GB recommended)
   - **Disk**: 1 GB
   - **Startup command**: `node --import tsx src/index.ts`

### 2. Upload the code

**Option A — Clone from GitHub:**
```
git clone https://github.com/bropro007996-ai/10x-rpc-frontend.git
cd 10x-rpc-frontend/backend
```

**Option B — Upload via SFTP:**
Upload the `backend/` folder contents to the server's root directory.

### 3. Install dependencies + generate Prisma client

In the server console:
```bash
npm install
npx prisma generate
```

### 4. Set environment variables

Set these in the Pterodactyl "Startup Variables" section or in a `.env` file:

```
DATABASE_URL=postgresql://USER:PASSWORD@ep-mute-tree-b3isbyhl-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
DISCORD_CLIENT_ID=1549299168562905148
DISCORD_CLIENT_SECRET=YOUR_DISCORD_CLIENT_SECRET
DISCORD_BOT_TOKEN=YOUR_DISCORD_BOT_TOKEN
DISCORD_SERVER_ID=1549302358926823496
DISCORD_OAUTH_SCOPE=openid identify sdk.social_layer_presence
SESSION_SECRET=10x-rpc-dev-secret-change-me-in-production-32bytes-min
NEXT_PUBLIC_APP_URL=https://www.10xrpc.shop
BACKEND_SECRET=<set a random secret here>
```

### 5. Start the server

Click "Start" in the Pterodactyl panel. The console should show:
```
[Backend] 24/7 RPC daemon starting...
[Backend] HTTP API server listening on port <SERVER_PORT>
[Backend] Endpoints: /health, /sync-user, /stop-rpc, /force-push, /push-update, /debug-daemon
```

### 6. Note the server URL

The backend URL will be: `http://<server-ip>:<server-port>`
Example: `http://92.118.206.201:30225`

### 7. Set BACKEND_URL on Vercel

Set the `BACKEND_URL` environment variable on Vercel to the Orihost server URL:
```
BACKEND_URL=http://92.118.206.201:30225
```

Also set `BACKEND_SECRET` on Vercel to match the backend's `BACKEND_SECRET`.

### 8. Redeploy Vercel

The Vercel frontend will now route all daemon operations to the Orihost backend instead of running them in-process.

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Public health check (uptime, daemon status) |
| `/sync-user?userId=xxx` | POST | Sync presence for a user (connect or push) |
| `/stop-rpc?userId=xxx` | POST | Stop RPC for a user (clear presence) |
| `/force-push?userId=xxx` | POST | Force reconnect + push (for platform changes) |
| `/push-update?userId=xxx` | POST | Fast path: reuse socket, just push OP 3 |
| `/debug-daemon` | GET | Admin debug: daemon internal state |
