"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { HomepageSettings } from "@/lib/types";
import { useLang } from "@/lib/i18n/provider";
import { pick } from "@/lib/utils";
import { isLocale, localePath, type Locale } from "@/lib/i18n/routing";
import { Reveal, MaskReveal } from "./reveal";

// `HomepageSettings.welcomeButtonUrl` is stored without a locale prefix
// (e.g. `/magazin`). App-relative paths get the active locale segment;
// absolute URLs pass through.
function withLocale(lang: Locale, url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  if (!url.startsWith("/")) return url;
  const segment = url.split("/")[1];
  return isLocale(segment) ? url : localePath(lang, url);
}

// Admin-authored welcome block between the hero and the featured categories.
// Hidden entirely when the settings row is missing or the heading is empty.
export function WelcomeBand({ settings }: { settings: HomepageSettings | null }) {
  const { lang } = useLang();

  if (!settings) return null;

  const heading = pick(lang, settings.welcomeHeading_ro, settings.welcomeHeading_ru);
  if (!heading) return null;

  const description = pick(lang, settings.welcomeDescription_ro, settings.welcomeDescription_ru);
  const buttonText = pick(lang, settings.welcomeButtonText_ro, settings.welcomeButtonText_ru);
  const buttonUrl = withLocale(lang, settings.welcomeButtonUrl);

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 md:py-28">
      <div className="max-w-2xl">
        <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] font-light leading-[1.02] tracking-[-0.02em]">
          <MaskReveal>{heading}</MaskReveal>
        </h2>

        {description && (
          <Reveal delay={0.1}>
            <p className="mt-5 text-lg text-muted-foreground">{description}</p>
          </Reveal>
        )}

        {buttonText && (
          <Reveal delay={0.2}>
            <Link
              href={buttonUrl}
              className="group label-mono mt-8 inline-flex items-center gap-2 text-foreground transition-colors hover:text-primary"
            >
              {buttonText}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        )}
      </div>
    </section>
  );
}
