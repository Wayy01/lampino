"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X, ShoppingBag, Phone } from "lucide-react";
import { useLang, useT } from "@/lib/i18n/provider";
import { localePath, shopHref, rentalsHref } from "@/lib/i18n/routing";
import { useCart } from "@/lib/cart/provider";
import { LanguageToggle } from "./language-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function CartButton({ className }: { className?: string }) {
  const t = useT();
  const { count, openCart } = useCart();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openCart}
      aria-label={t.cart.title}
      className={cn("relative h-10 w-10", className)}
    >
      <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.7rem] font-medium leading-none text-primary-foreground tabular-nums">
          {count}
        </span>
      )}
    </Button>
  );
}

export function Navbar({ phone }: { phone?: string | null }) {
  const t = useT();
  const { lang } = useLang();
  const [open, setOpen] = useState(false);

  const links = [
    { href: shopHref(lang), label: t.nav.products },
    { href: rentalsHref(lang), label: t.nav.rental },
    { href: localePath(lang, "/contact"), label: t.nav.contact },
  ];

  return (
    <header className="fixed inset-x-0 top-[var(--promo-h,0px)] z-50 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 sm:px-8 md:h-20">
        <Link
          href={localePath(lang)}
          className="font-display text-xl tracking-tight md:text-2xl"
          onClick={() => setOpen(false)}
        >
          Lampino<span className="text-primary">.</span>
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

        <div className="hidden items-center gap-2 md:flex">
          <LanguageToggle />
          <CartButton />
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <CartButton />
          <Button
            variant="bare"
            size="none"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
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
              {/* One tap to call, rather than another route into the shop —
                  the nav links above already cover that. */}
              <div className="mt-4 flex items-center justify-between gap-3">
                <LanguageToggle />
                {phone && (
                  <Button asChild size="sm" variant="ink">
                    <a
                      href={`tel:${phone.replace(/\s/g, "")}`}
                      onClick={() => setOpen(false)}
                    >
                      <Phone className="h-4 w-4" strokeWidth={1.75} />
                      {phone}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
