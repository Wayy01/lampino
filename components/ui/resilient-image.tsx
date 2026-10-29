"use client";

import { useEffect, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { ImageOff, LoaderCircle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImageStatus = "loading" | "loaded" | "error";

export type ImageLabels = { loading: string; error: string; retry: string };

// Each step is tried after the previous one fails: the optimized copy, then
// the original file straight from nginx (skips the resize queue entirely),
// then the original again after a pause in case the network blipped.
const RETRY_DELAYS_MS = [0, 600, 2000];

/**
 * `next/image` (always `fill`, so the parent must be positioned) with a
 * visible loading state, automatic fallbacks, and a clear error + retry once
 * every attempt has failed. Strings come in as `labels` because this folder is
 * shared by the storefront and the admin, which have separate dictionaries —
 * use `SiteImage` / `AdminImage` rather than this directly.
 */
export function ResilientImage({
  labels,
  compact = false,
  dark = false,
  onStatusChange,
  src,
  unoptimized,
  alt,
  ...props
}: Omit<ImageProps, "fill" | "onLoad" | "onError"> & {
  labels: ImageLabels;
  /** Thumbnail mode: icon-only states, the error text moves to a tooltip. */
  compact?: boolean;
  /** Sits on a dark stage (gallery, lightbox): light-on-dark states. */
  dark?: boolean;
  onStatusChange?: (status: ImageStatus) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<ImageStatus>("loading");
  // Bumped by the manual retry so the <img> remounts even on the same src.
  const [round, setRound] = useState(0);

  // A new image (gallery navigation, a re-ordered admin row) starts over.
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setAttempt(0);
    setStatus("loading");
  }

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const [pendingAttempt, setPendingAttempt] = useState<number | null>(null);
  useEffect(() => {
    if (pendingAttempt === null) return;
    const id = setTimeout(() => {
      setAttempt(pendingAttempt);
      setPendingAttempt(null);
    }, RETRY_DELAYS_MS[pendingAttempt]);
    return () => clearTimeout(id);
  }, [pendingAttempt]);

  const handleError = () => {
    const next = attempt + 1;
    if (next < RETRY_DELAYS_MS.length && typeof src === "string") setPendingAttempt(next);
    else setStatus("error");
  };

  const retry = (e: React.SyntheticEvent) => {
    // Usually sits inside a product link or the gallery's zoom button.
    e.preventDefault();
    e.stopPropagation();
    setAttempt(0);
    setPendingAttempt(null);
    setStatus("loading");
    setRound((r) => r + 1);
  };

  const fallback = attempt > 0 && typeof src === "string";
  const resolvedSrc =
    fallback && attempt > 1 ? `${src}${src.includes("?") ? "&" : "?"}retry=${round}-${attempt}` : src;

  return (
    <>
      {/* Drawn under the image, not over it: an <img> is transparent until
          it decodes, so the shimmer shows through while loading and is
          simply covered once it paints — even if JS never hydrates. */}
      {status === "loading" && (
        <span
          role="status"
          aria-label={labels.loading}
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden",
            dark ? "bg-white/[0.04]" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent to-transparent motion-reduce:animate-none",
              dark ? "via-white/[0.07]" : "via-foreground/[0.06]",
            )}
          />
          <span
            className={cn(
              "absolute inset-0 flex animate-fade-in-late flex-col items-center justify-center gap-2",
              dark ? "text-white/70" : "text-muted-foreground",
            )}
          >
            <LoaderCircle className={cn("animate-spin", compact ? "h-4 w-4" : "h-6 w-6")} strokeWidth={1.75} />
            {!compact && <span className="text-xs font-medium">{labels.loading}</span>}
          </span>
        </span>
      )}

      {status !== "error" && pendingAttempt === null && (
        <span className="absolute inset-0">
          <Image
            key={`${round}-${attempt}`}
            {...props}
            src={resolvedSrc}
            alt={alt}
            fill
            unoptimized={unoptimized || fallback}
            onLoad={() => setStatus("loaded")}
            onError={handleError}
          />
        </span>
      )}

      {status === "error" && (
        <span
          role="alert"
          title={compact ? labels.error : undefined}
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center",
            dark ? "bg-white/[0.04] text-white/70" : "bg-muted text-muted-foreground",
          )}
        >
          <ImageOff className={compact ? "h-4 w-4" : "h-6 w-6"} strokeWidth={1.75} />
          {!compact && (
            <span className={cn("text-xs font-medium", dark ? "text-white/90" : "text-foreground/80")}>
              {labels.error}
            </span>
          )}
          {/* Not a <button>: this often renders inside a link or button. */}
          <span
            role="button"
            tabIndex={0}
            aria-label={labels.retry}
            onClick={retry}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") retry(e);
            }}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background font-medium text-foreground transition-colors hover:bg-foreground/[0.04]",
              compact ? "absolute inset-0 rounded-none border-0 bg-transparent opacity-0" : "px-3 py-1 text-xs",
            )}
          >
            <RotateCw className="h-3.5 w-3.5" />
            {labels.retry}
          </span>
        </span>
      )}
    </>
  );
}
