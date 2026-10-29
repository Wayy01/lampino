// Remote hosts `next/image` may load from — mirrors `remotePatterns` in
// `next.config.ts` (keep the two in sync). The admin validates image URLs
// against it, so an image the admin accepts is one the storefront can render.
export const REMOTE_IMAGE_HOSTS = [
  "images.unsplash.com",
  "plus.unsplash.com",
  // Legacy product images imported from the old Tilda-built site.
  "static.tildacdn.com",
] as const;
