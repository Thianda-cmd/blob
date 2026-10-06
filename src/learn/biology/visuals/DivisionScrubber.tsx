"use client";

// Scrub through mitosis or meiosis: drag the time bar (or press play) and every chromosome
// moves; the tracker counts cells, chromosomes, chromatids and DNA content as you go.

import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { keysOf, sceneAt, SceneSvg, stagesOf, type DivisionKind, type DivisionVariant, type ModelSize, type Stage } from "./DivisionScene";

type Depth = 1 | 2 | 3;
type StageText = { name: Text; short: string; say: Text; say3?: Text };

const SIMPLE: Record<string, { name: Text; say: Text }> = {
  g1: { name: tx("Mother cell", "Mutterzelle"), say: tx("The cell grows. Its chromosomes lie in the nucleus as long, thin threads.", "Die Zelle wächst. Ihre Chromosomen liegen als lange, dünne Fäden im Zellkern.") },
  s: { name: tx("Copying", "Kopieren"), say: tx("Every chromosome is copied exactly.", "Jedes Chromosom wird ganz genau kopiert.") },
  g2: { name: tx("Ready to divide", "Bereit zur Teilung"), say: tx("Each chromosome now consists of two identical halves.", "Jedes Chromosom besteht jetzt aus zwei gleichen Hälften.") },
  pro: { name: tx("Chromosomes appear", "Chromosomen werden sichtbar"), say: tx("The threads coil up into short, thick chromosomes. The nucleus dissolves.", "Die Fäden verkürzen sich zu dicken Chromosomen. Die Hülle des Zellkerns löst sich auf.") },
  meta: { name: tx("Line-up in the middle", "Aufstellung in der Mitte"), say: tx("All chromosomes line up in the middle of the cell. Fibres from both ends grab them.", "Alle Chromosomen stellen sich in der Mitte der Zelle auf. Fasern von beiden Zellenden greifen an.") },
  ana: { name: tx("Pulled apart", "Auseinanderziehen"), say: tx("The two halves of every chromosome are pulled to opposite ends of the cell.", "Die beiden Hälften jedes Chromosoms werden zu den entgegengesetzten Zellenden gezogen.") },
  telo: { name: tx("Two new nuclei", "Zwei neue Zellkerne"), say: tx("A new nucleus forms at each end. The cell pinches in.", "An jedem Ende entsteht ein neuer Zellkern. Die Zelle schnürt sich ein.") },
  cyto: { name: tx("Two daughter cells", "Zwei Tochterzellen"), say: tx("Two daughter cells with exactly the same chromosomes as the mother cell.", "Zwei Tochterzellen mit genau denselben Chromosomen wie die Mutterzelle.") },
};

const MITOSIS: Record<string, StageText> = {
  g1: { name: tx("G1 phase", "G1-Phase"), short: "G1", say: tx("Interphase: the cell grows and does its normal work. Every chromosome has one chromatid.", "Interphase: Die Zelle wächst und arbeitet. Jedes Chromosom besteht aus einem Chromatid.") },
  s: { name: tx("S phase", "S-Phase"), short: "S", say: tx("Replication: the DNA of every chromosome is copied. One-chromatid chromosomes become two-chromatid chromosomes.", "Replikation: Die DNA jedes Chromosoms wird verdoppelt. Aus Ein-Chromatid- werden Zwei-Chromatid-Chromosomen.") },
  g2: { name: tx("G2 phase", "G2-Phase"), short: "G2", say: tx("The cell gets ready for mitosis. The centrioles have already doubled.", "Die Zelle bereitet die Mitose vor. Die Zentriolen sind schon verdoppelt.") },
  pro: { name: tx("Prophase", "Prophase"), short: "P", say: tx("The chromosomes condense and become visible. The nuclear envelope breaks down and the spindle apparatus forms.", "Die Chromosomen kondensieren und werden sichtbar. Die Kernhülle löst sich auf, der Spindelapparat bildet sich.") },
  meta: { name: tx("Metaphase", "Metaphase"), short: "M", say: tx("The chromosomes line up in the equatorial plane. Spindle fibres from both poles attach at every centromere.", "Die Chromosomen ordnen sich in der Äquatorialebene an. Spindelfasern von beiden Polen setzen an jedem Zentromer an.") },
  ana: { name: tx("Anaphase", "Anaphase"), short: "A", say: tx("The sister chromatids are separated and pulled to opposite poles by the spindle fibres.", "Die Schwesterchromatiden werden getrennt und von den Spindelfasern zu entgegengesetzten Polen gezogen.") },
  telo: { name: tx("Telophase", "Telophase"), short: "T", say: tx("A new nuclear envelope forms at each pole and the chromosomes uncoil. The cell starts to pinch in.", "An jedem Pol bildet sich eine neue Kernhülle, die Chromosomen entspiralisieren sich. Die Zelle schnürt sich ein.") },
  cyto: { name: tx("Cytokinesis", "Cytokinese"), short: "C", say: tx("The cytoplasm divides: two genetically identical daughter cells with one-chromatid chromosomes.", "Das Zellplasma teilt sich: zwei erbgleiche Tochterzellen mit Ein-Chromatid-Chromosomen.") },
};

