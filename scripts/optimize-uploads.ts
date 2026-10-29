// One-off: run every image already in public/uploads through the same
// optimizeImage() the upload action now applies. Same-format results are
// rewritten in place (URL unchanged). An opaque PNG becomes a new .jpg beside
// it and every database column that mentions the old URL is repointed; the PNG
// itself is left on disk. Back the folder and database up first.
//
// Run with: bun scripts/optimize-uploads.ts
import { access, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma";
import { optimizeImage } from "../lib/admin/optimize-image";

const PUBLIC = path.join(process.cwd(), "public");
const ROOT = path.join(PUBLIC, "uploads");
const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i;

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (IMAGE_EXT.test(entry.name)) yield full;
  }
}

const exists = (p: string) => access(p).then(() => true, () => false);
const urlOf = (file: string) => "/" + path.relative(PUBLIC, file).split(path.sep).join("/");

let before = 0;
let after = 0;
let total = 0;
const renamed = new Map<string, string>();

for await (const file of walk(ROOT)) {
  total++;
  const input = await readFile(file);
  const ext = path.extname(file);
  const { data, ext: outExt } = await optimizeImage(input, ext);
  before += input.length;
  after += data.length;
  if (data === input) continue;

  let target = file;
  if (outExt !== ext) {
    target = file.slice(0, -ext.length) + outExt;
    // Never clobber an unrelated file that already has the new name.
    if (await exists(target)) target = file.slice(0, -ext.length) + "-opt" + outExt;
    renamed.set(urlOf(file), urlOf(target));
  }
  // Write beside, then rename: a reader never sees a half-written file.
  await writeFile(`${target}.tmp`, data);
  await rename(`${target}.tmp`, target);
  console.log(`${urlOf(target)}  ${(input.length / 1e6).toFixed(2)}MB → ${(data.length / 1e6).toFixed(2)}MB`);
}

console.log(`\n${total} images, ${(before / 1e6).toFixed(1)}MB → ${(after / 1e6).toFixed(1)}MB`);

if (renamed.size > 0) {
  const prisma = new PrismaClient();
  const columns = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string; data_type: string }[]>(
    `select table_name, column_name, data_type from information_schema.columns
     where table_schema = 'public' and data_type in ('text', 'character varying', 'jsonb', 'json')`,
  );
  let updated = 0;
  for (const [from, to] of renamed) {
    for (const c of columns) {
      const col = `"${c.column_name}"`;
      const value = c.data_type.startsWith("json") ? `replace(${col}::text, $1, $2)::${c.data_type}` : `replace(${col}, $1, $2)`;
      updated += await prisma.$executeRawUnsafe(
        `update "${c.table_name}" set ${col} = ${value} where ${col}::text like '%' || $1 || '%'`,
        from,
        to,
      );
    }
  }
  console.log(`${renamed.size} PNGs converted to JPEG, ${updated} database values repointed`);
  await prisma.$disconnect();
}
