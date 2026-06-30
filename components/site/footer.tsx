"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

export function Footer() {
  const t = useT();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8 md:py-24">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr] md:gap-8">
          <div className="max-w-sm">
            <Link href="/" className="font-display text-3xl tracking-tight">
              Atelier<span className="text-primary">.</span>
            </Link>
            <p className="mt-5 text-muted-foreground">{t.footer.tagline}</p>
          </div>

          <div>
            <p className="label-mono mb-5 text-muted-foreground">
              {t.footer.explore}
            </p>
            <ul className="space-y-3">
              <FooterLink href="/cars">{t.footer.links.cars}</FooterLink>
              <FooterLink href="/cars">{t.nav.cta}</FooterLink>
            </ul>
          </div>

          <div>
            <p className="label-mono mb-5 text-muted-foreground">
              {t.footer.legal}
            </p>
            <ul className="space-y-3">
              <FooterLink href="/about">{t.footer.links.contact}</FooterLink>
              <FooterLink href="/terms">{t.footer.links.terms}</FooterLink>
              <FooterLink href="/privacy">{t.footer.links.privacy}</FooterLink>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="label-mono text-muted-foreground">
            © {year} Atelier — {t.footer.rights}
          </p>
          <p className="label-mono text-muted-foreground">Made in Italy</p>
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
