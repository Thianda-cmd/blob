"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { xCross, X_DISEASES } from "@/learn/biology/topics/genetics/data";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { Geno } from "./GeneticsPea";

/** A gamete's sex chromosome: a long X with the gene locus, or the short Y without it. */
function SexChromosome({ kind, ill }: { kind: "X" | "Y"; ill?: boolean }) {
  return (
    <svg viewBox="0 0 16 40" className="h-9 w-4" aria-hidden>
      {kind === "X" ? (
        <>
          <rect x={3} y={2} width={10} height={36} rx={5} fill="var(--bio-nucleus)" stroke="var(--bio-outline)" strokeWidth={1.3} />
          <rect x={3} y={11} width={10} height={6} fill={ill ? "var(--ink)" : "var(--raised)"} stroke="var(--bio-outline)" strokeWidth={1} />
        </>
      ) : (
        <rect x={3} y={14} width={10} height={22} rx={5} fill="var(--bio-water)" stroke="var(--bio-outline)" strokeWidth={1.3} />
      )}
    </svg>
  );
}

function GameteChip({ g, delay }: { g: string; delay: number }) {
  return (
    <motion.span
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 360, damping: 22, delay }}
      className="flex items-center gap-1 rounded-full border-2 border-blob/50 bg-blob-soft px-2 py-0.5 text-[16px] text-ink"
    >
      <SexChromosome kind={g.startsWith("Y") ? "Y" : "X"} ill={g.includes("^a")} />
      <Geno g={g} />
    </motion.span>
  );
}

/** Child symbol: circle (daughter) or square (son), filled when affected, half filled for a carrier. */
function ChildSymbol({ son, state }: { son: boolean; state: "ill" | "carrier" | "ok" }) {
  const fill = state === "ill" ? "var(--ink)" : "var(--raised)";
  return (
    <svg viewBox="0 0 30 30" className="size-7 shrink-0" aria-hidden>
      {son ? <rect x={4} y={4} width={22} height={22} rx={2} fill={fill} stroke="var(--ink)" strokeWidth={1.8} /> : <circle cx={15} cy={15} r={11.5} fill={fill} stroke="var(--ink)" strokeWidth={1.8} />}
      {state === "carrier" && <path d="M 15 3.5 A 11.5 11.5 0 0 0 15 26.5 Z" fill="var(--ink)" />}
    </svg>
  );
}

const MOTHERS: { d: number; g: string; label: Text }[] = [
  { d: 0, g: "X^A X^A", label: tx("healthy", "gesund") },
  { d: 1, g: "X^A X^a", label: tx("carrier", "Konduktorin") },
  { d: 2, g: "X^a X^a", label: tx("affected", "betroffen") },
];
const FATHERS: { d: number; g: string; label: Text }[] = [
  { d: 0, g: "X^A Y", label: tx("healthy", "gesund") },
  { d: 1, g: "X^a Y", label: tx("affected", "betroffen") },
];

const pc = (v: number): Text => tx(`${Math.round(v * 100)}%`, `${Math.round(v * 100)} %`);

