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
    // Both root layouts sit behind a dynamic segment (`app/[lang]`,
    // `app/admin/[lang]`), so an unmatched URL has no layout Next can build a
    // 404 document from and it falls back to an unstyled error page.
    // `global-not-found` brings its own document, which is the documented
    // escape hatch for exactly this shape.
    globalNotFound: true,
  },
};

export default nextConfig;