const MEIOSIS: Record<string, StageText> = {
  g1: {
    name: tx("Interphase (G1)", "Interphase (G1)"),
    short: "G1",
    say: tx("A diploid cell (2n): every chromosome is there twice, one from the mother (red) and one from the father (blue).", "Eine diploide Zelle (2n): Jedes Chromosom gibt es zweimal, eins von der Mutter (rot) und eins vom Vater (blau)."),
  },
  s: { name: tx("Interphase (S, G2)", "Interphase (S, G2)"), short: "S", say: tx("The DNA is replicated: every chromosome now has two chromatids.", "Die DNA wird repliziert: Jedes Chromosom besteht jetzt aus zwei Chromatiden.") },
  pro1: {
    name: tx("Prophase I", "Prophase I"),
    short: "P I",
    say: tx("The homologous chromosomes pair up and swap pieces (crossing over).", "Die homologen Chromosomen legen sich paarweise aneinander und tauschen Stücke aus (Crossing-over)."),
    say3: tx(
      "Homologous chromosomes pair up into bivalents (four chromatids). Non-sister chromatids cross over (chiasma, purple ring) and exchange segments: crossing over.",
      "Die Homologen paaren sich zu Bivalenten (vier Chromatiden). Nicht-Schwesterchromatiden überkreuzen sich (Chiasma, lila Ring) und tauschen Abschnitte aus: Crossing-over.",
    ),
  },
  meta1: {
    name: tx("Metaphase I", "Metaphase I"),
    short: "M I",
    say: tx("The chromosome pairs line up in the equatorial plane.", "Die Chromosomenpaare ordnen sich in der Äquatorialebene an."),
    say3: tx("The bivalents line up in the equatorial plane. Which homologue faces which pole is pure chance.", "Die Bivalente ordnen sich in der Äquatorialebene an. Welches Homolog zu welchem Pol zeigt, ist Zufall."),
  },
  ana1: {
    name: tx("Anaphase I", "Anaphase I"),
    short: "A I",
    say: tx("The homologous chromosomes are separated. Each chromosome stays whole with its two chromatids.", "Die homologen Chromosomen werden getrennt. Jedes Chromosom bleibt mit seinen zwei Chromatiden ganz."),
    say3: tx(
      "The homologues are pulled to opposite poles; the chromatids stay joined at the centromere. The random distribution is interchromosomal recombination.",
      "Die Homologen werden zu entgegengesetzten Polen gezogen, die Chromatiden bleiben am Zentromer verbunden. Die zufällige Verteilung ist die interchromosomale Rekombination.",
    ),
  },
  telo1: {
    name: tx("Telophase I", "Telophase I"),
    short: "T I",
    say: tx("Two cells, each with one set of chromosomes (n). The chromosomes still have two chromatids.", "Zwei Zellen mit je einem Chromosomensatz (n). Die Chromosomen haben noch zwei Chromatiden."),
    say3: tx("End of the reduction division: two haploid cells (n, 2c). No replication before meiosis II!", "Ende der Reduktionsteilung: zwei haploide Zellen (n, 2c). Vor der Meiose II wird nicht repliziert!"),
  },
  pro2: { name: tx("Prophase II", "Prophase II"), short: "P II", say: tx("New spindles form in both cells, this time at right angles to the first division.", "In beiden Zellen bilden sich neue Spindeln, diesmal quer zur ersten Teilung.") },
  meta2: { name: tx("Metaphase II", "Metaphase II"), short: "M II", say: tx("In both cells the chromosomes line up in the equatorial plane.", "In beiden Zellen ordnen sich die Chromosomen in der Äquatorialebene an.") },
  ana2: {
    name: tx("Anaphase II", "Anaphase II"),
    short: "A II",
    say: tx("The sister chromatids are separated, just like in mitosis.", "Die Schwesterchromatiden werden getrennt, genau wie in der Mitose."),
    say3: tx("Equational division: the sister chromatids are separated, just like in mitosis.", "Äquationsteilung: Die Schwesterchromatiden werden getrennt, genau wie in der Mitose."),
  },
  telo2: {
    name: tx("Telophase II", "Telophase II"),
    short: "T II",
    say: tx("Four haploid sex cells. Crossing over and the random distribution make all four genetically different.", "Vier haploide Keimzellen. Durch Crossing-over und zufällige Verteilung sind alle vier genetisch verschieden."),
    say3: tx("Four haploid cells (n, 1c) with one-chromatid chromosomes, all genetically different.", "Vier haploide Zellen (n, 1c) mit Ein-Chromatid-Chromosomen, alle genetisch verschieden."),
  },
};

