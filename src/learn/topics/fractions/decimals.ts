import type { Locale } from "@/i18n/config";
import { txMap, type Text } from "@/i18n/text";
import { gcd } from "@/learn/engine/rng";

// Decimals for fractions level 2: long division with the period, bilingual decimal text.

/** Rounds away floating-point noise. */
export const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** A decimal in one language: 0.375 / 0,375. */
export const decStr = (v: number, l: Locale) => {
  const s = String(r6(v));
  return l === "de" ? s.replace(".", ",") : s;
};

/** A decimal in both languages. */
export const dec = (v: number): Text => txMap((_, l) => decStr(v, l));

/**
 * Display-language maths written the German way (decimal comma between digits), in both
 * languages: the English version gets decimal points. Only for maths without words.
 */
export const bi = (de: string): { en: string; de: string } => ({ en: de.replace(/(\d),(\d)/g, "$1.$2"), de });

/** The result of n : d done by hand: whole part, digits after the comma, remainders and where the period starts. */
export type Division = {
  int: number;
  digits: number[];
  /** The remainder before each digit (rems[i] · 10 : d gives digits[i]). */
  rems: number[];
  /** Index in digits where the period starts, or -1 when the division ends (remainder 0). */
  start: number;
};

/** Long division n : d (n ≥ 0, d > 0) until the remainder is 0 or repeats. */
export function longDivision(n: number, d: number, max = 60): Division {
  const int = Math.floor(n / d);
  let r = n % d;
  const digits: number[] = [];
  const rems: number[] = [];
  const seen = new Map<number, number>();
  while (r !== 0 && !seen.has(r) && digits.length < max) {
    seen.set(r, digits.length);
    rems.push(r);
    r *= 10;
    digits.push(Math.floor(r / d));
    r %= d;
  }
  return { int, digits, rems, start: r === 0 ? -1 : (seen.get(r) ?? -1) };
}

/** Pre-period and period digits of n/d as strings: 1/6 → { pre: "1", period: "6" }. */
export function periodOf(n: number, d: number) {
  const L = longDivision(n, d);
  if (L.start < 0) return { int: L.int, pre: L.digits.join(""), period: "" };
  return { int: L.int, pre: L.digits.slice(0, L.start).join(""), period: L.digits.slice(L.start).join("") };
}

/** Does n/d (in lowest terms) end? Only when the denominator has no prime factors but 2 and 5. */
export function terminates(n: number, d: number) {
  let q = d / gcd(n, d);
  while (q % 2 === 0) q /= 2;
  while (q % 5 === 0) q /= 5;
  return q === 1;
}

/** Prime factors in ascending order: 12 → [2, 2, 3]. */
export function primeFactors(k: number): number[] {
  const out: number[] = [];
  let m = k;
  for (let p = 2; p * p <= m; p++) {
    while (m % p === 0) {
      out.push(p);
      m /= p;
    }
  }
  if (m > 1) out.push(m);
  return out;
}

/**
 * A repeating decimal in the display language, written out with dots: 0,333… or 0,1666…
 * (the display language has no bar; the pictures show the bar). `key` keys the digits.
 */
export function dotsSrc(int: string, pre: string, period: string, l: Locale, key = ""): string {
  const reps = period.length === 1 ? 3 : period.length <= 3 ? 2 : 1;
  const comma = l === "de" ? "," : ".";
  const k = key ? `#${key}` : "";
  const kd = key ? `#${key}dots` : "";
  return `${int}${comma}${pre}${period.repeat(reps)}${k} …${kd}`;
}

/** dotsSrc in both languages. */
export const dots = (int: string, pre: string, period: string, key = ""): Text => txMap((_, l) => dotsSrc(int, pre, period, l, key));

/** The repeating decimal of n/d (n ≥ 0) with dots, in both languages: 1/6 → 0,1666… */
export function fracDots(n: number, d: number, key = ""): Text {
  const p = periodOf(n, d);
  return p.period ? dots(String(p.int), p.pre, p.period, key) : dec(n / d);
}
