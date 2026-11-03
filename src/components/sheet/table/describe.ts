// A filter in a few words for the table panel: "größer als 0,5", "enthält „Probe“",
// "zwischen 01.11.2026 und 30.11.2026", "3 Werte: „0“, „0,25“, leer …".

import type { Locale } from "@/i18n/config";
import type { SheetTableText } from "@/i18n/messages/sheetTable";
import { formatValue } from "@/sheet/engine";
import type { ColumnKind } from "@/sheet/table/model";
import type { FilterSpec } from "@/sheet/types";

export function describeFilter(f: FilterSpec, kind: ColumnKind, locale: Locale, t: SheetTableText): string {
  const num = (n: number | null) => (n === null ? "" : formatValue(n, kind === "date" ? { kind: "date", style: "short" } : undefined, locale));
  const quote = (s: string) => (locale === "de" ? `„${s}“` : `“${s}”`);
  switch (f.kind) {
    case "values": {
      const shown = f.values.slice(0, 3).map((v) => (v === "" ? t.filterBlank : quote(v)));
      return f.values.length <= 3 ? shown.join(", ") : `${t.filterValues(f.values.length)}: ${shown.join(", ")} …`;
    }
    case "text":
      return `${t.textOps[f.op]} ${quote(f.text)}`;
    case "number": {
      const names = kind === "date" ? t.dateOps : t.numberOps;
      if (f.op === "between") return `${names.between} ${num(f.a)} ${t.and} ${num(f.b)}`;
      if (f.op === "top" || f.op === "bottom") return names[f.op].replace(/10 …|…/, String(f.a ?? 10));
      if (f.op === "aboveAverage" || f.op === "belowAverage") return names[f.op];
      return `${names[f.op]} ${num(f.a)}`;
    }
  }
}
