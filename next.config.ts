import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return [
      { source: '/dashboard', destination: '/' },
      { source: '/profile', destination: '/' },
      { source: '/config', destination: '/' },
      { source: '/checkout', destination: '/' },
      { source: '/oauth-consent', destination: '/' },
      { source: '/admin', destination: '/' },
      { source: '/login', destination: '/' },
      { source: '/emoji-picker', destination: '/' },
    ];
  },
};

export default nextConfig;
