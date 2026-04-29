import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Allow images from any HTTPS source (for future asset loading)
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
