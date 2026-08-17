// The real Lampino logo, as a data URI. `app/apple-icon.png` is the same file
// Apple serves as the touch icon and the highest-resolution copy of the logo in
// the repo; the generated `opengraph-image` route draws it through an `<img>`
// because Satori (next/og) renders images, not raw SVG tags.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function brandMarkDataUri(): Promise<string> {
  const png = await readFile(join(process.cwd(), "app/apple-icon.png"));
  return `data:image/png;base64,${png.toString("base64")}`;
}