const NDJ_SAY: Record<string, Text> = {
  "ndj1:ana1": tx("Error! The homologues of the first pair are not separated (nondisjunction). Both go to the same pole.", "Fehler! Die Homologen des ersten Paares werden nicht getrennt (Nondisjunction). Beide wandern zum selben Pol."),
  "ndj1:telo1": tx("One cell has one chromosome too many (n + 1), the other one too few (n − 1).", "Eine Zelle hat ein Chromosom zu viel (n + 1), die andere eins zu wenig (n − 1)."),
  "ndj1:telo2": tx("All four sex cells are faulty: two with n + 1, two with n − 1 chromosomes.", "Alle vier Keimzellen sind fehlerhaft: zwei mit n + 1, zwei mit n − 1 Chromosomen."),
  "ndj2:ana2": tx("Error! In the left cell the sister chromatids of the first chromosome are not separated (nondisjunction).", "Fehler! In der linken Zelle werden die Schwesterchromatiden des ersten Chromosoms nicht getrennt (Nondisjunction)."),
  "ndj2:telo2": tx("Two sex cells are normal (n), one has n + 1 and one n − 1 chromosomes.", "Zwei Keimzellen sind normal (n), eine hat n + 1, eine n − 1 Chromosomen."),
};

/** DNA content (in c) at each stage. */
const DNA: Record<DivisionKind, number[]> = { mitosis: [2, 4, 4, 4, 4, 4, 4, 2], meiosis: [2, 4, 4, 4, 4, 2, 2, 2, 2, 1] };

type Row = { label: Text; value: Text; hot?: boolean };

