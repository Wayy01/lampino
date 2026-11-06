// Shrinks an uploaded image before it lands in public/uploads. Originals off a
// phone are 3–4 MB and 4000px wide; `next/image` has to decode every one of
// them on a cache miss, which on this box is ~2.5s per image and queues behind
// every other thumbnail on a product page. 2000px still covers the widest
// gallery slot at 2x DPR.
//
// Shared by the upload action and scripts/optimize-uploads.ts.
import sharp from "sharp";

export const MAX_IMAGE_EDGE = 2000;

type Ext = ".jpg" | ".jpeg" | ".png" | ".webp" | ".avif" | ".gif";

export type OptimizedImage = { data: Buffer; ext: string };

/**
 * Returns a resized, re-encoded copy plus the extension it should be saved
 * under, or the input untouched when re-encoding would not help. Same format
 * in, same format out — except an opaque PNG, which is almost always a photo
 * saved in the wrong format and comes out as JPEG at a fifth of the size.
 * Never throws on a decodable-but-odd file — it falls back to the original.
 */
export async function optimizeImage(input: Buffer, ext: string): Promise<OptimizedImage> {
  const e = ext.toLowerCase() as Ext;
  const original = { data: input, ext };
  // Animated GIFs would lose their frames; leave them alone.
  if (e === ".gif") return original;

  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    const oversized =
      (meta.width ?? 0) > MAX_IMAGE_EDGE || (meta.height ?? 0) > MAX_IMAGE_EDGE;
    const rotated = (meta.orientation ?? 1) !== 1;

    // `rotate()` bakes the EXIF orientation into the pixels before the
    // metadata is stripped, so phone portraits don't come out sideways.
    let pipeline = sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: MAX_IMAGE_EDGE,
        height: MAX_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      });

    let outExt = ext;
    if (e === ".png" && (await sharp(input, { failOn: "none" }).stats()).isOpaque) {
      pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
      outExt = ".jpg";
    } else if (e === ".jpg" || e === ".jpeg") pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
    else if (e === ".png") pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
    else if (e === ".webp") pipeline = pipeline.webp({ quality: 82 });
    else if (e === ".avif") pipeline = pipeline.avif({ quality: 55 });
    else return original;

    const data = await pipeline.toBuffer();
    // An already-small, already-upright file can come back bigger; keep it.
    if (!oversized && !rotated && data.length >= input.length) return original;
    return { data, ext: outExt };
  } catch {
    return original;
  }
}
