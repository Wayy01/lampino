// Turns a raw uploaded file into what the storefront serves. Phone media is
// the main customer: iPhones shoot HEIC photos and HEVC (often 10-bit HDR)
// .mov videos, which most browsers outside Safari cannot display. Photos are
// decoded and re-encoded as JPEG; videos are transcoded to H.264 MP4 capped
// at 1080p, which also cuts a 4K clip to a fraction of its size.
import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { optimizeImage } from "@/lib/admin/optimize-image";
import type { MediaKind } from "@/lib/admin/media";

// The stored extension always comes from these tables, never from the
// client-supplied filename — otherwise `evil.html` would be written into
// public/uploads and served from our own origin. SVG is deliberately absent:
// it can carry script.
const BY_MIME: Record<string, { kind: MediaKind; ext: string }> = {
  "image/jpeg": { kind: "image", ext: ".jpg" },
  "image/png": { kind: "image", ext: ".png" },
  "image/webp": { kind: "image", ext: ".webp" },
  "image/gif": { kind: "image", ext: ".gif" },
  "image/avif": { kind: "image", ext: ".avif" },
  "image/heic": { kind: "image", ext: ".heic" },
  "image/heif": { kind: "image", ext: ".heic" },
  "image/heic-sequence": { kind: "image", ext: ".heic" },
  "image/heif-sequence": { kind: "image", ext: ".heic" },
  "video/mp4": { kind: "video", ext: ".mp4" },
  "video/webm": { kind: "video", ext: ".webm" },
  "video/quicktime": { kind: "video", ext: ".mov" },
  "video/x-m4v": { kind: "video", ext: ".mp4" },
  "video/3gpp": { kind: "video", ext: ".mp4" },
};

// Fallback when the browser sends no MIME type — Chrome on Windows does this
// for .heic files copied off an iPhone.
const BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  webm: "video/webm",
  mov: "video/quicktime",
  "3gp": "video/3gpp",
};

export function classifyUpload(
  mime: string,
  fileName: string,
): { kind: MediaKind; ext: string } | null {
  const byMime = BY_MIME[mime.toLowerCase()];
  if (byMime) return byMime;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const fallback = BY_EXT[ext];
  return fallback ? BY_MIME[fallback] : null;
}

export class UnreadableMediaError extends Error {}

/** Image file → optimized bytes plus final extension. HEIC comes out as JPEG. */
export async function processImage(
  filePath: string,
  ext: string,
): Promise<{ data: Buffer; ext: string }> {
  const input = await readFile(filePath);
  if (ext !== ".heic") {
    // optimizeImage passes undecodable input through untouched; reject it
    // here instead of storing a non-image under an image extension.
    const meta = await sharp(input, { failOn: "none" }).metadata().catch(() => null);
    if (!meta?.width) throw new UnreadableMediaError();
    return optimizeImage(input, ext);
  }

  // sharp's bundled libheif only decodes AVIF, not HEVC-coded HEIC, so the
  // pixels come from libheif compiled to wasm.
  let decoded: { width: number; height: number; data: ArrayLike<number> };
  try {
    const { default: decode } = await import("heic-decode");
    decoded = await decode({ buffer: input });
  } catch {
    throw new UnreadableMediaError();
  }
  const jpeg = await sharp(Buffer.from(decoded.data as Uint8ClampedArray), {
    raw: { width: decoded.width, height: decoded.height, channels: 4 },
  })
    .jpeg({ quality: 92 })
    .toBuffer();
  return optimizeImage(jpeg, ".jpg");
}

export const MAX_VIDEO_EDGE = 1920;

function run(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg binary missing"));
    // Lower priority so a transcode doesn't starve the storefront.
    const child = spawn("nice", ["-n", "10", ffmpegPath, ...args]);
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr = (stderr + d).slice(-20_000);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

/**
 * Video file → H.264/AAC MP4 at `outPath`. WebM is left as-is (every browser
 * that matters plays it); everything else is transcoded so HEVC, odd
 * containers and huge bitrates never reach visitors.
 */
export async function processVideo(inPath: string, outPath: string): Promise<void> {
  // `ffmpeg -i` with no output exits non-zero but prints the stream info.
  const probe = await run(["-hide_banner", "-i", inPath]);
  if (!/Stream #.*Video:/.test(probe.stderr)) throw new UnreadableMediaError();

  // iPhone HDR (HLG / Dolby Vision) looks washed out when squeezed into
  // 8-bit SDR naively; tone-map it first.
  const hdr = /arib-std-b67|smpte2084/.test(probe.stderr);
  const scale = `scale='if(gt(iw,ih),min(${MAX_VIDEO_EDGE},iw),-2)':'if(gt(iw,ih),-2,min(${MAX_VIDEO_EDGE},ih))'`;
  const filters = hdr
    ? `zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,${scale}`
    : `${scale},format=yuv420p`;

  const { code, stderr } = await run([
    "-hide_banner",
    "-y",
    "-i", inPath,
    "-map", "0:v:0",
    "-map", "0:a:0?",
    "-vf", filters,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-profile:v", "high",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ac", "2",
    "-map_metadata", "-1",
    "-movflags", "+faststart",
    outPath,
  ]);
  if (code !== 0) {
    console.error("[upload] ffmpeg failed:", stderr.slice(-2000));
    throw new UnreadableMediaError();
  }
  if ((await stat(outPath)).size === 0) throw new UnreadableMediaError();
}
