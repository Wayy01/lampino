"use client";

import { useT } from "@/lib/i18n/provider";
import { SectionHeading } from "./section-heading";
import { Reveal, RevealGroup } from "./reveal";

export function HowItWorks() {
  const t = useT();
  return (
    <section className="mx-auto max-w-[1400px] px-5 py-24 sm:px-8 md:py-32">
      <SectionHeading
        index="01"
        kicker={t.howItWorks.kicker}
        title={t.howItWorks.title}
      />

      <RevealGroup className="mt-16 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-border bg-border md:mt-20 md:grid-cols-3">
        {t.howItWorks.steps.map((step, i) => (
          <Reveal key={i} as="div" delay={i}>
            <div className="flex h-full flex-col bg-background p-8 md:p-10">
              <span className="font-display text-5xl font-light text-primary/30">
                0{i + 1}
              </span>
              <h3 className="font-display mt-8 text-2xl tracking-tight">
                {step.title}
              </h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {step.text}
              </p>
            </div>
          </Reveal>
        ))}
      </RevealGroup>
    </section>
  );
}
