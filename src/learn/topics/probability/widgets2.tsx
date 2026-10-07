"use client";

// Level 2 widgets: build a two-stage tree diagram for an urn (with or without replacement) and
// pick paths, and a chart showing why "at least once" is 1 − P(never) and not n · p.

import { motion } from "motion/react";
import { useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { gcd } from "@/learn/engine/rng";
import { pow } from "@/lib/stableMath";
import { cn } from "@/lib/utils";
import { ProbabilityTree, ProbabilityUrn, useNum, type TreeBranch } from "./pictures";
import { Segmented, Stepper } from "./widgets1";

const fracSrc = (n: number, d: number) => (n === 0 ? "0" : `\\frac{${n}}{${d}}`);
const reduced = (n: number, d: number) => {
  if (n === 0) return "0";
  const g = gcd(n, d);
  return d / g === 1 ? String(n / g) : `\\frac{${n / g}}{${d / g}}`;
};

// ---------------------------------------------------------------------------
// Tree builder

type Preset = { id: string; label: Text; leaves: number[] };
const PRESETS: Preset[] = [
  { id: "rr", label: tx("both red", "zweimal rot"), leaves: [0] },
  { id: "diff", label: tx("different colours", "verschiedene Farben"), leaves: [1, 2] },
  { id: "same", label: tx("same colour", "gleiche Farbe"), leaves: [0, 3] },
  { id: "least", label: tx("at least one red", "mindestens einmal rot"), leaves: [0, 1, 2] },
];

export function ProbabilityTreeBuilder() {
  const t = useText();
  const [red, setRed] = useState(3);
  const [green, setGreen] = useState(2);
  const [back, setBack] = useState<"with" | "without">("with");
  const [sel, setSel] = useState<number[]>([0]);
  const n = red + green;
  const m = back === "with" ? n : n - 1;
  // second-stage counts after drawing red / green
  const after = back === "with" ? { r: [red, green], g: [red, green] } : { r: [red - 1, green], g: [red, green - 1] };
  const branches: TreeBranch[] = [
    {
      node: "r",
      p: `${red}/${n}`,
      kids: [
        { node: "r", p: `${after.r[0]}/${m}` },
        { node: "g", p: `${after.r[1]}/${m}` },
      ],
    },
    {
      node: "g",
      p: `${green}/${n}`,
      kids: [
        { node: "r", p: `${after.g[0]}/${m}` },
        { node: "g", p: `${after.g[1]}/${m}` },
      ],
    },
  ];
  const nums = [red * after.r[0], red * after.r[1], green * after.g[0], green * after.g[1]];
  const den = n * m;
  const ends = nums.map((x) => (x === 0 ? "0" : `${x}/${den}`));
  const picked = [...sel].sort((a, b) => a - b);
  const total = picked.reduce((s, i) => s + nums[i], 0);
  const words = ["rr", "rg", "gr", "gg"];
  const sumSrc = picked.length
    ? `P = ${picked.map((i) => fracSrc(nums[i], den)).join(" + ")}${picked.length > 1 ? ` = ${fracSrc(total, den)}` : ""}${total > 0 && reduced(total, den) !== fracSrc(total, den) ? ` = ${reduced(total, den)}` : ""}`
    : "";
  const preset = PRESETS.find((p) => p.leaves.length === picked.length && p.leaves.every((l, i) => l === picked[i]));
  const toggle = (i: number) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Stepper label={t(tx("red", "rot"))} value={red} min={1} max={6} onChange={setRed} />
        <Stepper label={t(tx("green", "grün"))} value={green} min={1} max={6} onChange={setGreen} />
        <Segmented
          value={back}
          onChange={setBack}
          options={[
            { id: "with", label: t(tx("with replacement", "mit Zurücklegen")) },
            { id: "without", label: t(tx("without replacement", "ohne Zurücklegen")) },
          ]}
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div className="space-y-2">
          <ProbabilityTree
            branches={branches}
            ends={ends}
            hl={sel}
            onLeaf={toggle}
            leafLabel={(i) => `${t(tx("Path", "Pfad"))} ${words[i]}`}
          />
          <p className="text-center text-[12.5px] text-ink-3">{t(tx("Tap the end of a path to select it.", "Tippe auf ein Pfadende, um den Pfad auszuwählen."))}</p>
        </div>
        <div className="space-y-3">
          <ProbabilityUrn balls={[{ color: "red", n: red }, { color: "green", n: green }]} />
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            {back === "with"
              ? t(tx("The ball goes back: the second draw looks exactly like the first.", "Die Kugel kommt zurück: Der zweite Zug sieht genauso aus wie der erste."))
              : t(tx("The ball stays out: one ball fewer, and one fewer of the colour you drew.", "Die Kugel bleibt draußen: eine Kugel weniger, und eine weniger von der gezogenen Farbe."))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSel(p.leaves)}
            className={cn(
              "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
              preset?.id === p.id ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            {t(p.label)}
          </button>
        ))}
      </div>

      <div className="min-h-[76px] rounded-xl border border-line bg-surface px-4 py-3">
        {picked.length ? (
          <div className="space-y-1">
            <div className="text-[12.5px] text-ink-3">
              {preset ? t(preset.label) : t(tx("your paths", "deine Pfade"))}: {picked.map((i) => words[i]).join(", ")}
            </div>
            <MathView src={sumSrc} size="md" scope="tree-sum" />
            <div className="text-[12.5px] text-ink-2">
              {picked.length > 1
                ? t(tx("Multiply along each path (path rule 1), then add the paths (path rule 2).", "Entlang jedes Pfades multiplizieren (1. Pfadregel), dann die Pfade addieren (2. Pfadregel)."))
                : t(tx("Multiply along the path: path rule 1.", "Entlang des Pfades multiplizieren: 1. Pfadregel."))}
            </div>
          </div>
        ) : (
          <div className="text-[13.5px] text-ink-3">{t(tx("No path selected yet.", "Noch kein Pfad ausgewählt."))}</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// At least once

type Kind = "die" | "coin" | "wheel";
const KINDS: Record<Kind, { p: [number, number]; label: Text; event: Text }> = {
  die: { p: [1, 6], label: tx("Six (die)", "Sechs (Würfel)"), event: tx("at least one six", "mindestens eine Sechs") },
  coin: { p: [1, 2], label: tx("Heads (coin)", "Wappen (Münze)"), event: tx("heads at least once", "mindestens einmal Wappen") },
  wheel: { p: [1, 10], label: tx("Jackpot (1 in 10)", "Hauptgewinn (1 von 10)"), event: tx("at least one jackpot", "mindestens ein Hauptgewinn") },
};
const NMAX = 30;

export function ProbabilityAtLeastOnce() {
  const t = useText();
  const num = useNum();
  const locale = useLocale();
  const [kind, setKind] = useState<Kind>("die");
  const [n, setN] = useState(4);
  const [c, d] = KINDS[kind].p;
  const q = (d - c) / d;
  const at = (k: number) => 1 - pow(q, k);
  // "More likely than not" needs more than 50 %: one coin toss gives exactly 50 %.
  const half = Array.from({ length: NMAX }, (_, i) => i + 1).find((k) => at(k) > 0.5) ?? NMAX;
  const W = 560;
  const H = 240;
  const x0 = 56;
  const plotW = W - x0 - 12;
  const bw = plotW / NMAX;
  const TOP = 1.15;
  const y = (v: number) => 18 + (1 - Math.min(v, TOP) / TOP) * (H - 56);
  const naive = (k: number) => (k * c) / d;
  const over = Array.from({ length: NMAX }, (_, i) => i + 1).find((k) => naive(k) > 1);
  // The n · p line ends where it leaves the chart (at 115 %), with an arrow: it keeps on rising.
  const kx = (k: number) => x0 + (k - 0.5) * bw;
  const kTop = (TOP * d) / c;
  const linePts = Array.from({ length: NMAX }, (_, i) => i + 1)
    .filter((k) => naive(k) <= TOP)
    .map((k) => [kx(k), y(naive(k))]);
  if (kTop < NMAX) linePts.push([kx(kTop), y(TOP)]);
  const [ex, ey] = linePts[linePts.length - 1];
  const [px, py] = linePts[linePts.length - 2] ?? [ex - 10, ey + 10];
  const len = Math.sqrt((ex - px) ** 2 + (ey - py) ** 2) || 1;
  const [ux, uy] = [(ex - px) / len, (ey - py) / len];
  const arrow = [
    [ex + 3 * ux, ey + 3 * uy],
    [ex - 7 * ux - 4.5 * uy, ey - 7 * uy + 4.5 * ux],
    [ex - 7 * ux + 4.5 * uy, ey - 7 * uy - 4.5 * ux],
  ];
  const pct = (v: number) => `${num(v * 100, 1)}${locale === "de" ? " %" : "%"}`;
  const ev = t(KINDS[kind].event);
  // 1 − (1/2)^1 is exactly 0.5: then "=" instead of "≈".
  const exact = Number.isInteger(Math.round(at(n) * 1e6) / 1e3);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Segmented value={kind} onChange={setKind} options={(Object.keys(KINDS) as Kind[]).map((k) => ({ id: k, label: t(KINDS[k].label) }))} />
        <label className="flex min-w-[220px] flex-1 items-center gap-3 text-[13px] text-ink-2">
          <span className="whitespace-nowrap">{t(tx("Tries", "Versuche"))}: <span className="font-math text-[17px] text-ink tabular-nums">n = {n}</span></span>
          <input type="range" min={1} max={NMAX} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full accent-blob" aria-label={t(tx("Number of tries", "Anzahl der Versuche"))} />
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t(tx("Chart: probability of at least one hit", "Diagramm: Wahrscheinlichkeit für mindestens einen Treffer"))}>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={x0} x2={W - 12} y1={y(v)} y2={y(v)} stroke={v === 1 ? "var(--ink-3)" : "var(--line)"} strokeWidth={v === 1 ? 1.4 : 1} />
            <text x={x0 - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)" className="max-sm:text-[17px]" style={{ fontFamily: "var(--font-sans)" }}>
              {Math.round(v * 100)}
              {locale === "de" ? " %" : "%"}
            </text>
          </g>
        ))}
        {Array.from({ length: NMAX }, (_, i) => i + 1).map((k) => {
          const v = at(k);
          const on = k === n;
          return (
            <g key={k} onClick={() => setN(k)} className="cursor-pointer">
              <motion.rect
                initial={false}
                animate={{ y: y(v), height: y(0) - y(v) }}
                transition={{ type: "tween", ease: "easeOut", duration: 0.35 }}
                x={x0 + (k - 1) * bw + bw * 0.15}
                width={bw * 0.7}
                rx={2}
                fill="var(--blob)"
                opacity={on ? 1 : k < n ? 0.45 : 0.22}
              />
              {(k === 1 || k % 5 === 0) && (
                <text x={x0 + (k - 0.5) * bw} y={H - 20} textAnchor="middle" fontSize={11} fill="var(--ink-3)" className="max-sm:text-[17px]" style={{ fontFamily: "var(--font-sans)" }}>
                  {k}
                </text>
              )}
            </g>
          );
        })}
        {/* the tempting wrong rule n · p */}
        <polyline points={linePts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ")} fill="none" stroke="var(--danger)" strokeWidth={2} strokeDasharray="6 4" />
        {kTop < NMAX && <polygon points={arrow.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ")} fill="var(--danger)" />}
        {over && (
          <text x={Math.min(kx(over) + 14, W - 230)} y={y(TOP) + 18} fontSize={12} fill="var(--danger)" className="max-sm:text-[17px]" style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}>
            {t(tx("n · p > 1: impossible!", "n · p > 1: unmöglich!"))}
          </text>
        )}
        <text x={W - 12} y={H - 2} textAnchor="end" fontSize={11} fill="var(--ink-3)" className="max-sm:text-[16px]" style={{ fontFamily: "var(--font-sans)" }}>
          {t(tx("number of tries n", "Anzahl der Versuche n"))}
        </text>
      </svg>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-blob/40 bg-blob-soft/50 px-4 py-3">
          <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-blob-ink">{t(tx("Right: via the complement", "Richtig: mit dem Gegenereignis"))}</div>
          <MathView src={`1 - (${fracSrc(d - c, d)})^{${n}} ${exact ? "=" : "\\approx"} ${num(at(n), 3)}`} size="md" animate={false} />
          <div className="mt-1 text-[13px] text-ink-2">
            P({ev}) {exact ? "=" : "≈"} {pct(at(n))}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface px-4 py-3">
          <div className={cn("mb-1 text-[12px] font-semibold uppercase tracking-[0.06em]", n === 1 ? "text-ink-3" : "text-danger")}>
            {n === 1 ? t(tx("Adding", "Addieren")) : t(tx("Wrong: adding", "Falsch: addieren"))}
          </div>
          <MathView src={`${n} \\cdot ${fracSrc(c, d)} ${naive(n) > 1 ? ">" : Number.isInteger(Math.round(naive(n) * 1e6) / 1e3) ? "=" : "\\approx"} ${naive(n) > 1 ? "1" : num(naive(n), 3)}`} size="md" animate={false} className="text-ink-2" />
          <div className="mt-1 text-[13px] text-ink-2">
            {n === 1
              ? t(tx("1 · p = p: with a single try that's still right. From two tries on, adding goes wrong.", "1 · p = p: Bei einem Versuch stimmt das noch. Ab zwei Versuchen geht Addieren schief."))
              : naive(n) > 1
                ? t(tx("More than 1? No probability can be that big.", "Mehr als 1? So groß kann keine Wahrscheinlichkeit sein."))
                : t(tx("Too big: paths with several hits get counted more than once.", "Zu groß: Pfade mit mehreren Treffern werden mehrfach gezählt."))}
          </div>
        </div>
      </div>
      <p className="text-[13.5px] leading-relaxed text-ink-2">
        {t(
          tx(
            `Drag the slider. From n = ${half} tries on, “${ev}” is more likely than not. But it never reaches 100 %.`,
            `Zieh am Regler. Ab n = ${half} Versuchen ist „${ev}“ wahrscheinlicher als nicht. Aber 100 % erreicht es nie.`,
          ),
        )}
      </p>
    </div>
  );
}
