import { ImageResponse } from "next/og";
import { brandMarkDataUri } from "@/lib/brand-mark";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { LOCALES } from "@/lib/i18n/routing";

export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Nothing here depends on the locale, but the segment does — listing the params
// renders both cards at build time instead of on every crawler request.
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// The share card for every route that doesn't set its own image (product and
// rental pages point at their own photo). Wordmark only — Satori's bundled font
// is Latin-basic, so no Romanian diacritics and no Cyrillic here.
export default async function OpengraphImage() {
  const mark = await brandMarkDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#14110f",
          backgroundImage:
            "radial-gradient(circle at 16% 30%, rgba(240,179,82,0.26) 0%, rgba(240,179,82,0.09) 34%, rgba(20,17,15,0) 66%)",
          padding: 84,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
          <img src={mark} width={220} height={220} alt="" />
          <div style={{ fontSize: 116, color: "#f6f4ef", letterSpacing: "-0.04em" }}>
            {SITE_NAME}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ width: 180, height: 8, background: "#d0713e" }} />
          <div style={{ fontSize: 40, color: "#c9bcae", letterSpacing: "-0.01em" }}>
            {SITE_URL.replace(/^https?:\/\//, "")}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
