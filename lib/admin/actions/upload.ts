"use server";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, langFromForm } from "@/lib/admin/i18n";
import { UPLOAD_LIMITS_MB } from "@/lib/admin/media";

export type UploadResult = { url: string } | { error: string };

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

export async function uploadMedia(fd: FormData): Promise<UploadResult> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);
  const t = getAdminDict(lang).media;

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: t.failed };
  }

  const kind = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
      ? "video"
      : null;
  if (!kind) return { error: t.invalidType };

  const limitMb = UPLOAD_LIMITS_MB[kind];
  if (file.size > limitMb * 1024 * 1024) {
    return { error: `${t.tooLarge} (max ${limitMb}MB)` };
  }

  const ext =
    EXT_BY_MIME[file.type] ??
    path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const name = `${Date.now()}-${randomBytes(5).toString("hex")}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", `${kind}s`);

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

  return { url: `/uploads/${kind}s/${name}` };
}