function rows(kind: DivisionKind, stage: Stage, N: number, depth: Depth, variant: DivisionVariant): Row[] {
  const n = N / 2;
  const cells = tx("Cells", "Zellen");
  const chrom = tx("Chromosomes per cell", "Chromosomen pro Zelle");
  const cts = tx("Chromatids per chromosome", "Chromatiden pro Chromosom");
  const dna = tx("DNA content per cell", "DNA-Gehalt pro Zelle");
  const set = tx("Chromosome set", "Chromosomensatz");
  const v = (s: string | number) => String(s);
  if (kind === "mitosis") {
    const t: Record<string, [string, Text, string, string, string]> = {
      g1: ["1", v(N), "1", "2c", "2n"],
      s: ["1", v(N), "1 → 2", "2c → 4c", "2n"],
      g2: ["1", v(N), "2", "4c", "2n"],
      pro: ["1", v(N), "2", "4c", "2n"],
      meta: ["1", v(N), "2", "4c", "2n"],
      ana: ["1", tx(`${2 * N} (${N} per pole)`, `${2 * N} (${N} je Pol)`), "1", "4c", "2 · 2n"],
      telo: [`1`, tx(`2 nuclei · ${N}`, `2 Kerne · ${N}`), "1", "4c", "2 · 2n"],
      cyto: ["2", v(N), "1", "2c", "2n"],
    };
    const [c, ch, ct, d, s] = t[stage];
    const list: Row[] = [
      { label: cells, value: c },
      { label: chrom, value: ch, hot: stage === "ana" || stage === "cyto" },
    ];
    if (depth === 1) return list;
    return [...list, { label: cts, value: ct, hot: stage === "s" || stage === "ana" }, { label: dna, value: d, hot: stage === "s" || stage === "cyto" }, { label: set, value: s }];
  }
  const end1 = variant === "ndj1" ? `${n + 1} | ${n - 1}` : v(n);
  const end2 = variant === "ndj1" ? `${n + 1} | ${n + 1} | ${n - 1} | ${n - 1}` : variant === "ndj2" ? `${n + 1} | ${n - 1} | ${n} | ${n}` : v(n);
  const t: Record<string, [string, Text, string, string, string]> = {
    g1: ["1", v(N), "1", "2c", "2n"],
    s: ["1", v(N), "1 → 2", "2c → 4c", "2n"],
    pro1: ["1", tx(`${N} (${n} pairs)`, `${N} (${n} Paare)`), "2", "4c", "2n"],
    meta1: ["1", tx(`${N} (${n} pairs)`, `${N} (${n} Paare)`), "2", "4c", "2n"],
    ana1: ["1", v(N), "2", "4c", "2n"],
    telo1: ["2", end1, "2", "2c", variant === "ndj1" ? "n + 1 | n − 1" : "n"],
    pro2: ["2", end1, "2", "2c", variant === "ndj1" ? "n + 1 | n − 1" : "n"],
    meta2: ["2", end1, "2", "2c", variant === "ndj1" ? "n + 1 | n − 1" : "n"],
    ana2: ["2", variant === "ndj1" ? `${2 * (n + 1)} | ${2 * (n - 1)}` : v(N), "1", "2c", "2 · n"],
    telo2: ["4", end2, "1", "1c", variant === "normal" ? "n" : "n ± 1"],
  };
  const [c, ch, ct, d, s] = t[stage];
  return [
    { label: cells, value: c, hot: stage === "telo1" || stage === "telo2" },
    { label: chrom, value: ch, hot: stage === "telo1" || (stage === "telo2" && variant !== "normal") },
    { label: cts, value: ct, hot: stage === "s" || stage === "ana2" },
    { label: dna, value: d, hot: stage === "s" || stage === "telo1" || stage === "telo2" },
    { label: set, value: s, hot: stage === "telo1" },
  ];
}

