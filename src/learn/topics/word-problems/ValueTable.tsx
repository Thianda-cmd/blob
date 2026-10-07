"use client";

import { useLocale } from "@/i18n/client";
import type { Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { nf } from "./kit";

/** `null` shows a question mark (the value that's wanted). */
export type TableRow = { label: Text; values: (number | null)[]; digits?: number };

/** A value table (Wertetabelle) for a task: two or three rows, numbers in the language's style. */
export function ValueTable({ rows, caption }: { rows: TableRow[]; caption?: Text }) {
  const t = useText();
  const l = useLocale();
  const cols = Math.max(...rows.map((r) => r.values.length));
  return (
    <div className="space-y-1.5">
      {caption && <div className="text-[12px] font-medium text-ink-3">{t(caption)}</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-center">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={cn(i > 0 && "border-t border-line")}>
                <th scope="row" className="whitespace-nowrap border-r border-line py-2 pl-1 pr-3 text-left text-[13px] font-medium text-ink-2">
                  {t(r.label)}
                </th>
                {Array.from({ length: cols }, (_, k) => {
                  const v = r.values[k];
                  return (
                    <td key={k} className="min-w-[3.2em] px-2 py-2 font-math text-[18px] tabular-nums text-ink">
                      {v === undefined ? "" : v === null ? <span className="font-semibold text-blob-ink">?</span> : nf(v, l, r.digits ?? 2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
