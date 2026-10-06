"use client";

// Antigen and antibody fit like a key and a lock (Schlüssel-Schloss-Prinzip). Students send one
// of three antibodies against a group of viruses: the matching one binds with both of its
// binding sites to two viruses at once, so the viruses clump together (Agglutination) and a
// macrophage can eat the clump. The wrong ones don't bind. `ImmuneLockKeyPicture` is the
// task picture: which antibody fits this antigen?

import { motion, useReducedMotion } from "motion/react";
import { RotateCcw, Shuffle } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { AB, AB_COLOR, Antibody, bumpPath, clump, Macrophage, PAINT, VirusParticle, type ClumpLink, type Epitope } from "./ImmuneCells";

const RP = 20;
const S = 4.5;

// ---------------------------------------------------------------------------
// The clump: a chain of viruses with an antibody bridging each neighbouring pair.

const LINKS: ClumpLink[] = [
  { a: 0, b: 1, beta: 0, side: 1 },
  { a: 1, b: 2, beta: -40, side: -1 },
  { a: 2, b: 3, beta: 30, side: 1 },
  { a: 3, b: 4, beta: -10, side: -1 },
  { a: 2, b: 5, beta: -100, side: 1 },
  { a: 3, b: 6, beta: 80, side: -1 },
];
const CLUMP = clump(LINKS, RP, S, [280, 150]);
/** Where the viruses float before they are bound. */
const FREE: [number, number][] = [
  [92, 70],
  [210, 52],
  [350, 64],
  [470, 92],
  [120, 222],
  [300, 236],
  [452, 216],
];
const CHOICES: Epitope[] = ["round", "tri", "square"];

type Run = "idle" | "fit" | "miss" | "eaten";