/** The DNA content over time, with a cursor at t. */
export function DivisionDnaGraph({ kind, t, labels = true, className }: { kind: DivisionKind; t?: number; labels?: boolean; className?: string }) {
  const tt = useText();
  const values = DNA[kind];
  const W = 300;
  const H = 120;
  const x0 = 34;
  const x1 = W - 10;
  const y = (c: number) => 100 - c * 20;
  const x = (i: number) => x0 + ((x1 - x0) * i) / (values.length - 1);
  const pts = values.map((c, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(c)}`).join("");
  const names = stagesOf(kind).map((s) => (kind === "mitosis" ? MITOSIS : MEIOSIS)[s].short);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className ?? "block h-auto w-full"} role="img" aria-label={tt(tx("DNA content per cell over time", "DNA-Gehalt pro Zelle im Zeitverlauf"))}>
      {[1, 2, 4].map((c) => (
        <g key={c}>
          <line x1={x0} x2={x1} y1={y(c)} y2={y(c)} stroke="var(--line)" strokeWidth={1} />
          <text x={x0 - 6} y={y(c) + 3.5} textAnchor="end" fontSize={10.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            {c}c
          </text>
        </g>
      ))}
      <line x1={x0} x2={x0} y1={8} y2={100} stroke="var(--ink-3)" strokeWidth={1} />
      <line x1={x0} x2={x1} y1={100} y2={100} stroke="var(--ink-3)" strokeWidth={1} />
      <path d={pts} fill="none" stroke="var(--blob)" strokeWidth={2.4} strokeLinejoin="round" />
      {!labels && (
        <text x={x1} y={113} textAnchor="end" fontSize={10} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
          {tt(tx("time →", "Zeit →"))}
        </text>
      )}
      {labels && names.map((l, i) => (
        <text key={i} x={x(i)} y={113} textAnchor="middle" fontSize={8.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
          {l}
        </text>
      ))}
      {t !== undefined && (
        <g>
          <line x1={x(t)} x2={x(t)} y1={8} y2={100} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={x(t)} cy={y(values[Math.floor(t)] + (values[Math.min(values.length - 1, Math.floor(t) + 1)] - values[Math.floor(t)]) * (t - Math.floor(t)))} r={4.5} fill="var(--blob)" stroke="var(--raised)" strokeWidth={1.5} />
        </g>
      )}
    </svg>
  );
}

export function DivisionScrubber({
  kind = "mitosis",
  depth = 2,
  crossing,
  allowErrors = false,
  start = 0,
  initialVariant = "normal",
}: {
  kind?: DivisionKind;
  depth?: Depth;
  crossing?: boolean;
  /** Offer the nondisjunction switch (meiosis). */
  allowErrors?: boolean;
  start?: number;
  initialVariant?: DivisionVariant;
}) {
  const tt = useText();
  const reduce = useReducedMotion();
  const [t, setT] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [human, setHuman] = useState(false);
  const [variant, setVariant] = useState<DivisionVariant>(initialVariant);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);

  const co = crossing ?? kind === "meiosis";
  const stages = stagesOf(kind);
  const last = stages.length - 1;
  const opts = useMemo(() => ({ kind, n2: 4 as ModelSize, crossing: co, variant }), [kind, co, variant]);
  const keys = useMemo(() => keysOf(opts), [opts]);
  const scene = sceneAt(opts, keys, t);
  const at = Math.round(t);
  const stage = stages[at];
  const texts = kind === "mitosis" ? MITOSIS : MEIOSIS;
  const text = texts[stage];
  const name = kind === "mitosis" && depth === 1 ? SIMPLE[stage].name : text.name;
  const say = NDJ_SAY[`${variant}:${stage}`] ?? (kind === "mitosis" && depth === 1 ? SIMPLE[stage].say : depth === 3 && text.say3 ? text.say3 : text.say);
  const N = human ? 46 : 4;

  const stop = () => {
    ctrl.current?.stop();
    setPlaying(false);
  };
  const goTo = (to: number) => {
    stop();
    const target = Math.max(0, Math.min(last, to));
    if (reduce) {
      setT(target);
      return;
    }
    ctrl.current = animate(t, target, { duration: Math.min(1.4, 0.35 + Math.abs(target - t) * 0.35), ease: "easeInOut", onUpdate: setT });
  };
  const play = () => {
    if (playing) {
      stop();
      return;
    }
    if (reduce) {
      setT(t >= last - 0.01 ? 0 : Math.floor(t + 1));
      return;
    }
    const from = t >= last - 0.01 ? 0 : t;
    setPlaying(true);
    ctrl.current?.stop();
    ctrl.current = animate(from, last, { duration: (last - from) * 1.5, ease: "linear", onUpdate: setT, onComplete: () => setPlaying(false) });
  };
  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pad = 12;
    const u = (e.clientX - r.left - pad) / Math.max(1, r.width - 2 * pad);
    setT(Math.max(0, Math.min(last, u * last)));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") goTo(Math.floor(t + 1.0001));
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") goTo(Math.ceil(t - 1.0001));
    else if (e.key === "Home") goTo(0);
    else if (e.key === "End") goTo(last);
    else return;
    e.preventDefault();
  };
  const pct = (v: number) => `calc(12px + (100% - 24px) * ${v / last})`;

  return (
    <div className="space-y-4">
      {allowErrors && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={tt(tx("What happens in meiosis", "Was in der Meiose passiert"))}>
          {(
            [
              ["normal", tx("Normal", "Normal")],
              ["ndj1", tx("Error in meiosis I", "Fehler in Meiose I")],
              ["ndj2", tx("Error in meiosis II", "Fehler in Meiose II")],
            ] as [DivisionVariant, Text][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setVariant(id);
                goTo(id === "normal" ? 0 : id === "ndj1" ? 3 : 6);
              }}
              aria-pressed={variant === id}
              className={cn("h-9 rounded-lg px-3 text-[13px] font-medium transition-colors", variant === id ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
            >
              {tt(label)}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-surface p-2 sm:p-3">
        <SceneSvg scene={scene} title={kind === "mitosis" ? tx("A model cell (2n = 4) in mitosis", "Eine Modellzelle (2n = 4) in der Mitose") : tx("A model cell (2n = 4) in meiosis", "Eine Modellzelle (2n = 4) in der Meiose")} />
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => goTo(Math.ceil(t - 1.0001))} disabled={t <= 0.001} aria-label={tt(tx("Previous stage", "Vorige Phase"))} className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35">
          <ChevronLeft className="size-4" />
        </button>
        <button type="button" onClick={play} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-blob px-3 text-[13.5px] font-semibold text-white active:scale-[0.97]">
          {playing ? <Pause className="size-4" /> : t >= last - 0.01 ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
          <span className="hidden sm:inline">{tt(playing ? tx("Pause", "Pause") : t >= last - 0.01 ? tx("Again", "Nochmal") : tx("Play", "Abspielen"))}</span>
        </button>
        <button type="button" onClick={() => goTo(Math.floor(t + 1.0001))} disabled={t >= last - 0.001} aria-label={tt(tx("Next stage", "Nächste Phase"))} className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35">
          <ChevronRight className="size-4" />
        </button>
        <div className="min-w-0 flex-1 text-right text-[12px] text-ink-3">
          {tt(tx("Drag the bar", "Zieh am Zeitstrahl"))}
        </div>
      </div>

      <div>
        <div
          role="slider"
          tabIndex={0}
          aria-label={tt(tx("Time", "Zeit"))}
          aria-valuemin={0}
          aria-valuemax={last}
          aria-valuenow={at}
          aria-valuetext={tt(name)}
          onPointerDown={(e) => {
            stop();
            e.currentTarget.setPointerCapture(e.pointerId);
            fromPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
          }}
          onKeyDown={onKey}
          className="relative h-9 cursor-pointer touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blob/50"
        >
          <div className="absolute inset-x-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
          <div className="absolute left-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-blob/60" style={{ width: `calc((100% - 24px) * ${t / last})` }} />
          {stages.map((s, i) => (
            <span key={s} className={cn("absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full", i <= t + 0.001 ? "bg-blob" : "bg-line-2")} style={{ left: pct(i) }} />
          ))}
          <span className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blob bg-raised shadow-card" style={{ left: pct(t) }} />
        </div>
        <div className="relative h-5">
          {stages.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => goTo(i)}
              className={cn("absolute top-0 -translate-x-1/2 whitespace-nowrap rounded px-0.5 text-[10.5px] font-semibold leading-5 transition-colors", i === at ? "text-blob-ink" : "text-ink-3 hover:text-ink")}
              style={{ left: pct(i) }}
              tabIndex={-1}
            >
              {kind === "mitosis" && depth === 1 ? i + 1 : texts[s].short}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${stage}-${variant}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="rounded-xl border border-line bg-surface px-4 py-3"
            aria-live="polite"
          >
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-blob-ink">
              {at + 1} / {last + 1}
            </div>
            <div className="mt-0.5 text-[17px] font-semibold text-ink">{tt(name)}</div>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{tt(say)}</p>
          </motion.div>
        </AnimatePresence>

        <div className="rounded-xl border border-line bg-surface px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{tt(tx("Counter", "Zähler"))}</span>
            <div className="flex rounded-lg border border-line p-0.5 text-[12px]">
              {[false, true].map((h) => (
                <button key={String(h)} type="button" onClick={() => setHuman(h)} aria-pressed={human === h} className={cn("rounded-md px-2 py-0.5 font-medium transition-colors", human === h ? "bg-blob text-white" : "text-ink-2 hover:text-ink")}>
                  {h ? tt(tx("Human 2n = 46", "Mensch 2n = 46")) : tt(tx("Model 2n = 4", "Modell 2n = 4"))}
                </button>
              ))}
            </div>
          </div>
          <dl className="space-y-1">
            {rows(kind, stage, N, depth, variant).map((r, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <dt className="text-ink-2">{tt(r.label)}</dt>
                <dd className={cn("font-math text-[16px] tabular-nums", r.hot ? "font-semibold text-blob-ink" : "text-ink")}>{tt(r.value)}</dd>
              </div>
            ))}
          </dl>
          {depth > 1 && <DivisionDnaGraph kind={kind} t={t} className="mt-2 block h-auto w-full max-w-[340px]" />}
        </div>
      </div>
    </div>
  );
}
