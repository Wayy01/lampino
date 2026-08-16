"use client";

import { Button } from "@/components/ui/button";
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
      {(["ro", "ru"] as const).map((code) => (
        <Button
          key={code}
          variant="bare"
          size="none"
          pill
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={cn(
            "px-2.5 py-1",
            lang === code
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {code}
        </Button>
      ))}
    </div>
  );
}
