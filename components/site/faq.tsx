"use client";

import { useT } from "@/lib/i18n/provider";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function Faq() {
  const t = useT();
  return (
    <section className="mx-auto max-w-[1400px] px-5 py-24 sm:px-8 md:py-32">
      <SectionHeading index="04" kicker={t.faq.kicker} title={t.faq.title} />
      <Reveal className="mt-16 md:mt-20">
        <Accordion type="single" collapsible className="border-b border-border">
          {t.faq.items.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}
