"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { dictionaries, type Dict, type Lang } from "./dictionaries";
import { isLocale } from "./routing";

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
  t: Dict;
};

const LangContext = createContext<LangContextValue | null>(null);

const COOKIE = "lampino-lang";

// The active language is driven entirely by the URL locale segment (`/ro`,
// `/ru`), passed down from the server layout. Switching languages rewrites the
// leading segment of the current path and persists the choice in a cookie so
// the proxy honours it on the next locale-less visit.
export function LanguageProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const setLang = (next: Lang) => {
    document.cookie = `${COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = next;
    const segments = pathname.split("/");
    if (isLocale(segments[1])) segments[1] = next;
    else segments.splice(1, 0, next);
    // Preserve the active query string (filters/pagination) across the switch.
    const search =
      typeof window !== "undefined" ? window.location.search : "";
    router.push(`${segments.join("/") || `/${next}`}${search}`);
  };

  const toggle = () => setLang(lang === "ro" ? "ru" : "ro");

  return (
    <LangContext.Provider
      value={{ lang, setLang, toggle, t: dictionaries[lang] }}
    >
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}

export function useT() {
  return useLang().t;
}
