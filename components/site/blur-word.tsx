"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const EASE_OUT = [0.33, 1, 0.68, 1] as const; // ease-out cubic
const STAGGER = 0.045; // seconds between letters
const DURATION = 0.5; // blur + fade per letter
const HOLD = 2.5; // seconds a word stays before the next one

// The letters arrive tinted along the terracotta ramp (--primary →
// --primary-deep) and settle to solid --primary once the word has landed.
// Kept as literals because the tint is interpolated per letter in JS.
const SWEEP = ["#d0713e", "#a85530", "#7a3d1f"] as const;

function tint(index: number, total: number): string {
  const pos = (index / Math.max(total - 1, 1)) * (SWEEP.length - 1);
  const from = SWEEP[Math.floor(pos)];
  const to = SWEEP[Math.min(Math.floor(pos) + 1, SWEEP.length - 1)];
  const t = pos - Math.floor(pos);
  const channel = (offset: number) => {
    const a = parseInt(from.slice(offset, offset + 2), 16);
    const b = parseInt(to.slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * t);
  };
  return `rgb(${channel(1)},${channel(3)},${channel(5)})`;
}

/**
 * A word that cycles through `words`, each one revealing letter by letter out
 * of a blur. The widest word is rendered invisibly underneath to reserve the
 * line's width, so a swap never reflows the heading around it.
 *
 * The animation is decorative — the heading's accessible text lives in a
 * sibling `sr-only` span, and reduced-motion users get a static first word.
 */
// One word's worth of letters. Mounted under `key={word}`, so a swap remounts
// it and the tint starts over without an effect having to reset state.
function Letters({ word, reduced }: { word: string; reduced: boolean }) {
  const letters = [...word];
  const [settled, setSettled] = useState(false);

  // Drop the per-letter tint once the last letter has finished arriving.
  useEffect(() => {
    const id = setTimeout(
      () => setSettled(true),
      (STAGGER * letters.length + DURATION + 0.2) * 1000,
    );
    return () => clearTimeout(id);
  }, [letters.length]);

  return (
    <>
      {letters.map((char, i) => (
        <motion.span
          key={i}
          initial={reduced ? false : { opacity: 0, filter: "blur(16px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: DURATION, delay: i * STAGGER, ease: EASE_OUT }}
          className="inline-block transition-colors duration-500"
          style={{ color: settled ? "var(--primary)" : tint(i, letters.length) }}
        >
          {char}
        </motion.span>
      ))}
    </>
  );
}

export function BlurWord({ words }: { words: string[] }) {
  const reduced = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setIndex((p) => (p + 1) % words.length), HOLD * 1000);
    return () => clearInterval(id);
  }, [reduced, words.length]);

  const word = reduced ? words[0] : words[index];
  const widest = words.reduce((a, b) => ([...b].length > [...a].length ? b : a));

  return (
    <span className="relative inline-block italic">
      <span aria-hidden className="invisible">
        {widest}
      </span>
      <span className="absolute left-0 top-0 whitespace-nowrap">
        <Letters key={word} word={word} reduced={reduced} />
      </span>
    </span>
  );
}
