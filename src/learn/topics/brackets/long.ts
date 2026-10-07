// Long terms with several brackets and a factor in front: 4x − 2(3x − 5) + (x − 1), 3[2x − (x − 4)].
// Rendered with stable token keys, so each term glides to its new place when a bracket is multiplied out.

import type { Locale } from "@/i18n/config";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import type { Frame } from "@/learn/types";

/** A term c·v ("" = a number) or a bracket with a factor in front (sign included: −2, 1, −1, 0.5). */
export type LT = { kind: "t"; c: number; v: string; id: string; sk?: string };
export type LG = { kind: "g"; f: number; open: "(" | "["; id: string; items: LN[]; sk?: string };
export type LN = LT | LG;

export const lt = (id: string, c: number, v = ""): LT => ({ kind: "t", c, v, id });
export const lg = (id: string, f: number, items: LN[], open: "(" | "[" = "("): LG => ({ kind: "g", f, open, id, items });

export const round = (x: number) => Math.round(x * 1000) / 1000;

/** A number as the student writes it: 0.5 in English, 0,5 in German. */
export const num = (x: number, l: Locale) => {
  const s = String(round(x));
  return l === "de" ? s.replace(".", ",") : s;
};

/**
 * A sign glued to what follows it, as one `\group` that a line break can't split: "- 2(3x - 5)" never
 * leaves "−" or "−2" at the end of a phone line. A sign that opens a group would look like the sign of
 * a number, so a binary one (`first` false) gets the spacing of an operator by hand.
 */
export const glued = (sign: "" | "+" | "-", body: string, first: boolean) =>
  !sign ? `\\group{${body}}` : first ? `\\group{${sign}${body}}` : `\\group{\\; ${sign} \\; ${body}}`;

/**
 * Display source: sign `s<id>`, coefficient `c<id>`, variable `v<id>`; bracket sign `p<id>`, factor `f<id>`, brackets `b<id>`.
 * `glue` (only without keys, for task maths and options): a term like 3x, and a bracket with its sign and
 * factor, each stay on one line, so a phone breaks only between them. Answer texts are never glued.
 */
export function src(items: LN[], l: Locale = "en", keys = true, glue = false): string {
  const k = (key: string) => (keys ? `#${key}` : "");
  const tight = glue && !keys;
  if (items.length === 0) return "0";
  return items
    .map((it, i) => {
      const first = i === 0;
      if (it.kind === "t") {
        const sk = it.sk ?? `s${it.id}`;
        const sign = it.c < 0 ? `-${k(sk)}${first && !keys ? "" : " "}` : first ? "" : `+${k(sk)} `;
        const abs = Math.abs(it.c);
        const coef = it.v && abs === 1 ? "" : `${num(abs, l)}${k(`c${it.id}`)}`;
        const v = it.v ? `${it.v}${k(`v${it.id}`)}` : "";
        const body = [coef, v].filter(Boolean).join(keys ? " " : "");
        if (tight && (first ? it.c < 0 || (coef && v) : coef && v)) return first ? glued(it.c < 0 ? "-" : "", body, true) : `${sign}\\group{${body}}`;
        return `${sign}${body}`;
      }
      const sk = it.sk ?? `p${it.id}`;
      const sign = it.f < 0 ? `-${k(sk)}${first && !keys ? "" : " "}` : first ? "" : `+${k(sk)} `;
      const abs = Math.abs(it.f);
      const fac = abs === 1 ? "" : `${num(abs, l)}${k(`f${it.id}`)}${keys ? " " : ""}`;
      const close = it.open === "(" ? ")" : "]";
      const bracket = `${fac}${it.open}${src(it.items, l, keys, glue)}${close}${k(`b${it.id}`)}`;
      if (tight && (fac || it.f < 0 || !first)) return glued(it.f < 0 ? "-" : first ? "" : "+", bracket, first);
      return `${sign}${bracket}`;
    })
    .join(" ");
}

/** The same in both languages (only different when there are decimals). Without keys it is glued for display. */
export function show(items: LN[], keys = true): Text {
  const en = src(items, "en", keys, !keys);
  const de = src(items, "de", keys, !keys);
  return en === de ? en : tx(en, de);
}

