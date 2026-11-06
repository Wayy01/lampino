import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Resolved from node_modules at runtime: ffmpeg-static locates its binary
  // relative to its own file, heic-decode loads a wasm build of libheif.
  serverExternalPackages: ["ffmpeg-static", "heic-decode"],
  images: {
    // Upload filenames are unique and never edited in place, so an optimized
    // copy can live for a month. The 4h default sent every product nobody had
    // opened recently back through a slow cold resize.
    minimumCacheTTL: 2592000,
    // AVIF first (about 20% smaller than WebP for photos), WebP for browsers
    // without it. Encoded once per size and cached for the TTL above.
    formats: ["image/avif", "image/webp"],
    // Keep in sync with REMOTE_IMAGE_HOSTS in lib/media-hosts.ts, which the
    // admin validates image URLs against. (Not imported: a project import here
    // makes output tracing pull in the whole tree.)
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      // Legacy product images imported from the old Tilda-built site.
      { protocol: "https", hostname: "static.tildacdn.com" },
    ],
  },
  async redirects() {
    return [
      // The previous app's image sitemap, still registered in Search Console.
      // Images are listed in the main sitemap now.
      { source: "/sitemap-images.xml", destination: "/sitemap.xml", permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      // Media uploads use /api/upload; this only covers the larger admin
      // forms (product JSON payloads).
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