function note(md: number, fd: number): Text {
  if (fd === 1 && md === 0)
    return tx(
      "An affected father passes his $X^a$ to **every daughter**: they all become carriers. His sons get his **Y**, so none of them is affected.",
      "Ein betroffener Vater gibt sein $X^a$ an **jede Tochter** weiter: Alle werden Konduktorinnen. Seine Söhne bekommen sein **Y**, deshalb ist keiner von ihnen betroffen.",
    );
  if (md === 1 && fd === 0)
    return tx(
      "The carrier mother passes $X^a$ to half of her children. Sons have no second X to cover it: **half of the sons** are affected. Daughters get a healthy $X^A$ from their father.",
      "Die Konduktorin gibt $X^a$ an die Hälfte ihrer Kinder weiter. Söhne haben kein zweites X, das es ausgleicht: **Die Hälfte der Söhne** ist betroffen. Töchter bekommen vom Vater ein gesundes $X^A$.",
    );
  if (md === 1 && fd === 1)
    return tx("Now daughters can be affected too: they need $X^a$ from **both** parents. Half of the daughters and half of the sons are affected.", "Jetzt können auch Töchter betroffen sein: Sie brauchen $X^a$ von **beiden** Eltern. Die Hälfte der Töchter und die Hälfte der Söhne sind betroffen.");
  if (md === 2)
    return fd === 1
      ? tx("Both parents only have $X^a$ to give: every child is affected.", "Beide Eltern können nur $X^a$ weitergeben: Alle Kinder sind betroffen.")
      : tx("An affected mother passes $X^a$ to **every son**: all sons are affected. The daughters are carriers.", "Eine betroffene Mutter gibt $X^a$ an **jeden Sohn** weiter: Alle Söhne sind betroffen. Die Töchter sind Konduktorinnen.");
  return tx("No $X^a$ in the family: all children are healthy.", "Kein $X^a$ in der Familie: Alle Kinder sind gesund.");
}

/**
 * X-linked recessive inheritance: pick mother and father, see daughters and sons separately.
 * Columns: the father's sperm (X or Y), rows: the mother's eggs.
 */
