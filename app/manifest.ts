import type { MetadataRoute } from "next";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, localePath } from "@/lib/i18n/routing";
import { SITE_NAME } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  const meta = dictionaries[DEFAULT_LOCALE].meta;
  return {
    name: meta.title,
    short_name: SITE_NAME,
    description: meta.description,
    start_url: localePath(DEFAULT_LOCALE),
    scope: "/",
    display: "standalone",
    lang: DEFAULT_LOCALE,
    background_color: "#f6f4ef",
    theme_color: "#d0713e",
    icons: [
      { src: "/icon.png", sizes: "96x96", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
