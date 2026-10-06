"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { geno } from "@/learn/biology/topics/genetics/data";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { MiniPair } from "./GeneticsChromosomes";
import { Geno, PeaPlant } from "./GeneticsPea";

type Gene = { L: string; name: Text; dom: Text; rec: Text };
const GENES: Gene[] = [
  { L: "A", name: tx("Flower colour", "Blütenfarbe"), dom: tx("purple flowers", "violette Blüten"), rec: tx("white flowers", "weiße Blüten") },
  { L: "R", name: tx("Seed shape", "Samenform"), dom: tx("round seeds", "runde Samen"), rec: tx("wrinkled seeds", "runzlige Samen") },
];

function Toggle({ value, letter, onChange, label }: { value: string; letter: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label={label}>
      {[letter, letter.toLowerCase()].map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("relative min-w-[38px] rounded-md px-2 py-1 font-math text-[18px] italic", value === v ? "text-white" : "text-ink-2 hover:text-ink")}
        >
          {value === v && <motion.span layoutId={`${label}-on`} className="absolute inset-0 rounded-md bg-blob" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          <span className="relative">{v}</span>
        </button>
      ))}
    </div>
  );
}

function status(g: string): Text {
  if (g[0] !== g[1]) return tx("heterozygous (mixed)", "mischerbig (heterozygot)");
  return g[0] === g[0].toUpperCase() ? tx("homozygous dominant", "reinerbig (homozygot) dominant") : tx("homozygous recessive", "reinerbig (homozygot) rezessiv");
}

function why(g: string, gene: Gene): Text {
  const L = gene.L;
  const l = L.toLowerCase();
  if (g[0] !== g[1])
    return tx(`$${L}${l}$: the dominant allele $${L}$ wins. The recessive $${l}$ is still there, just hidden.`, `$${L}${l}$: Das dominante Allel $${L}$ setzt sich durch. Das rezessive $${l}$ ist trotzdem da, nur verborgen.`);
  if (g[0] === L) return tx(`$${L}${L}$: two dominant alleles. Looks the same as $${L}${l}$!`, `$${L}${L}$: zwei dominante Allele. Sieht genauso aus wie $${L}${l}$!`);
  return tx(`$${l}${l}$: only when **both** alleles are recessive does the recessive trait show.`, `$${l}${l}$: Nur wenn **beide** Allele rezessiv sind, zeigt sich das rezessive Merkmal.`);
}

/** Level 1: pick the two alleles of two genes (one from each parent) and watch the pea plant change. */
export function GeneticsAlleleLab() {
  const t = useText();
  const [al, setAl] = useState<[string, string][]>([
    ["A", "a"],
    ["r", "r"],
  ]);
  const set = (gi: number, side: 0 | 1, v: string) => setAl((cur) => cur.map((p, i) => (i === gi ? ((side === 0 ? [v, p[1]] : [p[0], v]) as [string, string]) : p)));
  const gA = geno(al[0][0], al[0][1]);
  const gR = geno(al[1][0], al[1][1]);
  const purple = gA.includes("A");
  const round = gR.includes("R");
  return (
    <div className="grid items-center gap-5 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      <div className="flex items-end justify-center gap-2">
        <div className="w-[170px] shrink-0">
          <PeaPlant flower={purple ? "purple" : "white"} seedShape={round ? "round" : "wrinkled"} />
        </div>
        <MiniPair a={al[0]} b={al[1]} />
      </div>
      <div className="space-y-3">
        {GENES.map((gene, gi) => {
          const g = gi === 0 ? gA : gR;
          const dom = g.includes(gene.L);
          return (
            <div key={gene.L} className="rounded-xl border border-line bg-surface p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-ink">{t(gene.name)}</span>
                <span className="rounded-full bg-blob-soft px-2 py-0.5 text-[12px] font-medium text-blob-ink">{t(status(g))}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-2">
                <span className="flex items-center gap-2">
                  ♀ {t(tx("from mother", "von der Mutter"))}
                  <Toggle value={al[gi][0]} letter={gene.L} onChange={(v) => set(gi, 0, v)} label={`m${gene.L}`} />
                </span>
                <span className="flex items-center gap-2">
                  ♂ {t(tx("from father", "vom Vater"))}
                  <Toggle value={al[gi][1]} letter={gene.L} onChange={(v) => set(gi, 1, v)} label={`f${gene.L}`} />
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[14px]">
                <span className="text-ink-3">
                  {t(tx("Genotype", "Genotyp"))}{" "}
                  <span className="text-[18px] text-ink">
                    <Geno g={g} />
                  </span>
                </span>
                <span className="text-ink-3">
                  {t(tx("Phenotype", "Phänotyp"))} <span className="font-medium text-ink">{t(dom ? gene.dom : gene.rec)}</span>
                </span>
              </div>
              <motion.p key={g} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-[13px] leading-snug text-ink-2">
                <Inline text={why(g, gene)} />
              </motion.p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
