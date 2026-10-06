"use client";

// Mini lab: food tests. Pick a food and a test (iodine, glucose test strip, biuret, grease
// spot); watch the result and collect it in the results table. Water is the control.
// Also exports the tube/strip/paper pictures for practice tasks.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Minus, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

export type FoodTest = "iodine" | "strip" | "biuret" | "grease";
export type Food = "potato" | "glucose" | "quark" | "oil" | "milk" | "peanut" | "water";

export const TESTS: Record<FoodTest, { name: Text; short: Text; finds: Text; plus: Text; minus: Text; yes: Text; no: Text }> = {
  iodine: {
    name: tx("Iodine test (iodine solution)", "Iodprobe (Iod-Kaliumiodid-Lösung)"),
    short: tx("Iodine", "Iodprobe"),
    finds: tx("starch", "Stärke"),
    plus: tx("blue-black", "blau-schwarz"),
    minus: tx("stays brown-yellow", "bleibt gelbbraun"),
    yes: tx("Positive: the sample contains starch.", "Positiv: Die Probe enthält Stärke."),
    no: tx("Negative: no starch detected.", "Negativ: keine Stärke nachweisbar."),
  },
  strip: {
    name: tx("Glucose test strip", "Glucose-Teststreifen"),
    short: tx("Glucose strip", "Glucose-Streifen"),
    finds: tx("glucose", "Glucose"),
    plus: tx("pad turns green", "Testfeld wird grün"),
    minus: tx("pad stays yellow", "Testfeld bleibt gelb"),
    yes: tx("Positive: the sample contains glucose.", "Positiv: Die Probe enthält Glucose."),
    no: tx("Negative: no glucose detected.", "Negativ: keine Glucose nachweisbar."),
  },
  biuret: {
    name: tx("Biuret test", "Biuret-Probe"),
    short: tx("Biuret", "Biuret"),
    finds: tx("protein", "Eiweiß"),
    plus: tx("violet", "violett"),
    minus: tx("stays blue", "bleibt blau"),
    yes: tx("Positive: the sample contains protein.", "Positiv: Die Probe enthält Eiweiß."),
    no: tx("Negative: no protein detected.", "Negativ: kein Eiweiß nachweisbar."),
  },
  grease: {
    name: tx("Grease spot test", "Fettfleckprobe"),
    short: tx("Grease spot", "Fettfleck"),
    finds: tx("fat", "Fett"),
    plus: tx("see-through spot stays after drying", "durchscheinender Fleck bleibt nach dem Trocknen"),
    minus: tx("spot dries away", "Fleck trocknet weg"),
    yes: tx("Positive: the sample contains fat.", "Positiv: Die Probe enthält Fett."),
    no: tx("Negative: no fat detected.", "Negativ: kein Fett nachweisbar."),
  },
};

export const FOODS: Record<Food, { name: Text; has: FoodTest[]; sample: string; note?: Text }> = {
  potato: { name: tx("Potato", "Kartoffel"), has: ["iodine"], sample: "color-mix(in oklab, var(--bio-bone) 80%, var(--raised))" },
  glucose: { name: tx("Glucose solution", "Traubenzucker-Lösung"), has: ["strip"], sample: "color-mix(in oklab, var(--ink) 6%, var(--raised))" },
  quark: { name: tx("Low-fat quark", "Magerquark"), has: ["biuret"], sample: "color-mix(in oklab, var(--bio-bone) 55%, var(--raised))" },
  oil: { name: tx("Cooking oil", "Speiseöl"), has: ["grease"], sample: "color-mix(in oklab, var(--bio-sun) 45%, var(--raised))" },
  milk: {
    name: tx("Whole milk", "Vollmilch"),
    has: ["biuret", "grease"],
    sample: "color-mix(in oklab, var(--bio-bone) 30%, var(--raised))",
    note: tx("Milk sugar (lactose) is not glucose, so the strip stays yellow.", "Milchzucker (Lactose) ist keine Glucose, darum bleibt der Streifen gelb."),
  },
  peanut: { name: tx("Peanut (crushed)", "Erdnuss (zerrieben)"), has: ["biuret", "grease"], sample: "color-mix(in oklab, var(--bio-wood) 40%, var(--raised))" },
  water: {
    name: tx("Water (control)", "Wasser (Blindprobe)"),
    has: [],
    sample: "color-mix(in oklab, var(--bio-water) 18%, var(--raised))",
    note: tx("The control shows what a negative result looks like.", "Die Blindprobe zeigt, wie ein negatives Ergebnis aussieht."),
  },
};

