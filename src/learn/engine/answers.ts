import type { Locale } from "@/i18n/config";
import { resolveText, tx, type Text } from "@/i18n/text";
import type { AnswerSpec, Feedback, Mistake } from "@/learn/types";
import { balanceSrc, checkBalance, checkFormula, checkMulti, checkWord, readCoefficients, wordDisplay } from "@/learn/chemistry/check";
import { checkMatch, checkOrder, matchShowsMistake, orderShowsMistake } from "./arrange";
import { diagnoseExpr, diagnoseFraction, diagnoseInequality, diagnoseNumber, diagnosePair, diagnoseSolutions, type Diagnosis } from "./diagnose";
import { close, equivalent, isExpanded, likeTermsCombined, parse, parseNumber, toDisplay } from "./expr";
import { gcd } from "./rng";

/** What the answer UI hands to the checker. Shape depends on the spec kind. */
export type AnswerValue =
  | { kind: "text"; text: string }
  | { kind: "fraction"; n: string; d: string }
  | { kind: "list"; values: string[]; none?: boolean }
  | { kind: "inequality"; op: string; text: string }
  | { kind: "choice"; index: number }
  | { kind: "multi"; indices: number[] }
  /** Item indices (in spec.items) in the order the student arranged them. */
  | { kind: "order"; order: number[] }
  /** For each left item, the index of the chosen partner in matchOptions(spec). */
  | { kind: "match"; picks: (number | null)[] };

const nearly = (a: number, b: number, tol = 1e-6) => close(a, b, tol) || Math.abs(a - b) < tol;

const NUM = String.raw`(?:\d+(?:[.,]\d+)?|[.,]\d+)`;
const PLAIN = new RegExp(`^[+-]?${NUM}$`);
const PLAIN_FRACTION = new RegExp(`^([+-]?${NUM})/([+-]?${NUM})$`);

/**
 * A typed number on its own: 12, -3,5, 2.75, 3/4, 1 000, optionally followed by the
 * unit. Calculations like "2^5" or "√144" are not accepted as the answer to "work out 2⁵".
 */
