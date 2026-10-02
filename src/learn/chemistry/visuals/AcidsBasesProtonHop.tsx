"use client";

import { AnimatePresence, motion } from "motion/react";
import { MoveRight, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

// A proton hops from the acid (proton donor) to the base (proton acceptor). The acceptor
// catches it with a lone pair, the charges appear, and the equation completes itself.

type P = { x: number; y: number };
type Particle = {
  symbol: string;
  r: number;
  at: P;
  /** Other H atoms of this particle. */
  hs: P[];
  /** Label before and after the proton hop (plain text with sub/superscripts). */
  before: string;
  after: string;
  /** Charge before and after. */
  q: [number, number];
};

type Scene = {
  id: string;
  tab: Text;
  left: Particle;
  right: Particle;
  /** Which side gives the proton. */
  donor: "left" | "right";
  from: P;
  to: P;
  start: string;
  end: string;
  caption: Text;
};

const L = 95;
const R = 265;
const Y = 98;

const SCENES: Scene[] = [
  {
    id: "acid",
    tab: tx("Acid + water", "Säure + Wasser"),
    left: { symbol: "Cl", r: 30, at: { x: L, y: Y }, hs: [], before: "HCl", after: "Cl⁻", q: [0, -1] },
    right: { symbol: "O", r: 24, at: { x: R, y: Y }, hs: [{ x: R - 19, y: Y + 24 }, { x: R + 19, y: Y + 24 }], before: "H₂O", after: "H₃O⁺", q: [0, 1] },
    donor: "left",
    from: { x: L + 40, y: Y },
    to: { x: R, y: Y - 36 },
    start: "\\ce{HCl + H2O}",
    end: "\\ce{HCl + H2O -> H3O+ + Cl-}",
    caption: tx(
      "Hydrogen chloride hands its proton to a water molecule. Water catches it with a lone pair and becomes an **oxonium ion**. The electron stays behind: a **chloride ion**.",
      "Chlorwasserstoff gibt sein Proton an ein Wassermolekül ab. Das Wasser fängt es mit einem freien Elektronenpaar und wird zum **Oxonium-Ion**. Das Elektron bleibt zurück: ein **Chlorid-Ion**.",
    ),
  },
  {
    id: "base",
    tab: tx("Base + water", "Base + Wasser"),
    left: { symbol: "N", r: 25, at: { x: L, y: Y }, hs: [{ x: L - 25, y: Y + 19 }, { x: L + 25, y: Y + 19 }, { x: L, y: Y + 36 }], before: "NH₃", after: "NH₄⁺", q: [0, 1] },
    right: { symbol: "O", r: 24, at: { x: R, y: Y }, hs: [{ x: R + 19, y: Y + 24 }], before: "H₂O", after: "OH⁻", q: [0, -1] },
    donor: "right",
    from: { x: R - 35, y: Y + 6 },
    to: { x: L, y: Y - 37 },
    start: "\\ce{NH3 + H2O}",
    end: "\\ce{NH3 + H2O <=> NH4+ + OH-}",
    caption: tx(
      "This time **water** is the proton donor: ammonia takes a proton from it. Ammonium ions form, and the water is left as a **hydroxide ion**. That's why ammonia solution is alkaline.",
      "Diesmal ist **Wasser** der Protonendonator: Ammoniak nimmt ihm ein Proton ab. Es entstehen Ammonium-Ionen, und das Wasser bleibt als **Hydroxid-Ion** zurück. Deshalb ist Ammoniakwasser alkalisch.",
    ),
  },
  {
    id: "neutral",
    tab: tx("Neutralisation", "Neutralisation"),
    left: { symbol: "O", r: 24, at: { x: L, y: Y }, hs: [{ x: L - 19, y: Y + 24 }, { x: L + 19, y: Y + 24 }], before: "H₃O⁺", after: "H₂O", q: [1, 0] },
    right: { symbol: "O", r: 24, at: { x: R, y: Y }, hs: [{ x: R + 19, y: Y + 24 }], before: "OH⁻", after: "H₂O", q: [-1, 0] },
    donor: "left",
    from: { x: L, y: Y - 36 },
    to: { x: R - 19, y: Y + 24 },
    start: "\\ce{H3O+ + OH-}",
    end: "\\ce{H3O+ + OH- -> 2H2O}",
    caption: tx(
      "The oxonium ion hands its extra proton to the hydroxide ion. Both charges disappear: **two water molecules**. This is the heart of every neutralisation.",
      "Das Oxonium-Ion gibt sein zusätzliches Proton an das Hydroxid-Ion ab. Beide Ladungen verschwinden: **zwei Wassermoleküle**. Das ist der Kern jeder Neutralisation.",
    ),
  },
];

const H_R = 13;

function Atom({ at, r, symbol, strong }: { at: P; r: number; symbol: string; strong?: boolean }) {
  return (
    <g>
      <circle cx={at.x} cy={at.y} r={r} style={{ fill: strong ? "color-mix(in oklab, var(--ink) 10%, var(--raised))" : "var(--raised)", stroke: "var(--ink-3)" }} strokeWidth={1.6} />
      <text x={at.x} y={at.y + (strong ? 6 : 4.5)} textAnchor="middle" className={strong ? "fill-ink font-semibold" : "fill-ink-2"} style={{ fontSize: strong ? 18 : 13 }}>
        {symbol}
      </text>
    </g>
  );
}

function Charge({ at, r, q }: { at: P; r: number; q: number }) {
  return (
    <AnimatePresence>
      {q !== 0 && (
        <motion.g key={q} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.4 }} style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}>
          <circle cx={at.x + r * 0.85} cy={at.y - r * 0.85} r={10} fill="var(--blob)" />
          <text x={at.x + r * 0.85} y={at.y - r * 0.85 + 4.5} textAnchor="middle" fill="white" style={{ fontSize: 15, fontWeight: 700 }}>
            {q > 0 ? "+" : "−"}
          </text>
        </motion.g>
      )}
    </AnimatePresence>
  );
}

