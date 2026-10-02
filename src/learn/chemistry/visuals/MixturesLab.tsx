"use client";

// The separation lab for the "mixtures" topic: pick a mixture, then use separation steps one
// after another. Each step acts on the beaker (the model in mixtures-lab.ts) and separated
// substances land on the shelf. Wrong orders show what goes wrong.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDownToLine, Check, Droplets, Flame, FlaskRound, Funnel, Grid3x3, Magnet, RotateCcw, Undo2 } from "lucide-react";
import { useState, type ComponentType } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { COMPS, SCENARIOS, STEPS, contentsOf, namesOf, run, separated, solved, type Comp, type Product, type Step, type Vessel } from "../mixtures-lab";

// ---------------------------------------------------------------------------
// Grains: a few dozen little shapes per substance, at fixed seeded places.

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

const COUNT: Partial<Record<Comp, number>> = { sand: 34, salt: 18, sugar: 16, iron: 20, gravel: 6, sulfur: 26 };
const SEED: Record<Comp, number> = { salt: 3, sugar: 5, sand: 7, iron: 11, gravel: 13, sulfur: 17, water: 19, ethanol: 23 };

export const GRAIN_COLOR: Record<Comp, string> = {
  sand: "color-mix(in oklab, var(--subject-sand) 55%, var(--surface))",
  salt: "var(--raised)",
  sugar: "var(--raised)",
  iron: "var(--ink-2)",
  gravel: "color-mix(in oklab, var(--ink-3) 55%, var(--surface))",
  sulfur: "color-mix(in oklab, var(--subject-sand) 85%, var(--surface))",
  water: "color-mix(in oklab, var(--subject-sky) 24%, transparent)",
  ethanol: "color-mix(in oklab, var(--subject-sky) 24%, transparent)",
};

type GrainPos = { x: number; y: number; a: number };

/** Places in a box [x0, x1] × [y0, y1] for a substance. */
export function grainPlaces(c: Comp, x0: number, x1: number, y0: number, y1: number, n = COUNT[c] ?? 0): GrainPos[] {
  const rnd = seeded(SEED[c] * 97 + Math.round(x0 + y0));
  return Array.from({ length: n }, () => ({ x: r1(x0 + rnd() * (x1 - x0)), y: r1(y0 + rnd() * (y1 - y0)), a: Math.round(rnd() * 180) }));
}

export function Grain({ c, p, scale = 1 }: { c: Comp; p: GrainPos; scale?: number }) {
  const k = scale;
  switch (c) {
    case "salt":
    case "sugar": {
      const s = (c === "salt" ? 4.2 : 5) * k;
      return <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={0.6} transform={`translate(${p.x} ${p.y}) rotate(${p.a})`} fill={GRAIN_COLOR[c]} stroke="var(--ink-3)" strokeWidth={0.8} />;
    }
    case "iron":
      return <rect x={-0.9 * k} y={-3.4 * k} width={1.8 * k} height={6.8 * k} rx={0.8} transform={`translate(${p.x} ${p.y}) rotate(${p.a})`} fill={GRAIN_COLOR.iron} />;
    case "gravel":
      return <ellipse cx={p.x} cy={p.y} rx={7.5 * k} ry={5.6 * k} fill={GRAIN_COLOR.gravel} stroke="var(--ink-3)" strokeWidth={0.8} />;
    default:
      return <circle cx={p.x} cy={p.y} r={(c === "sulfur" ? 2.7 : 2.5) * k} fill={GRAIN_COLOR[c]} />;
  }
}

// ---------------------------------------------------------------------------
// The beaker

const BX0 = 46;
const BX1 = 174;
const FLOOR = 186;
const LIQ_TOP = 96;

const ICONS: Record<Step, ComponentType<{ className?: string }>> = {
  magnet: Magnet,
  sieve: Grid3x3,
  dissolve: Droplets,
  filter: Funnel,
  decant: ArrowDownToLine,
  evaporate: Flame,
  distil: FlaskRound,
};

