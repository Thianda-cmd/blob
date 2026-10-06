"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { createRng } from "@/learn/engine/rng";
import { childrenOf, exclusion, generatePedigree, MODES, possibleGenotypes, possibleModes, type Mode, type Pedigree } from "@/learn/biology/topics/genetics/pedigree";
import { genoLabel, isCarrier, MODE_NAME, possibleText, reasonText } from "@/learn/biology/topics/genetics/pedigree-text";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { SvgGeno } from "./GeneticsPea";

const SLOT = 50;
const PADL = 42;
const PADR = 16;
const TOP = 30;
const ROW = 104;
const R = 14;
const ROMAN = ["I", "II", "III", "IV"];

/**
 * A pedigree with the standard symbols: square = male, circle = female, filled = affected,
 * half filled = heterozygous carrier, "?" = status unknown. Persons are numbered 1, 2, 3 …
 * generation by generation, from left to right.
 */
export function GeneticsPedigreeChart({
  ped,
  highlight,
  ask,
  labels,
  carriers,
  dim,
  legend = true,
}: {
  ped: Pedigree;
  /** People (indices) to ring in purple. */
  highlight?: number[];
  /** A person (index) the task asks about: pulsing ring. */
  ask?: number;
  /** Genotype labels under the numbers (display form like "X^A X^a"), null for none. */
  labels?: (string | null)[];
  /** People (indices) to draw as carriers (half filled), in addition to `person.carrier`. */
  carriers?: number[];
  /** People (indices) to fade out. */
  dim?: number[];
  legend?: boolean;
}) {
  const t = useText();
  const reduce = useReducedMotion();
  const { people } = ped;
  const gens = Math.max(...people.map((p) => p.gen)) + 1;
  const W = PADL + ped.width * SLOT + PADR;
  const H = TOP + (gens - 1) * ROW + R + (labels ? 44 : 28);
  const X = (i: number) => PADL + people[i].x * SLOT;
  const Y = (i: number) => TOP + people[i].gen * ROW;
  const isCarrierP = (i: number) => people[i].carrier || carriers?.includes(i);
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const [a, b] of ped.couples) {
    const ya = Y(a);
    const [l, r] = X(a) < X(b) ? [a, b] : [b, a];
    lines.push({ x1: X(l) + R, y1: ya, x2: X(r) - R, y2: ya });
    const kids = childrenOf(ped, a, b);
    if (!kids.length) continue;
    const mid = (X(a) + X(b)) / 2;
    const ys = ya + ROW / 2;
    lines.push({ x1: mid, y1: ya, x2: mid, y2: ys });
    const xs = [...kids.map(X), mid];
    lines.push({ x1: Math.min(...xs), y1: ys, x2: Math.max(...xs), y2: ys });
    for (const k of kids) lines.push({ x1: X(k), y1: ys, x2: X(k), y2: Y(k) - R });
  }
  const anyCarrier = people.some((_, i) => isCarrierP(i));
  const anyUnknown = people.some((p) => p.unknown && !p.unborn);
  const anyUnborn = people.some((p) => p.unborn);

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full" style={{ maxWidth: Math.min(640, W * 1.35) }} role="img" aria-label={t(tx("Pedigree", "Stammbaum"))}>
        {Array.from({ length: gens }, (_, g) => (
          <text key={g} x={12} y={TOP + g * ROW} dominantBaseline="central" fontSize={14} fontWeight={600} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            {ROMAN[g]}
          </text>
        ))}
        {lines.map((l, i) => (
          <line key={i} {...l} stroke="var(--ink-2)" strokeWidth={1.6} strokeLinecap="round" />
        ))}
        {people.map((p, i) => {
          const x = X(i);
          const y = Y(i);
          const lit = highlight?.includes(i) || ask === i;
          const faded = dim?.includes(i);
          const fill = p.affected ? "var(--ink)" : "var(--raised)";
          const half = !p.affected && isCarrierP(i);
          return (
            <g key={i} opacity={faded ? 0.3 : 1} style={{ transition: "opacity .25s" }}>
              {lit && <circle cx={x} cy={y} r={R + 8} fill="var(--blob-soft)" stroke="var(--blob)" strokeWidth={2.4} />}
              {ask === i && !reduce && (
                <motion.circle
                  cx={x}
                  cy={y}
                  r={R + 8}
                  fill="none"
                  stroke="var(--blob)"
                  strokeWidth={2}
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                />
              )}
              {p.unborn ? (
                <rect x={x - R * 0.95} y={y - R * 0.95} width={R * 1.9} height={R * 1.9} rx={2} transform={`rotate(45 ${x} ${y})`} fill="var(--raised)" stroke="var(--ink)" strokeWidth={1.8} strokeDasharray="4 3" />
              ) : p.sex === "m" ? (
                <>
                  <rect x={x - R} y={y - R} width={2 * R} height={2 * R} rx={2} fill={fill} stroke="var(--ink)" strokeWidth={1.8} />
                  {half && <rect x={x - R} y={y - R} width={R} height={2 * R} fill="var(--ink)" />}
                </>
              ) : (
                <>
                  <circle cx={x} cy={y} r={R + 0.5} fill={fill} stroke="var(--ink)" strokeWidth={1.8} />
                  {half && <path d={`M ${x} ${y - R - 0.5} A ${R + 0.5} ${R + 0.5} 0 0 0 ${x} ${y + R + 0.5} Z`} fill="var(--ink)" />}
                </>
              )}
              {p.unknown && (
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={700} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
                  ?
                </text>
              )}
              <text x={x} y={y + R + 14} textAnchor="middle" fontSize={14} fontWeight={lit ? 700 : 500} fill={lit ? "var(--blob)" : "var(--ink-2)"} style={{ fontFamily: "var(--font-sans)" }}>
                {i + 1}
              </text>
              {labels?.[i] && (
                <text x={x} y={y + R + 31} textAnchor="middle" fontSize={12.5} fill="var(--ink)" style={{ fontFamily: "var(--font-math)" }}>
                  <SvgGeno g={labels[i]!} fontSize={12.5} />
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {legend && (
        <figcaption className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
          <LegendItem shape="m" label={tx("male", "Mann")} />
          <LegendItem shape="f" label={tx("female", "Frau")} />
          <LegendItem shape="m" filled label={tx("affected", "betroffen")} />
          {anyCarrier && <LegendItem shape="f" half label={tx("carrier (heterozygous)", "Überträger(in), heterozygot")} />}
          {anyUnknown && <LegendItem shape="m" unknown label={tx("status unknown", "Status unbekannt")} />}
          {anyUnborn && <LegendItem shape="d" unknown label={tx("expected child", "erwartetes Kind")} />}
        </figcaption>
      )}
    </figure>
  );
}

function LegendItem({ shape, filled, half, unknown, label }: { shape: "m" | "f" | "d"; filled?: boolean; half?: boolean; unknown?: boolean; label: Text }) {
  const t = useText();
  return (
    <span className="flex items-center gap-1.5">
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
        {shape === "d" ? (
          <rect x={4} y={4} width={12} height={12} rx={1} transform="rotate(45 10 10)" fill="var(--raised)" stroke="var(--ink)" strokeWidth={1.4} strokeDasharray="3 2" />
        ) : shape === "m" ? (
          <rect x={2} y={2} width={16} height={16} rx={1.5} fill={filled ? "var(--ink)" : "var(--raised)"} stroke="var(--ink)" strokeWidth={1.6} />
        ) : (
          <circle cx={10} cy={10} r={8} fill={filled ? "var(--ink)" : "var(--raised)"} stroke="var(--ink)" strokeWidth={1.6} />
        )}
        {half && <path d="M 10 2 A 8 8 0 0 0 10 18 Z" fill="var(--ink)" />}
        {unknown && (
          <text x={10} y={11} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="var(--ink-2)">
            ?
          </text>
        )}
      </svg>
      {t(label)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Widgets

/** A family for the level 2 widget: exactly one of the two autosomal modes fits. */
function detectiveFamily(k: number) {
  const rng = createRng(5101 + k * 131);
  const mode: Mode = rng.chance(0.5) ? "AR" : "AD";
  const ped = generatePedigree(rng, mode, ["AD", "AR"], (p) => p.length === 1, 8);
  const truth = possibleModes(ped, ["AD", "AR"])[0] ?? mode;
  const trio = exclusion(ped, truth === "AD" ? "AR" : "AD");
  return { ped, truth, trio };
}

function labelsFor(ped: Pedigree, mode: Mode) {
  const sets = possibleGenotypes(ped, mode);
  return {
    labels: ped.people.map((p, i) => genoLabel(mode, p.sex, sets[i])),
    carriers: ped.people.map((p, i) => (isCarrier(mode, p.sex, p.affected, sets[i]) ? i : -1)).filter((i) => i >= 0),
  };
}

function NewFamily({ onClick, n }: { onClick: () => void; n: number }) {
  const t = useText();
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-medium text-ink-3">{t(tx(`Family ${n}`, `Familie ${n}`))}</span>
      <button type="button" onClick={onClick} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink">
        <RefreshCw className="size-3.5" />
        {t(tx("New family", "Neue Familie"))}
      </button>
    </div>
  );
}

/** Level 2: dominant or recessive? Find the family that decides it. */
export function GeneticsPedigreeDetective() {
  const t = useText();
  const [k, setK] = useState(0);
  const [guess, setGuess] = useState<"AD" | "AR" | null>(null);
  const [showGeno, setShowGeno] = useState(false);
  const { ped, truth, trio } = useMemo(() => detectiveFamily(k), [k]);
  const geno = useMemo(() => labelsFor(ped, truth), [ped, truth]);
  const next = () => {
    setK(k + 1);
    setGuess(null);
    setShowGeno(false);
  };
  const right = guess === truth;
  const why: Text | null = !trio
    ? null
    : truth === "AR"
      ? tx(
          `Persons ${trio.father + 1} and ${trio.mother + 1} are healthy, but their child ${trio.child + 1} is affected. The allele was hidden in both parents: they are carriers ($Aa$). That only works if it is **recessive**.`,
          `${trio.father + 1} und ${trio.mother + 1} sind gesund, ihr Kind ${trio.child + 1} ist aber krank. Das Allel war bei beiden Eltern verborgen: Sie sind Überträger ($Aa$). Das geht nur, wenn es **rezessiv** ist.`,
        )
      : tx(
          `Persons ${trio.father + 1} and ${trio.mother + 1} are both affected, but their child ${trio.child + 1} is healthy. Both parents must be $Aa$ and passed on a healthy $a$. With a recessive allele, two affected parents ($aa$) could only have affected children: so it's **dominant**.`,
          `${trio.father + 1} und ${trio.mother + 1} sind beide krank, ihr Kind ${trio.child + 1} ist aber gesund. Beide Eltern müssen $Aa$ sein und ein gesundes $a$ weitergegeben haben. Bei einem rezessiven Allel hätten zwei kranke Eltern ($aa$) nur kranke Kinder: Es ist also **dominant**.`,
        );
  return (
    <div className="space-y-3">
      <NewFamily onClick={next} n={k + 1} />
      <GeneticsPedigreeChart
        ped={ped}
        highlight={guess && trio ? [trio.father, trio.mother, trio.child] : undefined}
        labels={showGeno ? geno.labels : undefined}
        carriers={showGeno ? geno.carriers : undefined}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] text-ink-2">{t(tx("The disease allele is …", "Das Krankheitsallel ist …"))}</span>
        {(["AD", "AR"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setGuess(m)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-[14px] font-medium transition-colors",
              guess === m ? (right ? "border-ok bg-ok/10 text-ok" : "border-danger bg-danger/10 text-danger") : "border-line text-ink hover:bg-hover",
            )}
          >
            {m === "AD" ? t(tx("dominant", "dominant")) : t(tx("recessive", "rezessiv"))}
          </button>
        ))}
        {guess && (
          <button type="button" onClick={() => setShowGeno(!showGeno)} aria-pressed={showGeno} className={cn("ml-auto rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors", showGeno ? "border-blob bg-blob-soft text-ink" : "border-line text-ink-2 hover:bg-hover")}>
            {t(tx("Show genotypes", "Genotypen zeigen"))}
          </button>
        )}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={`${k}${guess}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-blob-soft px-3 py-2 text-[13.5px] leading-snug text-ink">
          {!guess ? (
            t(tx("Look for a couple whose child doesn't match them. Then decide.", "Such ein Elternpaar, dessen Kind nicht zu ihnen passt. Dann entscheide."))
          ) : (
            <>
              <strong className={right ? "text-ok" : "text-danger"}>{right ? t(tx("Right! ", "Richtig! ")) : t(tx("Not quite. ", "Nicht ganz. "))}</strong>
              {why && <Inline text={why} />}
              {showGeno && <span className="mt-1 block text-ink-2">{t(tx("“A?” means AA or Aa: the second allele can't be read from the tree.", "„A?“ heißt AA oder Aa: Das zweite Allel lässt sich am Stammbaum nicht ablesen."))}</span>}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** A family for the level 3 widget: some modes ruled out, at least one possible. */
function labFamily(k: number) {
  const rng = createRng(7703 + k * 211);
  const mode = rng.pick(MODES);
  const want = rng.chance(0.55) ? 1 : 2;
  const ped = generatePedigree(rng, mode, MODES, (p) => p.length === want || (want === 2 && p.length === 1), 9);
  return ped;
}

/** Level 3: the exclusion method. Test each mode against every family. */
export function GeneticsPedigreeLab() {
  const t = useText();
  const [k, setK] = useState(0);
  const [sel, setSel] = useState<Mode | null>(null);
  const [tested, setTested] = useState<Mode[]>([]);
  const ped = useMemo(() => labFamily(k), [k]);
  const verdicts = useMemo(() => Object.fromEntries(MODES.map((m) => [m, exclusion(ped, m)])) as Record<Mode, ReturnType<typeof exclusion>>, [ped]);
  const geno = useMemo(() => (sel && !verdicts[sel] ? labelsFor(ped, sel) : null), [ped, sel, verdicts]);
  const trio = sel ? verdicts[sel] : null;
  const test = (m: Mode) => {
    setSel(m);
    if (!tested.includes(m)) setTested([...tested, m]);
  };
  const next = () => {
    setK(k + 1);
    setSel(null);
    setTested([]);
  };
  const done = tested.length === MODES.length;
  const left = MODES.filter((m) => !verdicts[m]);
  return (
    <div className="space-y-3">
      <NewFamily onClick={next} n={k + 1} />
      <GeneticsPedigreeChart
        ped={ped}
        highlight={trio ? [trio.father, trio.mother, trio.child] : undefined}
        dim={trio ? ped.people.map((_, i) => i).filter((i) => i !== trio.father && i !== trio.mother && i !== trio.child) : undefined}
        labels={geno?.labels}
        carriers={geno?.carriers}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MODES.map((m) => {
          const seen = tested.includes(m);
          const out = !!verdicts[m];
          return (
            <button
              key={m}
              type="button"
              onClick={() => test(m)}
              aria-pressed={sel === m}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[13.5px] font-medium leading-tight transition-colors",
                sel === m ? "border-blob bg-blob-soft text-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
              )}
            >
              <span>{t(MODE_NAME[m])}</span>
              {seen && (out ? <X className="size-4 shrink-0 text-danger" aria-label={t(tx("ruled out", "ausgeschlossen"))} /> : <Check className="size-4 shrink-0 text-ok" aria-label={t(tx("possible", "möglich"))} />)}
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={`${k}${sel}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-blob-soft px-3 py-2 text-[13.5px] leading-snug text-ink">
          {!sel ? (
            t(tx("Tap a mode of inheritance to test it against every family in the tree.", "Tipp auf einen Erbgang, um ihn an jeder Familie im Stammbaum zu prüfen."))
          ) : trio ? (
            <>
              <strong className="text-danger">{t(tx("Ruled out. ", "Ausgeschlossen. "))}</strong>
              <Inline text={reasonText(ped, sel, trio)} />
            </>
          ) : (
            <>
              <strong className="text-ok">{t(tx("Possible. ", "Möglich. "))}</strong>
              <Inline text={possibleText(sel)} />{" "}
              {t(tx("The labels show the genotypes that fit; half-filled symbols are certain carriers.", "Die Beschriftung zeigt die passenden Genotypen; halb gefüllte Symbole sind sichere Überträger(innen)."))}
            </>
          )}
          {done && (
            <span className="mt-1.5 block font-medium">
              {t(tx("Still possible: ", "Noch möglich: "))}
              {left.map((m) => t(MODE_NAME[m])).join(", ")}
            </span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
