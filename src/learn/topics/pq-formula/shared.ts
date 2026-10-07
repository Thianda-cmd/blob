import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import type { AnswerSpec, Mistake } from "@/learn/types";

// ---------------------------------------------------------------------------
// Equations as lists of terms c·x^p with stable ids, so every term glides to
// its new place while the equation is rearranged.

export type Term = { id: string; c: number; p: 0 | 1 | 2 };

export const T = (id: string, c: number, p: 0 | 1 | 2): Term => ({ id, c, p });

/** Rounds away floating point noise. */
export const clean = (v: number) => Math.round(v * 1e9) / 1e9;

/**
 * Decimal comma, as in German schools: "2,5", "-0,75". Everything is written the German way
 * first; `localize` turns the English side into "2.5" at the end.
 */
export function dec(v: number): string {
  return String(clean(v)).replace(".", ",");
}

/** In brackets when negative: "(-3)". */
export const par = (v: number) => (v < 0 ? `(${dec(v)})` : dec(v));

/** A keyed number: "4#k" or "-#ks 4#k". */
export const num = (v: number, k: string) => (v < 0 ? `-#${k}s ${dec(-v)}#${k}` : `${dec(v)}#${k}`);

export function termSrc(t: Term, first: boolean, keys: boolean): string {
  const k = (name: string) => (keys ? `#${name}${t.id}` : "");
  const abs = Math.abs(t.c);
  const sign = t.c < 0 ? `-${k("s")} ` : first ? "" : `+${k("s")} `;
  const coef = t.p > 0 && abs === 1 ? "" : `${dec(abs)}${k("c")} `;
  const v = t.p === 0 ? "" : t.p === 1 ? `x${k("v")}` : `x${k("v")}^{2${k("e")}}`;
  return `${sign}${coef}${v}`.trim();
}

export function sideSrc(ts: Term[], keys = true, zeroKey = "z"): string {
  const list = ts.filter((t) => t.c !== 0);
  if (!list.length) return keys ? `0#${zeroKey}` : "0";
  return list.map((t, i) => termSrc(t, i === 0, keys)).join(" ");
}

export function eqSrc(left: Term[], right: Term[], keys = true): string {
  return keys ? `${sideSrc(left, true, "zl")} =#eq ${sideSrc(right)}` : `${sideSrc(left, false)} = ${sideSrc(right, false)}`;
}

/** Plain text of a few terms for notes, e.g. "3x - 2x". */
export const plainTerms = (ts: Term[]) => sideSrc(ts, false);

/** a·x² + b·x + c without keys, e.g. "2x^2 - 8x + 3". */
export const quadSrc = (a: number, b: number, c: number) => sideSrc([T("a", a, 2), T("b", b, 1), T("c", c, 0)], false);

/** Joins bilingual pieces, language by language. */
export const cat = (...parts: (Text | undefined)[]): Text => txMap((_, locale) => parts.map((part) => resolveText(part, locale)).join(""));

export const NO_SOLUTION: Text = tx('"no solution"#none', '"keine Lösung"#none');

/** "x - 3" or "x + 2" for a bracket (x − r). */
export const minusR = (r: number, v = "x") => (r === 0 ? v : r > 0 ? `${v} - ${dec(r)}` : `${v} + ${dec(-r)}`);

/** "(3 | −4)" with a little room around the bar; a minus after it stays a sign. */
export function ptSrc(x: number | string, y: number | string): string {
  const f = (v: number | string) => (typeof v === "number" ? dec(v) : v);
  const ys = f(y);
  return `(${f(x)} \\, | \\, ${ys.startsWith("-") ? `\\group{${ys}}` : ys})`;
}

/** A solution set in German school notation: "L = \{ -3; 5 \}", sorted. */
export const setSrc = (values: number[]) =>
  values.length ? `L = \\{ ${[...values].sort((a, b) => a - b).map(dec).join("; ")} \\}` : "L = \\{ \\}";

/** The same set with keys, for an animated last frame. */
export const setKeyed = (values: number[], prefix = "L") =>
  values.length
    ? `L#${prefix} =#${prefix}eq \\{#${prefix}lb ${[...values]
        .sort((a, b) => a - b)
        .map((v, i) => `${i ? ` ;#${prefix}sc${i > 1 ? i : ""} ` : ""}${num(v, `${prefix}v${i}`)}`)
        .join("")} \\}#${prefix}rb`
    : `L#${prefix} =#${prefix}eq \\{#${prefix}lb \\}#${prefix}rb`;

// ---------------------------------------------------------------------------
// Comparing solution lists

