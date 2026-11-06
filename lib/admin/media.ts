// Shared media constants/helpers for the upload action and the picker UI.

// Size ceilings per kind; the client pre-checks these too so most oversized
// files never leave the browser. Sized for phone originals (a 48MP iPhone
// photo, a few minutes of 4K video). nginx's `client_max_body_size` for
// lampino.md must be at least the video limit.
export const UPLOAD_LIMITS_MB = { image: 30, video: 500 } as const;

export type UploadResult = { url: string } | { error: string };

export type MediaKind = keyof typeof UPLOAD_LIMITS_MB;

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i;

/** Best-effort guess used only to pick a preview (thumbnail vs. video icon). */
export function looksLikeVideo(url: string): boolean {
  return VIDEO_EXT.test(url);
}
