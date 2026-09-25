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
      { source: '/oauth-consent', destination: '/' },
      { source: '/admin', destination: '/' },
      { source: '/login', destination: '/' },
    ];
  },
};

export default nextConfig;
