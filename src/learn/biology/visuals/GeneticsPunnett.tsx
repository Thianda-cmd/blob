"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { bloodGroup, punnett } from "@/learn/biology/topics/genetics/data";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { BloodDrop, Geno, MirabilisFlower, PeaFlower, PeaSeed } from "./GeneticsPea";

export type PunnettKind = "flower" | "shape" | "mirabilis" | "blood";

export const PUNNETT_GENOTYPES: Record<PunnettKind, string[]> = {
  flower: ["AA", "Aa", "aa"],
  shape: ["RR", "Rr", "rr"],
  mirabilis: ["RR", "RW", "WW"],
  blood: ["AA", "A0", "BB", "B0", "AB", "00"],
};

const KIND_NAME: Record<PunnettKind, Text> = {
  flower: tx("Pea: flower colour", "Erbse: Blütenfarbe"),
  shape: tx("Pea: seed shape", "Erbse: Samenform"),
  mirabilis: tx("Four o'clock flower", "Wunderblume"),
  blood: tx("Blood groups", "Blutgruppen"),
};

const KIND_RULE: Record<PunnettKind, Text> = {
  flower: tx("purple ($A$) dominant over white ($a$)", "violett ($A$) dominant über weiß ($a$)"),
  shape: tx("round ($R$) dominant over wrinkled ($r$)", "rund ($R$) dominant über runzlig ($r$)"),
  mirabilis: tx("red ($R$) and white ($W$): intermediate", "rot ($R$) und weiß ($W$): intermediär"),
  blood: tx("$A$ and $B$ codominant, $0$ recessive", "$A$ und $B$ kodominant, $0$ rezessiv"),
};

type Pheno = { key: string; label: Text; colour: string };

export function phenotypeOf(kind: PunnettKind, g: string): Pheno {
  switch (kind) {
    case "flower":
      return g.includes("A") ? { key: "purple", label: tx("purple", "violett"), colour: "var(--bio-u)" } : { key: "white", label: tx("white", "weiß"), colour: "var(--bio-bone)" };
    case "shape":
      return g.includes("R") ? { key: "round", label: tx("round", "rund"), colour: "var(--bio-c)" } : { key: "wrinkled", label: tx("wrinkled", "runzlig"), colour: "var(--bio-pollen)" };
    case "mirabilis":
      return g === "RR"
        ? { key: "red", label: tx("red", "rot"), colour: "var(--bio-blood)" }
        : g === "RW"
          ? { key: "pink", label: tx("pink", "rosa"), colour: "var(--bio-petal)" }
          : { key: "white", label: tx("white", "weiß"), colour: "var(--bio-bone)" };
    case "blood": {
      const bg = bloodGroup(g);
      const colour = { A: "var(--bio-water)", B: "var(--bio-leaf)", AB: "var(--bio-u)", "0": "var(--bio-bone)" }[bg];
      return { key: bg, label: tx(`group ${bg}`, `Gruppe ${bg}`), colour };
    }
  }
}

/** Small picture of a phenotype. */
export function PhenoIcon({ kind, g, size = 34 }: { kind: PunnettKind; g: string; size?: number }) {
  const p = phenotypeOf(kind, g);
  return (
    <svg viewBox="0 0 48 44" width={size} height={(size * 44) / 48} aria-hidden className="shrink-0">
      {kind === "flower" && <PeaFlower x={22} y={26} s={0.95} colour={p.key === "purple" ? "purple" : "white"} />}
      {kind === "shape" && <PeaSeed cx={24} cy={22} r={15} shape={p.key === "round" ? "round" : "wrinkled"} colour="yellow" />}
      {kind === "mirabilis" && <MirabilisFlower x={24} y={22} r={16} colour={p.key as "red" | "pink" | "white"} />}
      {kind === "blood" && <BloodDrop x={24} y={22} s={0.95} group={p.key} />}
    </svg>
  );
}

/** A gamete (Keimzelle) with its one allele. */
function Gamete({ allele, delay = 0 }: { allele: string; delay?: number }) {
  return (
    <motion.span
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 22, delay }}
      className="grid size-10 place-items-center rounded-full border-2 border-blob/60 bg-blob-soft text-[19px] text-ink"
    >
      <Geno g={allele} />
    </motion.span>
  );
}

/**
 * The Punnett square (Kreuzungsschema): gametes of parent 1 (♂) across the top, of parent 2 (♀)
 * down the side, offspring in the cells. `ask` shows a "?" in one cell (0–3, row by row).
 */
