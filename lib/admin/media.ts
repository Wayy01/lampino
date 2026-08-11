// Shared media constants/helpers for the upload action and the picker UI.

// Size ceilings per kind; the client pre-checks these too so most oversized
// files never leave the browser.
export const UPLOAD_LIMITS_MB = { image: 10, video: 200 } as const;

export type MediaKind = keyof typeof UPLOAD_LIMITS_MB;

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i;

/** Best-effort guess used only to pick a preview (thumbnail vs. video icon). */
export function looksLikeVideo(url: string): boolean {
  return VIDEO_EXT.test(url);
}
