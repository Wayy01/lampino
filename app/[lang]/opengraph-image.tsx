import { ImageResponse } from "next/og";
import { BRAND_MARK_DATA_URI } from "@/lib/brand-mark";
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
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f6f4ef",
          padding: 84,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <img src={BRAND_MARK_DATA_URI} width={124} height={124} alt="" />
          <div style={{ fontSize: 108, color: "#14110f", letterSpacing: "-0.04em" }}>
            {SITE_NAME}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ width: 180, height: 8, background: "#d0713e" }} />
          <div style={{ fontSize: 40, color: "#6b6259", letterSpacing: "-0.01em" }}>
            {SITE_URL.replace(/^https?:\/\//, "")}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
