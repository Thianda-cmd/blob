"use client";

import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Geno } from "./GeneticsPea";

/** Offspring of a test cross: genotype, phenotype, count, and the total. */
export function GeneticsCountTable({ title, rows }: { title?: Text; rows: { geno: string; pheno?: Text; n: number }[] }) {
  const t = useText();
  const total = rows.reduce((s, r) => s + r.n, 0);
  return (
    <div className="mx-auto w-full max-w-[460px]">
      {title && <div className="mb-1.5 text-center text-[13px] text-ink-3">{t(title)}</div>}
      <table className="w-full text-[14.5px]">
        <thead>
          <tr className="text-left text-[12px] uppercase tracking-wide text-ink-3">
            <th className="py-1 font-medium">{t(tx("Genotype", "Genotyp"))}</th>
            {rows.some((r) => r.pheno) && <th className="py-1 font-medium">{t(tx("Phenotype", "Phänotyp"))}</th>}
            <th className="py-1 text-right font-medium">{t(tx("Number", "Anzahl"))}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              <td className="py-1.5 text-[16px] text-ink">
                <Geno g={r.geno} />
              </td>
              {rows.some((x) => x.pheno) && <td className="py-1.5 text-ink-2">{r.pheno ? t(r.pheno) : ""}</td>}
              <td className="py-1.5 text-right tabular-nums text-ink">{r.n}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-line font-semibold">
            <td className="py-1.5 text-ink" colSpan={rows.some((r) => r.pheno) ? 2 : 1}>
              {t(tx("Total", "Summe"))}
            </td>
            <td className="py-1.5 text-right tabular-nums text-ink">{total}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Recombination frequencies between pairs of genes. */
export function GeneticsRfTable({ pairs }: { pairs: [string, string, number][] }) {
  const t = useText();
  const de = useLocale() === "de";
  return (
    <div className="mx-auto w-full max-w-[360px]">
      <table className="w-full text-[14.5px]">
        <thead>
          <tr className="text-left text-[12px] uppercase tracking-wide text-ink-3">
            <th className="py-1 font-medium">{t(tx("Genes", "Gene"))}</th>
            <th className="py-1 text-right font-medium">{t(tx("Recombination frequency", "Rekombinationshäufigkeit"))}</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map(([a, b, v]) => (
            <tr key={a + b} className="border-t border-line">
              <td className="py-1.5 font-math text-[16px] italic text-ink">
                {a} – {b}
              </td>
              <td className="py-1.5 text-right tabular-nums text-ink">{de ? `${String(v).replace(".", ",")} %` : `${v}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
