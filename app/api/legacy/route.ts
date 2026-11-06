// Answers the 301 for a legacy URL (see lib/legacy-redirects.ts). `proxy.ts`
// rewrites matching requests here — the visitor's URL is unchanged, so the
// redirect goes straight from the old URL to the final canonical one.
import { NextResponse, type NextRequest } from "next/server";
import { isLocale } from "@/lib/i18n/routing";
import { resolveLegacyTarget } from "@/lib/data/legacy";
import { absoluteUrl } from "@/lib/seo";
import { LEGACY_HEADER, type LegacyTarget } from "@/lib/legacy-redirects";
import { parseId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const [lang = "", kind, rawId] = (request.headers.get(LEGACY_HEADER) ?? "").split(":");
  const id = parseId(rawId);
  if (!isLocale(lang) || id === null || (kind !== "product" && kind !== "category")) {
    return new NextResponse(null, { status: 404 });
  }
  const target: LegacyTarget = kind === "product" ? { product: id } : { category: id };
  return NextResponse.redirect(absoluteUrl(await resolveLegacyTarget(lang, target)), 301);
}
