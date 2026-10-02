import type { Locale } from "@/i18n/config";
import { resolveText, tx, type Text } from "@/i18n/text";
import type { AnswerSpec, Feedback } from "@/learn/types";
import { close, equivalent, isExpanded, likeTermsCombined, parse, parseNumber, toDisplay } from "./expr";
import { gcd } from "./rng";

/** What the answer UI hands to the checker. Shape depends on the spec kind. */
export type AnswerValue =
  | { kind: "text"; text: string }
  | { kind: "fraction"; n: string; d: string }
  | { kind: "list"; values: string[]; none?: boolean }
  | { kind: "inequality"; op: string; text: string }
  | { kind: "choice"; index: number };

const nearly = (a: number, b: number, tol = 1e-6) => close(a, b, tol) || Math.abs(a - b) < tol;

const NUM = String.raw`(?:\d+(?:[.,]\d+)?|[.,]\d+)`;
const PLAIN = new RegExp(`^[+-]?${NUM}$`);
const PLAIN_FRACTION = new RegExp(`^([+-]?${NUM})/([+-]?${NUM})$`);

/**
 * A typed number on its own: 12, -3,5, 2.75, 3/4, 1 000, optionally followed by the
 * unit. Calculations like "2^5" or "√144" are not accepted as the answer to "work out 2⁵".
 */
export function parsePlainNumber(raw: string, unit?: Text): number | null {
  let s = raw.trim().replace(/[−–]/g, "-").replace(/\s+/g, " ");
  const units = unit == null ? [] : typeof unit === "string" ? [unit] : [unit.de, unit.en];
  for (const u of units) if (u && s.toLowerCase().endsWith(u.toLowerCase())) s = s.slice(0, -u.length).trim();
  s = s.replace(/\s*[%€]$/, "").trim();
  s = s.replace(/(\d) (?=\d{3}(?!\d))/g, "$1");
  const value = (t: string) => Number(t.replace(",", "."));
  if (PLAIN.test(s)) return value(s);
  const f = PLAIN_FRACTION.exec(s);
  if (f && value(f[2]) !== 0) return value(f[1]) / value(f[2]);
  return null;
}

