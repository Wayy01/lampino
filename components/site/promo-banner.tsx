"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PromoBanner as PromoBannerData } from "@/lib/types";
import { useLang } from "@/lib/i18n/provider";
import { localePath } from "@/lib/i18n/routing";
import { pick, cn } from "@/lib/utils";

/**
 * The admin-controlled announcement strip. It sits above the fixed navbar,
 * which offsets itself by `--promo-h` — a variable the layout only sets when a
 * banner is actually rendered, so the default (banner off) layout is untouched.
 * Colours come from the DB, so they're inline styles rather than theme classes.
 */
export function PromoBanner({ banner }: { banner: PromoBannerData }) {
  const { lang } = useLang();

  const message = pick(lang, banner.message_ro, banner.message_ru);
  const cta = pick(lang, banner.ctaText_ro, banner.ctaText_ru);
  if (!message) return null;

  const href = banner.ctaLink.startsWith("http")
    ? banner.ctaLink
    : localePath(lang, banner.ctaLink);

  const visibility = banner.showOnMobile
    ? banner.showOnDesktop
      ? "flex"
      : "flex md:hidden"
    : "hidden md:flex";

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-[60] h-10 items-center justify-center gap-3 px-5 text-sm",
        visibility,
      )}
      style={{ backgroundColor: banner.backgroundColor, color: banner.textColor }}
    >
      <span className="truncate">{message}</span>
      {cta && (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1 border-b border-current/40 pb-px transition-colors hover:border-current"
        >
          {cta}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
