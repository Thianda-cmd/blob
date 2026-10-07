// Monomials like 6x²y for factoring out (Ausklammern): the greatest common factor, dividing every
// term by it, and keyed frames so each term visibly splits into "factor · rest" and the rest moves
// into the bracket.

import { tx, txMap, type Text } from "@/i18n/text";
import { gcd } from "@/learn/engine/rng";
import type { Frame } from "@/learn/types";
import { glued } from "./long";

/** c · v₁^e₁ · v₂^e₂ … (exponents in the order of the task's letters). */
export type Mono = { c: number; e: number[] };

export const mono = (c: number, ...e: number[]): Mono => ({ c, e });

const hasLetter = (m: Mono) => m.e.some((e) => e > 0);

/**
 * Display source of one monomial. With `k`, tokens get keys: sign `${k}s` (or `signKey`), coefficient
 * `${k}c`, letter `${k}<v>`, exponent `${k}e<v>`. `bare`: no sign, absolute value.
 * Without keys (task maths, options, notes) the term is one `\group` with its sign: a line break on a
 * phone never splits 12ab² into "12a" and "b²", nor a sign from its term. Keyed frames stay ungrouped,
 * so their tokens glide freely.
 */
export function monoSrc(m: Mono, vars: string[], o: { first?: boolean; k?: string; signKey?: string; bare?: boolean } = {}): string {
  const keyed = o.k !== undefined;
  const key = (name: string) => (keyed ? `#${o.k}${name}` : "");
  const abs = Math.abs(m.c);
  const parts: string[] = [];
  if (!(hasLetter(m) && abs === 1)) parts.push(`${abs}${key("c")}`);
  vars.forEach((v, i) => {
    const e = m.e[i] ?? 0;
    if (e === 0) return;
    parts.push(e === 1 ? `${v}${key(v)}` : `${v}${key(v)}^{${e}${key(`e${v}`)}}`);
  });
  const body = keyed ? parts.join(" ") : parts.length > 1 ? `\\group{${parts.join("")}}` : parts.join("");
  if (o.bare) return body;
  const sk = o.signKey !== undefined ? `#${o.signKey}` : key("s");
  if (!keyed) return o.first && m.c > 0 && parts.length === 1 ? body : glued(m.c < 0 ? "-" : o.first ? "" : "+", parts.join(""), !!o.first);
  if (m.c < 0) return `-${sk} ${body}`;
  return o.first ? body : `+${sk} ${body}`;
}

/** A sum of monomials; `k(i)` gives the key prefix of term i. */
export function polySrc(list: Mono[], vars: string[], k?: (i: number) => string): string {
  if (!list.length) return "0";
  return list.map((m, i) => monoSrc(m, vars, { first: i === 0, k: k?.(i) })).join(" ");
}

/** Text for the answer checker: "6x^2y-9xy^2". */
export function polyPlain(list: Mono[], vars: string[]): string {
  return (
    list
      .map((m, i) => {
        const abs = Math.abs(m.c);
        const letters = vars.map((v, j) => (m.e[j] ? (m.e[j] === 1 ? v : `${v}^${m.e[j]}`) : "")).join("");
        const body = `${letters && abs === 1 ? "" : abs}${letters}`;
        return `${m.c < 0 ? "-" : i === 0 ? "" : "+"}${body}`;
      })
      .join("") || "0"
  );
}

export const monoPlain = (m: Mono, vars: string[]) => polyPlain([m], vars);

/** Greatest common factor: gcd of the numbers, every letter with its smallest exponent. */
export function gcfOf(list: Mono[]): Mono {
  const c = list.reduce((g, m) => gcd(g, m.c), 0) || 1;
  const n = Math.max(...list.map((m) => m.e.length));
  const e = Array.from({ length: n }, (_, i) => Math.min(...list.map((m) => m.e[i] ?? 0)));
  return { c: Math.abs(c), e };
}

