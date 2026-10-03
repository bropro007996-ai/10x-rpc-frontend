// 10X RPC Backend — Standalone configuration (no Next.js dependency)
// All secrets come from environment variables.

export const CONFIG = {
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    botToken: process.env.DISCORD_BOT_TOKEN || '',
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'https://www.10xrpc.shop/auth/discord/callback',
    scope: process.env.DISCORD_OAUTH_SCOPE || 'openid identify sdk.social_layer_presence',
    authorizeUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    apiBase: 'https://discord.com/api/v9',
    gatewayUrl: process.env.DISCORD_GATEWAY_URL || 'wss://gateway.discord.gg/?v=10&encoding=json',
    serverId: process.env.DISCORD_SERVER_ID || '1549302358926823496',
    inviteUrl: process.env.DISCORD_INVITE_URL || 'https://discord.gg/jr27qeCZU',
  },
  app: {
    name: '10X RPC',
    tagline: 'Premium Discord Rich Presence',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://www.10xrpc.shop',
    trialDays: 30,
  },
  session: {
    cookieName: '10x_rpc_session',
    ttlDays: 7,
    secret: process.env.SESSION_SECRET || '10x-rpc-dev-secret-change-me-in-production-32bytes-min',
  },
  admin: {
    discordIds: ['824940038617694279', '1526539220586467351'],
  },
  // HTTP server port (Pterodactyl allocates this)
  port: parseInt(process.env.SERVER_PORT || '3001', 10),
  // Secret token that the Vercel frontend uses to authenticate API calls
  backendSecret: process.env.BACKEND_SECRET || '',
}

export type AppConfig = typeof CONFIG
