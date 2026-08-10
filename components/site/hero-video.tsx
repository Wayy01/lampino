"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

const EASE = [0.22, 1, 0.36, 1] as const;

// Poster (always works) shows instantly and stays visible if no video is present.
const POSTER =
  "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=2400&q=80";

// Bundled clip served from `public/hero.mp4` — used as the fallback whenever the
// production hero video (HeroContent.leftMediaUrl) isn't available.
const FALLBACK_VIDEO = "/hero.mp4";

export function HeroVideo({ videoUrl }: { videoUrl?: string | null }) {
  const t = useT();

  return (
    <section className="relative flex h-[68svh] min-h-[500px] items-center justify-center overflow-hidden">
      {/* Background video with poster fallback */}
      <video
        key={videoUrl ?? FALLBACK_VIDEO}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster={POSTER}
        aria-hidden
      >
        <source src={videoUrl || FALLBACK_VIDEO} type="video/mp4" />
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
          href="/products"
          className="group mt-10 inline-flex items-center gap-2 border-b border-background/40 pb-1 text-lg text-background transition-colors hover:border-primary hover:text-primary"
        >
          {t.hero.ctaPrimary}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </motion.div>
    </section>
  );
}
