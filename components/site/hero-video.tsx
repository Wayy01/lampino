"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useLang, useT } from "@/lib/i18n/provider";
import { shopHref } from "@/lib/i18n/routing";

const EASE = [0.22, 1, 0.36, 1] as const;

// Poster (always works) shows instantly and stays visible if no video is present.
const DEFAULT_POSTER =
  "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=2400&q=80";

// Bundled clip served from `public/hero.mp4` — the ultimate fallback whenever the
// production hero video (HeroContent media) isn't available.
const FALLBACK_VIDEO = "/hero.mp4";

// The homepage hero shows a single background video. The schema stores two media
// slots; the data layer resolves the best video into `videoUrl` and passes the
// other media as `posterUrl`, shown before/if the video can't play.
export function HeroVideo({
  videoUrl,
  posterUrl,
}: {
  videoUrl?: string | null;
  posterUrl?: string | null;
}) {
  const t = useT();
  const { lang } = useLang();
  const src = videoUrl || FALLBACK_VIDEO;
  const poster = posterUrl || DEFAULT_POSTER;

  return (
    <section className="relative flex h-[68svh] min-h-[500px] items-center justify-center overflow-hidden">
      {/* Background video with poster fallback */}
      <video
        key={src}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster={poster}
        aria-hidden
      >
        <source src={src} type="video/mp4" />
      </video>

      {/* Dark warm overlay for text contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-foreground/70 via-foreground/50 to-foreground/75" />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-5 text-center text-background sm:px-8"
      >
        <div className="label-mono flex items-center gap-3 text-background/70">
          <span className="h-px w-8 bg-background/40" />
          <span>{t.hero.kicker}</span>
          <span className="h-px w-8 bg-background/40" />
        </div>

        <h1 className="font-display mt-7 text-[clamp(2.75rem,9vw,7rem)] font-light leading-[0.95] tracking-[-0.03em]">
          {t.hero.titleA}{" "}
          <span className="italic text-primary">{t.hero.titleB}</span>
        </h1>

        <Link
          href={shopHref(lang)}
          className="group mt-10 inline-flex items-center gap-2 border-b border-background/40 pb-1 text-lg text-background transition-colors hover:border-primary hover:text-primary"
        >
          {t.hero.ctaPrimary}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </motion.div>
    </section>
  );
}
