"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
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

const STORAGE_KEY = "lampino-lang";
const DEFAULT_LANG: Lang = "ro";

// localStorage-backed store for the active language, read via
// useSyncExternalStore so hydration stays SSR-safe without a setState effect.
const listeners = new Set<() => void>();

function readLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "ro" || stored === "ru" ? stored : DEFAULT_LANG;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function writeLang(next: Lang) {
  window.localStorage.setItem(STORAGE_KEY, next);
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn());
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, readLang, () => DEFAULT_LANG);

  const setLang = (next: Lang) => writeLang(next);
  const toggle = () => writeLang(lang === "ro" ? "ru" : "ro");

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
