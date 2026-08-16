// The Lampino bulb mark, as a data URI. `app/icon.svg` is the same glyph as a
// static favicon; the generated `apple-icon` and `opengraph-image` routes draw
// it through `<img>` because Satori (next/og) renders images, not raw SVG tags.

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<path d="M16 5.2a7.2 7.2 0 0 0-4.4 12.9c.9.7 1.4 1.7 1.5 2.8l.1.9h5.6l.1-.9c.1-1.1.6-2.1 1.5-2.8A7.2 7.2 0 0 0 16 5.2Z" fill="#d0713e"/>
<rect x="12.9" y="23.1" width="6.2" height="1.8" rx="0.9" fill="#14110f"/>
<rect x="13.9" y="26" width="4.2" height="1.7" rx="0.85" fill="#14110f"/>
</svg>`;

export const BRAND_MARK_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`;
