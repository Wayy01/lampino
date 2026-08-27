"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { SpecularButton } from "@/components/ui/specular-button";
import { useLang, useT } from "@/lib/i18n/provider";
import { shopHref, isLocale, localePath, type Locale } from "@/lib/i18n/routing";
import { pick } from "@/lib/utils";
import { HeroLightbulb } from "@/components/site/hero-lightbulb";
import { BlurWord } from "@/components/site/blur-word";

const EASE = [0.22, 1, 0.36, 1] as const;
const DESKTOP = "(min-width: 1024px)";

// `HeroContent.leftButtonUrl` is stored without a locale prefix (e.g. `/magazin`).
// App-relative paths get the active locale segment; absolute URLs pass through.
function withLocale(lang: Locale, url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  if (!url.startsWith("/")) return url;
  const segment = url.split("/")[1];
  return isLocale(segment) ? url : localePath(lang, url);
}

/**
 * Two heroes, one per breakpoint.
 *
 * Phones get the split layout with the draggable light bulb; desktops get the
 * admin-uploaded hero video full-bleed, with the heading centred over it and
 * the call to action as a plain underlined link.
 *
 * Which one is *laid out* is decided in CSS (`lg:hidden` / `hidden lg:block`),
 * so the first paint is right before hydration. Which one is *mounted* is then
 * narrowed by a matchMedia check, so phones never download the video and
 * desktops never run the bulb's physics loop for a hidden element.
 */
export function Hero({
  videoUrl,
  posterUrl,
  buttonText_ro,
  buttonText_ru,
  buttonUrl,
}: {
  videoUrl?: string | null;
  posterUrl?: string | null;
  buttonText_ro?: string | null;
  buttonText_ru?: string | null;
  buttonUrl?: string | null;
}) {
  const t = useT();
  const { lang } = useLang();
  const ctaLabel = pick(lang, buttonText_ro, buttonText_ru) || t.hero.ctaPrimary;
  const ctaHref = buttonUrl ? withLocale(lang, buttonUrl) : shopHref(lang);

  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <>
      {/* Desktop: full-bleed video */}
      <section className="relative hidden h-[100svh] w-full overflow-hidden bg-foreground lg:block">
        {isDesktop && videoUrl ? (
          <video
            src={videoUrl}
            poster={posterUrl ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-deep via-foreground to-foreground" />
        )}

        {/* The heading sits on unpredictable footage, so it gets its own scrim
            rather than trusting the clip to stay dark behind the text. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-foreground/70 via-foreground/45 to-foreground/80"
        />

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          // The navbar is fixed and opaque, so the padding re-centres the copy
          // inside the part of the viewport that is actually visible.
          className="relative z-10 flex h-full flex-col items-center justify-center px-8 pt-[calc(var(--promo-h,0px)+5rem)] text-center"
        >
          <div className="label-mono flex items-center gap-3 text-background/70">
            <span className="h-px w-8 bg-background/35" />
            <span>{t.hero.kicker}</span>
            <span className="h-px w-8 bg-background/35" />
          </div>

          <h1
            aria-label={`${t.hero.titleStatic} ${t.hero.titleWords[0]}`}
            className="font-display mt-7 max-w-5xl text-[clamp(3rem,5.5vw,5.5rem)] font-light leading-[0.97] tracking-[-0.03em] text-background"
          >
            {t.hero.titleStatic} <BlurWord words={t.hero.titleWords} />
          </h1>

          {/* A link, not a button: the CTA reads as part of the copy. */}
          <Link
            href={ctaHref}
            className="group label-mono mt-10 inline-flex items-center gap-2 border-b border-background/40 pb-1 text-background transition-colors hover:border-background hover:text-background"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </section>

      {/* Mobile: split layout with the hanging bulb.
          overflow-x-clip, not overflow-hidden: the bulb's glow — and the bulb
          itself, once you drag it down — has to spill over the sections below,
          while a sideways swing still can't widen the page. z-10 keeps that
          spill painted above the later sections instead of under them. */}
      <section className="relative z-10 overflow-x-clip bg-background lg:hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-4 px-5 py-16 sm:px-8">
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

          <div className="relative order-first h-[360px] sm:h-[440px]">
            {isDesktop !== true && <HeroLightbulb />}
          </div>
        </div>
      </section>
    </>
  );
}
