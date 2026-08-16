"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ContactSettings } from "@/lib/types";
import { useLang, useT } from "@/lib/i18n/provider";
import { localePath, shopHref, rentalsHref } from "@/lib/i18n/routing";
import { pick } from "@/lib/utils";

export function Footer({ contact }: { contact: ContactSettings | null }) {
  const t = useT();
  const { lang } = useLang();
  const year = new Date().getFullYear();

  const address = contact
    ? [
        pick(lang, contact.address_ro, contact.address_ru),
        pick(lang, contact.city_ro, contact.city_ru),
        pick(lang, contact.country_ro, contact.country_ru),
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  const socials = contact
    ? ([
        ["Facebook", contact.facebookUrl],
        ["Instagram", contact.instagramUrl],
        ["TikTok", contact.tiktokUrl],
      ] as const).filter(([, url]) => url)
    : [];

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8 md:py-24">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1.2fr] md:gap-8">
          <div className="max-w-sm">
            <Link
              href={localePath(lang)}
              className="font-display text-3xl tracking-tight"
            >
              Lampino<span className="text-primary">.</span>
            </Link>
            <p className="mt-5 text-muted-foreground">{t.footer.tagline}</p>
          </div>

          <div>
            <p className="label-mono mb-5 text-muted-foreground">
              {t.footer.explore}
            </p>
            <ul className="space-y-3">
              <FooterLink href={shopHref(lang)}>
                {t.footer.links.products}
              </FooterLink>
              <FooterLink href={rentalsHref(lang)}>{t.nav.rental}</FooterLink>
            </ul>
          </div>

          <div>
            <p className="label-mono mb-5 text-muted-foreground">
              {t.footer.legal}
            </p>
            <ul className="space-y-3">
              <FooterLink href={localePath(lang, "/contact")}>
                {t.footer.links.contact}
              </FooterLink>
              <FooterLink href={localePath(lang, "/terms")}>
                {t.footer.links.terms}
              </FooterLink>
              <FooterLink href={localePath(lang, "/privacy")}>
                {t.footer.links.privacy}
              </FooterLink>
            </ul>
          </div>

          {contact && (
            <div>
              <p className="label-mono mb-5 text-muted-foreground">
                {t.footer.contact}
              </p>
              <ul className="space-y-3">
                <li>
                  <a
                    href={`tel:${contact.phone.replace(/\s/g, "")}`}
                    className="text-foreground transition-colors hover:text-primary"
                  >
                    {contact.phone}
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-foreground transition-colors hover:text-primary"
                  >
                    {contact.email}
                  </a>
                </li>
                {address && <li className="text-muted-foreground">{address}</li>}
                <li className="text-muted-foreground">
                  <span className="label-mono block">{t.footer.hours}</span>
                  {pick(lang, contact.businessHours_ro, contact.businessHours_ru)}
                </li>
              </ul>

              {socials.length > 0 && (
                <>
                  <p className="label-mono mb-3 mt-8 text-muted-foreground">
                    {t.footer.follow}
                  </p>
                  <ul className="flex flex-wrap gap-x-5 gap-y-2">
                    {socials.map(([label, url]) => (
                      <li key={label}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-1 text-foreground transition-colors hover:text-primary"
                        >
                          {label}
                          <ArrowUpRight className="h-4 w-4 -translate-y-px opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="label-mono text-muted-foreground">
            © {year} Lampino — {t.footer.rights}
          </p>
          <p className="label-mono text-muted-foreground">{t.footer.tagline}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group inline-flex items-center gap-1 text-foreground transition-colors hover:text-primary"
      >
        {children}
        <ArrowUpRight className="h-4 w-4 -translate-y-px opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
      </Link>
    </li>
  );
}
