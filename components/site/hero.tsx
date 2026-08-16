"use client";

import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { SpecularButton } from "@/components/ui/specular-button";
import { useLang, useT } from "@/lib/i18n/provider";
import { shopHref, isLocale, localePath, type Locale } from "@/lib/i18n/routing";
import { pick } from "@/lib/utils";
import { HeroLightbulb } from "@/components/site/hero-lightbulb";
import { BlurWord } from "@/components/site/blur-word";

const EASE = [0.22, 1, 0.36, 1] as const;

// `HeroContent.leftButtonUrl` is stored without a locale prefix (e.g. `/magazin`).
// App-relative paths get the active locale segment; absolute URLs pass through.
function withLocale(lang: Locale, url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  if (!url.startsWith("/")) return url;
  const segment = url.split("/")[1];
  return isLocale(segment) ? url : localePath(lang, url);
}

// Split hero: heading + CTA on the left, a draggable, physics-driven light
// bulb hanging on a cord on the right. No video, no dark overlay — the page
// stays on the site's single warm-white surface.
export function Hero({
  buttonText_ro,
  buttonText_ru,
  buttonUrl,
}: {
  buttonText_ro?: string | null;
  buttonText_ru?: string | null;
  buttonUrl?: string | null;
}) {
  const t = useT();
  const { lang } = useLang();
  const ctaLabel = pick(lang, buttonText_ro, buttonText_ru) || t.hero.ctaPrimary;
  const ctaHref = buttonUrl ? withLocale(lang, buttonUrl) : shopHref(lang);

  // overflow-x-clip, not overflow-hidden: the bulb's glow — and the bulb
  // itself, once you drag it down — has to spill over the sections below,
  // while a sideways swing still can't widen the page. z-10 keeps that spill
  // painted above the later sections instead of under them.
  return (
    <section className="relative z-10 overflow-x-clip bg-background">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-4 px-5 py-16 sm:px-8 lg:min-h-[640px] lg:grid-cols-2 lg:gap-8 lg:py-0">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="relative z-10 flex flex-col items-start text-left"
        >
          <div className="label-mono flex items-center gap-3 text-muted-foreground">
            <span className="h-px w-8 bg-foreground/25" />
            <span>{t.hero.kicker}</span>
          </div>

          {/* aria-label pins the heading's accessible name to the canonical
              phrase while the last word cycles, without duplicating the word
              in the DOM the way a visible + sr-only pair would. */}
          <h1
            aria-label={`${t.hero.titleStatic} ${t.hero.titleWords[0]}`}
            className="font-display mt-7 text-[clamp(2.75rem,6.5vw,5.25rem)] font-light leading-[0.97] tracking-[-0.03em] text-foreground"
          >
            {t.hero.titleStatic} <BlurWord words={t.hero.titleWords} />
          </h1>

          <SpecularButton href={ctaHref} className="mt-9">
            {ctaLabel}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </SpecularButton>
        </motion.div>

        <div className="relative order-first h-[360px] sm:h-[440px] lg:order-last lg:h-[640px]">
          <HeroLightbulb />
        </div>
      </div>
    </section>
  );
}
