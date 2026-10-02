"use client";

import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, Zap } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { ionText, roman } from "../redox-data";

// Electrons travel from the reducing agent to the oxidising agent. The oxidation numbers
// (Roman numerals, as in German school books) update, and the half-equations appear.

type Particle = {
  id: string;
  symbol: string;
  at: [number, number];
  /** Position after the reaction (molecules split into ions). */
  to?: [number, number];
  r: [number, number];
  ox: [number, number];
  side: "left" | "right";
};

type Scene = {
  id: string;
  label: string;
  particles: Particle[];
  /** One electron per move: [from, to]. */
  moves: [string, string][];
  /** Atoms joined in a molecule before the reaction. */
  bonds?: [string, string][];
  ox: string;
  red: string;
  total: string;
  donor: Text;
  acceptor: Text;
};

const L = 102;
const R = 278;

const SCENES: Scene[] = [
  {
    id: "mgo",
    label: "Mg + O2",
    particles: [
      { id: "m1", symbol: "Mg", at: [L, 70], r: [28, 23], ox: [0, 2], side: "left" },
      { id: "m2", symbol: "Mg", at: [L, 166], r: [28, 23], ox: [0, 2], side: "left" },
      { id: "o1", symbol: "O", at: [R, 94], to: [R, 70], r: [22, 29], ox: [0, -2], side: "right" },
      { id: "o2", symbol: "O", at: [R, 142], to: [R, 166], r: [22, 29], ox: [0, -2], side: "right" },
    ],
    moves: [
      ["m1", "o1"],
      ["m1", "o1"],
      ["m2", "o2"],
      ["m2", "o2"],
    ],
    bonds: [["o1", "o2"]],
    ox: "\\ce{Mg -> Mg^2+ + 2e-} \\quad | \\cdot 2",
    red: "\\ce{O2 + 4e- -> 2O^2-}",
    total: "\\ce{2Mg + O2 -> 2MgO}",
    donor: tx("**Magnesium** gives electrons away: it is **oxidised** and acts as the **reducing agent**.", "**Magnesium** gibt Elektronen ab: Es wird **oxidiert** und ist das **Reduktionsmittel**."),
    acceptor: tx("**Oxygen** takes the electrons up: it is **reduced** and acts as the **oxidising agent**.", "**Sauerstoff** nimmt die Elektronen auf: Er wird **reduziert** und ist das **Oxidationsmittel**."),
  },
  {
    id: "fecu",
    label: "Fe + Cu^2+",
    particles: [
      { id: "fe", symbol: "Fe", at: [L, 118], r: [28, 24], ox: [0, 2], side: "left" },
      { id: "cu", symbol: "Cu", at: [R, 118], r: [23, 28], ox: [2, 0], side: "right" },
    ],
    moves: [
      ["fe", "cu"],
      ["fe", "cu"],
    ],
    ox: "\\ce{Fe -> Fe^2+ + 2e-}",
    red: "\\ce{Cu^2+ + 2e- -> Cu}",
    total: "\\ce{Fe + Cu^2+ -> Fe^2+ + Cu}",
    donor: tx("**Iron** gives electrons away: it is **oxidised** and acts as the **reducing agent**.", "**Eisen** gibt Elektronen ab: Es wird **oxidiert** und ist das **Reduktionsmittel**."),
    acceptor: tx("The **copper ion** takes them up: it is **reduced** and acts as the **oxidising agent**.", "Das **Kupfer-Ion** nimmt sie auf: Es wird **reduziert** und ist das **Oxidationsmittel**."),
  },
  {
    id: "nacl",
    label: "Na + Cl2",
    particles: [
      { id: "n1", symbol: "Na", at: [L, 70], r: [30, 22], ox: [0, 1], side: "left" },
      { id: "n2", symbol: "Na", at: [L, 166], r: [30, 22], ox: [0, 1], side: "left" },
      { id: "c1", symbol: "Cl", at: [R, 92], to: [R, 70], r: [23, 31], ox: [0, -1], side: "right" },
      { id: "c2", symbol: "Cl", at: [R, 144], to: [R, 166], r: [23, 31], ox: [0, -1], side: "right" },
    ],
    moves: [
      ["n1", "c1"],
      ["n2", "c2"],
    ],
    bonds: [["c1", "c2"]],
    ox: "\\ce{Na -> Na+ + e-} \\quad | \\cdot 2",
    red: "\\ce{Cl2 + 2e- -> 2Cl-}",
    total: "\\ce{2Na + Cl2 -> 2NaCl}",
    donor: tx("**Sodium** gives electrons away: it is **oxidised** and acts as the **reducing agent**.", "**Natrium** gibt Elektronen ab: Es wird **oxidiert** und ist das **Reduktionsmittel**."),
    acceptor: tx("**Chlorine** takes them up: it is **reduced** and acts as the **oxidising agent**. No oxygen involved, still a redox reaction!", "**Chlor** nimmt sie auf: Es wird **reduziert** und ist das **Oxidationsmittel**. Ganz ohne Sauerstoff, trotzdem eine Redoxreaktion!"),
  },
  {
    id: "cuag",
    label: "Cu + 2Ag+",
    particles: [
      { id: "cu", symbol: "Cu", at: [L, 118], r: [27, 23], ox: [0, 2], side: "left" },
      { id: "a1", symbol: "Ag", at: [R, 70], r: [22, 27], ox: [1, 0], side: "right" },
      { id: "a2", symbol: "Ag", at: [R, 166], r: [22, 27], ox: [1, 0], side: "right" },
    ],
    moves: [
      ["cu", "a1"],
      ["cu", "a2"],
    ],
    ox: "\\ce{Cu -> Cu^2+ + 2e-}",
    red: "\\ce{Ag+ + e- -> Ag} \\quad | \\cdot 2",
    total: "\\ce{Cu + 2Ag+ -> Cu^2+ + 2Ag}",
    donor: tx("**Copper** gives electrons away: it is **oxidised** and acts as the **reducing agent**.", "**Kupfer** gibt Elektronen ab: Es wird **oxidiert** und ist das **Reduktionsmittel**."),
    acceptor: tx("The **silver ions** take one each: they are **reduced** and act as the **oxidising agent**.", "Die **Silber-Ionen** nehmen je eins auf: Sie werden **reduziert** und sind das **Oxidationsmittel**."),
  },
];

