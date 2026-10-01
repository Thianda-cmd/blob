"use client";

import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Drop = { x: number; y: number; r: number; delay: number };
type Burst = { id: number; drops: Drop[] };

function makeBurst(id: number, size: number): Burst {
  const count = 7;
  const offset = Math.random() * Math.PI;
  const drops = Array.from({ length: count }, (_, i) => {
    const angle = offset + (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = size * (0.85 + Math.random() * 0.55);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, r: 1.6 + Math.random() * 1.6, delay: Math.random() * 0.04 };
  });
  return { id, drops };
}

/**
 * A jelly checkbox: the box squishes, an orange fill pops in with a little overshoot,
 * the tick draws itself and a few droplets splash out.
 */
export function TaskCheckbox({
  checked,
  onChange,
  size = 18,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: number;
  label?: string;
  className?: string;
}) {
  const [scope, animate] = useAnimate<HTMLButtonElement>();
  const [bursts, setBursts] = useState<Burst[]>([]);
  const reduce = useReducedMotion();

  function toggle() {
    const next = !checked;
    if (!reduce) {
      if (next) {
        animate(
          "[data-box]",
          { scaleX: [1, 1.3, 0.88, 1.06, 1], scaleY: [1, 0.7, 1.14, 0.96, 1] },
          { duration: 0.55, ease: "easeOut", times: [0, 0.22, 0.5, 0.75, 1] },
        );
        const id = Date.now() + Math.random();
        setBursts((b) => [...b, makeBurst(id, size)]);
        setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 900);
      } else {
        animate("[data-box]", { scale: [1, 0.82, 1.05, 1] }, { duration: 0.35, ease: "easeOut" });
      }
    }
    onChange(next);
  }

  return (
    <button
      ref={scope}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label ?? (checked ? "Mark as not done" : "Mark as done")}
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      className={cn("group/check relative grid shrink-0 place-items-center rounded-md outline-offset-1", className)}
      style={{ width: size + 6, height: size + 6 }}
    >
      <span
        data-box
        className={cn(
          "relative block overflow-hidden rounded-[6px] border-[1.5px] transition-colors duration-150",
          checked ? "border-blob" : "border-line-2 group-hover/check:border-ink-3",
        )}
        style={{ width: size, height: size }}
      >
        {/* hover hint */}
        {!checked && <span className="absolute inset-0 bg-blob/0 transition-colors group-hover/check:bg-blob/10" />}
        <motion.span
          className="absolute -inset-px rounded-[5px] bg-blob"
          initial={false}
          animate={checked ? { scale: 1, opacity: 1, borderRadius: 5 } : { scale: 0, opacity: 0, borderRadius: 12 }}
          transition={checked ? { type: "spring", stiffness: 520, damping: 15, mass: 0.7 } : { duration: 0.14 }}
        />
        <svg viewBox="0 0 16 16" className="absolute inset-0 size-full" fill="none" aria-hidden>
          <motion.path
            d="M4 8.4 L6.9 11.1 L12.2 5.2"
            stroke="white"
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={checked ? { delay: 0.08, duration: 0.24, ease: "easeOut" } : { duration: 0.1 }}
          />
        </svg>
      </span>

      <span className="pointer-events-none absolute inset-0" aria-hidden>
        <AnimatePresence>
          {bursts.map((b) => (
            <span key={b.id} className="absolute left-1/2 top-1/2">
              {/* ring */}
              <motion.span
                className="absolute rounded-full border-2 border-blob"
                style={{ width: size, height: size, left: -size / 2, top: -size / 2 }}
                initial={{ scale: 0.7, opacity: 0.55 }}
                animate={{ scale: 1.9, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
              {b.drops.map((d, i) => (
                <motion.span
                  key={i}
                  className="absolute rounded-full bg-blob"
                  style={{ width: d.r * 2, height: d.r * 2, left: -d.r, top: -d.r }}
                  initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
                  animate={{ x: d.x, y: d.y + 3, scale: [0.4, 1.15, 0], opacity: [1, 1, 0.6] }}
                  transition={{ duration: 0.62, delay: 0.05 + d.delay, ease: [0.16, 0.9, 0.3, 1] }}
                />
              ))}
            </span>
          ))}
        </AnimatePresence>
      </span>
    </button>
  );
}