/** Text for the answer checker: "-2x+10". */
export const answerText = (items: LN[]) => src(items, "en", false).replace(/\s+/g, "") || "0";

export const termsOf = (items: LN[]) => items.filter((x): x is LT => x.kind === "t");

const scale = (n: LN, f: number): LN => (n.kind === "t" ? { ...n, c: round(n.c * f) } : { ...n, f: round(n.f * f) });

export function groupsIn(items: LN[]): LG[] {
  const out: LG[] = [];
  for (const it of items) if (it.kind === "g") out.push(it, ...groupsIn(it.items));
  return out;
}

/** Brackets without brackets inside, left to right: the ones that can be resolved now. */
export const innermost = (items: LN[]) => groupsIn(items).filter((g) => !g.items.some((x) => x.kind === "g"));

/** The bracket that contains bracket `gid` (if any). */
export function parentOf(items: LN[], gid: string): LG | null {
  for (const g of groupsIn(items)) if (g.items.some((x) => x.kind === "g" && x.id === gid)) return g;
  return null;
}

export type Rule = "right" | "onlyFirst" | "signSlip" | "noFlip" | "firstFlipOnly";

/** One product of the factor with an inner term, possibly with a typical slip. */
function product(x: LN, j: number, f: number, rule: Rule): LN {
  if (x.kind !== "t") return scale(x, f);
  if (rule === "onlyFirst" && Math.abs(f) !== 1 && j > 0) return x;
  if (rule === "signSlip" && f < 0 && x.c < 0) return { ...x, c: -Math.abs(round(f * x.c)) };
  if (rule === "noFlip" && f === -1) return x;
  if (rule === "firstFlipOnly" && f === -1 && j > 0) return x;
  return scale(x, f);
}

/** Multiply out bracket `gid`. The sign in front goes to the first product. */
export function resolve(items: LN[], gid: string, rule: Rule = "right"): LN[] {
  const out: LN[] = [];
  for (const it of items) {
    if (it.kind === "g" && it.id === gid) {
      it.items.forEach((inner, j) => {
        const next = product(inner, j, it.f, rule);
        out.push(j === 0 ? { ...next, sk: it.sk ?? `p${it.id}` } : next);
      });
    } else if (it.kind === "g") out.push({ ...it, items: resolve(it.items, gid, rule) });
    else out.push(it);
  }
  return out;
}

/** Keys of the tokens that change when bracket `gid` is multiplied out. */
export function changedKeys(items: LN[], gid: string): string[] {
  const g = groupsIn(items).find((x) => x.id === gid);
  if (!g) return [];
  if (g.f === 1) return [];
  return g.items.flatMap((x, j) => {
    const sign = j === 0 ? (g.sk ?? `p${g.id}`) : (x.sk ?? (x.kind === "t" ? `s${x.id}` : `p${x.id}`));
    return Math.abs(g.f) === 1 || x.kind !== "t" ? [sign] : [sign, `c${x.id}`, `v${x.id}`];
  });
}

/** Arrows from the factor (or the minus) to every term inside. */
export function arrowsFor(items: LN[], gid: string): [string, string][] {
  const g = groupsIn(items).find((x) => x.id === gid);
  if (!g || g.f === 1) return [];
  const from = Math.abs(g.f) === 1 ? (g.sk ?? `p${g.id}`) : `f${g.id}`;
  return g.items.map((x) => [from, x.kind === "t" ? (x.v && Math.abs(x.c) === 1 ? `v${x.id}` : `c${x.id}`) : `b${x.id}(`] as [string, string]);
}

/** Like terms next to each other: letters in order of first appearance, the numbers last. */
export function sortLike(list: LT[]): LT[] {
  const order: string[] = [];
  for (const x of list) if (x.v && !order.includes(x.v)) order.push(x.v);
  order.push("");
  return [...list].sort((a, b) => order.indexOf(a.v) - order.indexOf(b.v));
}

/** Add up like terms; the first of each kind keeps its keys so it morphs into the sum. */
export function combineLike(list: LT[]): LT[] {
  const out: LT[] = [];
  for (const x of sortLike(list)) {
    const prev = out.find((o) => o.v === x.v);
    if (prev) prev.c = round(prev.c + x.c);
    else out.push({ ...x });
  }
  return out.filter((x) => x.c !== 0);
}

