// Fallback for images uploaded after the server started.
//
// `next start` snapshots the `public/` file list at boot, so a file the admin
// uploads later 404s through Next until the next restart. Browsers never
// notice (nginx serves /uploads straight from disk), but `/_next/image` fetches
// its source through Next itself — so every freshly uploaded product photo
// failed to optimize and showed up broken on the storefront. Files that did
// exist at boot are still served by Next's static handler and never reach
// this route.
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const ROOT = path.join(process.cwd(), "public", "uploads");

// Images only: this exists for the optimizer, and nginx owns everything else.
const TYPE_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const file = path.join(ROOT, ...(await params).path);
  const type = TYPE_BY_EXT[path.extname(file).toLowerCase()];
  // `path.join` resolves `..`, so anything that escapes the folder is refused.
  if (!type || !file.startsWith(ROOT + path.sep)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const body = await readFile(file);
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(body.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