export const near = (u: number, v: number) => Math.abs(u - v) < 1e-6;
export const sameSet = (u: number[], v: number[]) => u.length === v.length && u.every((x) => v.some((y) => near(x, y)));
/** As a student types it: two decimals at most. */
export const typed = (v: number) => clean(Math.round(v * 100) / 100);

export const solutionsAnswer = (values: number[], variable = "x") => ({ kind: "solutions" as const, variable, values, allowNone: true });

/**
 * Collects typical wrong solution sets: each one only when it differs from the right answer
 * and from the ones before. `part`: may be just some of the right solutions (forgetting the
 * negative root is worth its own message).
 */
export function solutionMistakes(values: number[], variable = "x") {
  const list: Mistake[] = [];
  const right = [...new Set(values.map(typed))];
  const add = (sol: number[] | null, title: Text, say: Text, { part = false, close = false } = {}) => {
    if (!sol || list.length >= 5) return;
    const vals = [...new Set(sol.map(typed))];
    if (sameSet(vals, right) || list.some((m) => m.when.kind === "solutions" && sameSet(m.when.values, vals))) return;
    if (!part && vals.length && vals.length < right.length && vals.every((v) => right.some((w) => near(v, w)))) return;
    const when: AnswerSpec = { kind: "solutions", variable, values: vals, allowNone: true };
    list.push({ when, title, say, ...(close ? { close } : {}) });
  };
  return { list, add };
}

/** ±√v as a list (empty when v < 0, one value when v = 0). */
export function rootsOf(v: number): number[] {
  if (v < -1e-9) return [];
  if (Math.abs(v) < 1e-9) return [0];
  const r = Math.sqrt(v);
  return [clean(r), clean(-r)];
}

export const isSquare = (v: number) => v >= 0 && Number.isInteger(Math.sqrt(v));

// ---------------------------------------------------------------------------
// English decimals: "2,5" becomes "2.5" on the English side. The subscript in x_{1,2} stays.

const DECIMAL = /(\d+),(\d+)/g;

function enNumbers(s: string): string {
  return s.replace(DECIMAL, (m: string, a: string, b: string, at: number, all: string) => (all.slice(Math.max(0, at - 2), at) === "_{" ? m : `${a}.${b}`));
}

/** The English side with decimal points (a plain string becomes bilingual only if it has a decimal). */
export function enDecimals(t: Text): Text {
  if (typeof t === "string") {
    const en = enNumbers(t);
    return en === t ? t : tx(en, t);
  }
  const en = enNumbers(t.en);
  return en === t.en ? t : { en, de: t.de };
}

/**
 * MathView reads a minus right after "\\{" as a binary minus ("{ − 5; 5 }"). Wrapping the first
 * element of a set in \\group makes it a sign again: "{ −5; 5 }".
 */
export function signAfterBrace(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const at = s.indexOf("\\{", i);
    if (at < 0) {
      out += s.slice(i);
      break;
    }
    let j = at + 2;
    if (s[j] === "#") {
      j++;
      while (j < s.length && /[A-Za-z0-9_-]/.test(s[j])) j++;
    }
    out += s.slice(i, j);
    let k = j;
    while (s[k] === " ") k++;
    if (s[k] !== "-") {
      i = j;
      continue;
    }
    let depth = 0;
    let e = k;
    for (; e < s.length; e++) {
      const ch = s[e];
      if (ch === "\\" && (s[e + 1] === "{" || s[e + 1] === "}")) {
        if (depth === 0 && s[e + 1] === "}") break;
        e++;
      } else if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (depth === 0 && ch === ";") break;
    }
    let end = e;
    while (end > k && s[end - 1] === " ") end--;
    out += `${s.slice(j, k)}\\group{${s.slice(k, end)}}${s.slice(end, e)}`;
    i = e;
  }
  return out;
}

/** Signs in sets and English decimals, for any text or display source. */
export function polish(t: Text): Text {
  return enDecimals(typeof t === "string" ? signAfterBrace(t) : { en: signAfterBrace(t.en), de: signAfterBrace(t.de) });
}

const SKIP = new Set(["visual", "widget", "highlight", "arrows", "component"]);
const isText = (o: Record<string, unknown>) => Object.keys(o).length === 2 && typeof o.en === "string" && typeof o.de === "string";

function walk(v: unknown): unknown {
  if (typeof v === "string") return polish(v);
  if (Array.isArray(v)) return v.map(walk);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (isText(o)) return polish(o as Text);
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) out[k] = SKIP.has(k) ? x : walk(x);
    return out;
  }
  return v;
}

/**
 * Decimal points for English in a whole exercise or lesson (texts, frames, options, mistakes),
 * and signs in sets. Content is written once with German decimal commas; this makes the
 * English side right.
 */
export function localize<V>(value: V): V {
  return walk(value) as V;
}
