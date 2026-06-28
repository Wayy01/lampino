"use client";

import { ShieldCheck, Tag, BadgeCheck, MessageSquare } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { SectionHeading } from "./section-heading";
import { Reveal, RevealGroup } from "./reveal";

const ICONS = [ShieldCheck, Tag, BadgeCheck, MessageSquare];

export function WhyUs() {
  const t = useT();
  return (
    <section className="border-y border-border bg-muted/40">
      <div className="mx-auto max-w-[1400px] px-5 py-24 sm:px-8 md:py-32">
        <SectionHeading
          index="03"
          kicker={t.whyUs.kicker}
          title={t.whyUs.title}
        />

        <RevealGroup className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 md:mt-20 lg:grid-cols-4">
          {t.whyUs.items.map((item, i) => {
            const Icon = ICONS[i];
            return (
              <Reveal key={i} as="div" delay={i}>
                <div className="border-t border-foreground/15 pt-6">
                  <Icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
                  <h3 className="font-display mt-6 text-xl tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {item.text}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
