"use client";

import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import type { ContactSettings } from "@/lib/types";
import { useLang, useT } from "@/lib/i18n/provider";
import { pick } from "@/lib/utils";
import { Reveal, MaskReveal } from "./reveal";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The shop's real, geocodable address. Kept out of the database on purpose:
 * `ContactSettings.address_*` is admin-editable display copy in two languages,
 * and a map query has to stay a single string Google can actually resolve.
 */
const MAP_QUERY = "Strada 31 August 1989 58, Chișinău MD-2023, Moldova";
const MAP_EMBED = `https://www.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&output=embed`;
const MAP_LINK = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAP_QUERY)}`;

export function ContactContent({ contact }: { contact: ContactSettings | null }) {
  const t = useT();
  const { lang } = useLang();
  const c = t.contact;

  const hours = contact
    ? pick(lang, contact.businessHours_ro, contact.businessHours_ru)
    : null;

  const socials = contact
    ? ([
        ["Facebook", contact.facebookUrl],
        ["Instagram", contact.instagramUrl],
        ["TikTok", contact.tiktokUrl],
      ] as const).filter(([, url]) => url)
    : [];

  // Phone/email/hours come from the database; the address is the constant
  // above so the text and the pin below it can never disagree.
  const rows: { label: string; value: React.ReactNode }[] = [
    contact?.phone && {
      label: c.phone,
      value: (
        <a
          href={`tel:${contact.phone.replace(/\s/g, "")}`}
          className="transition-colors hover:text-primary"
        >
          {contact.phone}
        </a>
      ),
    },
    contact?.email && {
      label: c.email,
      value: (
        <a
          href={`mailto:${contact.email}`}
          className="transition-colors hover:text-primary"
        >
          {contact.email}
        </a>
      ),
    },
    { label: c.address, value: MAP_QUERY },
    hours && { label: c.hours, value: hours },
    socials.length > 0 && {
      label: c.follow,
      value: (
        <span className="flex flex-wrap gap-x-5 gap-y-2">
          {socials.map(([name, url]) => (
            <a
              key={name}
              href={url!}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 transition-colors hover:text-primary"
            >
              {name}
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          ))}
        </span>
      ),
    },
  ].filter(Boolean) as { label: string; value: React.ReactNode }[];

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
          <span>{c.kicker}</span>
        </motion.div>

        <h1 className="font-display mt-7 text-[clamp(2.5rem,8vw,6rem)] font-light leading-[0.95] tracking-[-0.03em]">
          <MaskReveal delay={0.1}>{c.title}</MaskReveal>
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.45, ease: EASE }}
          className="label-mono mt-8 text-muted-foreground"
        >
          {c.updated}
        </motion.p>
      </div>

      <div className="mt-20 max-w-3xl border-t border-border md:mt-28">
        {rows.map((row, i) => (
          <Reveal key={row.label} as="div" delay={i}>
            <div className="grid gap-3 border-b border-border py-10 md:grid-cols-[3rem_1fr] md:gap-8">
              <span className="font-display text-3xl font-light text-primary/30">
                0{i + 1}
              </span>
              <div>
                <h2 className="label-mono text-muted-foreground">{row.label}</h2>
                <div className="font-display mt-3 text-2xl tracking-tight">
                  {row.value}
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal as="div" className="mt-16 md:mt-20">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted">
          <iframe
            src={MAP_EMBED}
            title={c.mapTitle}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="block h-[380px] w-full border-0 md:h-[460px]"
          />
        </div>
        <a
          href={MAP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="group label-mono mt-5 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          {c.directions}
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      </Reveal>
    </div>
  );
}
