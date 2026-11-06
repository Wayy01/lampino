"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { preload } from "react-dom";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useLang, useT } from "@/lib/i18n/provider";
import { shopHref, isLocale, localePath, type Locale } from "@/lib/i18n/routing";
import { pick } from "@/lib/utils";
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

/**
 * Full-height hero on every screen size: the admin-uploaded video full-bleed,
 * with the heading centred over it and the call to action as a plain
 * underlined link. Falls back to the poster, then to a gradient.
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
  // The poster is the home page's LCP image (a video's first frame isn't).
  // Without a preload the browser only finds it once it parses the <video>.
  if (posterUrl) preload(posterUrl, { as: "image", fetchPriority: "high" });

  // The hero video (several MB) starts downloading only once the page has
  // loaded, so it never competes with the HTML, fonts and scripts the first
  // paint needs. Until then the section shows its poster or dark background.
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  // `autoPlay` isn't reliably honoured for a src set after mount; start it.
  useEffect(() => {
    if (videoReady) videoRef.current?.play().catch(() => {});
  }, [videoReady]);
  useEffect(() => {
    if (!videoUrl) return;
    const start = () => setVideoReady(true);
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, [videoUrl]);

  return (
    <>
      <section className="relative h-[100svh] w-full overflow-hidden bg-foreground">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoReady ? videoUrl : undefined}
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
            fetchPriority="high"
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

        {/* Slide only, no fade: the heading is an LCP candidate, and text at
            opacity 0 doesn't count as painted until hydration runs. */}
        <motion.div
          initial={{ y: 18 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          // The navbar is fixed and opaque, so the padding re-centres the copy
          // inside the part of the viewport that is actually visible.
          className="relative z-10 flex h-full flex-col items-center justify-center px-5 pt-[calc(var(--promo-h,0px)+4rem)] text-center sm:px-8 md:pt-[calc(var(--promo-h,0px)+5rem)]"
        >
          <div className="label-mono flex items-center gap-3 text-background/70">
            <span className="h-px w-8 bg-background/35" />
            <span>{t.hero.kicker}</span>
            <span className="h-px w-8 bg-background/35" />
          </div>

          <h1
            aria-label={`${t.hero.titleStatic} ${t.hero.titleWords[0]}`}
            className="font-display mt-7 max-w-5xl text-[clamp(2.75rem,5.5vw,5.5rem)] font-light leading-[0.97] tracking-[-0.03em] text-background"
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

    </>
  );
}