export const divMono = (a: Mono, b: Mono): Mono => ({ c: a.c / b.c, e: a.e.map((x, i) => x - (b.e[i] ?? 0)) });
export const mulMono = (a: Mono, b: Mono): Mono => ({ c: a.c * b.c, e: a.e.map((x, i) => x + (b.e[i] ?? 0)) });
export const negMono = (a: Mono): Mono => ({ ...a, c: -a.c });
export const isOne = (m: Mono) => Math.abs(m.c) === 1 && !hasLetter(m);
export const sameMono = (a: Mono, b: Mono) => a.c === b.c && a.e.every((x, i) => x === (b.e[i] ?? 0));

/** Does m divide every term with whole numbers and no negative exponents? */
export const dividesAll = (m: Mono, list: Mono[]) => list.every((t) => t.c % m.c === 0 && t.e.every((x, i) => x >= (m.e[i] ?? 0)));

/** Is the bracket fully factored (no common factor left except 1)? */
export const isPrimitive = (list: Mono[]) => isOne(gcfOf(list));

// ---------------------------------------------------------------------------
// Words

/** "the greatest common factor of 6 and 9 is 3" / "ggT(6, 9) = 3", plus the letters. */
export function gcfNote(list: Mono[], vars: string[], g: Mono): Text {
  const nums = list.map((m) => Math.abs(m.c));
  const letters = vars.map((v, i) => (g.e[i] ? `$${g.e[i] === 1 ? v : `${v}^${g.e[i]}`}$` : "")).filter(Boolean);
  const gs = monoSrc(g, vars, { first: true });
  return txMap((t) => {
    const n =
      g.c === 1
        ? t(`The numbers ${nums.slice(0, -1).join(", ")} and ${nums[nums.length - 1]} have no common factor except $1$.`, `Die Zahlen ${nums.slice(0, -1).join(", ")} und ${nums[nums.length - 1]} haben keinen gemeinsamen Teiler außer $1$.`)
        : t(`Numbers: the greatest common factor of ${nums.slice(0, -1).join(", ")} and ${nums[nums.length - 1]} is $${g.c}$.`, `Zahlen: Der ggT von ${nums.slice(0, -1).join(", ")} und ${nums[nums.length - 1]} ist $${g.c}$.`);
    const l = letters.length
      ? t(`Letters in **every** term, each with its smallest exponent: ${letters.join(", ")}.`, `Buchstaben, die in **jedem** Term stecken, jeweils mit dem kleinsten Exponenten: ${letters.join(", ")}.`)
      : t("No letter is in every term.", "Kein Buchstabe steckt in jedem Term.");
    return `${n} ${l} ${t(`Together: $${gs}$.`, `Zusammen: $${gs}$.`)}`;
  });
}

/**
 * Frames for factoring `G` (positive) out of `list`: the terms, each term as G · rest, G in front of
 * the bracket, and the check by expanding. `pre` is put in front of everything (e.g. "-#m (").
 */
