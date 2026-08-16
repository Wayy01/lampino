"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ChartColumnBig,
  Package,
  Shapes,
  Sparkles,
  CalendarClock,
  ShoppingCart,
  BadgePercent,
  PanelsTopLeft,
  Users,
  Settings2,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/admin/actions/auth";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import type { AdminDict } from "@/lib/admin/i18n";
import { LOCALES } from "@/lib/i18n/routing";
import { ActionToastProvider } from "@/components/admin/action-toast";

const NAV: {
  path: string;
  label: (t: AdminDict) => string;
  icon: typeof Package;
  exact?: boolean;
}[] = [
  { path: "", label: (t) => t.nav.dashboard, icon: LayoutDashboard, exact: true },
  { path: "/analytics", label: (t) => t.nav.analytics, icon: ChartColumnBig },
  { path: "/products", label: (t) => t.nav.products, icon: Package },
  { path: "/categories", label: (t) => t.nav.categories, icon: Shapes },
  { path: "/rentals", label: (t) => t.nav.rentals, icon: Sparkles },
  { path: "/orders", label: (t) => t.nav.orders, icon: ShoppingCart },
  { path: "/applications", label: (t) => t.nav.applications, icon: CalendarClock },
  { path: "/promotions", label: (t) => t.nav.promotions, icon: BadgePercent },
  { path: "/homepage", label: (t) => t.nav.homepage, icon: PanelsTopLeft },
  { path: "/users", label: (t) => t.nav.users, icon: Users },
  { path: "/settings", label: (t) => t.nav.settings, icon: Settings2 },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t, href } = useAdminLang();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ path, label, icon: Icon, exact }) => {
        const target = href(path);
        const active = exact ? pathname === target : pathname.startsWith(target);
        return (
          <Link
            key={path}
            href={target}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[0.95rem] transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            {label(t)}
          </Link>
        );
      })}
    </nav>
  );
}

function LanguageSwitch() {
  const { lang, setLang } = useAdminLang();
  return (
    <div className="flex rounded-[var(--radius-md)] border p-0.5">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => setLang(locale)}
          className={cn(
            "flex h-8 flex-1 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] font-mono text-xs uppercase transition-colors",
            locale === lang
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}

function SidebarFooter({ username }: { username: string }) {
  const { t, lang } = useAdminLang();
  return (
    <div className="mt-auto flex flex-col gap-1 border-t pt-4">
      <div className="mb-2 px-1">
        <LanguageSwitch />
      </div>
      <a
        href={`/${lang}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[0.95rem] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
      >
        <ExternalLink className="h-[18px] w-[18px]" strokeWidth={1.75} />
        {t.nav.viewSite}
      </a>
      <form action={logout.bind(null, lang)}>
        <button
          type="submit"
          className="flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[0.95rem] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {t.nav.signOut}
          <span className="ml-auto max-w-[7rem] truncate text-xs text-muted-foreground/70">
            {username}
          </span>
        </button>
      </form>
    </div>
  );
}

function Wordmark() {
  const { t, href } = useAdminLang();
  return (
    <Link href={href()} className="font-display text-xl tracking-tight">
      Lampino<span className="text-primary">.</span>
      <span className="label-mono ml-2 text-muted-foreground">
        {t.login.admin}
      </span>
    </Link>
  );
}

export function AdminShell({
  username,
  children,
}: {
  username: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useAdminLang();

  // Lock body scroll while the mobile drawer is open. The drawer closes on
  // navigation via the NavLinks onNavigate callback.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <ActionToastProvider>
      <div className="min-h-screen lg:flex">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col overflow-y-auto border-r bg-surface px-4 py-6 lg:flex">
          <div className="mb-8 px-3">
            <Wordmark />
          </div>
          <NavLinks />
          <SidebarFooter username={username} />
        </aside>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-surface px-4 lg:hidden">
          <Wordmark />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t.nav.openMenu}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-foreground/[0.05]"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-surface px-4 py-6 shadow-xl">
              <div className="mb-8 flex items-center justify-between px-3">
                <Wordmark />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t.nav.closeMenu}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-foreground/[0.05]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavLinks onNavigate={() => setOpen(false)} />
              <SidebarFooter username={username} />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 lg:pl-60">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </ActionToastProvider>
  );
}