export function check(spec: AnswerSpec, answer: AnswerValue): Feedback {
  switch (spec.kind) {
    case "number": {
      if (answer.kind !== "text") return { correct: false };
      const v = parsePlainNumber(answer.text, spec.unit);
      if (v === null) {
        return parseNumber(answer.text) !== null
          ? { correct: false, message: tx("Work it out and type just the result as a number.", "Rechne es aus und gib nur das Ergebnis als Zahl ein.") }
          : { correct: false, message: tx("That doesn't look like a number.", "Das sieht nicht nach einer Zahl aus.") };
      }
      const tol = spec.tolerance ?? 1e-6;
      if (Math.abs(v - spec.value) <= tol * Math.max(1, Math.abs(spec.value))) return { correct: true };
      if (Math.abs(Math.abs(v) - Math.abs(spec.value)) <= tol * Math.max(1, Math.abs(spec.value)) && spec.value !== 0)
        return { correct: false, partial: true, message: tx("So close! Check the sign.", "Ganz knapp! Prüf das Vorzeichen.") };
      return { correct: false };
    }
    case "fraction": {
      if (answer.kind !== "fraction") return { correct: false };
      const n = parseNumber(answer.n);
      const d = parseNumber(answer.d);
      if (n === null || d === null || d === 0 || !Number.isInteger(n) || !Number.isInteger(d)) {
        return { correct: false, message: tx("Use whole numbers on top and bottom.", "Nimm ganze Zahlen für Zähler und Nenner.") };
      }
      if (!nearly(n / d, spec.n / spec.d)) return { correct: false };
      if (spec.mustReduce && Math.abs(gcd(n, d)) !== 1) return { correct: false, partial: true, message: tx("Right value! Now reduce the fraction as far as it goes.", "Richtiger Wert! Jetzt kürze den Bruch so weit wie möglich.") };
      return { correct: true };
    }
    case "expr": {
      if (answer.kind !== "text") return { correct: false };
      const user = parse(answer.text);
      if (!user.ok) return { correct: false, message: user.error };
      const target = parse(spec.value);
      if (!target.ok) return { correct: false, message: tx("This exercise has a typo. Skip it.", "Diese Aufgabe hat einen Fehler. Überspring sie.") };
      if (!equivalent(user.ast, target.ast, { positive: spec.positive })) return { correct: false };
      if ((spec.form === "expanded" || spec.form === "simplified") && !isExpanded(user.ast)) {
        return { correct: false, partial: true, message: tx("Same value, but there are still brackets. Multiply them out.", "Gleicher Wert, aber da sind noch Klammern. Multipliziere sie aus.") };
      }
      if (spec.form === "simplified" && !likeTermsCombined(user.ast)) {
        return { correct: false, partial: true, message: tx("Almost! Combine the like terms too.", "Fast! Fasse auch die gleichartigen Terme zusammen.") };
      }
      return { correct: true };
    }
    case "solutions": {
      if (answer.kind !== "list") return { correct: false };
      if (answer.none) return spec.values.length === 0 ? { correct: true } : { correct: false, message: tx("There is a solution here. Look again.", "Hier gibt es eine Lösung. Schau noch mal hin.") };
      if (spec.values.length === 0) return { correct: false, message: tx("Check the discriminant first. Is there a solution at all?", "Prüf zuerst die Diskriminante. Gibt es überhaupt eine Lösung?") };
      const given = answer.values.map((t) => t.trim()).filter(Boolean).map(parseNumber);
      if (given.some((g) => g === null)) return { correct: false, message: tx("Type numbers like 3, -2 or 1,5.", "Gib Zahlen wie 3, -2 oder 1,5 ein.") };
      const nums = given as number[];
      const want = [...new Set(spec.values.map((v) => Math.round(v * 1e9) / 1e9))];
      const got = [...new Set(nums.map((v) => Math.round(v * 1e9) / 1e9))];
      const allRight = got.every((g) => want.some((w) => nearly(g, w, 1e-4)));
      if (allRight && got.length === want.length) return { correct: true };
      if (allRight && got.length < want.length) return { correct: false, partial: true, message: want.length === 2 ? tx("Good, but there are two solutions.", "Gut, aber es gibt zwei Lösungen.") : tx("Good, but there is more.", "Gut, aber da fehlt noch etwas.") };
      return { correct: false };
    }
    case "inequality": {
      if (answer.kind !== "inequality") return { correct: false };
      const v = parseNumber(answer.text);
      if (v === null) return { correct: false, message: tx("Type the boundary number.", "Gib die Grenzzahl ein.") };
      const sameValue = nearly(v, spec.value, 1e-6);
      if (sameValue && answer.op === spec.op) return { correct: true };
      if (sameValue) return { correct: false, partial: true, message: tx("Right number, but check the direction of the sign.", "Richtige Zahl, aber prüf die Richtung des Zeichens.") };
      return { correct: false };
    }
    case "pair": {
      if (answer.kind !== "list") return { correct: false };
      const nums = answer.values.map((t) => parsePlainNumber(t));
      if (nums.some((n) => n === null)) {
        return answer.values.some((t) => !t.trim())
          ? { correct: false, message: tx("Fill in both values.", "Füll beide Werte aus.") }
          : { correct: false, message: tx("Type each value as a plain number, like 3, -2 or 1/2.", "Gib jeden Wert als einfache Zahl ein, z. B. 3, -2 oder 1/2.") };
      }
      const [a, b] = nums as number[];
      if (nearly(a, spec.values[0], 1e-4) && nearly(b, spec.values[1], 1e-4)) return { correct: true };
      if (nearly(a, spec.values[0], 1e-4) || nearly(b, spec.values[1], 1e-4)) return { correct: false, partial: true, message: tx("One of them is right!", "Einer davon stimmt!") };
      return { correct: false };
    }
    case "choice":
      return { correct: answer.kind === "choice" && answer.index === spec.correct };
  }
}

/** A short human-readable version of the right answer (display language). */
export function answerDisplay(spec: AnswerSpec, locale: Locale): string {
  // German notation: decimal comma, and money always with two decimals.
  const n = (v: number, unit?: string) => {
    const r = Math.round(v * 1e6) / 1e6;
    const text = unit === "€" && !Number.isInteger(r) ? r.toFixed(2) : String(r);
    return text.replace(".", ",");
  };
  const t = (x: Parameters<typeof resolveText>[0]) => resolveText(x, locale);
  switch (spec.kind) {
    case "number": {
      const unit = t(spec.unit);
      return `${n(spec.value, unit)}${unit ? ` "${unit}"` : ""}`;
    }
    case "fraction":
      return `\\frac{${spec.n}}{${spec.d}}`;
    case "expr": {
      const p = parse(spec.value);
      const prefix = t(spec.prefix);
      return `${prefix ? `${prefix} ` : ""}${p.ok ? toDisplay(p.ast) : spec.value}`;
    }
    case "solutions":
      if (spec.values.length === 0) return locale === "de" ? '"keine Lösung"' : '"no solution"';
      if (spec.values.length === 1) return `${spec.variable} = ${n(spec.values[0])}`;
      return spec.values.map((v, i) => `${spec.variable}_${i + 1} = ${n(v)}`).join(" \\quad ");
    case "inequality":
      return `${spec.variable} ${spec.op} ${n(spec.value)}`;
    case "pair":
      return `${t(spec.names[0])} = ${n(spec.values[0])} \\quad ${t(spec.names[1])} = ${n(spec.values[1])}`;
    case "choice":
      return "";
  }
}
