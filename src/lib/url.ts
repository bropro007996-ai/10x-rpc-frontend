// 10X RPC — Request origin helper
// Derives the browser-visible origin (scheme://host) from an incoming request,
// respecting reverse-proxy headers (X-Forwarded-Host / X-Forwarded-Proto).
//
// This is used for ALL redirect responses so they work in every environment:
//   - localhost dev (http://localhost:3000)
//   - Vercel production (https://www.10xrpc.shop)
//   - The sandbox preview proxy (https://preview-*.space-z.ai) — Caddy forwards
//     the original Host + scheme via X-Forwarded-* headers.
//
// Previously redirects used CONFIG.app.url (a hardcoded env var) which broke
// sign-in whenever the browser's host differed from that env var — e.g. the
// demo-login flow redirected to http://localhost:3000/dashboard from a
// preview-*.space-z.ai page, which the browser could not reach.

export function requestOrigin(req: Request): string {
  const headers = req.headers
  const proto =
    headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const host =
    headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    headers.get('host') ||
    new URL(req.url).host
  return `${proto}://${host}`
}

// Build an absolute URL for a path on the current request's origin.
export function absoluteUrl(req: Request, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${requestOrigin(req)}${clean}`
}
