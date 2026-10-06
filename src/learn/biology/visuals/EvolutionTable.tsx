"use client";

import type { Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";

/** A small two-column data table for tasks (e.g. amino acid differences in cytochrome c). */
export function EvolutionTable({ head, rows, caption }: { head: [Text, Text]; rows: [Text, string][]; caption?: Text }) {
  const t = useText();
  return (
    <figure className="mx-auto w-full max-w-[420px]">
      <table className="w-full overflow-hidden rounded-xl border border-line text-[14.5px]">
        <thead className="bg-surface text-left text-[13px] text-ink-2">
          <tr>
            <th className="px-3 py-2 font-semibold">{t(head[0])}</th>
            <th className="px-3 py-2 text-right font-semibold">{t(head[1])}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, value], i) => (
            <tr key={i} className="border-t border-line">
              <td className="px-3 py-1.5 text-ink">{t(name)}</td>
              <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {caption && <figcaption className="mt-1.5 text-[12.5px] text-ink-3">{t(caption)}</figcaption>}
    </figure>
  );
}
