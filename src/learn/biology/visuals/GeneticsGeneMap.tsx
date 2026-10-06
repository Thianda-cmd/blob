"use client";

import { AnimatePresence, motion } from "motion/react";
import { Play, RefreshCw, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useLocale } from "@/i18n/client";
import { useText } from "@/i18n/useText";
import { createRng } from "@/learn/engine/rng";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

const fmt = (v: number, de: boolean) => (de ? String(v).replace(".", ",") : String(v));

// ---------------------------------------------------------------------------
// A chromosome map: genes on a bar, distances in cM below

export type MapGene = { name: string; pos: number };
export type MapBracket = { from: number; to: number; label: string | null; lane?: number };

/** A gene map (Genkarte): loci on a chromosome with their distances in centimorgan. `label: null` shows "?". */
export function GeneticsChromosomeMap({ genes, brackets = [], highlight }: { genes: MapGene[]; brackets?: MapBracket[]; highlight?: string[] }) {
  const t = useText();
  const lo = Math.min(...genes.map((g) => g.pos));
  const hi = Math.max(...genes.map((g) => g.pos));
  const W = 520;
  const x = (p: number) => 50 + ((p - lo) / Math.max(1, hi - lo)) * (W - 100);
  const lanes = Math.max(0, ...brackets.map((b) => b.lane ?? 0)) + 1;
  const H = 96 + lanes * 34;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[560px]" role="img" aria-label={t(tx("Gene map", "Genkarte"))}>
      <rect x={20} y={46} width={W - 40} height={22} rx={11} fill="var(--bio-nucleus)" stroke="var(--bio-outline)" strokeWidth={1.6} />
      {genes.map((g) => {
        const on = highlight?.includes(g.name);
        return (
          <motion.g key={g.name} initial={false} animate={{ x: x(g.pos) }} transition={{ type: "spring", stiffness: 220, damping: 26 }}>
            <rect x={-3} y={46} width={6} height={22} fill={on ? "var(--blob)" : "var(--ink)"} />
            <text x={0} y={34} textAnchor="middle" fontSize={17} fontStyle="italic" fontWeight={on ? 700 : 500} fill={on ? "var(--blob)" : "var(--ink)"} style={{ fontFamily: "var(--font-math)" }}>
              {g.name}
            </text>
          </motion.g>
        );
      })}
      {brackets.map((b, i) => {
        const y = 92 + (b.lane ?? 0) * 34;
        const x1 = x(Math.min(b.from, b.to));
        const x2 = x(Math.max(b.from, b.to));
        return (
          <g key={i}>
            <path d={`M ${x1} ${y - 8} V ${y} H ${x2} V ${y - 8}`} fill="none" stroke="var(--ink-2)" strokeWidth={1.4} />
            <rect x={(x1 + x2) / 2 - 30} y={y + 3} width={60} height={20} rx={6} fill={b.label === null ? "var(--blob-soft)" : "var(--raised)"} />
            <text x={(x1 + x2) / 2} y={y + 14} textAnchor="middle" dominantBaseline="middle" fontSize={14} fontWeight={600} fill={b.label === null ? "var(--blob)" : "var(--ink)"} style={{ fontFamily: "var(--font-sans)" }}>
              {b.label ?? "?"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Crossing-over: how often do two genes end up recombined?

type Tally = { AB: number; ab: number; Ab: number; aB: number };
const EMPTY: Tally = { AB: 0, ab: 0, Ab: 0, aB: 0 };

function CrossingOver() {
  const t = useText();
  const [d, setD] = useState(12);
  const [tally, setTally] = useState<Tally>(EMPTY);
  const [runs, setRuns] = useState(0);
  const [chiasma, setChiasma] = useState<number | null>(null);
  const A = 90;
  const B = A + d * 9;
  const total = tally.AB + tally.ab + tally.Ab + tally.aB;
  const rec = tally.Ab + tally.aB;
  const rf = total ? Math.round((rec / total) * 1000) / 10 : 0;

  const run = () => {
    const rng = createRng(9001 + runs * 7919 + d);
    const next = { ...tally };
    for (let i = 0; i < 100; i++) {
      const recomb = rng.next() < d / 100;
      const first = rng.chance(0.5);
      if (recomb) next[first ? "Ab" : "aB"]++;
      else next[first ? "AB" : "ab"]++;
    }
    setTally(next);
    setRuns(runs + 1);
    // show one crossing-over: between A and B in d % of the cases (here: every other run with a chance)
    const between = rng.next() < Math.min(0.9, (d / 100) * 3);
    setChiasma(between ? A + 8 + rng.next() * (B - A - 16) : rng.chance(0.5) ? 50 + rng.next() * 25 : Math.min(470, B + 14 + rng.next() * 40));
  };
  const reset = (nd: number) => {
    setD(nd);
    setTally(EMPTY);
    setChiasma(null);
  };
  const cx = chiasma ?? 490;
  const between = chiasma !== null && chiasma > A && chiasma < B;
  const pink = "var(--bio-petal)";
  const blue = "var(--bio-water)";
  /** Left of the chiasma the chromosome keeps its colour, right of it the pieces are swapped. */
  const seg = (y: number, left: string, right: string) => (
    <>
      <motion.rect x={30} y={y} height={22} initial={false} animate={{ width: cx - 30 }} transition={{ duration: 0.45 }} fill={left} />
      <motion.rect y={y} height={22} initial={false} animate={{ x: cx, width: 490 - cx }} transition={{ duration: 0.45 }} fill={right} />
    </>
  );
  const letter = (x: number, upper: string, top: boolean) => {
    const swap = chiasma !== null && chiasma < x;
    return top !== swap ? upper : upper.toLowerCase();
  };
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="flex items-baseline justify-between text-[13.5px] text-ink-2">
          <span>{t(tx("Distance between gene A and gene B", "Abstand zwischen Gen A und Gen B"))}</span>
          <span className="font-math text-[18px] text-ink">{d} cM</span>
        </span>
        <input type="range" min={1} max={40} value={d} onChange={(e) => reset(Number(e.target.value))} className="mt-1 w-full accent-[var(--blob)]" aria-label={t(tx("Distance in centimorgan", "Abstand in Centimorgan"))} />
      </label>
      <svg viewBox="0 0 520 150" className="mx-auto block h-auto w-full max-w-[560px]" role="img" aria-label={t(tx("Homologous chromosomes with crossing-over", "Homologe Chromosomen mit Crossing-over"))}>
        <defs>
          <clipPath id="co-top">
            <rect x={30} y={30} width={460} height={22} rx={11} />
          </clipPath>
          <clipPath id="co-bot">
            <rect x={30} y={92} width={460} height={22} rx={11} />
          </clipPath>
        </defs>
        <g clipPath="url(#co-top)">{seg(30, pink, blue)}</g>
        <g clipPath="url(#co-bot)">{seg(92, blue, pink)}</g>
        <rect x={30} y={30} width={460} height={22} rx={11} fill="none" stroke="var(--bio-outline)" strokeWidth={1.6} />
        <rect x={30} y={92} width={460} height={22} rx={11} fill="none" stroke="var(--bio-outline)" strokeWidth={1.6} />
        {(
          [
            [A, "A"],
            [B, "B"],
          ] as const
        ).map(([x, gene], i) => (
          <motion.g key={i} initial={false} animate={{ x }} transition={{ type: "spring", stiffness: 260, damping: 28 }}>
            <rect x={-9} y={31} width={18} height={20} rx={3} fill="var(--raised)" stroke="var(--bio-outline)" strokeWidth={1} />
            <rect x={-9} y={93} width={18} height={20} rx={3} fill="var(--raised)" stroke="var(--bio-outline)" strokeWidth={1} />
            <text x={0} y={42} textAnchor="middle" dominantBaseline="central" fontSize={15} fontStyle="italic" fill="var(--ink)" style={{ fontFamily: "var(--font-math)" }}>
              {letter(x, gene, true)}
            </text>
            <text x={0} y={104} textAnchor="middle" dominantBaseline="central" fontSize={15} fontStyle="italic" fill="var(--ink)" style={{ fontFamily: "var(--font-math)" }}>
              {letter(x, gene, false)}
            </text>
          </motion.g>
        ))}
        <AnimatePresence>
          {chiasma !== null && (
            <motion.g key={`${runs}`} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
              <path d={`M ${cx - 12} 54 L ${cx + 12} 90 M ${cx + 12} 54 L ${cx - 12} 90`} stroke="var(--blob)" strokeWidth={3} strokeLinecap="round" />
              <text x={cx} y={134} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--blob)" style={{ fontFamily: "var(--font-sans)" }}>
                {between ? t(tx("crossing-over between A and B", "Crossing-over zwischen A und B")) : t(tx("crossing-over outside A–B", "Crossing-over außerhalb von A–B"))}
              </text>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={run} className="flex items-center gap-1.5 rounded-lg bg-blob px-3 py-1.5 text-[13.5px] font-medium text-white transition-opacity hover:opacity-90">
          <Play className="size-3.5" />
          {t(tx("Meiosis: 100 gametes", "Meiose: 100 Keimzellen"))}
        </button>
        <button type="button" onClick={() => reset(d)} disabled={!total} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-hover disabled:opacity-40">
          <RotateCcw className="size-3.5" />
          {t(tx("Reset", "Zurücksetzen"))}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(["AB", "ab", "Ab", "aB"] as const).map((k) => {
          const n = tally[k];
          const recomb = k === "Ab" || k === "aB";
          return (
            <div key={k} className="flex flex-col items-center gap-1">
              <div className="flex h-24 w-full items-end overflow-hidden rounded-lg border border-line bg-surface">
                <motion.div className="w-full" style={{ background: recomb ? "var(--blob)" : "var(--ink-3)" }} initial={false} animate={{ height: `${total ? (n / total) * 100 : 0}%` }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />
              </div>
              <span className="font-math text-[16px] italic text-ink">{k}</span>
              <span className="text-[12px] tabular-nums text-ink-2">{n}</span>
              <span className={cn("text-[11px]", recomb ? "font-medium text-blob-ink" : "text-ink-3")}>{recomb ? t(tx("recombinant", "rekombinant")) : t(tx("parental", "elterlich"))}</span>
            </div>
          );
        })}
      </div>
      <p className="rounded-xl bg-blob-soft px-3 py-2 text-[13.5px] leading-snug text-ink">
        {total ? (
          <Inline
            text={tx(
              `${rec} of ${total} gametes are recombinant: recombination frequency **${fmt(rf, false)}%**. Set: ${d} cM. The farther apart two genes lie, the more often a crossing-over falls between them.`,
              `${rec} von ${total} Keimzellen sind rekombinant: Rekombinationshäufigkeit **${fmt(rf, true)} %**. Eingestellt: ${d} cM. Je weiter zwei Gene auseinanderliegen, desto öfter liegt ein Crossing-over zwischen ihnen.`,
            )}
          />
        ) : (
          <Inline
            text={tx(
              "Pink: chromosome from the mother with $A$ and $B$, blue: from the father with $a$ and $b$. Start meiosis and count the gametes.",
              "Rosa: Chromosom von der Mutter mit $A$ und $B$, blau: vom Vater mit $a$ und $b$. Starte die Meiose und zähle die Keimzellen.",
            )}
          />
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gene map from recombination frequencies

type MapSet = { genes: [string, string, string]; names?: Text[]; rf: [number, number, number]; note?: Text };

/** rf: [g0–g1, g1–g2, g0–g2]. */
const CAMPBELL: MapSet = {
  genes: ["b", "cn", "vg"],
  names: [tx("black body", "schwarzer Körper"), tx("cinnabar eyes", "zinnoberrote Augen"), tx("vestigial wings", "Stummelflügel")],
  rf: [9, 9.5, 17],
  note: tx(
    "$b$–$vg$ is only 17%, not 9 + 9.5 = 18.5%. Two crossing-overs between $b$ and $vg$ swap the outer genes back: these gametes look parental. Short distances are measured more exactly.",
    "$b$–$vg$ beträgt nur 17 % statt 9 + 9,5 = 18,5 %. Zwei Crossing-over zwischen $b$ und $vg$ tauschen die äußeren Gene zurück: Diese Keimzellen sehen elterlich aus. Kurze Abstände werden genauer gemessen.",
  ),
};

function mapSet(k: number): MapSet {
  if (k % 3 === 0) return CAMPBELL;
  const rng = createRng(313 + k * 977);
  const d1 = rng.int(3, 18);
  const d2 = rng.int(3, 18);
  const letters = rng.shuffle(["A", "B", "C"]);
  // letters[1] lies in the middle
  return { genes: [letters[0], letters[1], letters[2]], rf: [d1, d2, d1 + d2] };
}

function GeneMap() {
  const t = useText();
  const de = useLocale() === "de";
  const [k, setK] = useState(0);
  const [mid, setMid] = useState<string | null>(null);
  const set = mapSet(k);
  const [g0, g1, g2] = set.genes;
  const pairs: [string, string, number][] = [
    [g0, g1, set.rf[0]],
    [g1, g2, set.rf[1]],
    [g0, g2, set.rf[2]],
  ];
  // Shown in a fixed alphabetical order so the table doesn't give the answer away.
  const shownPairs = [...pairs].sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
  const dist = (a: string, b: string) => pairs.find(([x, y]) => (x === a && y === b) || (x === b && y === a))![2];
  const pct = (v: number) => `${fmt(v, de)}${de ? " %" : "%"}`;
  let map: { genes: MapGene[]; brackets: MapBracket[] } | null = null;
  if (mid) {
    const outer = set.genes.filter((g) => g !== mid);
    const left = dist(outer[0], mid);
    const right = dist(mid, outer[1]);
    map = {
      genes: [
        { name: outer[0], pos: 0 },
        { name: mid, pos: left },
        { name: outer[1], pos: left + right },
      ],
      brackets: [
        { from: 0, to: left, label: `${fmt(left, de)} cM` },
        { from: left, to: left + right, label: `${fmt(right, de)} cM` },
        { from: 0, to: left + right, label: `${fmt(dist(outer[0], outer[1]), de)} cM`, lane: 1 },
      ],
    };
  }
  const right = mid === g1;
  const outer = mid ? set.genes.filter((g) => g !== mid) : [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13.5px] text-ink-2">{set.names ? t(tx("Fruit fly (Drosophila), test crosses:", "Taufliege (Drosophila), Testkreuzungen:")) : t(tx("Three linked genes, test crosses:", "Drei gekoppelte Gene, Testkreuzungen:"))}</div>
        <button
          type="button"
          onClick={() => {
            setK(k + 1);
            setMid(null);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink"
        >
          <RefreshCw className="size-3.5" />
          {t(tx("New genes", "Neue Gene"))}
        </button>
      </div>
      {set.names && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
          {set.genes.map((g, i) => (
            <span key={g}>
              <span className="font-math italic text-ink">{g}</span>: {t(set.names![i])}
            </span>
          ))}
        </div>
      )}
      <table className="w-full max-w-[360px] text-[14px]">
        <thead>
          <tr className="text-left text-[12px] uppercase tracking-wide text-ink-3">
            <th className="py-1 font-medium">{t(tx("Genes", "Gene"))}</th>
            <th className="py-1 font-medium">{t(tx("Recombination frequency", "Rekombinationshäufigkeit"))}</th>
          </tr>
        </thead>
        <tbody>
          {shownPairs.map(([a, b, v]) => (
            <tr key={a + b} className={cn("border-t border-line", mid && (a === mid || b === mid) ? "text-ink" : "text-ink-2")}>
              <td className="py-1 font-math italic">
                {a} – {b}
              </td>
              <td className="py-1 tabular-nums">{pct(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] text-ink-2">{t(tx("Which gene lies in the middle?", "Welches Gen liegt in der Mitte?"))}</span>
        {[...set.genes].sort().map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setMid(g)}
            className={cn(
              "min-w-[44px] rounded-lg border px-3 py-1.5 font-math text-[16px] italic transition-colors",
              mid === g ? (right ? "border-ok bg-ok/10 text-ok" : "border-danger bg-danger/10 text-danger") : "border-line text-ink hover:bg-hover",
            )}
          >
            {g}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {map && (
          <motion.div key={`${k}${mid}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            <GeneticsChromosomeMap genes={map.genes} brackets={map.brackets} highlight={mid ? [mid] : undefined} />
            <p className={cn("rounded-xl px-3 py-2 text-[13.5px] leading-snug text-ink", right ? "bg-blob-soft" : "bg-danger/10")}>
              {right ? (
                <Inline
                  text={
                    set.note ??
                    tx(
                      `It fits: ${fmt(dist(outer[0], mid!), false)} + ${fmt(dist(mid!, outer[1]), false)} = ${fmt(dist(outer[0], outer[1]), false)} cM. The two genes with the **largest** recombination frequency are the outer ones.`,
                      `Passt: ${fmt(dist(outer[0], mid!), true)} + ${fmt(dist(mid!, outer[1]), true)} = ${fmt(dist(outer[0], outer[1]), true)} cM. Die beiden Gene mit der **größten** Rekombinationshäufigkeit liegen außen.`,
                    )
                  }
                />
              ) : (
                <Inline
                  text={tx(
                    `That doesn't add up: ${fmt(dist(outer[0], mid!), false)} + ${fmt(dist(mid!, outer[1]), false)} is far from ${fmt(dist(outer[0], outer[1]), false)}. The pair with the largest value must be the two **outer** genes.`,
                    `Das geht nicht auf: ${fmt(dist(outer[0], mid!), true)} + ${fmt(dist(mid!, outer[1]), true)} ist weit weg von ${fmt(dist(outer[0], outer[1]), true)}. Das Paar mit dem größten Wert sind die beiden **äußeren** Gene.`,
                  )}
                />
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Level 3: crossing-over simulation and a gene map built from recombination frequencies. */
export function GeneticsGeneMap() {
  const t = useText();
  const scope = useId();
  const [tab, setTab] = useState<"co" | "map">("co");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap rounded-lg border border-line p-0.5">
        {(["co", "map"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", tab === k ? "text-ink" : "text-ink-3 hover:text-ink")}>
            {tab === k && <motion.span layoutId={`${scope}-tab`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{k === "co" ? t(tx("Crossing-over", "Crossing-over")) : t(tx("Build a gene map", "Genkarte erstellen"))}</span>
          </button>
        ))}
      </div>
      {tab === "co" ? <CrossingOver /> : <GeneMap />}
    </div>
  );
}
