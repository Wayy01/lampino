"use client";

import { useLang } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div
      className={cn(
        "label-mono flex items-center gap-0.5 rounded-full border border-border bg-surface/70 p-0.5 backdrop-blur",
        className,
      )}
    >
      {(["it", "en"] as const).map((code) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors cursor-pointer",
            lang === code
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
