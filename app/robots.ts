import type { MetadataRoute } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The CMS and the analytics endpoint have nothing to index. Filtered
        // catalog URLs stay crawlable on purpose — they carry a canonical back
        // to `/magazin`, and a blocked URL is a canonical Google never reads.
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    // Yandex-only directive, and Yandex matters for the Russian-language half
    // of this audience.
    host: SITE_URL,
  };
}
