import { tx, type Text } from "@/i18n/text";
import { lcm } from "@/learn/engine/rng";
import type { Frame } from "@/learn/types";
import { opDivide, side, term, val } from "../lines/level2";
import { joinText, prodTerm } from "./level2";

// ---------------------------------------------------------------------------
// 3×3 systems and the Gauss algorithm (Gauß-Verfahren), with integer row
// operations as in German schools: "IIa = II − 2 · I", "IIIb = 3 · IIIa + IIa".

/** One equation x·x + y·y + z·z = c (the letters can be renamed for display, e.g. a, b, c). */
export type Row = { x: number; y: number; z: number; c: number };
export type V3 = "x" | "y" | "z";
export const V3S: V3[] = ["x", "y", "z"];
export type Names = [string, string, string];
export const XYZ: Names = ["x", "y", "z"];

export const combine = (p: number, r: Row, q: number, s: Row): Row => ({ x: p * r.x + q * s.x, y: p * r.y + q * s.y, z: p * r.z + q * s.z, c: p * r.c + q * s.c });
export const holds3 = (r: Row, v: [number, number, number]) => r.x * v[0] + r.y * v[1] + r.z * v[2] === r.c;
export const isZeroRow = (r: Row) => r.x === 0 && r.y === 0 && r.z === 0;

/** p, q with p > 0 so that p · target + q · pivot has no `v` any more (smallest numbers). */
export function elimFactors(target: Row, pivot: Row, v: V3): [number, number] | null {
  const a = target[v];
  const b = pivot[v];
  if (a === 0 || b === 0) return null;
  const l = lcm(a, b);
  return [l / Math.abs(a), -Math.sign(a) * Math.sign(b) * (l / Math.abs(b))];
}

/** "II − 2 · I", "3 · IIIa + IIa" (display language, labels as text). */
export function opSrc(p: number, target: string, q: number, source: string): string {
  const left = p === 1 ? `\\text{${target}}` : `${p} \\cdot \\text{${target}}`;
  const k = Math.abs(q);
  return `${left} ${q < 0 ? "-" : "+"} ${k === 1 ? "" : `${k} \\cdot `}\\text{${source}}`;
}

/** The same as plain text for notes: "II − 2 · I". */
export function opText(p: number, target: string, q: number, source: string): string {
  const left = p === 1 ? target : `${p} · ${target}`;
  const k = Math.abs(q);
  return `${left} ${q < 0 ? "−" : "+"} ${k === 1 ? "" : `${k} · `}${source}`;
}

/** The next name of a row after an operation: II → IIa → IIb, III → IIIa → IIIb. */
export function nextLabel(label: string): string {
  const m = label.match(/^(I+)([a-z]?)$/);
  if (!m) return `${label}'`;
  return m[2] ? `${m[1]}${String.fromCharCode(m[2].charCodeAt(0) + 1)}` : `${m[1]}a`;
}

export type GaussStep = { target: number; source: number; p: number; q: number; before: Row; after: Row; label: string; newLabel: string; sourceLabel: string; v: V3 };

/**
 * The school plan: (I) removes x from (II) and (III), then (IIa) removes y from (IIIa).
 * Rows whose coefficient is already 0 are left alone. Returns null if a pivot is 0 (a row
 * swap would be needed).
 */
export function gaussPlan(rows: Row[]): { steps: GaussStep[]; final: Row[]; labels: string[] } | null {
  const cur = rows.map((r) => ({ ...r }));
  const labels = ["I", "II", "III"];
  const steps: GaussStep[] = [];
  const plan: [number, number, V3][] = [
    [1, 0, "x"],
    [2, 0, "x"],
    [2, 1, "y"],
  ];
  for (const [t, s, v] of plan) {
    if (cur[t][v] === 0) continue;
    const f = elimFactors(cur[t], cur[s], v);
    if (!f) return null;
    const after = combine(f[0], cur[t], f[1], cur[s]);
    const newLabel = nextLabel(labels[t]);
    steps.push({ target: t, source: s, p: f[0], q: f[1], before: cur[t], after, label: labels[t], newLabel, sourceLabel: labels[s], v });
    cur[t] = after;
    labels[t] = newLabel;
  }
  return { steps, final: cur, labels };
}

/** Back substitution in step form; null when a pivot is 0. Values may be fractions (as numbers). */
export function backSolve(rows: Row[]): [number, number, number] | null {
  const [a, b, c] = rows;
  if (c.z === 0 || b.y === 0 || a.x === 0 || c.x !== 0 || c.y !== 0 || b.x !== 0) return null;
  const z = c.c / c.z;
  const y = (b.c - b.z * z) / b.y;
  const x = (a.c - a.y * y - a.z * z) / a.x;
  return [x, y, z];
}

// ---------------------------------------------------------------------------
// Display

