"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { LanguageToggle } from "./language-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Navbar() {
  const t = useT();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "/cars", label: t.nav.cars },
    { href: "/about", label: t.nav.about },
  ];

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 sm:px-8 md:h-20">
        <Link
          href="/"
          className="font-display text-xl tracking-tight md:text-2xl"
          onClick={() => setOpen(false)}
        >
          Atelier<span className="text-primary">.</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="label-mono text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <LanguageToggle />
          <Button asChild size="sm" variant="ink">
            <Link href="/cars">{t.nav.cta}</Link>
          </Button>
        </div>

        <button
          className="flex items-center justify-center md:hidden cursor-pointer"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-border bg-background md:hidden"
          >
            <div className="flex flex-col gap-1 px-5 py-4">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="font-display py-3 text-2xl tracking-tight"
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-4 flex items-center justify-between">
                <LanguageToggle />
                <Button asChild size="sm" variant="ink">
                  <Link href="/cars" onClick={() => setOpen(false)}>
                    {t.nav.cta}
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
