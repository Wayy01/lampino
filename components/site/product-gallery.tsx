"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { Play, X, ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export function ProductGallery({
  media,
  alt,
}: {
  media: MediaItem[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const count = media.length;
  const current = media[active];

  const go = useCallback(
    (dir: number) => {
      setActive((i) => (i + dir + count) % count);
    },
    [count],
  );

  // Escape closes the lightbox; arrows navigate while it's open.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, go]);

  if (count === 0) return null;

  return (
    <div>
      {/* Main stage */}
      <Button
        type="button"
        variant="bare"
        size="none"
        onClick={() => setFullscreen(true)}
        aria-label={alt}
        className="group relative block aspect-[16/10] w-full cursor-zoom-in overflow-hidden rounded-[var(--radius-lg)] bg-foreground/90"
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={active}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="absolute inset-0"
          >
            {current.type === "video" ? (
              <>
                {/* Blurred backdrop so vertical clips sit cleanly in the frame. */}
                <video
                  key={`bg-${active}`}
                  src={current.src}
                  muted
                  autoPlay
                  loop
                  playsInline
                  aria-hidden
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
                />
                <video
                  key={`main-${active}`}
                  src={current.src}
                  poster={current.thumbnail ?? undefined}
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="relative h-full w-full object-contain"
                />
              </>
            ) : (
              <Image
                src={current.src}
                alt={alt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
              />
            )}
          </motion.div>
        </AnimatePresence>

        <span className="pointer-events-none absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100">
          <Expand className="h-4 w-4" />
        </span>
      </Button>

      {/* Thumbnail strip */}
      {count > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5">
          {media.map((item, i) => (
            <Button
              key={i}
              variant="bare"
              size="none"
              onClick={() => setActive(i)}
              aria-label={`${alt} ${i + 1}`}
              className={cn(
                "relative block aspect-square overflow-hidden rounded-[var(--radius-md)] bg-muted",
                active === i
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "opacity-65 hover:opacity-100",
              )}
            >
              {item.type === "video" ? (
                <>
                  {item.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <video
                      src={item.src}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-foreground/20">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background/85 text-foreground backdrop-blur">
                      <Play className="h-3.5 w-3.5 translate-x-[1px]" fill="currentColor" />
                    </span>
                  </span>
                </>
              ) : (
                <Image
                  src={item.src}
                  alt=""
                  fill
                  sizes="20vw"
                  className="object-cover"
                />
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Fullscreen lightbox */}
      <AnimatePresence>
        {fullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
            onClick={() => setFullscreen(false)}
          >
            <Button
              variant="overlay"
              size="icon-lg"
              onClick={() => setFullscreen(false)}
              aria-label="Close"
              className="absolute right-5 top-5 z-10"
            >
              <X className="h-5 w-5" />
            </Button>

            {count > 1 && (
              <>
                <Button
                  variant="overlay"
                  size="icon-xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(-1);
                  }}
                  aria-label="Previous"
                  className="absolute left-3 top-1/2 z-10 -translate-y-1/2 sm:left-6"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="overlay"
                  size="icon-xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(1);
                  }}
                  aria-label="Next"
                  className="absolute right-3 top-1/2 z-10 -translate-y-1/2 sm:right-6"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

            <div
              className="flex h-full w-full items-center justify-center p-6 sm:p-12"
              onClick={(e) => e.stopPropagation()}
            >
              {current.type === "video" ? (
                <video
                  key={`fs-${active}`}
                  src={current.src}
                  poster={current.thumbnail ?? undefined}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="max-h-[90vh] max-w-full rounded-[var(--radius-md)]"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.src}
                  alt={alt}
                  className="max-h-[90vh] max-w-full rounded-[var(--radius-md)] object-contain"
                />
              )}
            </div>

            {count > 1 && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white tabular-nums">
                {active + 1} / {count}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