export function GeneticsXLinked() {
  const t = useText();
  const scope = useId();
  const [dis, setDis] = useState(0);
  const [md, setMd] = useState(1);
  const [fd, setFd] = useState(0);
  const disease = X_DISEASES[dis];
  const r = xCross(md, fd);
  const mg = md === 0 ? ["X^A", "X^A"] : md === 1 ? ["X^A", "X^a"] : ["X^a", "X^a"];
  const fg = [fd ? "X^a" : "X^A", "Y"];
  const key = `${md}${fd}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap rounded-lg border border-line p-0.5">
        {X_DISEASES.map((d, i) => (
          <button key={d.id} type="button" onClick={() => setDis(i)} className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", dis === i ? "text-ink" : "text-ink-3 hover:text-ink")}>
            {dis === i && <motion.span layoutId={`${scope}-tab`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{t(d.short)}</span>
          </button>
        ))}
      </div>
      <p className="text-[13.5px] text-ink-3">
        <Inline text={tx(`The allele for ${resolveText(disease.short, "en")} ($a$) lies on the X chromosome and is recessive. The Y has no copy of this gene.`, `Das Allel für die ${resolveText(disease.short, "de")} ($a$) liegt auf dem X-Chromosom und ist rezessiv. Das Y hat dieses Gen nicht.`)} />
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <XPicker label={tx("♀ Mother", "♀ Mutter")} list={MOTHERS} value={md} set={setMd} />
        <XPicker label={tx("♂ Father", "♂ Vater")} list={FATHERS} value={fd} set={setFd} />
      </div>
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="mx-auto grid w-full max-w-[380px] grid-cols-[72px_1fr_1fr] gap-1.5">
          <div className="grid place-items-center text-[12px] leading-tight text-ink-3">
            <span>♂ →</span>
            <span>♀ ↓</span>
          </div>
          {fg.map((g, i) => (
            <div key={`${key}f${i}`} className="flex flex-col items-center gap-0.5 py-1">
              <GameteChip g={g} delay={i * 0.06} />
              <span className="text-[11.5px] text-ink-3">{i === 0 ? t(tx("→ daughters", "→ Töchter")) : t(tx("→ sons", "→ Söhne"))}</span>
            </div>
          ))}
          {mg.map((m, ri) => (
            <div key={ri} className="contents">
              <div className="grid place-items-center">
                <GameteChip key={`${key}m${ri}`} g={m} delay={0.12 + ri * 0.06} />
              </div>
              {fg.map((f, ci) => {
                const son = f === "Y";
                const d = (m.includes("^a") ? 1 : 0) + (!son && f.includes("^a") ? 1 : 0);
                const state = son ? (d ? "ill" : "ok") : d === 2 ? "ill" : d === 1 ? "carrier" : "ok";
                const g = son ? `${m} Y` : f.includes("^a") && !m.includes("^a") ? `${m} ${f}` : `${f} ${m}`;
                return (
                  <div key={ci} className="min-h-[70px] rounded-xl border border-line bg-raised">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.div
                        key={`${key}${ri}${ci}`}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.25 + (ri * 2 + ci) * 0.08 }}
                        className="flex h-full min-h-[70px] flex-col items-center justify-center gap-0.5 py-1"
                      >
                        <div className="flex items-center gap-1.5">
                          <ChildSymbol son={son} state={state} />
                          <span className="text-[16px] text-ink">
                            <Geno g={g} />
                          </span>
                        </div>
                        <span className="text-[11.5px] text-ink-2">
                          {state === "ill" ? t(tx("affected", "betroffen")) : state === "carrier" ? t(tx("carrier", "Konduktorin")) : t(tx("healthy", "gesund"))}
                        </span>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="space-y-2.5 text-[14px]">
          <Row label={tx("Daughters", "Töchter")} parts={[[r.daughterAffected, tx("affected", "betroffen"), "ill"], [r.daughterCarrier, tx("carriers", "Konduktorinnen"), "carrier"], [1 - r.daughterAffected - r.daughterCarrier, tx("healthy", "gesund"), "ok"]]} />
          <Row label={tx("Sons", "Söhne")} parts={[[r.sonAffected, tx("affected", "betroffen"), "ill"], [1 - r.sonAffected, tx("healthy", "gesund"), "ok"]]} />
          <div className="text-[13.5px] text-ink-2">
            {t(tx("Of all children: ", "Von allen Kindern: "))}
            <strong className="text-ink">{t(pc(r.affectedSon))}</strong> {t(tx("are affected sons", "sind betroffene Söhne"))}
            {r.daughterAffected > 0 && (
              <>
                {", "}
                <strong className="text-ink">{t(pc(r.daughterAffected / 2))}</strong> {t(tx("affected daughters", "betroffene Töchter"))}
              </>
            )}
          </div>
          <motion.p key={key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-blob-soft px-3 py-2 text-[13.5px] leading-snug text-ink">
            <Inline text={note(md, fd)} />
          </motion.p>
        </div>
      </div>
    </div>
  );
}

function XPicker({ label, list, value, set }: { label: Text; list: typeof MOTHERS; value: number; set: (d: number) => void }) {
  const t = useText();
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface p-2.5">
      <div className="mb-1.5 text-[13px] font-medium text-ink">{t(label)}</div>
      <div className="flex flex-wrap gap-1.5">
        {list.map((o) => (
          <button
            key={o.d}
            type="button"
            onClick={() => set(o.d)}
            aria-pressed={value === o.d}
            className={cn("rounded-lg border px-2 py-1 text-left transition-colors", value === o.d ? "border-blob bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            <span className="block text-[16px]">
              <Geno g={o.g} />
            </span>
            <span className="block text-[11.5px] leading-tight opacity-90">{t(o.label)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Row({ label, parts }: { label: Text; parts: [number, Text, "ill" | "carrier" | "ok"][] }) {
  const t = useText();
  const shown = parts.filter(([v]) => v > 0);
  const bg = { ill: "var(--ink)", carrier: "var(--ink-3)", ok: "var(--raised)" };
  return (
    <div>
      <div className="mb-1 text-[12.5px] font-medium uppercase tracking-wide text-ink-3">{t(label)}</div>
      <div className="flex h-6 overflow-hidden rounded-lg border border-line">
        {shown.map(([v, , k]) => (
          <motion.div key={k} layout initial={false} animate={{ flexGrow: v }} transition={{ type: "spring", stiffness: 260, damping: 30 }} className="basis-0" style={{ background: bg[k] }} />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[13px] text-ink-2">
        {shown.map(([v, name, k]) => (
          <span key={k}>
            <strong className="text-ink">{t(pc(v))}</strong> {t(name)}
          </span>
        ))}
      </div>
    </div>
  );
}