const FOOD_ORDER: Food[] = ["potato", "glucose", "quark", "oil", "milk", "peanut", "water"];
const TEST_ORDER: FoodTest[] = ["iodine", "strip", "biuret", "grease"];

/** Colours before and after (positive / negative). */
export const TEST_COLOR: Record<FoodTest, { start: string; plus: string; minus: string }> = {
  iodine: {
    start: "color-mix(in oklab, var(--bio-wood) 55%, var(--bio-sun))",
    plus: "light-dark(color-mix(in oklab, var(--bio-blood-low) 50%, var(--bio-outline)), color-mix(in oklab, var(--bio-blood-low) 55%, var(--raised)))",
    minus: "color-mix(in oklab, var(--bio-wood) 55%, var(--bio-sun))",
  },
  strip: { start: "var(--bio-sun)", plus: "var(--bio-chloro)", minus: "var(--bio-sun)" },
  biuret: { start: "color-mix(in oklab, var(--bio-water) 75%, var(--raised))", plus: "var(--bio-u)", minus: "color-mix(in oklab, var(--bio-water) 75%, var(--raised))" },
  grease: { start: "var(--bio-bone)", plus: "color-mix(in oklab, var(--bio-membrane) 45%, var(--bio-bone))", minus: "var(--bio-bone)" },
};

// ---------------------------------------------------------------------------
// Pictures

const OUT = "var(--bio-outline)";

