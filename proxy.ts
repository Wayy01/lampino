import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_HEADER, LOCALES } from "@/lib/i18n/routing";

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

/** Forward the resolved locale to the app; see `LOCALE_HEADER`. */
function withLocaleHeader(request: NextRequest, locale: string) {
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, locale);
  return NextResponse.next({ request: { headers } });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  // Run on everything except Next internals, API routes, and static assets.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
