// Helpers for writing generated maths cleanly: linear terms with several variables
// (4x - 3y + 7) and polynomials in one variable (2x² - 3x + 1).

/** A linear term: coefficient and variable ("" for a constant). */
export type Term = { c: number; v: string };

export const t = (c: number, v = ""): Term => ({ c, v });

function coefText(c: number, v: string, first: boolean): string {
  const sign = c < 0 ? (first ? "-" : "- ") : first ? "" : "+ ";
  const abs = Math.abs(c);
  const num = v && abs === 1 ? "" : String(abs);
  return `${sign}${num}${v}`;
}

/** "4x - 3y + 7". Zero terms are skipped; an empty list shows "0". */
export function showTerms(terms: Term[], opts: { keepZero?: boolean } = {}): string {
  const list = opts.keepZero ? terms : terms.filter((x) => x.c !== 0);
  if (list.length === 0) return "0";
  return list.map((x, i) => coefText(x.c, x.v, i === 0)).join(" ");
}

/** One signed term for inside a sum: "+ 3x", "- 5". */
export function showSigned(term: Term): string {
  return coefText(term.c, term.v, false);
}

/** Combine like terms, variables first (alphabetically), constant last. */
export function combine(terms: Term[]): Term[] {
  const map = new Map<string, number>();
  for (const x of terms) map.set(x.v, (map.get(x.v) ?? 0) + x.c);
  return [...map.entries()]
    .filter(([, c]) => c !== 0)
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    .map(([v, c]) => ({ c, v }));
}

export const negate = (terms: Term[]) => terms.map((x) => ({ c: -x.c, v: x.v }));
export const scale = (terms: Term[], k: number) => terms.map((x) => ({ c: x.c * k, v: x.v }));

/** Like terms grouped next to each other (same order as `combine`), not yet added up. */
export function groupLike(terms: Term[]): Term[] {
  const order = combine(terms.map((x) => ({ ...x, c: 1 }))).map((x) => x.v);
  return [...terms].filter((x) => x.c !== 0).sort((a, b) => order.indexOf(a.v) - order.indexOf(b.v));
}

/** Text for the answer checker: "4x-3y+7". */
export function plainTerms(terms: Term[]) {
  return showTerms(terms).replace(/\s+/g, "");
}

// ---------------------------------------------------------------------------
// Polynomials in one variable, as coefficient arrays: [c0, c1, c2] = c0 + c1·x + c2·x².

export type Poly = number[];

export function polyAdd(a: Poly, b: Poly): Poly {
  const out = new Array(Math.max(a.length, b.length)).fill(0);
  a.forEach((c, i) => (out[i] += c));
  b.forEach((c, i) => (out[i] += c));
  return trim(out);
}

export function polyMul(a: Poly, b: Poly): Poly {
  const out = new Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
  return trim(out);
}

export const polyScale = (a: Poly, k: number) => trim(a.map((c) => c * k));

function trim(p: Poly): Poly {
  const out = [...p];
  while (out.length > 1 && out[out.length - 1] === 0) out.pop();
  return out;
}

/** "2x^2 - 3x + 1" (highest power first). */
export function showPoly(p: Poly, v = "x"): string {
  const terms: string[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i];
    if (c === 0) continue;
    const first = terms.length === 0;
    const sign = c < 0 ? (first ? "-" : "- ") : first ? "" : "+ ";
    const abs = Math.abs(c);
    const body = i === 0 ? String(abs) : `${abs === 1 ? "" : abs}${v}${i > 1 ? `^${i}` : ""}`;
    terms.push(`${sign}${body}`);
  }
  return terms.length ? terms.join(" ") : "0";
}

/** A linear factor like "(2x - 3)" from [c0, c1]. */
export function showLinear(p: Poly, v = "x"): string {
  return `(${showPoly(p, v)})`;
}

export const plainPoly = (p: Poly, v = "x") => showPoly(p, v).replace(/\s+/g, "");
