"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, ArrowDown } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { formatEur } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero({ startingPrice }: { startingPrice: number }) {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const overlayY = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden"
    >
      {/* Cinematic background image */}
      <motion.div style={{ y: imageY }} className="absolute inset-0 -z-10">
        <div className="absolute inset-0 animate-ken-burns">
          <Image
            src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=2400&q=80"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/15 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/45 via-transparent to-transparent" />
      </motion.div>

      <motion.div
        style={{ y: overlayY, opacity: fade }}
        className="relative mx-auto w-full max-w-[1400px] px-5 pb-16 pt-32 sm:px-8 md:pb-24"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
          className="label-mono mb-7 text-foreground/70"
        >
          {t.hero.kicker}
        </motion.div>

        <h1 className="font-display text-[clamp(3rem,11vw,9.5rem)] font-light leading-[0.92] tracking-[-0.03em]">
          <Mask delay={0.15}>{t.hero.titleA}</Mask>
          <Mask delay={0.28}>
            <span className="italic text-primary">{t.hero.titleB}</span>
          </Mask>
        </h1>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
          className="mt-9 flex max-w-2xl flex-col gap-8 md:flex-row md:items-end md:justify-between"
        >
          <p className="max-w-md text-lg leading-relaxed text-foreground/80">
            {t.hero.subtitle}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.62, ease: EASE }}
          className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5"
        >
          <Button asChild size="lg" variant="primary" className="group">
            <Link href="/cars">
              {t.hero.ctaPrimary}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <div className="flex items-baseline gap-2">
            <span className="label-mono text-muted-foreground">
              {t.hero.priceFrom}
            </span>
            <span className="font-display text-3xl tracking-tight">
              {formatEur(startingPrice)}
            </span>
            <span className="label-mono text-muted-foreground">
              {t.hero.perDay}
            </span>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        style={{ opacity: fade }}
        className="pointer-events-none absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex"
      >
        <span className="label-mono text-muted-foreground">{t.hero.scroll}</span>
        <motion.span
          animate={{ y: [0, 7, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <ArrowDown className="h-4 w-4 text-muted-foreground" />
        </motion.span>
      </motion.div>
    </section>
  );
}

function Mask({
  children,
  delay,
}: {
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <span className="block overflow-hidden pb-[0.2em]">
      <motion.span
        initial={{ y: "110%" }}
        animate={{ y: 0 }}
        transition={{ duration: 1, delay, ease: EASE }}
        className="block"
      >
        {children}
      </motion.span>
    </span>
  );
}