function positiveFrames(list: Mono[], vars: string[], G: Mono, wrap: (s: string) => string, notes: { why: Text }): Frame[] {
  const q = list.map((m) => divMono(m, G));
  const gKeyed = (i: number) => monoSrc(G, vars, { bare: true, k: `g${i}` });
  const qBare = (i: number) => (isOne(q[i]) ? `1#q${i}c` : monoSrc(q[i], vars, { bare: true, k: `q${i}` }));
  const start = list.map((m, i) => monoSrc(m, vars, { first: i === 0, k: `q${i}`, signKey: `s${i}` })).join(" ");
  const products = list
    .map((m, i) => {
      const sign = m.c < 0 ? `-#s${i} ` : i === 0 ? "" : `+#s${i} `;
      return `${sign}${gKeyed(i)} \\cdot#d${i} ${qBare(i)}`;
    })
    .join(" ");
  const inside = q.map((m, i) => (isOne(m) ? `${m.c < 0 ? `-#s${i} ` : i === 0 ? "" : `+#s${i} `}1#q${i}c` : monoSrc(m, vars, { first: i === 0, k: `q${i}`, signKey: `s${i}` }))).join(" ");
  const result = `${gKeyed(0)} (${inside})#br`;
  const gs = monoSrc(G, vars, { first: true });
  const hasOne = q.some(isOne);
  return [
    { math: wrap(start), note: notes.why },
    {
      math: wrap(products),
      note: hasOne
        ? tx(`Write every term as $${gs} \\cdot$ something. Careful: $${gs} = ${gs} \\cdot 1$.`, `Schreib jeden Term als $${gs} \\cdot$ etwas. Vorsicht: $${gs} = ${gs} \\cdot 1$.`)
        : tx(`Write every term as $${gs} \\cdot$ something: divide each term by $${gs}$.`, `Schreib jeden Term als $${gs} \\cdot$ etwas: Teile jeden Term durch $${gs}$.`),
      highlight: list.flatMap((_, i) => [`g${i}c`, ...vars.flatMap((v) => [`g${i}${v}`, `g${i}e${v}`])]),
    },
    {
      math: wrap(result),
      note: hasOne
        ? tx(`Put $${gs}$ in front of the bracket. The $1$ stays: without it, a term would go missing.`, `Setz $${gs}$ vor die Klammer. Die $1$ bleibt stehen: Ohne sie würde ein Term fehlen.`)
        : tx(`Put $${gs}$ in front of the bracket. Inside is what's left of each term.`, `Setz $${gs}$ vor die Klammer. In der Klammer steht, was von jedem Term übrig bleibt.`),
      highlight: ["br(", "br)"],
    },
  ];
}

/**
 * The full worked solution for factoring F out of `list` (F may be negative): a negative factor
 * goes in two steps, first −1 (every sign flips), then the positive rest.
 */
export function factorFrames(list: Mono[], vars: string[], F: Mono): Frame[] {
  const plain = polySrc(list, vars);
  const Fs = monoSrc(F, vars, { first: true });
  const q = list.map((m) => divMono(m, F));
  const front = F.c === -1 && !hasLetter(F) ? "-" : Fs;
  const check: Frame = {
    math: `${front}(${polySrc(q, vars)}) = ${plain}`,
    note: tx(`Check by expanding: $${front === "-" ? "-1" : Fs}$ times every term in the bracket gives the start term back.`, `Probe durch Ausmultiplizieren: $${front === "-" ? "-1" : Fs}$ mal jeden Term in der Klammer ergibt wieder den Anfangsterm.`),
  };
  if (F.c > 0) return [...positiveFrames(list, vars, F, (s) => s, { why: gcfNote(list, vars, F) }), check];
  const flipped = list.map(negMono);
  const G = negMono(F);
  const minusFrames: Frame[] = [
    {
      math: list.map((m, i) => monoSrc(m, vars, { first: i === 0, k: `q${i}`, signKey: `s${i}` })).join(" "),
      note: isOne(G)
        ? tx("Factor out $-1$, so just a minus. Dividing by $-1$ flips **every** sign.", "Klammere $-1$ aus, also nur ein Minus. Durch $-1$ teilen dreht **jedes** Vorzeichen um.")
        : tx(`Factor out $${Fs}$. The minus first: dividing by $-1$ flips **every** sign.`, `Klammere $${Fs}$ aus. Zuerst das Minus: Durch $-1$ teilen dreht **jedes** Vorzeichen um.`),
    },
    {
      math: `-#m (${flipped.map((m, i) => monoSrc(m, vars, { first: i === 0, k: `q${i}`, signKey: `s${i}` })).join(" ")})#o`,
      note: tx("Minus in front, every sign in the bracket flipped. Expand to check: you get the start term back.", "Minus davor, jedes Vorzeichen in der Klammer umgedreht. Ausmultipliziert ergibt das wieder den Anfangsterm."),
      highlight: ["m", ...list.map((_, i) => `s${i}`)],
    },
  ];
  if (isOne(G)) return [...minusFrames, check];
  const inner = positiveFrames(flipped, vars, G, (s) => `-#m (${s})#o`, { why: gcfNote(flipped, vars, G) });
  // The last frame drops the outer bracket: −(3xy(…)) is simply −3xy(…).
  const last = inner[inner.length - 1];
  inner[inner.length - 1] = { ...last, math: `-#m ${String(last.math).replace(/^-#m \(/, "").replace(/\)#o$/, "")}` };
  return [...minusFrames, ...inner, check];
}
