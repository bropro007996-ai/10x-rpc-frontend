// 10X RPC — /uptime page metadata (server component)
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'System Status — 10X RPC',
  description: 'Real-time uptime and health status for 10X RPC services: the app, Neon Postgres, and Discord API.',
  robots: { index: true, follow: true },
  openGraph: {
    title: '10X RPC System Status',
    description: 'Real-time health of all 10X RPC services.',
    type: 'website',
  },
}

export default function UptimeLayout({ children }: { children: React.ReactNode }) {
  return children
}
