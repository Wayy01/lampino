"use client";

import { motion } from "motion/react";
import { useT } from "@/lib/i18n/provider";
import { Reveal, MaskReveal } from "./reveal";

const EASE = [0.22, 1, 0.36, 1] as const;

export function LegalContent({ section }: { section: "terms" | "privacy" }) {
  const t = useT();
  const content = t[section];

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
          <span>{content.kicker}</span>
        </motion.div>

        <h1 className="font-display mt-7 text-[clamp(2.5rem,8vw,6rem)] font-light leading-[0.95] tracking-[-0.03em]">
          <MaskReveal delay={0.1}>{content.title}</MaskReveal>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
          className="mt-8 max-w-2xl text-xl leading-relaxed text-muted-foreground md:text-2xl"
        >
          {content.intro}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.45, ease: EASE }}
          className="label-mono mt-8 text-muted-foreground"
        >
          {content.updated}
        </motion.p>
      </div>

      <div className="mt-20 max-w-3xl border-t border-border md:mt-28">
        {content.body.map((block, i) => (
          <Reveal key={i} as="div" delay={i}>
            <div className="grid gap-3 border-b border-border py-10 md:grid-cols-[3rem_1fr] md:gap-8">
              <span className="font-display text-3xl font-light text-primary/30">
                0{i + 1}
              </span>
              <div>
                <h2 className="font-display text-2xl tracking-tight">
                  {block.h}
                </h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  {block.p}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