/** A row like "(IIa) −3y − z = −9" with keys per row id: terms `<id>x`…, equals `e<id>`, label `L<id>`. */
export function rowSrc(r: Row, id: string, label: string, names: Names = XYZ, tone: "group" | "blob" | "green" | "red" | "fade" = "group"): string {
  const terms = side([
    [r.x, names[0], `${id}x`],
    [r.y, names[1], `${id}y`],
    [r.z, names[2], `${id}z`],
  ]);
  return `\\${tone}{\\text{(${label})}#L${id} \\; ${terms} =#e${id} ${val(r.c, `${id}c`)}}#R${id}`;
}

/** Rows below each other. */
export const stack = (rows: string[]) => rows.join(" \\\\ ");

/** L = {(x | y | z)}. */
export function tripleSrc(v: [number, number, number]): string {
  const part = (n: number, k: string, first: boolean) => `${first ? "" : n < 0 ? "|" : "| \\,"} ${val(n, k)}`;
  return `L#Lr =#Er "{"#Lo (${part(v[0], "rx", true)} \\, ${part(v[1], "ry", false)} \\, ${part(v[2], "rz", false)})#rp "}"#Lc`;
}
export const tripleText = (v: [number, number, number]) => `(${v[0]} \\,|\\, ${v[1]} \\,|\\, ${v[2]})`;

/** "3x", "−y" for messages. */
export const t3 = (c: number, v: string) => term(c, v, "m", true).replace(/#[A-Za-z0-9_-]+/g, "");

/** K·v + D = R solved, as one line of maths for a note: "−3y − 3 = −9 ⇒ −3y = −6 ⇒ y = 2". */
export function chainSrc(K: number, v: string, D: number, R: number): string {
  const parts: string[] = [];
  const kv = t3(K, v);
  if (D !== 0) parts.push(`${kv} ${D < 0 ? "-" : "+"} ${Math.abs(D)} = ${R}`);
  if (K !== 1) parts.push(`${kv} = ${R - D}`);
  parts.push(`${v} = ${fmt((R - D) / K)}`);
  return parts.join(" \\Rightarrow ");
}
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000));

// ---------------------------------------------------------------------------
// Worked solutions

export type Board = { rows: Row[]; labels: string[]; ids: string[] };

const OP_NOTE = (s: GaussStep, names: Names): Text => {
  const op = `**${opText(s.p, s.label, s.q, s.sourceLabel)}**`;
  const v = names[V3S.indexOf(s.v)];
  return tx(`Eliminate $${v}$ from (${s.label}): calculate ${op}. That gives (${s.newLabel}).`, `Eliminiere $${v}$ aus (${s.label}): Rechne ${op}. Das ergibt (${s.newLabel}).`);
};

/** The system after each Gauss step, ending in step form. */
export function gaussFrames(rows: Row[], names: Names = XYZ, intro?: Text): { frames: Frame[]; final: Row[]; labels: string[] } | null {
  const plan = gaussPlan(rows);
  if (!plan) return null;
  const ids = ["1", "2", "3"];
  const labels = ["I", "II", "III"];
  const cur = rows.map((r) => ({ ...r }));
  const show = (hl: number | null, tone: "blob" | "green" | "red" = "blob") => stack(cur.map((r, i) => rowSrc(r, ids[i], labels[i], names, i === hl ? tone : "group")));
  const frames: Frame[] = [
    {
      math: show(null),
      note: joinText(
        intro,
        tx(
          `Goal: **step form**. Use (I) to eliminate $${names[0]}$ from the rows below it, then use the second row to eliminate $${names[1]}$ from the last one.`,
          `Ziel: **Stufenform**. Eliminiere mit (I) das $${names[0]}$ aus den Zeilen darunter, dann mit der zweiten Zeile das $${names[1]}$ aus der letzten.`,
        ),
      ),
    },
  ];
  plan.steps.forEach((s) => {
    cur[s.target] = s.after;
    labels[s.target] = s.newLabel;
    frames.push({ math: show(s.target), note: OP_NOTE(s, names) });
  });
  return { frames, final: plan.final, labels: plan.labels };
}

