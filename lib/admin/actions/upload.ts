"use server";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, langFromForm } from "@/lib/admin/i18n";
import { UPLOAD_LIMITS_MB } from "@/lib/admin/media";

export type UploadResult = { url: string } | { error: string };

// Uploads land in `public/`, so this is also the list of extensions we are
// willing to serve from our own origin. SVG is deliberately absent: it can
// carry script, and `MediaThumb` renders uploads unoptimized.
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

export async function uploadMedia(fd: FormData): Promise<UploadResult> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);
  const t = getAdminDict(lang).media;

  const file = fd.get("file");
  // Distinguish "you picked nothing" from "the file you picked has no bytes" —
  // the second usually means a broken transfer, and re-picking fixes it.
  if (!(file instanceof File)) return { error: t.noFile };
  if (file.size === 0) return { error: t.emptyFile };

  // The extension comes from the allow-list, never from the client-supplied
  // filename — otherwise `Content-Type: image/x-anything` plus `evil.html`
  // would write a same-origin HTML file into public/uploads.
  const ext = EXT_BY_MIME[file.type];
  if (!ext) return { error: `${t.invalidType} ${t.allowedTypes}` };

  const kind = file.type.startsWith("image/") ? "image" : "video";

  const limitMb = UPLOAD_LIMITS_MB[kind];
  if (file.size > limitMb * 1024 * 1024) {
    return { error: `${t.tooLarge} (max ${limitMb}MB)` };
  }

  const name = `${Date.now()}-${randomBytes(5).toString("hex")}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", `${kind}s`);

  // A full disk, a read-only mount or a missing `public/` all surface here.
  // Without this the write rejected straight out of the action and the upload
  // button just stopped spinning.
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: t.writeFailed };
  }

  return { url: `/uploads/${kind}s/${name}` };
}
