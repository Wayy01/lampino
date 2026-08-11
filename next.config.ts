import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
  experimental: {
    serverActions: {
      // Admin media uploads (videos especially) go through a Server Action.
      bodySizeLimit: "200mb",
    },
  },
};

export default nextConfig;
