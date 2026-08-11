"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Two-step destructive button: first click arms it ("Sure?"), second click
 * runs the bound server action. Disarms itself after a moment.
 */
export function ConfirmButton({
  action,
  children,
  confirmLabel = "Sure?",
  className,
  title,
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  confirmLabel?: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleClick = () => {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    clearTimeout(timer.current);
    setArmed(false);
    startTransition(async () => {
      await action();
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={title}
      className={cn(
        "flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 text-sm transition-colors disabled:pointer-events-none disabled:opacity-60",
        armed
          ? "bg-red-600 text-white hover:bg-red-700"
          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-red-600",
        className,
      )}
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : armed ? confirmLabel : children}
    </button>
  );
}