export function GeneticsPunnettGrid({ kind, g1, g2, ask, hidden, className }: { kind: PunnettKind; g1: string; g2: string; ask?: number; hidden?: boolean; className?: string }) {
  const t = useText();
  const cells = punnett(g1, g2);
  const k = `${kind}${g1}${g2}`;
  return (
    <div className={cn("mx-auto grid w-full max-w-[380px] grid-cols-[52px_1fr_1fr] gap-1.5", className)} role="table" aria-label={t(tx("Punnett square", "Kreuzungsschema"))}>
      <div className="relative grid place-items-center rounded-lg text-[13px] text-ink-3" aria-hidden>
        <svg viewBox="0 0 52 52" className="absolute inset-0 size-full">
          <line x1={4} y1={4} x2={48} y2={48} stroke="var(--line)" strokeWidth={1.5} />
        </svg>
        <span className="absolute right-1.5 top-0.5">♂</span>
        <span className="absolute bottom-0.5 left-1.5">♀</span>
      </div>
      {[g1[0], g1[1]].map((a, i) => (
        <div key={`c${k}${i}`} className="grid place-items-center py-1">
          <Gamete allele={a} delay={i * 0.06} />
        </div>
      ))}
      {[g2[0], g2[1]].map((r, ri) => (
        <div key={`r${ri}`} className="contents">
          <div className="grid place-items-center">
            <Gamete key={`r${k}${ri}`} allele={r} delay={0.12 + ri * 0.06} />
          </div>
          {[0, 1].map((ci) => {
            const idx = ri * 2 + ci;
            const g = cells[idx];
            const isAsk = ask === idx;
            return (
              <div key={ci} className={cn("relative min-h-[64px] rounded-xl border", isAsk ? "border-2 border-dashed border-blob bg-blob-soft" : "border-line bg-raised")}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={`${k}${idx}${isAsk}${hidden}`}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.25 + idx * 0.08 }}
                    className="flex h-full min-h-[64px] items-center justify-center gap-1.5 px-1 py-1.5"
                  >
                    {isAsk ? (
                      <span className="text-[24px] font-bold text-blob">?</span>
                    ) : hidden ? null : (
                      <>
                        <PhenoIcon kind={kind} g={g} size={32} />
                        <span className="text-[19px] text-ink">
                          <Geno g={g} />
                        </span>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Ratio of counts in a fixed order, reduced: [2, 2] → "1 : 1". */
function reduced(counts: number[]) {
  const g = counts.reduce((a, b) => {
    let x = a;
    let y = b;
    while (y) [x, y] = [y, x % y];
    return x;
  });
  return counts.map((c) => c / g);
}

/** What the cross shows, in one line. */
function crossNote(kind: PunnettKind, g1: string, g2: string): Text {
  const cells = punnett(g1, g2);
  const genos = new Set(cells);
  const phenos = new Set(cells.map((c) => phenotypeOf(kind, c).key));
  const homo = (g: string) => g[0] === g[1];
  if (kind === "blood") {
    if (phenos.size === 4) return tx("All four blood groups are possible: each with 25%. The hidden $0$ alleles meet in a quarter of the children.", "Alle vier Blutgruppen sind möglich, jede mit 25 %. Die verborgenen $0$-Allele treffen sich bei einem Viertel der Kinder.");
    if (cells.some((c) => c === "AB")) return tx("$A$ and $B$ are **codominant**: a child with $AB$ shows both, blood group AB.", "$A$ und $B$ sind **kodominant**: Ein Kind mit $AB$ zeigt beide, Blutgruppe AB.");
    if (cells.some((c) => c === "00")) return tx("Blood group 0 needs the recessive $0$ allele from **both** parents.", "Blutgruppe 0 braucht das rezessive $0$-Allel von **beiden** Eltern.");
    return tx("Each cell stands for a probability of 25%.", "Jede Zelle steht für eine Wahrscheinlichkeit von 25 %.");
  }
  if (homo(g1) && homo(g2) && g1 !== g2)
    return kind === "mirabilis"
      ? tx("**Uniformity rule**: all offspring are the same, $RW$ and pink. Neither allele dominates: intermediate inheritance.", "**Uniformitätsregel**: Alle Nachkommen sind gleich, $RW$ und rosa. Kein Allel setzt sich durch: intermediärer Erbgang.")
      : tx("**Uniformity rule** (1st law): pure-breeding × pure-breeding gives a uniform F1. All are heterozygous and show the dominant trait.", "**Uniformitätsregel** (1. Mendelsche Regel): reinerbig × reinerbig ergibt eine einheitliche F1. Alle sind mischerbig und zeigen das dominante Merkmal.");
  if (genos.size === 1) return tx("Both parents are pure-breeding and the same: the offspring look exactly like them.", "Beide Eltern sind reinerbig und gleich: Die Nachkommen sehen genauso aus wie sie.");
  if (!homo(g1) && !homo(g2))
    return kind === "mirabilis"
      ? tx("**Splitting rule**: red : pink : white = 1 : 2 : 1. Here the phenotype ratio equals the genotype ratio.", "**Spaltungsregel**: rot : rosa : weiß = 1 : 2 : 1. Hier ist das Phänotypverhältnis gleich dem Genotypverhältnis.")
      : tx("**Splitting rule** (2nd law): phenotypes 3 : 1, genotypes 1 : 2 : 1. The recessive trait is back!", "**Spaltungsregel** (2. Mendelsche Regel): Phänotypen 3 : 1, Genotypen 1 : 2 : 1. Das rezessive Merkmal ist wieder da!");
  if (phenos.size === 2)
    return kind === "mirabilis"
      ? tx("Half and half: 1 : 1. One parent is heterozygous, the other pure-breeding.", "Halb und halb: 1 : 1. Ein Elternteil ist mischerbig, der andere reinerbig.")
      : (homo(g1) && g1 === g1.toLowerCase()) || (homo(g2) && g2 === g2.toLowerCase())
        ? tx("**Test cross**: crossed with the recessive homozygote, a 1 : 1 ratio shows that the other parent is heterozygous.", "**Rückkreuzung**: Mit dem rezessiv Reinerbigen gekreuzt, verrät ein Verhältnis von 1 : 1, dass der andere Elternteil mischerbig ist.")
        : tx("Half and half: 1 : 1.", "Halb und halb: 1 : 1.");
  return tx("All offspring show the dominant trait, but not all have the same genotype.", "Alle Nachkommen zeigen das dominante Merkmal, haben aber nicht alle denselben Genotyp.");
}

function Results({ kind, g1, g2 }: { kind: PunnettKind; g1: string; g2: string }) {
  const t = useText();
  const cells = punnett(g1, g2);
  const genos = PUNNETT_GENOTYPES[kind].filter((g) => cells.includes(g));
  const gCounts = genos.map((g) => cells.filter((c) => c === g).length);
  const gRatio = reduced(gCounts);
  const phenos: Pheno[] = [];
  for (const g of PUNNETT_GENOTYPES[kind]) {
    if (!cells.includes(g)) continue;
    const p = phenotypeOf(kind, g);
    if (!phenos.some((x) => x.key === p.key)) phenos.push(p);
  }
  const pCounts = phenos.map((p) => cells.filter((c) => phenotypeOf(kind, c).key === p.key).length);
  const pRatio = reduced(pCounts);
  return (
    <div className="space-y-3 text-[14px]">
      <div>
        <div className="mb-1 text-[12.5px] font-medium uppercase tracking-wide text-ink-3">{t(tx("Genotypes", "Genotypen"))}</div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[18px] text-ink">
          {genos.map((g, i) => (
            <span key={g} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-ink-3">:</span>}
              <span className="font-math tabular-nums">{gRatio[i]}</span>
              <Geno g={g} />
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[12.5px] font-medium uppercase tracking-wide text-ink-3">{t(tx("Phenotypes", "Phänotypen"))}</div>
        <div className="flex h-7 w-full overflow-hidden rounded-lg border border-line">
          {phenos.map((p, i) => (
            <motion.div
              key={p.key}
              layout
              initial={false}
              animate={{ flexGrow: pCounts[i] }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="grid min-w-0 basis-0 place-items-center text-[12px] font-semibold text-ink"
              style={{ background: p.colour }}
            >
              <span className="truncate px-1">{t(tx(`${(pCounts[i] / 4) * 100}%`, `${(pCounts[i] / 4) * 100} %`))}</span>
            </motion.div>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[14px] text-ink">
          {phenos.map((p, i) => (
            <span key={p.key} className="flex items-center gap-1">
              <span className="font-math text-[17px] tabular-nums">{pRatio[i]}</span> {t(p.label)}
              {i < phenos.length - 1 && <span className="ml-2 text-ink-3">:</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function GenoPicker({ label, options, value, onChange, kind }: { label: Text; options: string[]; value: string; onChange: (g: string) => void; kind: PunnettKind }) {
  const t = useText();
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <PhenoIcon kind={kind} g={value} size={30} />
        <div className="min-w-0 text-[13px] leading-tight text-ink-2">
          <div className="font-medium text-ink">{t(label)}</div>
          <div>{t(phenotypeOf(kind, value).label)}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t(label)}>
        {options.map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={value === g}
            onClick={() => onChange(g)}
            className={cn(
              "min-w-[44px] rounded-lg border px-2 py-1 text-[17px] transition-colors",
              value === g ? "border-blob bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            <Geno g={g} />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Build a cross: pick the genotypes of both parents, the gametes fill in, then the offspring,
 * and the genotype and phenotype ratios appear.
 */
export function GeneticsPunnett({ kinds = ["flower", "mirabilis", "blood"], homozygousOnly = false }: { kinds?: PunnettKind[]; homozygousOnly?: boolean }) {
  const t = useText();
  const scope = useId();
  const [kind, setKind] = useState<PunnettKind>(kinds[0]);
  const start: Record<PunnettKind, [string, string]> = homozygousOnly
    ? { flower: ["AA", "aa"], shape: ["RR", "rr"], mirabilis: ["RR", "WW"], blood: ["AA", "00"] }
    : { flower: ["Aa", "Aa"], shape: ["Rr", "Rr"], mirabilis: ["RW", "RW"], blood: ["A0", "B0"] };
  const [pick, setPick] = useState<Record<PunnettKind, [string, string]>>(start);
  const [g1, g2] = pick[kind];
  const opts = PUNNETT_GENOTYPES[kind].filter((g) => !homozygousOnly || g[0] === g[1]);
  const set = (i: 0 | 1, g: string) => setPick((p) => ({ ...p, [kind]: (i === 0 ? [g, p[kind][1]] : [p[kind][0], g]) as [string, string] }));
  const human = kind === "blood";
  return (
    <div className="space-y-4">
      {kinds.length > 1 && (
        <div className="flex flex-wrap rounded-lg border border-line p-0.5">
          {kinds.map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", kind === k ? "text-ink" : "text-ink-3 hover:text-ink")}>
              {kind === k && <motion.span layoutId={`${scope}-tab`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{t(KIND_NAME[k])}</span>
            </button>
          ))}
        </div>
      )}
      <p className="text-[13.5px] text-ink-3">
        <Inline text={KIND_RULE[kind]} />
      </p>
      <div className="flex items-stretch gap-2">
        <GenoPicker
          kind={kind}
          label={human ? tx("♂ Father", "♂ Vater") : homozygousOnly ? tx("♂ Parent (P)", "♂ Elternpflanze (P)") : tx("♂ Parent 1", "♂ Elternpflanze 1")}
          options={opts}
          value={g1}
          onChange={(g) => set(0, g)}
        />
        <span className="self-center font-math text-[24px] text-ink-3">×</span>
        <GenoPicker
          kind={kind}
          label={human ? tx("♀ Mother", "♀ Mutter") : homozygousOnly ? tx("♀ Parent (P)", "♀ Elternpflanze (P)") : tx("♀ Parent 2", "♀ Elternpflanze 2")}
          options={opts}
          value={g2}
          onChange={(g) => set(1, g)}
        />
      </div>
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div>
          <div className="mb-1.5 text-center text-[12.5px] text-ink-3">{t(homozygousOnly ? tx("Gametes and F1 offspring", "Keimzellen und Nachkommen (F1)") : tx("Gametes and offspring", "Keimzellen und Nachkommen"))}</div>
          <GeneticsPunnettGrid kind={kind} g1={g1} g2={g2} />
        </div>
        <div className="space-y-3">
          <Results kind={kind} g1={g1} g2={g2} />
          <motion.p key={`${kind}${g1}${g2}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-blob-soft px-3 py-2 text-[13.5px] leading-snug text-ink">
            <Inline text={crossNote(kind, g1, g2)} />
          </motion.p>
        </div>
      </div>
    </div>
  );
}

/** Level 1: only pure-breeding parents (P generation), to see the uniformity rule. */
export function GeneticsPunnettP() {
  return <GeneticsPunnett kinds={["flower", "shape"]} homozygousOnly />;
}