const H = 228;

export function RedoxTransfer() {
  const t = useText();
  const scope = useId();
  const [sceneId, setSceneId] = useState("mgo");
  const [phase, setPhase] = useState<"idle" | "moving" | "done">("idle");
  const scene = SCENES.find((s) => s.id === sceneId) ?? SCENES[0];
  const done = phase === "done";
  const byId = (id: string) => scene.particles.find((p) => p.id === id)!;
  const pos = (p: Particle) => (done && p.to ? p.to : p.at);
  const radius = (p: Particle) => p.r[done ? 1 : 0];
  const charge = (p: Particle) => (done ? p.ox[1] : p.ox[0]);

  const choose = (id: string) => {
    setSceneId(id);
    setPhase("idle");
  };

  // Electrons waiting on each donor, spread over its right-hand side.
  const waiting = scene.moves.map(([from, to], k) => {
    const p = byId(from);
    const mine = scene.moves.filter(([f]) => f === from);
    const idx = scene.moves.slice(0, k).filter(([f]) => f === from).length;
    const spread = mine.length > 1 ? (idx - (mine.length - 1) / 2) * 0.7 : 0;
    const q = byId(to);
    const angle = Math.atan2(q.at[1] - p.at[1], q.at[0] - p.at[0]) + spread;
    const r0 = p.r[0] + 7;
    return { from: [p.at[0] + Math.cos(angle) * r0, p.at[1] + Math.sin(angle) * r0] as [number, number], to: q, k };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {SCENES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => choose(s.id)}
            className={cn("relative h-9 rounded-lg border px-3 transition-colors", s.id === sceneId ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {s.id === sceneId && <motion.span layoutId={`${scope}-scene`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">
              <MathView src={`\\ce{${s.label}}`} size="sm" animate={false} />
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface px-2 py-2">
        <svg viewBox={`0 0 380 ${H}`} className="mx-auto block w-full max-w-[540px]" role="img" aria-label={t(tx("Electrons move from one particle to another", "Elektronen wandern von einem Teilchen zum anderen"))}>
          {/* molecule bonds before the reaction */}
          <AnimatePresence>
            {!done &&
              (scene.bonds ?? []).map(([a, b]) => (
                <motion.line
                  key={`${scene.id}-${a}-${b}`}
                  x1={byId(a).at[0]}
                  y1={byId(a).at[1]}
                  x2={byId(b).at[0]}
                  y2={byId(b).at[1]}
                  stroke="var(--ink-3)"
                  strokeWidth={5}
                  strokeLinecap="round"
                  exit={{ opacity: 0 }}
                />
              ))}
          </AnimatePresence>

          {scene.particles.map((p) => {
            const [x, y] = pos(p);
            const r = radius(p);
            const q = charge(p);
            const ox = done ? p.ox[1] : p.ox[0];
            const labelX = p.side === "left" ? x - r - 30 : x + r + 30;
            return (
              <g key={`${scene.id}-${p.id}`}>
                <motion.circle
                  initial={false}
                  animate={{ cx: x, cy: y, r }}
                  transition={{ type: "spring", stiffness: 160, damping: 18 }}
                  style={{ fill: q > 0 ? "color-mix(in oklab, var(--blob) 14%, var(--raised))" : q < 0 ? "color-mix(in oklab, var(--ink) 12%, var(--raised))" : "var(--raised)", stroke: "var(--ink-3)" }}
                  strokeWidth={1.6}
                />
                <motion.text initial={false} animate={{ x, y: y + 5.5 }} transition={{ type: "spring", stiffness: 160, damping: 18 }} textAnchor="middle" className="fill-ink font-math" style={{ fontSize: q === 0 ? 17 : 14.5 }}>
                  {q === 0 ? p.symbol : ionText(p.symbol, q)}
                </motion.text>
                {/* oxidation number pill */}
                <motion.g initial={false} animate={{ x: labelX, y }} transition={{ type: "spring", stiffness: 160, damping: 18 }}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.g key={ox} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}>
                      <rect x={-21} y={-12} width={42} height={24} rx={12} style={{ fill: done && p.ox[0] !== p.ox[1] ? "var(--blob)" : "var(--hover)" }} />
                      <text x={0} y={5} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: done && p.ox[0] !== p.ox[1] ? "white" : "var(--ink-2)" }}>
                        {roman(ox)}
                      </text>
                    </motion.g>
                  </AnimatePresence>
                </motion.g>
              </g>
            );
          })}

          {/* electrons */}
          {phase !== "done" &&
            waiting.map(({ from, to, k }) => {
              const [x2, y2] = to.to ?? to.at;
              const dx = from[0] - x2;
              const dy = from[1] - y2;
              const len = Math.hypot(dx, dy) || 1;
              const end: [number, number] = [x2 + (dx / len) * (to.r[1] - 4), y2 + (dy / len) * (to.r[1] - 4)];
              const mid: [number, number] = [(from[0] + end[0]) / 2, Math.min(from[1], end[1]) - 34];
              const last = k === scene.moves.length - 1;
              return (
                <motion.g
                  key={`${scene.id}-e${k}`}
                  initial={false}
                  animate={phase === "moving" ? { x: [from[0], mid[0], end[0]], y: [from[1], mid[1], end[1]] } : { x: from[0], y: from[1] }}
                  transition={phase === "moving" ? { duration: 0.9, delay: 0.1 + k * 0.28, ease: "easeInOut" } : { duration: 0 }}
                  onAnimationComplete={() => phase === "moving" && last && setPhase("done")}
                >
                  <circle r={7} fill="var(--blob)" />
                  <text y={4} textAnchor="middle" fill="white" style={{ fontSize: 11, fontWeight: 700 }}>
                    e⁻
                  </text>
                </motion.g>
              );
            })}

        </svg>
      </div>

      <div className="-mt-2 text-center text-[12.5px] text-ink-3">{t(tx("Electrons travel from the reducing agent to the oxidising agent.", "Elektronen wandern vom Reduktionsmittel zum Oxidationsmittel."))}</div>

      <div className="flex flex-wrap items-center gap-3">
        {phase === "idle" ? (
          <button type="button" onClick={() => setPhase("moving")} className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white hover:bg-blob-deep">
            <Zap className="size-4" /> {t(tx("Transfer electrons", "Elektronen übertragen"))}
          </button>
        ) : (
          <button type="button" onClick={() => setPhase("idle")} disabled={phase === "moving"} className="flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-[14px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40">
            <RotateCcw className="size-4" /> {t(tx("Again", "Noch mal"))}
          </button>
        )}
        <span className="text-[13px] text-ink-3">{t(tx("The pills show the oxidation numbers.", "Die Kärtchen zeigen die Oxidationszahlen."))}</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div key={`${scene.id}-done`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[13.5px] text-ink-2">
                <Inline text={scene.donor} />
              </div>
              <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[13.5px] text-ink-2">
                <Inline text={scene.acceptor} />
              </div>
            </div>
            <div className="space-y-2 overflow-x-auto rounded-xl border border-line bg-surface px-4 py-3">
              {[
                { label: tx("Oxidation", "Oxidation"), src: scene.ox },
                { label: tx("Reduction", "Reduktion"), src: scene.red },
                { label: tx("Redox reaction", "Redoxreaktion"), src: scene.total },
              ].map((row, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="w-32 shrink-0 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(row.label)}</span>
                  <MathView src={row.src} size="md" animate={false} />
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.p key={`${scene.id}-idle`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[13.5px] leading-relaxed text-ink-2">
            {t(tx("Who gives electrons away, who takes them? Watch the oxidation numbers when you press the button.", "Wer gibt Elektronen ab, wer nimmt sie auf? Achte auf die Oxidationszahlen, wenn du auf den Knopf drückst."))}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
