// One-off: download product images still hot-linked from the old Tilda site
// into public/uploads/products and point the rows at the local copy, so the
// storefront no longer depends on a third-party CDN keeping those files.
// Rows whose download fails are left untouched and listed at the end.
//
// Run with: bun scripts/localize-remote-images.ts
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma";
import { optimizeImage } from "../lib/admin/optimize-image";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

const prisma = new PrismaClient();
const dir = path.join(process.cwd(), "public", "uploads", "products");
await mkdir(dir, { recursive: true });

const rows = await prisma.productImage.findMany({
  where: { imageUrl: { contains: "tildacdn.com" } },
});

const failed: string[] = [];
for (const row of rows) {
  try {
    const res = await fetch(row.imageUrl, { signal: AbortSignal.timeout(30_000) });
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!res.ok || !EXT_BY_MIME[type]) throw new Error(`${res.status} ${type}`);

    const { data: bytes, ext } = await optimizeImage(
      Buffer.from(await res.arrayBuffer()),
      EXT_BY_MIME[type],
    );
    const name = `${Date.now()}-${randomBytes(5).toString("hex")}${ext}`;
    await writeFile(path.join(dir, name), bytes);
    await prisma.productImage.update({
      where: { id: row.id },
      data: { imageUrl: `/uploads/products/${name}` },
    });
    console.log(`#${row.id} ${row.imageUrl} → /uploads/products/${name}`);
  } catch (err) {
    failed.push(`#${row.id} ${row.imageUrl}: ${(err as Error).message}`);
  }
}

console.log(`\n${rows.length - failed.length}/${rows.length} localized`);
if (failed.length) console.log(`Failed:\n${failed.join("\n")}`);
await prisma.$disconnect();
