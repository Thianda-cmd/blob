"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { useText } from "@/i18n/useText";
import { tx } from "@/i18n/text";
import { byNumber, neutrons, shells } from "../elements";

type Props = {
  /** Atomic number (protons). */
  z: number;
  /** Ion charge: +1 takes one electron from the outer shell, −1 adds one. */
  charge?: number;
  /** Width and height in px. */
  size?: number;
  /** Shells turn slowly (off for reduced motion). */
  spin?: boolean;
  /** Outer shell electrons in the accent colour. */
  highlightOuter?: boolean;
  /** Show protons and neutrons in the nucleus. */
  nucleus?: boolean;
  className?: string;
};

// Rounded so server and client render identical attributes.
const round = (x: number) => Math.round(x * 100) / 100;

/** Electrons per shell for an atom or ion. */
export function ionShells(z: number, charge = 0): number[] {
  const out = shells(z);
  let change = -charge;
  while (change < 0 && out.length) {
    const take = Math.min(out[out.length - 1], -change);
    out[out.length - 1] -= take;
    change += take;
    if (out[out.length - 1] === 0) out.pop();
  }
  if (change > 0) out[out.length - 1] = (out[out.length - 1] ?? 0) + change;
  return out;
}

/**
 * The shell model (Bohr / Schalenmodell): nucleus in the middle, electrons as dots on
 * rings. Electrons glide in and out when `z` or `charge` change.
 */
export function AtomShells({ z, charge = 0, size = 220, spin = true, highlightOuter = true, nucleus = true, className }: Props) {
  const id = useId();
  const reduce = useReducedMotion();
  const t = useText();
  const el = byNumber(z);
  const layers = ionShells(z, charge);
  const c = size / 2;
  const core = Math.max(16, size * 0.11);
  const gap = (c - core - 10) / Math.max(layers.length, 2);
  const dot = Math.max(3, Math.min(6, size / 46));
  const label = el
    ? t(
        tx(
          `${el.symbol}${charge ? ` ion, charge ${charge > 0 ? "+" : "−"}${Math.abs(charge)}` : ""}: shells ${layers.join(", ")}`,
          `${el.symbol}${charge ? `-Ion, Ladung ${charge > 0 ? "+" : "−"}${Math.abs(charge)}` : ""}: Schalen ${layers.join(", ")}`,
        ),
      )
    : "";

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className} role="img" aria-label={label}>
      {layers.map((n, i) => {
        const r = core + gap * (i + 1);
        const outer = i === layers.length - 1;
        return (
          <g key={`ring-${i}`}>
            <motion.circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke="var(--line-2)"
              strokeWidth={1.25}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{ transformOrigin: `${c}px ${c}px` }}
              transition={{ type: "spring", stiffness: 260, damping: 26, delay: i * 0.05 }}
            />
            <motion.g
              style={{ transformOrigin: `${c}px ${c}px` }}
              animate={spin && !reduce ? { rotate: i % 2 ? -360 : 360 } : { rotate: 0 }}
              transition={spin && !reduce ? { duration: 26 + i * 10, ease: "linear", repeat: Infinity } : { duration: 0 }}
            >
              <AnimatePresence initial={false}>
                {Array.from({ length: n }, (_, k) => {
                  const a = (k / n) * Math.PI * 2 - Math.PI / 2;
                  return (
                    <motion.circle
                      key={`${id}-e-${i}-${k}`}
                      r={dot}
                      initial={{ cx: c, cy: c, opacity: 0 }}
                      animate={{ cx: round(c + r * Math.cos(a)), cy: round(c + r * Math.sin(a)), opacity: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{ type: "spring", stiffness: 180, damping: 20, delay: k * 0.02 }}
                      fill={outer && highlightOuter ? "var(--blob)" : "var(--ink-2)"}
                    />
                  );
                })}
              </AnimatePresence>
            </motion.g>
          </g>
        );
      })}
      <motion.circle
        cx={c}
        cy={c}
        r={core}
        fill="color-mix(in oklab, var(--blob) 14%, var(--raised))"
        stroke="color-mix(in oklab, var(--blob) 40%, transparent)"
        strokeWidth={1.25}
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        style={{ transformOrigin: `${c}px ${c}px` }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
      />
      {nucleus && el ? (
        <text x={c} y={c} textAnchor="middle" dominantBaseline="central" className="fill-ink font-semibold" style={{ fontSize: Math.max(9, core * 0.5) }}>
          <tspan x={c} dy={core > 26 ? "-0.55em" : 0}>
            {z}p⁺
          </tspan>
          {core > 26 && (
            <tspan x={c} dy="1.15em" className="fill-ink-3 font-medium">
              {neutrons(el)}n
            </tspan>
          )}
        </text>
      ) : null}
      {charge !== 0 && (
        <text x={size - 6} y={16} textAnchor="end" className="fill-blob-ink font-semibold" style={{ fontSize: Math.max(12, size * 0.075) }}>
          {Math.abs(charge) > 1 ? Math.abs(charge) : ""}
          {charge > 0 ? "+" : "−"}
        </text>
      )}
    </svg>
  );
}
