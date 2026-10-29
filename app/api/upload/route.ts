// Admin media upload. The raw file is the request body (not multipart), so it
// streams straight to a temp file instead of being buffered in memory — phone
// videos run to hundreds of MB. It lives under /api/upload because nginx gives
// that path a 300s timeout, which a video transcode needs; a Server Action
// would sit behind the default 60s.
import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getAdminSession } from "@/lib/admin/session";
import { adminDictionaries, type AdminLang } from "@/lib/admin/i18n";
import { UPLOAD_LIMITS_MB, type UploadResult } from "@/lib/admin/media";
import {
  UnreadableMediaError,
  classifyUpload,
  processImage,
  processVideo,
} from "@/lib/admin/process-upload";

export const dynamic = "force-dynamic";

class TooLargeError extends Error {}

function reply(body: UploadResult, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  const lang: AdminLang = request.headers.get("x-lang") === "ru" ? "ru" : "ro";
  const t = adminDictionaries[lang].media;

  if (!(await getAdminSession())) return reply({ error: t.failed }, 401);

  const fileName = decodeURIComponent(request.headers.get("x-file-name") ?? "");
  const type = classifyUpload(request.headers.get("content-type") ?? "", fileName);
  if (!type) return reply({ error: `${t.invalidType} ${t.allowedTypes}` }, 415);
  if (!request.body) return reply({ error: t.noFile }, 400);

  const limit = UPLOAD_LIMITS_MB[type.kind] * 1024 * 1024;
  if (Number(request.headers.get("content-length") ?? 0) > limit) {
    return reply({ error: `${t.tooLarge} (max ${UPLOAD_LIMITS_MB[type.kind]}MB)` }, 413);
  }

  const work = await mkdtemp(path.join(tmpdir(), "lampino-upload-"));
  try {
    // Stream to disk, enforcing the limit on the bytes actually received.
    const inPath = path.join(work, `in${type.ext}`);
    let received = 0;
    try {
      await pipeline(
        Readable.fromWeb(request.body as import("node:stream/web").ReadableStream),
        new Transform({
          transform(chunk: Buffer, _enc, cb) {
            received += chunk.length;
            cb(received > limit ? new TooLargeError() : null, chunk);
          },
        }),
        createWriteStream(inPath),
      );
    } catch (e) {
      if (e instanceof TooLargeError) {
        return reply({ error: `${t.tooLarge} (max ${UPLOAD_LIMITS_MB[type.kind]}MB)` }, 413);
      }
      return reply({ error: t.networkFailed }, 400);
    }
    if (received === 0) return reply({ error: t.emptyFile }, 400);

    const dir = path.join(process.cwd(), "public", "uploads", `${type.kind}s`);
    const base = `${Date.now()}-${randomBytes(5).toString("hex")}`;
    let name: string;

    try {
      await mkdir(dir, { recursive: true });
      if (type.kind === "image") {
        const { data, ext } = await processImage(inPath, type.ext);
        name = base + ext;
        await writeFile(path.join(dir, name), data);
      } else {
        // WebM plays everywhere as-is; everything else becomes H.264 MP4.
        const keep = type.ext === ".webm";
        const src = keep ? inPath : path.join(work, "out.mp4");
        if (!keep) await processVideo(inPath, src);
        name = base + (keep ? ".webm" : ".mp4");
        await copyFile(src, path.join(dir, name));
      }
    } catch (e) {
      if (e instanceof UnreadableMediaError) {
        return reply({ error: `${t.unreadable} ${t.allowedTypes}` }, 422);
      }
      console.error("[upload]", e);
      return reply({ error: t.writeFailed }, 500);
    }

    return reply({ url: `/uploads/${type.kind}s/${name}` });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
