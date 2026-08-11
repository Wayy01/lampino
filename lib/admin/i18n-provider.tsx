"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/routing";
import { adminDictionaries, type AdminDict, type AdminLang } from "./i18n";

type AdminLangContextValue = {
  lang: AdminLang;
  setLang: (lang: AdminLang) => void;
  t: AdminDict;
  /** Prefix an admin-relative path (e.g. `/products`) with `/admin/<lang>`. */
  href: (path?: string) => string;
};

const AdminLangContext = createContext<AdminLangContextValue | null>(null);

const COOKIE = "lampino-lang";

// Mirrors the site provider, but the locale lives in the second URL segment
// (`/admin/ro/...`). The cookie is shared with the storefront so both sides
// agree on the preferred language.
export function AdminLanguageProvider({
  lang,
  children,
}: {
  lang: AdminLang;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const setLang = (next: Locale) => {
    document.cookie = `${COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = next;
    const segments = pathname.split("/");
    if (segments[1] === "admin" && isLocale(segments[2])) segments[2] = next;
    const search = typeof window !== "undefined" ? window.location.search : "";
    router.push(`${segments.join("/")}${search}`);
  };

  const href = (path = "") => `/admin/${lang}${path}`;

  return (
    <AdminLangContext.Provider
      value={{ lang, setLang, t: adminDictionaries[lang], href }}
    >
      {children}
    </AdminLangContext.Provider>
  );
}

export function useAdminLang() {
  const ctx = useContext(AdminLangContext);
  if (!ctx) {
    throw new Error("useAdminLang must be used within AdminLanguageProvider");
  }
  return ctx;
}

export function useAdminT() {
  return useAdminLang().t;
}