function cleanNumber(raw: string, unit?: Text) {
  let s = raw.trim().replace(/[−–]/g, "-").replace(/\s+/g, " ");
  const units = unit == null ? [] : typeof unit === "string" ? [unit] : [unit.de, unit.en];
  // The unit typed after the number, spaces ignored ("100 °C", "100° C", "2,5 mol / L").
  const bare = (x: string) => x.replace(/\s+/g, "").replace(/"/g, "").toLowerCase();
  for (const u of units) {
    const b = bare(u ?? "");
    if (b && bare(s).endsWith(b)) {
      const cut = s.toLowerCase().replace(/\s+(?=\S)/g, (m, i) => (bare(s.slice(i)).length <= b.length ? "" : m));
      s = cut.slice(0, cut.length - b.length).trim() || s;
      break;
    }
  }
  if (units.some((u) => u?.includes("°C"))) s = s.replace(/\s*(?:°\s*c|grad(?:\s*celsius)?|degrees?(?:\s*celsius)?)$/i, "").trim();
  s = s.replace(/\s*[%€]$/, "").trim();
  return s.replace(/(\d) (?=\d{3}(?!\d))/g, "$1");
}

const value = (t: string) => Number(t.replace(",", "."));
const GROUPED = /^[+-]?[1-9]\d{0,2}(?:\.\d{3})+(?:,\d+)?$/;

export function parsePlainNumber(raw: string, unit?: Text): number | null {
  const s = cleanNumber(raw, unit);
  if (PLAIN.test(s)) return value(s);
  const f = PLAIN_FRACTION.exec(s);
  if (f && value(f[2]) !== 0) return value(f[1]) / value(f[2]);
  // German thousands dots: "1.250,50"
  if (GROUPED.test(s) && s.includes(",")) return value(s.replace(/\./g, ""));
  return null;
}

/**
 * Every sensible reading of a typed number. "26.523" is 26.523 in English but 26 523 in
 * German, so both are tried against the expected value.
 */
export function numberReadings(raw: string, unit?: Text): number[] {
  const first = parsePlainNumber(raw, unit);
  if (first === null) return [];
  const s = cleanNumber(raw, unit);
  return GROUPED.test(s) && !s.includes(",") ? [first, value(s.replace(/\./g, ""))] : [first];
}

/** Is the answer right? (Plus the basic messages; `check` adds Blob's diagnosis on top.) */
function checkCore(spec: AnswerSpec, answer: AnswerValue): Feedback {
  switch (spec.kind) {
    case "number": {
      if (answer.kind !== "text") return { correct: false };
      const readings = numberReadings(answer.text, spec.unit);
      const tol = spec.tolerance ?? 1e-6;
      const v = readings.find((r) => Math.abs(r - spec.value) <= tol * Math.max(1, Math.abs(spec.value))) ?? readings[0] ?? null;
      if (v === null) {
        return parseNumber(answer.text) !== null
          ? { correct: false, message: tx("Work it out and type just the result as a number.", "Rechne es aus und gib nur das Ergebnis als Zahl ein.") }
          : { correct: false, message: tx("That doesn't look like a number.", "Das sieht nicht nach einer Zahl aus.") };
      }
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
      const user = parse(stripPrefix(answer.text, spec.prefix));
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
      if (spec.values.length === 0) return { correct: false, message: tx("Check first whether there is a solution at all.", "Prüf zuerst, ob es überhaupt eine Lösung gibt.") };
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
    case "multi":
      return answer.kind === "multi" ? checkMulti(spec.correct, answer.indices) : { correct: false };
    case "formula":
      return answer.kind === "text" ? checkFormula(spec.value, answer.text) : { correct: false };
    case "balance":
      return answer.kind === "list" ? checkBalance(spec.equation, answer.values) : { correct: false };
    case "word":
      return answer.kind === "text" ? checkWord(spec.accept, answer.text, spec.exact) : { correct: false };
    case "order":
      return answer.kind === "order" ? checkOrder(spec, answer.order) : { correct: false };
    case "match":
      return answer.kind === "match" ? checkMatch(spec, answer.picks) : { correct: false };
  }
}

/**
 * Check an answer. When it's wrong, Blob tries to understand what happened: first the
 * exercise's own typical mistakes, then a general look at the answer (a sign flipped, a
 * term missing, like terms not combined, values swapped…).
 */
export function check(spec: AnswerSpec, answer: AnswerValue, opts: { mistakes?: Mistake[] } = {}): Feedback {
  const core = checkCore(spec, answer);
  if (core.correct) return core;
  const general = diagnose(spec, answer);
  for (const m of opts.mistakes ?? []) {
    if (m.when.kind !== spec.kind || !matches(m.when, spec, answer)) continue;
    return {
      correct: false,
      partial: m.close ?? (general?.close || core.partial),
      title: m.title ?? general?.title ?? core.title ?? tx("I see what happened", "Ich seh, was passiert ist"),
      message: m.say,
      mark: general?.mark ?? core.mark ?? markOf(spec, answer),
    };
  }
  if (general) return { correct: false, partial: general.close || core.partial, title: general.title, message: general.say, mark: general.mark };
  return core;
}

/** Does the student's answer match a mistake? Usually "would the checker accept it for `when`". */
function matches(when: AnswerSpec, spec: AnswerSpec, answer: AnswerValue): boolean {
  // Balancing the task's own equation: any balanced set would "pass", so compare the exact numbers.
  if (when.kind === "balance" && spec.kind === "balance" && when.equation === spec.equation) {
    const got = answer.kind === "list" ? readCoefficients(answer.values) : null;
    return !!got && got.length === when.coefficients.length && got.every((c, i) => c === when.coefficients[i]);
  }
  // Orders and matchings: the mistake names the wrong arrangement (or the wrong pairs) in words.
  if (when.kind === "order" && spec.kind === "order") return answer.kind === "order" && orderShowsMistake(spec, answer.order, when);
  if (when.kind === "match" && spec.kind === "match") return answer.kind === "match" && matchShowsMistake(spec, answer.picks, when);
  return checkCore(when, answer).correct;
}

/** "y = 2x + 1" typed into a box that already says "y =": drop the repeated left side. */
function stripPrefix(text: string, prefix?: Text): string {
  const left = resolveText(prefix, "en").match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*$/);
  if (!left) return text;
  const m = text.match(new RegExp(`^\\s*${left[1]}\\s*=(.*)$`));
  return m ? m[1] : text;
}

function markOf(spec: AnswerSpec, answer: AnswerValue): string | undefined {
  if (spec.kind !== "expr" || answer.kind !== "text") return undefined;
  const p = parse(stripPrefix(answer.text, spec.prefix));
  return p.ok ? toDisplay(p.ast) : undefined;
}

function diagnose(spec: AnswerSpec, answer: AnswerValue): Diagnosis | null {
  switch (spec.kind) {
    case "expr":
      return answer.kind === "text" ? diagnoseExpr(spec, answer.text) : null;
    case "number": {
      if (answer.kind !== "text") return null;
      const v = numberReadings(answer.text, spec.unit)[0];
      return v === undefined ? null : diagnoseNumber(v, spec.value, { percent: resolveText(spec.unit, "en").includes("%") });
    }
    case "fraction": {
      if (answer.kind !== "fraction") return null;
      const n = parseNumber(answer.n);
      const d = parseNumber(answer.d);
      if (n === null || d === null || d === 0 || n === 0) return null;
      return diagnoseFraction(n, d, spec);
    }
    case "solutions": {
      if (answer.kind !== "list" || answer.none || !spec.values.length) return null;
      const got = answer.values.map((t) => t.trim()).filter(Boolean).map(parseNumber);
      if (!got.length || got.some((g) => g === null)) return null;
      return diagnoseSolutions(got as number[], spec.values, spec.variable);
    }
    case "inequality": {
      if (answer.kind !== "inequality") return null;
      const v = parseNumber(answer.text);
      return v === null || !answer.op ? null : diagnoseInequality(answer.op, v, spec);
    }
    case "pair": {
      if (answer.kind !== "list") return null;
      const nums = answer.values.map((t) => parsePlainNumber(t));
      if (nums.some((n) => n === null)) return null;
      return diagnosePair(nums[0]!, nums[1]!, spec);
    }
    case "choice":
    case "multi":
    case "formula":
    case "balance":
    case "word":
    case "order":
    case "match":
      // Chemistry answers, orders and matchings are diagnosed inside their own checkers.
      return null;
  }
}

/** A short human-readable version of the right answer (display language). */
export function answerDisplay(spec: AnswerSpec, locale: Locale): string {
  // Decimal comma in German, point in English; money always with two decimals.
  const n = (v: number, unit?: string) => {
    const r = Math.round(v * 1e6) / 1e6;
    const text = unit === "€" && !Number.isInteger(r) ? r.toFixed(2) : String(r);
    return locale === "de" ? text.replace(".", ",") : text;
  };
  const t = (x: Parameters<typeof resolveText>[0]) => resolveText(x, locale);
  switch (spec.kind) {
    case "number": {
      const unit = t(spec.unit);
      return `${n(spec.value, unit)}${unit ? ` "${unit}"` : ""}`;
    }
    case "fraction":
      // A negative fraction gets its minus in front: −5/6, not (−5)/6.
      return spec.n * spec.d < 0 ? `-\\frac{${Math.abs(spec.n)}}{${Math.abs(spec.d)}}` : `\\frac{${Math.abs(spec.n)}}{${Math.abs(spec.d)}}`;
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
    case "multi":
      return "";
    case "formula":
      return `\\ce{${spec.value}}`;
    case "balance":
      return balanceSrc(spec.equation, spec.coefficients);
    case "word":
      return wordDisplay(spec.accept, locale);
    case "order":
    case "match":
      // Shown as cards by the exercise card.
      return "";
  }
}
