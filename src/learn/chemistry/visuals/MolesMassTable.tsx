"use client";

import { useLocale } from "@/i18n/client";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { element } from "../elements";
import { fx } from "../moles-core";

/** The atomic masses a task needs, as small periodic-table chips (masses as in the table). */
export function MolesMassTable({ symbols }: { symbols: string[] }) {
  const t = useText();
  const locale = useLocale();
  return (
    <div className="space-y-1.5">
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("Atomic masses from the periodic table", "Atommassen aus dem Periodensystem"))}</div>
      <div className="flex flex-wrap gap-2">
        {symbols.map((s) => {
          const e = element(s)!;
          const digits = Math.min(3, (String(e.mass).split(".")[1] ?? "").length);
          return (
            <div key={s} className="flex min-w-[78px] flex-col rounded-lg border border-line bg-surface px-2.5 py-1.5">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[17px] font-semibold text-ink">{s}</span>
                <span className="text-[10.5px] text-ink-3">{e.z}</span>
              </span>
              <span className="text-[12.5px] tabular-nums text-ink-2">{fx(e.mass, locale, digits)} u</span>
              <span className="truncate text-[10.5px] text-ink-3">{t(e.name)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
