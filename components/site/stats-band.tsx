"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
} from "motion/react";
import { useT } from "@/lib/i18n/provider";

export function StatsBand() {
  const t = useT();
  return (
    <section className="border-y border-border bg-foreground text-background">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-px bg-background/10 sm:grid-cols-4">
        {t.stats.items.map((item, i) => (
          <Counter
            key={i}
            value={item.value}
            suffix={item.suffix}
            label={item.label}
          />
        ))}
      </div>
    </section>
  );
}

function Counter({
  value,
  suffix,
  label,
}: {
  value: number;
  suffix: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return unsub;
  }, [rounded]);

  useEffect(() => {
    if (inView) {
      const controls = animate(count, value, {
        duration: 1.6,
        ease: [0.22, 1, 0.36, 1],
      });
      return controls.stop;
    }
  }, [inView, count, value]);

  return (
    <div
      ref={ref}
      className="flex flex-col items-center bg-foreground px-5 py-12 text-center md:py-16"
    >
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="font-display text-5xl font-light tracking-tight md:text-6xl"
      >
        {display}
        <span className="text-primary">{suffix}</span>
      </motion.div>
      <div className="label-mono mt-4 text-background/55">{label}</div>
    </div>
  );
}