/** Where each solid's grains sit: gravel at the very bottom, the rest mixed above it. */
function solidPlaces(c: Comp) {
  return c === "gravel" ? grainPlaces(c, BX0 + 10, BX1 - 10, FLOOR - 9, FLOOR - 7) : grainPlaces(c, BX0 + 5, BX1 - 5, FLOOR - 32, FLOOR - 4);
}

function Beaker({ vessel, last, count }: { vessel: Vessel; last: Step | null; count: number }) {
  const reduce = useReducedMotion();
  const t = useText();
  const quick = reduce ? { duration: 0 } : undefined;
  // How grains leave, depending on the step that took them.
  const leave = (c: Comp) =>
    last === "magnet" || last === "sieve"
      ? { y: -150, opacity: 0, transition: quick ?? { duration: 0.7, ease: "easeIn" as const, delay: c === "iron" ? 0 : 0.1 } }
      : last === "dissolve"
        ? { scale: 0, opacity: 0, transition: quick ?? { duration: 0.9 } }
        : last === "filter" || last === "decant"
          ? { x: 130, opacity: 0, transition: quick ?? { duration: 0.6 } }
          : { opacity: 0, transition: quick ?? { duration: 0.8 } };
  const wet = vessel.liquids.length > 0;
  const label = contentsOf(vessel).length ? t(namesOf(contentsOf(vessel))) : t(tx("empty", "leer"));
  return (
    <svg viewBox="0 0 220 200" className="block h-auto w-full" role="img" aria-label={`${t(tx("Beaker", "Becherglas"))}: ${label}`}>
      <AnimatePresence>
        {wet && (
          <motion.rect
            key={`liquid-${vessel.liquids.join()}`}
            x={BX0 - 3}
            width={BX1 - BX0 + 6}
            initial={{ y: FLOOR + 2, height: 0 }}
            animate={{ y: LIQ_TOP, height: FLOOR + 2 - LIQ_TOP }}
            exit={{ y: FLOOR + 2, height: 0, transition: quick ?? { duration: 1.1 } }}
            transition={quick ?? { duration: 0.8 }}
            fill={GRAIN_COLOR.water}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {vessel.dissolved.flatMap((c) =>
          grainPlaces(c, BX0 + 4, BX1 - 4, LIQ_TOP + 6, FLOOR - 4, 34).map((p, i) => (
            <motion.circle key={`d-${c}-${i}`} cx={p.x} cy={p.y} r={1.1} fill="var(--ink-3)" initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} exit={{ opacity: 0 }} transition={quick ?? { duration: 0.9, delay: (i % 7) * 0.08 }} />
          )),
        )}
      </AnimatePresence>
      <AnimatePresence>
        {vessel.solids.map((c) => (
          <motion.g key={`s-${c}`} initial={{ opacity: 0 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }} exit={leave(c)} style={{ transformBox: "fill-box", originX: 0.5, originY: 0.5 }}>
            {solidPlaces(c).map((p, i) => (
              <Grain key={i} c={c} p={p} scale={1.35} />
            ))}
          </motion.g>
        ))}
      </AnimatePresence>
      {/* steam while evaporating or distilling */}
      <AnimatePresence>
        {!reduce && (last === "evaporate" || last === "distil") && (
          <motion.g key={`steam-${count}`} initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.6 }}>
            {[70, 105, 140].map((x, i) => (
              <motion.circle key={x} cx={x} r={7} fill="color-mix(in oklab, var(--ink-3) 30%, transparent)" initial={{ cy: 100 }} animate={{ cy: 20, r: 13 }} transition={{ duration: 1.5, delay: i * 0.15 }} />
            ))}
          </motion.g>
        )}
      </AnimatePresence>
      <path d={`M${BX0 - 6} 34 L${BX0 - 6} ${FLOOR - 4} Q${BX0 - 6} ${FLOOR + 4} ${BX0 + 4} ${FLOOR + 4} L${BX1 - 4} ${FLOOR + 4} Q${BX1 + 6} ${FLOOR + 4} ${BX1 + 6} ${FLOOR - 4} L${BX1 + 6} 34`} fill="none" stroke="var(--ink-2)" strokeWidth={2.5} strokeLinejoin="round" />
      <path d={`M${BX0 - 12} 30 L${BX0 - 6} 34 M${BX1 + 12} 30 L${BX1 + 6} 34`} stroke="var(--ink-2)" strokeWidth={2.5} strokeLinecap="round" />
      {[0, 1, 2].map((i) => (
        <line key={i} x1={BX1 - 14} x2={BX1 - 2} y1={70 + i * 30} y2={70 + i * 30} stroke="var(--ink-3)" strokeWidth={1} />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The shelf

function Dish({ p }: { p: Product }) {
  const t = useText();
  const liquid = p.comps.every((c) => COMPS[c].liquid);
  const mixed = p.comps.length > 1;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className={cn("flex w-[104px] flex-col items-center gap-1 rounded-xl border p-2 text-center", p.lost ? "border-dashed border-line-2 bg-transparent" : mixed ? "border-danger/40 bg-danger/[0.04]" : "border-line bg-surface")}
    >
      <svg viewBox="0 0 80 44" className="h-10 w-[72px]" aria-hidden>
        {p.lost ? (
          <g fill="color-mix(in oklab, var(--ink-3) 35%, transparent)">
            <circle cx={28} cy={26} r={9} />
            <circle cx={40} cy={20} r={11} />
            <circle cx={53} cy={27} r={8} />
          </g>
        ) : liquid ? (
          <g>
            <path d="M32 6 L32 18 L20 38 Q19 41 23 41 L57 41 Q61 41 60 38 L48 18 L48 6" fill="none" stroke="var(--ink-2)" strokeWidth={1.8} strokeLinejoin="round" />
            <path d="M25.5 29 L54.5 29 L59 37.5 Q60 40 56 40 L24 40 Q20 40 21 37.5 Z" fill={GRAIN_COLOR.water} />
          </g>
        ) : (
          <g>
            {p.comps.flatMap((c) => grainPlaces(c, 20, 60, 24, 34, Math.ceil((COUNT[c] ?? 10) / 2.6)).map((q, i) => <Grain key={`${c}${i}`} c={c} p={q} scale={1.1} />))}
            <path d="M8 34 Q40 48 72 34" fill="none" stroke="var(--ink-2)" strokeWidth={1.8} strokeLinecap="round" />
          </g>
        )}
      </svg>
      <span className={cn("text-[12.5px] font-semibold leading-tight first-letter:uppercase", p.lost ? "text-ink-3" : "text-ink")}>{t(namesOf(p.comps))}</span>
      <span className={cn("text-[11px] leading-tight", mixed && !p.lost ? "font-medium text-danger" : "text-ink-3")}>{mixed && !p.lost ? t(tx("still mixed", "noch gemischt")) : t(p.label)}</span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

const PICKS = ["salt-sand-iron", "gravel-sand-salt", "salt-water", "wine", "mud"];

export function MixturesLab() {
  const t = useText();
  const [sid, setSid] = useState(PICKS[0]);
  const [steps, setSteps] = useState<Step[]>([]);
  const sc = SCENARIOS.find((s) => s.id === sid)!;
  const r = run(sc.start, steps);
  const done = solved(sc, r);
  const got = separated(sc, r);
  const last = steps.length ? steps[steps.length - 1] : null;
  const lastOutcome = r.log[r.log.length - 1];
  const rest = contentsOf(r.vessel);

  const pick = (id: string) => {
    setSid(id);
    setSteps([]);
  };
  const doStep = (s: Step) => {
    if (done || steps.length >= 8) return;
    setSteps((x) => [...x, s]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {PICKS.map((id) => {
          const s = SCENARIOS.find((x) => x.id === id)!;
          return (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              className={cn("h-9 rounded-lg px-3 text-[13px] font-medium transition-colors", sid === id ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
            >
              {t(s.name)}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] sm:items-start">
        <div className="space-y-1">
          <div className="relative mx-auto max-w-[240px]">
            <Beaker vessel={r.vessel} last={last} count={steps.length} />
            <AnimatePresence>
              {last && (
                <motion.div
                  key={steps.length}
                  initial={{ opacity: 0, y: 6, scale: 0.9 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, -4], scale: 1 }}
                  transition={{ duration: 1.8, times: [0, 0.15, 0.75, 1] }}
                  className="pointer-events-none absolute left-1/2 top-0 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-3 py-1 text-[12.5px] font-semibold text-paper"
                >
                  {(() => {
                    const I = ICONS[last];
                    return <I className="size-3.5" />;
                  })()}
                  {t(STEPS[last].name)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="text-center text-[12.5px] text-ink-3">
            {t(tx("In the beaker:", "Im Becherglas:"))} <span className="font-medium text-ink-2">{rest.length ? t(namesOf(rest)) : t(tx("nothing", "nichts"))}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            {t(tx("Separated", "Abgetrennt"))} · {got.length}/{sc.goal.length}
          </div>
          <div className="flex min-h-[104px] flex-wrap gap-2">
            <AnimatePresence initial={false}>
              {r.products.map((p, i) => (
                <Dish key={`${sid}-${i}-${p.comps.join()}`} p={p} />
              ))}
            </AnimatePresence>
            {!r.products.length && <p className="self-center text-[13px] text-ink-3">{t(tx("Separated substances land here.", "Hier landen die abgetrennten Stoffe."))}</p>}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {lastOutcome && (
              <motion.p
                key={steps.length}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                className={cn("rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed", lastOutcome.ok ? "bg-surface text-ink" : "bg-danger/[0.06] text-ink")}
              >
                <span className="font-semibold">{steps.length}. {t(STEPS[last!].name)}: </span>
                {t(lastOutcome.note)}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sc.tools.map((s) => {
          const I = ICONS[s];
          return (
            <motion.button
              key={s}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => doStep(s)}
              disabled={done}
              className="flex min-h-14 items-center gap-2.5 rounded-xl border border-line bg-raised px-3 py-2 text-left transition-colors hover:border-blob/50 hover:bg-blob-soft/40 disabled:opacity-40"
            >
              <I className="size-5 shrink-0 text-blob-ink" />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold leading-tight text-ink">{t(STEPS[s].name)}</span>
                <span className="block text-[11.5px] leading-tight text-ink-3">{t(STEPS[s].property)}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {steps.length > 0 && (
          <span className="flex flex-wrap items-center gap-1 text-[12.5px] text-ink-3">
            {steps.map((s, i) => (
              <span key={i} className="rounded-md bg-hover px-1.5 py-0.5 text-ink-2">
                {i + 1}. {t(STEPS[s].name)}
              </span>
            ))}
          </span>
        )}
        <div className="ml-auto flex gap-1">
          <button type="button" onClick={() => setSteps((x) => x.slice(0, -1))} disabled={!steps.length} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35">
            <Undo2 className="size-3.5" /> {t(tx("Undo", "Rückgängig"))}
          </button>
          <button type="button" onClick={() => setSteps([])} disabled={!steps.length} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35">
            <RotateCcw className="size-3.5" /> {t(tx("Start again", "Von vorn"))}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3 rounded-xl border border-ok/30 bg-ok/[0.07] px-4 py-3"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ok text-white">
              <Check className="size-4.5" strokeWidth={3} />
            </span>
            <p className="text-[14px] leading-snug text-ink">
              {t(
                tx(
                  `Done! Everything is separated in ${steps.length} ${steps.length === 1 ? "step" : "steps"}. Now try another mixture.`,
                  `Geschafft! Alles getrennt in ${steps.length} ${steps.length === 1 ? "Schritt" : "Schritten"}. Probier jetzt ein anderes Gemisch.`,
                ),
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A still picture of a mixture in a beaker, for tasks. */
export function MixturesBeaker({ comps, dissolved = [], liquids = [] }: { comps: Comp[]; dissolved?: Comp[]; liquids?: Comp[] }) {
  return (
    <div className="mx-auto max-w-[200px]">
      <Beaker vessel={{ solids: comps, dissolved, liquids }} last={null} count={0} />
    </div>
  );
}

