"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { createRng } from "@/learn/engine/rng";

const COLORS = ["var(--blob)", "var(--blob-deep)", "color-mix(in oklab, var(--blob) 45%, white)", "var(--ink)", "var(--ok)"];

/** A one-shot burst of jelly bits. Re-mount (change `key`) to fire again. */
export function Confetti({ count = 26, spread = 260, seed = 1 }: { count?: number; spread?: number; seed?: number }) {
  const bits = useMemo(() => {
    const rand = createRng(seed).next;
    return Array.from({ length: count }, (_, i) => {
      const angle = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.25;
      const dist = spread * (0.45 + rand() * 0.55);
      return {
        i,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        r: (rand() - 0.5) * 540,
        size: 6 + rand() * 7,
        round: rand() > 0.45,
        color: COLORS[Math.floor(rand() * COLORS.length)],
        delay: rand() * 0.08,
      };
    });
  }, [count, spread, seed]);

  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 z-30" aria-hidden>
      {bits.map((b) => (
        <motion.span
          key={b.i}
          className="absolute block"
          style={{ width: b.size, height: b.round ? b.size : b.size * 0.45, background: b.color, borderRadius: b.round ? 999 : 2, left: -b.size / 2, top: -b.size / 2 }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 120], opacity: [1, 1, 0], scale: 1, rotate: b.r }}
          transition={{ duration: 1.25, delay: b.delay, ease: [0.16, 0.8, 0.3, 1], times: [0, 0.55, 1] }}
        />
      ))}
    </span>
  );
}