export function AcidsBasesProtonHop() {
  const t = useText();
  const scope = useId();
  const [sceneId, setSceneId] = useState("acid");
  const [phase, setPhase] = useState<"idle" | "moving" | "done">("idle");
  const scene = SCENES.find((s) => s.id === sceneId) ?? SCENES[0];
  const after = phase === "done";
  const mid = { x: (scene.from.x + scene.to.x) / 2, y: Math.min(scene.from.y, scene.to.y) - 58 };
  const sides = [
    { p: scene.left, side: "left" as const },
    { p: scene.right, side: "right" as const },
  ];

  const choose = (id: string) => {
    setSceneId(id);
    setPhase("idle");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {SCENES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => choose(s.id)}
            className={cn("relative h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors", s.id === sceneId ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {s.id === sceneId && <motion.span layoutId={`${scope}-scene`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">{t(s.tab)}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface px-2 py-2">
        <svg viewBox="0 0 360 214" className="mx-auto block w-full max-w-[520px]" role="img" aria-label={t(tx("A proton moves from one particle to another", "Ein Proton wandert von einem Teilchen zum anderen"))}>
          {sides.map(({ p, side }) => {
            const isDonor = side === scene.donor;
            return (
              <g key={`${scene.id}-${side}`}>
                {/* bonds */}
                {p.hs.map((h, i) => (
                  <line key={i} x1={p.at.x} y1={p.at.y} x2={h.x} y2={h.y} stroke="var(--ink-3)" strokeWidth={2} />
                ))}
                {p.hs.map((h, i) => (
                  <Atom key={`h${i}`} at={h} r={H_R} symbol="H" />
                ))}
                <Atom at={p.at} r={p.r} symbol={p.symbol} strong />
                {/* the lone pair that catches the proton */}
                <AnimatePresence>
                  {!isDonor && phase === "idle" && (
                    <motion.g key="pair" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {[-5, 5].map((dx) => {
                        const vx = scene.to.x - p.at.x;
                        const vy = scene.to.y - p.at.y;
                        const len = Math.hypot(vx, vy) || 1;
                        const ux = vx / len;
                        const uy = vy / len;
                        const cx = p.at.x + ux * (p.r + 6) - uy * dx;
                        const cy = p.at.y + uy * (p.r + 6) + ux * dx;
                        return <circle key={dx} cx={cx} cy={cy} r={3} fill="var(--blob)" />;
                      })}
                    </motion.g>
                  )}
                </AnimatePresence>
                <Charge at={p.at} r={p.r} q={p.q[after ? 1 : 0]} />
                <text x={p.at.x} y={186} textAnchor="middle" className="fill-ink font-math" style={{ fontSize: 22 }}>
                  {after ? p.after : p.before}
                </text>
                <AnimatePresence>
                  {phase !== "idle" && (
                    <motion.text
                      key={`${scene.id}-role-${side}`}
                      x={p.at.x}
                      y={207}
                      textAnchor="middle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fill-blob-ink"
                      style={{ fontSize: 12.5, fontWeight: 600 }}
                    >
                      {t(isDonor ? tx("proton donor (acid)", "Protonendonator (Säure)") : tx("proton acceptor (base)", "Protonenakzeptor (Base)"))}
                    </motion.text>
                  )}
                </AnimatePresence>
              </g>
            );
          })}

          {/* the bond the proton is leaving or joining */}
          {phase === "done" ? (
            <line x1={(scene.donor === "left" ? scene.right : scene.left).at.x} y1={(scene.donor === "left" ? scene.right : scene.left).at.y} x2={scene.to.x} y2={scene.to.y} stroke="var(--blob)" strokeWidth={2.5} />
          ) : phase === "idle" ? (
            <line x1={(scene.donor === "left" ? scene.left : scene.right).at.x} y1={(scene.donor === "left" ? scene.left : scene.right).at.y} x2={scene.from.x} y2={scene.from.y} stroke="var(--ink-3)" strokeWidth={2} />
          ) : null}

          {/* the proton */}
          <motion.g
            key={scene.id}
            initial={false}
            animate={phase === "idle" ? { x: scene.from.x, y: scene.from.y } : phase === "moving" ? { x: [scene.from.x, mid.x, scene.to.x], y: [scene.from.y, mid.y, scene.to.y] } : { x: scene.to.x, y: scene.to.y }}
            transition={phase === "moving" ? { duration: 1.1, ease: "easeInOut" } : { duration: 0 }}
            onAnimationComplete={() => phase === "moving" && setPhase("done")}
          >
            <circle cx={0} cy={0} r={H_R + 1} fill="var(--blob)" />
            <text x={0} y={4.5} textAnchor="middle" fill="white" style={{ fontSize: 13, fontWeight: 700 }}>
              {phase === "moving" ? "H⁺" : "H"}
            </text>
          </motion.g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {phase === "idle" ? (
          <button type="button" onClick={() => setPhase("moving")} className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white hover:bg-blob-deep">
            <MoveRight className="size-4" /> {t(tx("Let the proton hop", "Proton übertragen"))}
          </button>
        ) : (
          <button type="button" onClick={() => setPhase("idle")} disabled={phase === "moving"} className="flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-[14px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40">
            <RotateCcw className="size-4" /> {t(tx("Again", "Noch mal"))}
          </button>
        )}
        <div className="min-w-0 overflow-x-auto">
          <MathView src={after ? scene.end : scene.start} size="md" scope={`${scope}-${scene.id}`} />
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={`${scene.id}-${after}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] leading-relaxed text-ink-2">
          {after ? (
            <Inline text={scene.caption} />
          ) : (
            t(tx("Who gives the proton away, and who takes it? Press the button and watch.", "Wer gibt das Proton ab, wer nimmt es auf? Drück auf den Knopf und schau zu."))
          )}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