/** Combine like terms inside every bracket that has no brackets left. */
export function tidyInside(items: LN[]): LN[] {
  return items.map((it) => {
    if (it.kind !== "g") return it;
    if (it.items.some((x) => x.kind === "g")) return { ...it, items: tidyInside(it.items) };
    return { ...it, items: combineLike(termsOf(it.items)) };
  });
}

/** A bracket (without brackets inside) whose like terms can still be combined. */
export const messyGroup = (items: LN[]) => innermost(items).find((g) => combineLike(termsOf(g.items)).length < g.items.length);

// ---------------------------------------------------------------------------
// Words for the notes

/** One term for a note: "3x", "-5", "0,5a". */
export const termText = (x: LT, l: Locale) => src([{ ...x, sk: undefined }], l, false);
/** A factor with its sign: "-2", "3", "0,5". */
const factorText = (f: number, l: Locale) => (f < 0 ? `-${num(-f, l)}` : num(f, l));

/** "$-2 \cdot 3x = -6x$ and $-2 \cdot (-5) = +10$". */
export function productsNote(g: LG): Text {
  return txMap((t, l) => {
    const parts = termsOf(g.items).map((x) => {
      const inner = x.c < 0 ? `(${termText(x, l)})` : termText(x, l);
      const p = { ...x, c: round(x.c * g.f) };
      // "+10" shows that minus times minus gives plus.
      const plus = g.f < 0 && x.c < 0 ? "+" : "";
      return `$${factorText(g.f, l)} \\cdot ${inner} = ${plus}${termText(p, l)}$`;
    });
    return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} ${t("and", "und")} ${parts[parts.length - 1]}` : parts[0];
  });
}

/** "$4x - 6x + x = -x$ and $10 - 1 = 9$" for every kind that gets combined. */
export function combineNote(list: LT[]): Text {
  return txMap((t, l) => {
    const kinds = new Map<string, LT[]>();
    for (const x of list) kinds.set(x.v, [...(kinds.get(x.v) ?? []), x]);
    const parts: string[] = [];
    for (const [v, xs] of kinds) {
      if (xs.length < 2) continue;
      const sum = round(xs.reduce((s, x) => s + x.c, 0));
      const lhs = src(
        xs.map((x) => ({ ...x, sk: undefined })),
        l,
        false,
      );
      parts.push(`$${lhs} = ${sum === 0 ? "0" : termText({ kind: "t", c: sum, v, id: "" }, l)}$`);
    }
    return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} ${t("and", "und")} ${parts[parts.length - 1]}` : (parts[0] ?? "");
  });
}

/** Two texts with a space between them. */
export const join = (a: Text, b: Text): Text => txMap((_, l) => `${resolveText(a, l)} ${resolveText(b, l)}`.trim());
/** Two texts glued together (for punctuation). */
export const cat = (a: Text, b: Text): Text => txMap((_, l) => `${resolveText(a, l)}${resolveText(b, l)}`);

/** What to do with a bracket, before multiplying it out. */
export function bracketNote(items: LN[], g: LG): Text {
  const nested = !!parentOf(items, g.id);
  const lead = nested ? tx("Innermost bracket first.", "Die innerste Klammer zuerst.") : "";
  if (g.f === 1) return join(lead, tx("A plus (or nothing) in front of this bracket: drop it, every sign stays.", "Vor dieser Klammer steht ein Plus (oder nichts): Lass sie weg, jedes Vorzeichen bleibt."));
  if (g.f === -1) return join(lead, tx("A minus in front of this bracket: drop it and flip **every** sign inside.", "Vor dieser Klammer steht ein Minus: Lass sie weg und dreh **jedes** Vorzeichen darin um."));
  return join(
    lead,
    txMap((t, l) =>
      t(
        `The factor $${factorText(g.f, l)}$ multiplies **every** term in the bracket${g.f < 0 ? ". Its minus comes along" : ""}.`,
        `Der Faktor $${factorText(g.f, l)}$ wird mit **jedem** Term in der Klammer multipliziert${g.f < 0 ? ". Sein Minus kommt mit" : ""}.`,
      ),
    ),
  );
}

