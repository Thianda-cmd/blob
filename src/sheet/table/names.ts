// Smart table names ("Tabelle1", "Kalibrierung"): Excel's rules for what a name may be, and a free
// name when the wished one is taken. Shared by the table model and ops.ts (duplicating a sheet
// copies its tables), so it imports nothing from either: model.ts imports ops.ts.

import type { Locale } from "@/i18n/config";

/** Excel's rules for table names: a letter or _ first, then letters, digits, _ and dots; not a cell address. */
export function validTableName(name: string): boolean {
  if (!name || name.length > 255) return false;
  if (!/^[A-Za-z_\\À-ÖØ-öø-ɏ][A-Za-z0-9_.À-ÖØ-öø-ɏ]*$/.test(name)) return false;
  if (/^[A-Za-z]{1,3}[0-9]+$/.test(name)) return false;
  if (/^[RrCc]$/.test(name) || /^[Rr][0-9]*[Cc][0-9]*$/.test(name)) return false;
  return true;
}

/** What someone typed as a name, made closer to a valid one: trimmed, spaces as _. */
export const cleanTableName = (name: string) => name.trim().replace(/\s+/g, "_");

/**
 * A name no table in `taken` has (compared without case): the wished one when it is valid and
 * free, else the next number after it ("Kalibrierung2", "Tabelle3", and "BSA_2" for a short name,
 * because BSA2 is a cell); without a valid wish "Tabelle1", "Tabelle2"… / "Table1"….
 */
export function freeTableName(taken: Iterable<string>, locale: Locale, base?: string): string {
  const used = new Set<string>();
  for (const name of taken) used.add(name.toLowerCase());
  const free = (n: string) => !used.has(n.toLowerCase()) && validTableName(n);
  const wanted = base === undefined ? "" : cleanTableName(base);
  if (wanted && validTableName(wanted)) {
    if (free(wanted)) return wanted;
    const m = /^(.*?)(\d+)$/.exec(wanted);
    let root = m && m[1] ? m[1] : wanted;
    let n = m && m[1] ? Number(m[2]) + 1 : 2;
    // "AB" + 2 would be a cell address.
    if (/^[A-Za-z]{1,3}$/.test(root)) root += "_";
    while (!free(`${root}${n}`)) n++;
    return `${root}${n}`;
  }
  const root = locale === "de" ? "Tabelle" : "Table";
  let n = 1;
  while (!free(`${root}${n}`)) n++;
  return `${root}${n}`;
}