export function ImmuneLockKey() {
  const t = useText();
  const reduce = useReducedMotion();
  const [target, setTarget] = useState<Epitope>("tri");
  const [sent, setSent] = useState<Epitope | null>(null);
  const [run, setRun] = useState<Run>("idle");
  const [round, setRound] = useState(0);

  const send = (shape: Epitope) => {
    setSent(shape);
    setRun(shape === target ? "fit" : "miss");
    setRound((r) => r + 1);
  };
  const reset = (next?: Epitope) => {
    setSent(null);
    setRun("idle");
    if (next) setTarget(next);
    setRound((r) => r + 1);
  };
  const clumped = run === "fit" || run === "eaten";

  const msg: Text =
    run === "fit"
      ? tx(
          "It fits! Each antibody has two identical binding sites and grabs two viruses at once. The viruses clump together (agglutination): they can't enter cells any more, and phagocytes can eat the whole clump.",
          "Passt! Jeder Antikörper hat zwei gleiche Bindungsstellen und packt zwei Viren gleichzeitig. Die Viren verklumpen (Agglutination): Sie können nicht mehr in Zellen eindringen, und Fresszellen fressen den ganzen Klumpen.",
        )
      : run === "miss"
        ? tx(
            "No match: the binding site of this antibody has a different shape than the antigen. Each antibody only fits one antigen, like a key fits one lock. Try another one!",
            "Passt nicht: Die Bindungsstelle dieses Antikörpers hat eine andere Form als das Antigen. Jeder Antikörper passt nur zu einem Antigen, wie ein Schlüssel zu einem Schloss. Probier einen anderen!",
          )
        : run === "eaten"
          ? tx("The macrophage engulfs the clump and digests it. The infection is under control.", "Die Makrophage nimmt den Klumpen auf und verdaut ihn. Die Infektion ist unter Kontrolle.")
          : tx(
              "These viruses carry antigens of one shape on their surface. Which antibody's binding sites fit them? Send one in!",
              "Diese Viren tragen Antigene einer bestimmten Form auf ihrer Oberfläche. Zu welchem Antikörper passen die Bindungsstellen? Schick einen los!",
            );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface p-1.5 sm:p-3">
        <svg viewBox="0 0 560 300" className="mx-auto block h-auto w-full max-w-[600px]" role="img" aria-label={t(tx("Antibodies and antigens", "Antikörper und Antigene"))}>
          {CLUMP.pathogens.map((v, i) => {
            const free = FREE[i];
            return (
              <motion.g
                key={`v${i}-${target}`}
                initial={{ x: free[0], y: free[1], opacity: 0 }}
                animate={
                  run === "eaten"
                    ? { x: 300, y: 150, opacity: 0, scale: 0.4 }
                    : clumped
                      ? { x: v.x, y: v.y, opacity: 1, scale: 1 }
                      : reduce
                        ? { x: free[0], y: free[1], opacity: 1, scale: 1 }
                        : { x: free[0], y: [free[1], free[1] - 6, free[1]], opacity: 1, scale: 1 }
                }
                transition={
                  run === "eaten"
                    ? { duration: 1.2, delay: 0.9 }
                    : clumped
                      ? { type: "spring", stiffness: 60, damping: 14, delay: 0.9 }
                      : { y: { duration: 3 + (i % 3) * 0.7, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.4 }, x: { type: "spring", stiffness: 60, damping: 14 } }
                }
              >
                <VirusParticle r={RP} shape={target} s={S} angles={v.angles} />
              </motion.g>
            );
          })}
          {sent &&
            CLUMP.antibodies.map((a, i) => {
              const startX = -30 - i * 18;
              const startY = 40 + i * 42;
              const fit = sent === target;
              const near = FREE[i % FREE.length];
              return (
                <motion.g
                  key={`ab${round}-${i}`}
                  initial={{ x: startX, y: startY, rotate: 0, opacity: 1 }}
                  animate={
                    run === "eaten"
                      ? { x: 300, y: 150, opacity: 0, scale: 0.4, rotate: a.rot }
                      : fit
                        ? { x: a.x, y: a.y, rotate: a.rot }
                        : { x: [startX, near[0] - 40, near[0] - 90], y: [startY, near[1] + 30, near[1] + 70], rotate: [0, 60, 140], opacity: [1, 1, 0] }
                  }
                  transition={run === "eaten" ? { duration: 1.2, delay: 0.9 } : fit ? { type: "spring", stiffness: 50, damping: 13, delay: 0.9 + i * 0.05 } : { duration: 2.4, times: [0, 0.55, 1], delay: i * 0.08 }}
                >
                  <Antibody shape={sent} s={S} />
                </motion.g>
              );
            })}
          <motion.g initial={{ x: 640, y: 150, opacity: 0 }} animate={run === "eaten" ? { x: 300, y: 150, opacity: 1 } : { x: 640, y: 150, opacity: 0 }} transition={{ type: "spring", stiffness: 40, damping: 14 }}>
            <Macrophage r={92} />
          </motion.g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink-2">{t(tx("Send antibody:", "Antikörper losschicken:"))}</span>
        {CHOICES.map((c, i) => (
          <motion.button
            key={c}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => send(c)}
            disabled={clumped}
            className={cn(
              "flex h-11 items-center gap-1 rounded-xl border px-2.5 text-[13.5px] font-semibold disabled:opacity-50",
              sent === c ? (run === "miss" ? "border-danger/50 bg-danger/[0.06]" : "border-blob bg-blob-soft text-blob-ink") : "border-line text-ink hover:bg-hover",
            )}
            aria-label={`${t(tx("Antibody", "Antikörper"))} ${"ABC"[i]}`}
          >
            <svg viewBox="-24 -28 48 48" width={34} height={34} aria-hidden>
              <Antibody shape={c} s={S} />
            </svg>
            {"ABC"[i]}
          </motion.button>
        ))}
        {run === "fit" && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setRun("eaten")}
            className="flex h-10 items-center rounded-xl bg-ink px-3.5 text-[13.5px] font-semibold text-paper"
          >
            {t(tx("Call a phagocyte", "Fresszelle rufen"))}
          </motion.button>
        )}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => reset(CHOICES[(CHOICES.indexOf(target) + 1) % CHOICES.length])}
            className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
          >
            <Shuffle className="size-4" /> {t(tx("Other virus", "Anderes Virus"))}
          </button>
          <button type="button" onClick={() => reset()} className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-hover hover:text-ink" aria-label={t(tx("Start again", "Neu starten"))}>
            <RotateCcw className="size-4" />
          </button>
        </div>
      </div>

      <motion.p
        key={`${run}-${round}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed", run === "fit" || run === "eaten" ? "bg-ok/10 text-ink" : run === "miss" ? "bg-danger/[0.07] text-ink" : "bg-hover/60 text-ink-2")}
      >
        {t(msg)}
      </motion.p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task picture: one antigen, four antibodies A to D

/**
 * `options[i]` is the shape at the tips of antibody i; `same` marks one antibody that carries the
 * antigen's own shape as a bump (same shape, not the counter-shape).
 */
export function ImmuneLockKeyPicture({ shape, options, same = -1 }: { shape: Epitope; options: Epitope[]; same?: number }) {
  const t = useText();
  return (
    <svg viewBox="0 0 440 200" className="mx-auto block h-auto w-full max-w-[460px]" role="img" aria-label={t(tx("Antigen and four antibodies", "Antigen und vier Antikörper"))}>
      {/* a piece of the pathogen's surface with its antigens pointing down */}
      <rect x={110} y={-40} width={220} height={84} rx={26} fill={PAINT.virus.fill} stroke={PAINT.virus.stroke} strokeWidth={2} />
      {[165, 220, 275].map((x) => (
        <path key={x} d={bumpPath(shape, S + 1)} transform={`translate(${x} 43) rotate(180)`} fill={PAINT.virus.stroke} />
      ))}
      {options.map((o, i) => {
        const x = 70 + i * 100;
        return (
          <g key={i} transform={`translate(${x} 126) scale(1.6)`}>
            {i === same ? <SameShape shape={o} /> : <Antibody shape={o} s={S} color={AB_COLOR} />}
            <text x={0} y={AB.stem + 14} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
              {"ABCD"[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** A Y whose tips carry the antigen's own shape as a bump: looks similar, but can't bind. */
function SameShape({ shape }: { shape: Epitope }) {
  const a = (AB.ang * Math.PI) / 180;
  const tip = (side: -1 | 1): [number, number] => [side * AB.arm * Math.sin(a), -AB.arm * Math.cos(a)];
  return (
    <g>
      <path d={`M 0 ${AB.stem} L 0 0 L ${tip(-1)[0]} ${tip(-1)[1]} M 0 0 L ${tip(1)[0]} ${tip(1)[1]}`} fill="none" stroke={AB_COLOR} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      {([-1, 1] as const).map((side) => {
        const [x, y] = tip(side);
        return <path key={side} d={bumpPath(shape, S)} transform={`translate(${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}) rotate(${side * 40})`} fill={AB_COLOR} />;
      })}
    </g>
  );
}
