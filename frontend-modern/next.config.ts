import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || 'https://online-examination-system-u4uh.onrender.com';

const nextConfig: NextConfig = {
  // Allow images from any HTTPS source (for future asset loading)
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }, { protocol: 'http', hostname: '**' }],
  },
  // Proxy all /api/** requests server-side to the EB backend.
  // This eliminates Mixed Content errors — the browser only ever talks
  // to the Amplify HTTPS domain; Next.js forwards the call to EB internally.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