/** The note after multiplying out. */
export function doneNote(g: LG): Text {
  if (g.f === 1) return tx("Brackets gone. Nothing else changes.", "Klammern weg. Sonst ändert sich nichts.");
  if (g.f === -1) return tx("Brackets gone, every sign flipped: $+$ becomes $-$, $-$ becomes $+$.", "Klammern weg, jedes Vorzeichen umgedreht: Aus $+$ wird $-$, aus $-$ wird $+$.");
  return cat(productsNote(g), ".");
}

// ---------------------------------------------------------------------------

/** The full worked solution: innermost bracket first, tidy up inside, then sort and combine. */
export function solveLong(start: LN[]): { frames: Frame[]; result: LT[] } {
  const frames: Frame[] = [];
  let cur = start;
  for (let g = innermost(cur)[0]; g; g = innermost(cur)[0]) {
    frames.push({ math: show(cur), note: bracketNote(cur, g), arrows: arrowsFor(cur, g.id), highlight: g.f === 1 ? [g.sk ?? `p${g.id}`, `b${g.id}(`, `b${g.id})`] : undefined });
    const keys = changedKeys(cur, g.id);
    cur = resolve(cur, g.id);
    frames.push({ math: show(cur), note: doneNote(g), highlight: keys });
    const messy = messyGroup(cur);
    if (messy) {
      const note = join(tx("Tidy up inside the bracket first:", "Fasse zuerst in der Klammer zusammen:"), combineNote(termsOf(messy.items)));
      cur = tidyInside(cur);
      frames.push({ math: show(cur), note: cat(note, ".") });
    }
  }
  let list = termsOf(cur);
  const sorted = sortLike(list);
  if (sorted.some((x, i) => x.id !== list[i].id)) {
    frames.push({ math: show(sorted), note: tx("Put like terms next to each other. Each term takes its sign along.", "Stell gleichartige Terme nebeneinander. Jeder Term nimmt sein Vorzeichen mit.") });
    list = sorted;
  }
  const result = combineLike(list);
  if (result.length < list.length) {
    frames.push({ math: show(result), note: cat(join(tx("Combine like terms:", "Fasse gleichartige Terme zusammen:"), combineNote(list)), tx(". Done!", ". Fertig!")) });
  } else {
    const last = frames[frames.length - 1];
    frames[frames.length - 1] = { ...last, note: join(last.note ?? "", tx("That's the result.", "Das ist das Ergebnis.")) };
  }
  return { frames, result };
}

/** The result a student gets with a slip (inside-out, tidying correctly, then combining). */
export function simulate(start: LN[], rule: Rule): LT[] {
  let cur = start;
  for (let g = innermost(cur)[0]; g; g = innermost(cur)[0]) cur = tidyInside(resolve(cur, g.id, rule));
  return combineLike(termsOf(cur));
}

/** Value of a term for given values of the variables. */
export function valueAt(items: LN[], env: Record<string, number>): number {
  return round(items.reduce((s, it) => s + (it.kind === "t" ? it.c * (it.v ? env[it.v] : 1) : it.f * valueAt(it.items, env)), 0));
}

/**
 * The term with numbers in place of the letters: 4 · 2 − 2(3 · 2 − 5). A negative number that opens a
 * bracket needs no brackets of its own: 2(−3 + 4), not 2((−3) + 4). `inBracket` is set for the contents of a bracket.
 */
export function insertedSrc(items: LN[], env: Record<string, number>, l: Locale, inBracket = false): string {
  return items
    .map((it, i) => {
      const first = i === 0;
      if (it.kind === "t") {
        const sign = it.c < 0 ? (first ? "-" : "- ") : first ? "" : "+ ";
        const abs = Math.abs(it.c);
        if (!it.v) return `${sign}${num(abs, l)}`;
        const x = env[it.v];
        const bare = inBracket && first && it.c === 1;
        const val = x < 0 && !bare ? `(${num(x, l)})` : num(x, l);
        return `${sign}${abs === 1 ? val : `${num(abs, l)} \\cdot ${val}`}`;
      }
      const sign = it.f < 0 ? (first ? "-" : "- ") : first ? "" : "+ ";
      const abs = Math.abs(it.f);
      const close = it.open === "(" ? ")" : "]";
      return `${sign}${abs === 1 ? "" : num(abs, l)}${it.open}${insertedSrc(it.items, env, l, true)}${close}`;
    })
    .join(" ");
}
