import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_HEADER, LOCALES } from "@/lib/i18n/routing";
import { LEGACY_HEADER, legacyTarget } from "@/lib/legacy-redirects";

const COOKIE = "lampino-lang";

// Same default as `SITE_URL` in lib/seo.ts (not imported, to keep this file
// dependency-free). `www.<host>` is folded into it with a 301 so search engines
// see exactly one origin; any other host (localhost, staging) is left alone.
const CANONICAL_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lampino.md").replace(/\/+$/, "");
const WWW_HOST = `www.${new URL(CANONICAL_ORIGIN).host}`;

// Pick a locale from the saved cookie, then the Accept-Language header,
// falling back to the default. Kept dependency-free so it can run at the edge.
function detectLocale(request: NextRequest): string {
  const cookie = request.cookies.get(COOKIE)?.value;
  if (cookie && LOCALES.includes(cookie as (typeof LOCALES)[number])) {
    return cookie;
  }
  const header = request.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (LOCALES.includes(code as (typeof LOCALES)[number])) return code;
  }
  return DEFAULT_LOCALE;
}

const isLocaleSegment = (segment: string | undefined) =>
  LOCALES.includes(segment as (typeof LOCALES)[number]);

/** Forward the resolved locale to the app; see `LOCALE_HEADER`. */
function withLocaleHeader(request: NextRequest, locale: string) {
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, locale);
  return NextResponse.next({ request: { headers } });
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // URLs from the old Tilda shop and renamed pages: one 301 to where they live
  // now. Path targets are answered here; product/category targets need the
  // live slug, so `/api/legacy` looks it up and answers instead.
  const legacy = legacyTarget(pathname);
  if (legacy) {
    const prefix = pathname.split("/")[1];
    const locale = isLocaleSegment(prefix) ? prefix : detectLocale(request);
    if ("path" in legacy) {
      return NextResponse.redirect(`${CANONICAL_ORIGIN}/${locale}${legacy.path}`, 301);
    }
    // The target travels in a header: a rewritten route handler still sees the
    // visitor's original URL, query string included.
    const headers = new Headers(request.headers);
    headers.set(
      LEGACY_HEADER,
      "product" in legacy ? `${locale}:product:${legacy.product}` : `${locale}:category:${legacy.category}`,
    );
    const url = request.nextUrl.clone();
    url.pathname = "/api/legacy";
    url.search = "";
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // `www.` → canonical origin, in one hop: a locale-less path gets its locale
  // here too rather than bouncing through a second redirect.
  if (request.headers.get("host") === WWW_HOST) {
    const current = pathname.split("/")[1];
    const path =
      isLocaleSegment(current) || pathname === "/admin" || pathname.startsWith("/admin/")
        ? pathname
        : `/${detectLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(`${CANONICAL_ORIGIN}${path}${search}`, 301);
  }

  // Admin lives at /admin/<locale>/...; redirect locale-less admin paths.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const rest = pathname.slice("/admin".length); // "" | "/login" | "/ro/..."
    const adminLocale = rest.split("/")[1];
    if (isLocaleSegment(adminLocale)) {
      return withLocaleHeader(request, adminLocale);
    }
    const url = request.nextUrl.clone();
    url.pathname = `/admin/${detectLocale(request)}${rest}`;
    return NextResponse.redirect(url);
  }

  // Already locale-prefixed (`/ro`, `/ru`, or a deeper path)? Leave it alone.
  const current = LOCALES.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (current) return withLocaleHeader(request, current);

  // Otherwise redirect to the detected locale, preserving path + query.
  const locale = detectLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals, API routes, static assets and the
  // metadata routes. The icons are now static files, so the trailing `.*\..*`
  // rule already covers them; they stay named for clarity.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|robots.txt|sitemap.xml|.*\\..*).*)",
    // Old Tilda standalone pages; the rule above skips anything with a dot.
    "/:page(page\\d+\\.html)",
  ],
};
