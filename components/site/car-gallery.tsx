"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export function CarGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-lg)] bg-muted">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={active}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <Image
              src={images[active]}
              alt={alt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                "relative aspect-[16/10] overflow-hidden rounded-[var(--radius-md)] bg-muted transition-all cursor-pointer",
                active === i
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "opacity-65 hover:opacity-100",
              )}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="20vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
