import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/routing";

const COOKIE = "lampino-lang";

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin lives at /admin/<locale>/...; redirect locale-less admin paths.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const rest = pathname.slice("/admin".length); // "" | "/login" | "/ro/..."
    if (isLocaleSegment(rest.split("/")[1])) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = `/admin/${detectLocale(request)}${rest}`;
    return NextResponse.redirect(url);
  }

  // Already locale-prefixed (`/ro`, `/ru`, or a deeper path)? Leave it alone.
  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  // Otherwise redirect to the detected locale, preserving path + query.
  const locale = detectLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals, API routes, static assets and the
  // metadata routes. `apple-icon` needs naming: it's the one crawler-facing
  // route with no file extension, so the trailing `.*\..*` rule misses it and
  // it would be redirected into a locale that has no such page.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
