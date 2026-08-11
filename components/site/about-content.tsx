"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useLang, useT } from "@/lib/i18n/provider";
import { shopHref } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { Reveal, MaskReveal } from "./reveal";

const EASE = [0.22, 1, 0.36, 1] as const;

export function AboutContent() {
  const t = useT();
  const { lang } = useLang();

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-28 pt-32 sm:px-8 md:pt-40">
      <div className="max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="label-mono flex items-center gap-3 text-muted-foreground"
        >
          <span className="text-primary">00</span>
          <span className="h-px w-8 bg-border" />
          <span>{t.about.kicker}</span>
        </motion.div>

        <h1 className="font-display mt-7 text-[clamp(2.5rem,8vw,6rem)] font-light leading-[0.95] tracking-[-0.03em]">
          <MaskReveal delay={0.1}>{t.about.title}</MaskReveal>
        </h1>
      </div>

      <div className="mt-24 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-border bg-border md:mt-32 md:grid-cols-3">
        {t.about.body.map((block, i) => (
          <Reveal key={i} as="div" delay={i}>
            <div className="flex h-full flex-col bg-background p-8 md:p-10">
              <span className="font-display text-5xl font-light text-primary/30">
                0{i + 1}
              </span>
              <h2 className="font-display mt-8 text-2xl tracking-tight">
                {block.h}
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                {block.p}
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-20 flex justify-center md:mt-28">
        <Button asChild size="lg" variant="ink" className="group">
          <Link href={shopHref(lang)}>
            {t.about.cta}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
      </Reveal>
    </div>
  );
}
