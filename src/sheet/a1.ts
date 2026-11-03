import type { Area, Pos } from "./types";

// A1 notation and small helpers for cells and areas. Rows and columns are 0-based in code;
// the UI shows row 0 as "1" and column 0 as "A".

/** The key of a cell in Sheet.cells. */
export const cellKey = (row: number, col: number) => `${row},${col}`;

export function parseKey(key: string): Pos {
  const i = key.indexOf(",");
  return { row: Number(key.slice(0, i)), col: Number(key.slice(i + 1)) };
}

/** 0 → "A", 25 → "Z", 26 → "AA". */
export function colName(col: number): string {
  let s = "";
  let n = col + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** "A" → 0, "AA" → 26; -1 when it isn't letters. */
export function colIndex(name: string): number {
  if (!/^[A-Za-z]{1,3}$/.test(name)) return -1;
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** { row: 0, col: 1 } → "B1". */
export const posName = (p: Pos) => `${colName(p.col)}${p.row + 1}`;

/** "B1" for one cell, "A1:C5" for more. */
export function areaName(a: Area): string {
  const start = posName({ row: a.r0, col: a.c0 });
  return a.r0 === a.r1 && a.c0 === a.c1 ? start : `${start}:${posName({ row: a.r1, col: a.c1 })}`;
}

/** "B12" or "$B$12" → { row: 11, col: 1 }; null when it isn't a cell address. */
export function parsePos(text: string): Pos | null {
  const m = /^\$?([A-Za-z]{1,3})\$?([0-9]{1,6})$/.exec(text.trim());
  if (!m) return null;
  const col = colIndex(m[1]);
  const row = Number(m[2]) - 1;
  return col < 0 || row < 0 ? null : { row, col };
}

/** "A1:C5", "c5:a1" or "B3" → a normalised area; null otherwise. (For the name box, not formulas.) */
export function parseArea(text: string): Area | null {
  const [a, b, rest] = text.trim().split(":");
  if (rest !== undefined) return null;
  const p = parsePos(a ?? "");
  const q = b === undefined ? p : parsePos(b);
  return p && q ? areaOf(p, q) : null;
}

/** The area between two corners, normalised. */
export const areaOf = (a: Pos, b: Pos): Area => ({
  r0: Math.min(a.row, b.row),
  c0: Math.min(a.col, b.col),
  r1: Math.max(a.row, b.row),
  c1: Math.max(a.col, b.col),
});

export const normArea = (a: Area): Area => ({ r0: Math.min(a.r0, a.r1), c0: Math.min(a.c0, a.c1), r1: Math.max(a.r0, a.r1), c1: Math.max(a.c0, a.c1) });

export const inArea = (a: Area, row: number, col: number) => row >= a.r0 && row <= a.r1 && col >= a.c0 && col <= a.c1;

export const sameArea = (a: Area, b: Area) => a.r0 === b.r0 && a.c0 === b.c0 && a.r1 === b.r1 && a.c1 === b.c1;

export const areaRows = (a: Area) => a.r1 - a.r0 + 1;
export const areaCols = (a: Area) => a.c1 - a.c0 + 1;

/** Do two areas share a cell? */
export const overlaps = (a: Area, b: Area) => a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;

/** A sheet name as formulas write it: plain when that is unambiguous, else in quotes ('Blatt 2', 'It''s'). */
export function quoteSheetName(name: string): string {
  const plain = /^[A-Za-z_À-ɏ][A-Za-z0-9_.À-ɏ]*$/.test(name) && !/^[A-Za-z]{1,3}[0-9]+$/.test(name) && !/^(true|false|wahr|falsch)$/i.test(name);
  return plain ? name : `'${name.replace(/'/g, "''")}'`;
}
