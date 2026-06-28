"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { MaskReveal } from "./reveal";

export function CtaBand() {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);

  return (
    <section ref={ref} className="relative overflow-hidden">
      <motion.div style={{ y }} className="absolute inset-0 -z-10 scale-110">
        <Image
          src="https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=2400&q=80"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-foreground/70" />
      </motion.div>

      <div className="mx-auto max-w-[1400px] px-5 py-28 text-center text-background sm:px-8 md:py-40">
        <h2 className="font-display mx-auto max-w-3xl text-[clamp(2.25rem,6vw,4.5rem)] font-light leading-[1.02] tracking-[-0.02em]">
          <MaskReveal>{t.ctaBand.title}</MaskReveal>
        </h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mx-auto mt-6 max-w-md text-background/80"
        >
          {t.ctaBand.text}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-10"
        >
          <Button asChild size="lg" variant="primary" className="group">
            <Link href="/cars">
              {t.ctaBand.button}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
