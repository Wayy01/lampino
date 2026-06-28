"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { dictionaries, type Dict, type Lang } from "./dictionaries";

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
  t: Dict;
};

const LangContext = createContext<LangContextValue | null>(null);

const STORAGE_KEY = "carshop-lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("it");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored === "it" || stored === "en") {
      setLangState(stored);
      document.documentElement.lang = stored;
    }
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  };

  const toggle = () => setLang(lang === "it" ? "en" : "it");

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