/** Back substitution from the step form: z from the last row, then y, then x. */
export function backFrames(final: Row[], labels: string[], names: Names = XYZ): { frames: Frame[]; values: [number, number, number] } | null {
  const v = backSolve(final);
  if (!v) return null;
  const [X, Y, Z] = v;
  const [A, B, C] = final;
  const frames: Frame[] = [];
  const [nx, ny, nz] = names;
  // z from the last row
  frames.push({
    math: `${term(C.z, nz, "3z", true)} =#e3 ${val(C.c, "3c")}${C.z === 1 ? "" : opDivide(C.z)}`,
    note: tx(`Start at the bottom: (${labels[2]}) only has $${nz}$ left.`, `Fang unten an: In (${labels[2]}) steht nur noch $${nz}$.`),
  });
  frames.push({ math: `${nz}#v3z =#e3 ${val(Z, "3c")}`, note: tx(`So $${nz} = ${Z}$.`, `Also ist $${nz} = ${Z}$.`) });
  // y from the middle row (it may have no z at all, e.g. b alone in a parabola task)
  const Dy = B.z * Z;
  frames.push({
    math: [term(B.y, ny, "2y", true), products([[B.z, Z, "2z"]], false), `=#e2 ${val(B.c, "2c")}`].filter(Boolean).join(" "),
    note: B.z === 0 ? tx(`(${labels[1]}) only contains $${ny}$.`, `(${labels[1]}) enthält nur noch $${ny}$.`) : putNote([[nz, Z]], labels[1]),
  });
  frames.push({
    math: `${ny}#v2y =#e2 ${val(Y, "2c")}`,
    note: tx(`$${chainSrc(B.y, ny, Dy, B.c)}$`, `$${chainSrc(B.y, ny, Dy, B.c)}$`),
  });
  // x from the first row: only the unknowns that really occur in it are put in
  const Dx = A.y * Y + A.z * Z;
  const known: [string, number][] = [];
  if (A.y !== 0) known.push([ny, Y]);
  if (A.z !== 0) known.push([nz, Z]);
  frames.push({
    math: [
      term(A.x, nx, "1x", true),
      products(
        [
          [A.y, Y, "1y"],
          [A.z, Z, "1z"],
        ],
        false,
      ),
      `=#e1 ${val(A.c, "1c")}`,
    ]
      .filter(Boolean)
      .join(" "),
    note: known.length ? putNote(known, labels[0]) : tx(`(${labels[0]}) only contains $${nx}$.`, `(${labels[0]}) enthält nur noch $${nx}$.`),
  });
  frames.push({ math: `${nx}#v1x =#e1 ${val(X, "1c")}`, note: tx(`$${chainSrc(A.x, nx, Dx, A.c)}$`, `$${chainSrc(A.x, nx, Dx, A.c)}$`) });
  return { frames: merged(frames), values: v };
}

/** "Put y = 2 and z = 3 into (I)." for the values that are really substituted. */
function putNote(known: [string, number][], label: string): Text {
  const list = known.map(([n, v]) => `$${n} = ${v}$`);
  const en = list.join(" and ");
  const de = list.join(" und ");
  return tx(`Put ${en} into (${label}).`, `Setze ${de} in (${label}) ein.`);
}

/** Products c · value for the non-zero coefficients, as a sum: "2 \cdot 1 - 2 + 3". */
export function products(list: [number, number, string][], first = true): string {
  const out: string[] = [];
  for (const [c, v, id] of list) if (c !== 0) out.push(prodTerm(c, v, id, first && out.length === 0));
  return out.join(" ");
}

const bare = (m: Text) => (typeof m === "string" ? m : m.en).replace(/#[A-Za-z0-9_-]+/g, "").replace(/\s+/g, " ").trim();

/** Two frames in a row that show the same picture become one (with both notes). */
function merged(frames: Frame[]): Frame[] {
  const out: Frame[] = [];
  for (const f of frames) {
    const last = out[out.length - 1];
    if (last && bare(last.math) === bare(f.math)) out[out.length - 1] = { ...f, note: joinText(last.note, f.note) };
    else out.push(f);
  }
  return out;
}

/** "Check in (II): 2 · 1 − 2 + 3 = 3. True!" */
export function check3Note(r: Row, v: [number, number, number], name: string): Text {
  const sum = products([
    [r.x, v[0], "a"],
    [r.y, v[1], "b"],
    [r.z, v[2], "c"],
  ]).replace(/#[A-Za-z0-9_-]+/g, "");
  const calc = `$${sum} = ${r.c}$`;
  return tx(`Check in ${name}: ${calc}. True!`, `Probe mit ${name}: ${calc}. Stimmt!`);
}

/** The full worked solution: Gauss steps, back substitution and the solution set with a check. */
export function solveFrames(rows: Row[], intro?: Text): { frames: Frame[]; values: [number, number, number] } | null {
  const g = gaussFrames(rows, XYZ, intro);
  if (!g) return null;
  const last = g.frames[g.frames.length - 1];
  g.frames[g.frames.length - 1] = { ...last, note: joinText(last.note, tx("Step form reached!", "Stufenform erreicht!")) };
  const b = backFrames(g.final, g.labels);
  if (!b) return null;
  const frames = [...g.frames, ...b.frames, { math: tripleSrc(b.values), note: joinText(tx(`So $L = \\{ ${tripleText(b.values)} \\}$.`, `Also ist $L = \\{ ${tripleText(b.values)} \\}$.`), check3Note(rows[1], b.values, "(II)")) }];
  return { frames, values: b.values };
}