/** A test tube; `color` fills the liquid. With `drops`, three drops fall in first. */
export function LabTube({ color, from, drops, run = 0 }: { color: string; from?: string; drops?: string; run?: number }) {
  const reduce = useReducedMotion();
  const animated = !!from && !reduce;
  return (
    <svg viewBox="0 0 80 190" className="h-[150px] w-auto" aria-hidden>
      {drops && animated && (
        <g key={run}>
          <path d="M34 4 L46 4 L44 24 L36 24 Z" fill="var(--raised)" stroke={OUT} strokeWidth={1.4} />
          {[0, 1, 2].map((k) => (
            <motion.circle key={k} cx={40} r={3.2} fill={drops} initial={{ cy: 28, opacity: 0 }} animate={{ cy: [28, 96], opacity: [1, 1, 0] }} transition={{ duration: 0.45, delay: 0.1 + k * 0.28, ease: "easeIn" }} />
          ))}
        </g>
      )}
      <motion.path
        key={`liq${run}`}
        d="M21 100 L21 160 A19 19 0 0 0 59 160 L59 100 Z"
        initial={animated ? { fill: from } : false}
        animate={{ fill: color }}
        transition={{ duration: 0.7, delay: animated ? 0.95 : 0 }}
      />
      <rect x={27} y={108} width={5} height={52} rx={2.5} fill="var(--raised)" opacity={0.35} />
      <path d="M19 34 L19 160 A21 21 0 0 0 61 160 L61 34" fill="none" stroke={OUT} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M14 34 L66 34" stroke={OUT} strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  );
}

/** A glucose test strip with its test pad. */
export function LabStrip({ color, from, run = 0 }: { color: string; from?: string; run?: number }) {
  const reduce = useReducedMotion();
  const animated = !!from && !reduce;
  return (
    <svg viewBox="0 0 80 190" className="h-[150px] w-auto" aria-hidden>
      <motion.g key={run} initial={animated ? { y: 40 } : false} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
        <rect x={31} y={14} width={18} height={150} rx={3} fill="var(--raised)" stroke={OUT} strokeWidth={1.6} />
        <motion.rect x={33} y={136} width={14} height={20} rx={2} initial={animated ? { fill: from } : false} animate={{ fill: color }} transition={{ duration: 0.7, delay: animated ? 1 : 0 }} stroke={OUT} strokeWidth={1} />
      </motion.g>
    </svg>
  );
}

/** Filter paper with a spot of the sample, after drying. */
export function LabPaper({ spot, run = 0, animate: anim = true }: { spot: boolean; run?: number; animate?: boolean }) {
  const reduce = useReducedMotion();
  const animated = anim && !reduce;
  return (
    <svg viewBox="0 0 150 150" className="h-[150px] w-auto" aria-hidden>
      <rect x={10} y={10} width={130} height={130} rx={4} fill="var(--bio-bone)" stroke={OUT} strokeWidth={1.6} />
      <motion.ellipse
        key={run}
        cx={75}
        cy={75}
        rx={30}
        ry={24}
        fill="color-mix(in oklab, var(--bio-membrane) 50%, var(--bio-bone))"
        stroke="color-mix(in oklab, var(--bio-membrane) 60%, var(--bio-bone))"
        strokeWidth={1}
        initial={animated ? { opacity: 0.9 } : false}
        animate={{ opacity: spot ? 0.85 : 0 }}
        transition={{ duration: 1.1, delay: animated ? 0.6 : 0 }}
      />
      {/* light shining through a grease spot */}
      {spot && <ellipse cx={66} cy={66} rx={9} ry={6} fill="var(--raised)" opacity={0.35} />}
    </svg>
  );
}

/** One test result as a picture with a caption (for tasks). */
function ResultPicture({ test, positive }: { test: FoodTest; positive: boolean }) {
  const t = useText();
  const c = TEST_COLOR[test];
  const col = positive ? c.plus : c.minus;
  return (
    <div className="flex w-[118px] flex-col items-center gap-1 text-center">
      {test === "grease" ? <LabPaper spot={positive} animate={false} /> : test === "strip" ? <LabStrip color={col} /> : <LabTube color={col} />}
      <span className="text-[12.5px] font-semibold leading-tight text-ink">{t(TESTS[test].short)}</span>
      <span className="text-[12px] leading-tight text-ink-2">{t(positive ? TESTS[test].plus : TESTS[test].minus)}</span>
    </div>
  );
}

/** Task picture: the results of some food tests on an unknown sample. */
export function DigestionTestResults({ results }: { results: [FoodTest, boolean][] }) {
  return (
    <div className="flex flex-wrap justify-center gap-3 py-1">
      {results.map(([test, pos]) => (
        <ResultPicture key={test} test={test} positive={pos} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function DigestionFoodLab() {
  const t = useText();
  const [food, setFood] = useState<Food>("potato");
  const [test, setTest] = useState<FoodTest | null>(null);
  const [run, setRun] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const positive = !!test && FOODS[food].has.includes(test);
  const c = test ? TEST_COLOR[test] : null;
  const count = Object.keys(done).length;

  const doTest = (x: FoodTest) => {
    setTest(x);
    setRun((r) => r + 1);
    setDone((d) => ({ ...d, [`${food}:${x}`]: FOODS[food].has.includes(x) }));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("1. Pick a food", "1. Wähle ein Lebensmittel"))}</div>
        <div className="flex flex-wrap gap-1.5">
          {FOOD_ORDER.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFood(f);
                setTest(null);
              }}
              className={cn("h-9 rounded-lg px-3 text-[13px] font-medium transition-colors", food === f ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
            >
              {t(FOODS[f].name)}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("2. Run a test", "2. Führe einen Nachweis durch"))}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TEST_ORDER.map((x) => (
            <motion.button
              key={x}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => doTest(x)}
              className={cn(
                "flex min-h-[52px] flex-col justify-center rounded-xl border px-3 py-1.5 text-left transition-colors",
                test === x ? "border-blob bg-blob-soft/60" : "border-line bg-raised hover:border-blob/50 hover:bg-blob-soft/40",
              )}
            >
              <span className="text-[13.5px] font-semibold leading-tight text-ink">{t(TESTS[x].short)}</span>
              <span className="text-[11.5px] leading-tight text-ink-3">{t(tx("finds", "weist nach:"))} {t(TESTS[x].finds)}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[170px_minmax(0,1fr)] sm:items-center">
        <div className="flex h-[170px] items-center justify-center rounded-xl border border-line bg-surface">
          {!test || !c ? (
            <LabTube color={FOODS[food].sample} />
          ) : test === "grease" ? (
            <LabPaper spot={positive} run={run} />
          ) : test === "strip" ? (
            <LabStrip color={positive ? c.plus : c.minus} from={c.start} run={run} />
          ) : (
            <LabTube color={positive ? c.plus : c.minus} from={FOODS[food].sample} drops={c.start} run={run} />
          )}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={test ? `${food}-${test}-${run}` : food} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, delay: test ? 0.9 : 0 }} className="space-y-1.5 text-[14px] leading-relaxed">
            {!test ? (
              <p className="text-ink-2">
                {t(tx("Sample:", "Probe:"))} <span className="font-semibold text-ink">{t(FOODS[food].name)}</span>. {t(tx("Which test do you want to try?", "Welchen Nachweis willst du ausprobieren?"))}
              </p>
            ) : (
              <>
                <p className="flex items-center gap-2 font-semibold text-ink">
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-white", positive ? "bg-ok" : "bg-ink-3")}>
                    {positive ? <Plus className="size-3.5" strokeWidth={3} /> : <Minus className="size-3.5" strokeWidth={3} />}
                  </span>
                  {t(positive ? TESTS[test].plus : TESTS[test].minus)}
                </p>
                <p className="text-ink-2">{t(positive ? TESTS[test].yes : TESTS[test].no)}</p>
                {FOODS[food].note && (test === "strip" || food === "water") && <p className="text-[13px] text-ink-3">{t(FOODS[food].note!)}</p>}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[420px] text-[12.5px]">
          <thead>
            <tr className="bg-surface text-ink-3">
              <th className="px-2.5 py-1.5 text-left font-semibold">{t(tx("Results", "Ergebnisse"))}</th>
              {TEST_ORDER.map((x) => (
                <th key={x} className="px-1.5 py-1.5 text-center font-semibold">
                  {t(TESTS[x].finds)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FOOD_ORDER.map((f) => (
              <tr key={f} className={cn("border-t border-line", f === food && "bg-blob-soft/30")}>
                <td className="px-2.5 py-1 text-ink-2">{t(FOODS[f].name)}</td>
                {TEST_ORDER.map((x) => {
                  const r = done[`${f}:${x}`];
                  return (
                    <td key={x} className="px-1.5 py-1 text-center">
                      {r === undefined ? (
                        <span className="text-ink-3">·</span>
                      ) : (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className={cn("inline-grid size-5 place-items-center rounded-full text-white", r ? "bg-ok" : "bg-ink-3/70")}>
                          {r ? <Plus className="size-3" strokeWidth={3} /> : <Minus className="size-3" strokeWidth={3} />}
                        </motion.span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2 text-[12.5px] text-ink-3">
        <span className="flex items-center gap-1.5">
          {count >= 28 && <Check className="size-4 text-ok" strokeWidth={3} />}
          {t(tx(`${count} of 28 tests done`, `${count} von 28 Nachweisen gemacht`))}
        </span>
        <button type="button" onClick={() => setDone({})} disabled={!count} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35">
          <RotateCcw className="size-3.5" /> {t(tx("Clear table", "Tabelle leeren"))}
        </button>
      </div>
    </div>
  );
}
