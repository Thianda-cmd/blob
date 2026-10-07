"use client";

import { tx, txMap, type Text } from "@/i18n/text";
import { equivalentText } from "@/learn/engine/expr";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { answerText, combineLike, groupsIn, insertedSrc, lg, lt, num, round, show, simulate, solveLong, src, termsOf, valueAt, type LG, type LN, type LT, type Rule } from "./long";
import { InsertCheck } from "./Probe";
import { BracketStepper } from "./Stepper";

// ---------------------------------------------------------------------------
// Helpers

/** Decimal comma in German: dec("0.5(4a - 6b)") → "0.5(…)" / "0,5(…)". */
const dec = (s: string): Text => {
  const de = s.replace(/(\d)\.(\d)/g, "$1,$2");
  return de === s ? s : tx(s, de);
};

/** "$-x + 9$" as a choice option or inline maths, decimal comma in German. */
const inline = (items: LN[]): Text => txMap((_, l) => `$${src(items, l, false, true)}$`);

const SIMPLIFY = tx("Remove the brackets and simplify", "Löse die Klammern auf und fasse zusammen");

const isConst = (n: LN | undefined): n is LT => !!n && n.kind === "t" && !n.v;

/** 7 − 2(x + 3) worked out as 5(x + 3): a number first, then a bracket with a factor. */
function pointBeforeLine(items: LN[]): LN[] | null {
  const [a, b, ...rest] = items;
  if (!isConst(a) || !b || b.kind !== "g" || Math.abs(b.f) === 1 || b.items.some((x) => x.kind === "g")) return null;
  const f = round(a.c + b.f);
  if (f === 0) return null;
  return [{ ...b, f, sk: undefined }, ...rest];
}

/** The first product "negative factor times negative term" in the task, for the sign-slip message. */
function minusTimesMinus(items: LN[]): { f: number; c: number } | null {
  for (const g of groupsIn(items)) {
    if (g.f >= 0 || g.f === -1) continue;
    const x = termsOf(g.items).find((y) => y.c < 0);
    if (x) return { f: g.f, c: x.c };
  }
  return null;
}

type Slip = { rule: Rule | "pbl"; title: Text; say: Text };

/** Typical slips for this task (only those that apply). */
function slipsFor(items: LN[]): Slip[] {
  const out: Slip[] = [];
  const groups = groupsIn(items);
  if (groups.some((g) => Math.abs(g.f) !== 1)) {
    out.push({
      rule: "onlyFirst",
      title: tx("Only the first term multiplied", "Nur der erste Term multipliziert"),
      say: tx("The factor in front has to multiply **every** term in the bracket, not just the first one.", "Der Faktor vor der Klammer muss mit **jedem** Term in der Klammer multipliziert werden, nicht nur mit dem ersten."),
    });
  }
  const mm = minusTimesMinus(items);
  if (mm) {
    out.push({
      rule: "signSlip",
      title: tx("Minus times minus", "Minus mal Minus"),
      say: txMap((t, l) =>
        t(
          `Careful with the signs: a negative factor times a negative term gives **plus**. Here $${num(mm.f, l)} \\cdot (${num(mm.c, l)}) = +${num(round(mm.f * mm.c), l)}$.`,
          `Achtung bei den Vorzeichen: Ein negativer Faktor mal ein negativer Term ergibt **Plus**. Hier $${num(mm.f, l)} \\cdot (${num(mm.c, l)}) = +${num(round(mm.f * mm.c), l)}$.`,
        ),
      ),
    });
  }
  if (groups.some((g) => g.f === -1)) {
    out.push({
      rule: "noFlip",
      title: tx("The minus got ignored", "Minus übersehen"),
      say: tx("Looks like a bracket with a minus in front was just dropped. Then **every** sign inside has to flip.", "Sieht so aus, als wäre eine Klammer mit Minus davor einfach weggelassen worden. Dann dreht sich **jedes** Vorzeichen darin um."),
    });
    out.push({
      rule: "firstFlipOnly",
      title: tx("Only the first sign flipped", "Nur das erste Vorzeichen gedreht"),
      say: tx("A minus in front of a bracket flips **every** sign inside, the last one too.", "Ein Minus vor einer Klammer dreht **jedes** Vorzeichen darin um, auch das letzte."),
    });
  }
  const pbl = pointBeforeLine(items);
  if (pbl && isConst(items[0]) && items[1].kind === "g") {
    const a = items[0].c;
    const f = items[1].f;
    out.push({
      rule: "pbl",
      title: tx("Point before line", "Punkt vor Strich"),
      say: txMap((t, l) =>
        t(
          `You worked out $${num(a, l)} ${f < 0 ? "-" : "+"} ${num(Math.abs(f), l)}$ first. But the $${num(Math.abs(f), l)}$ is multiplied with the bracket, and multiplying comes first.`,
          `Du hast zuerst $${num(a, l)} ${f < 0 ? "-" : "+"} ${num(Math.abs(f), l)}$ gerechnet. Die $${num(Math.abs(f), l)}$ wird aber mit der Klammer multipliziert, und Punkt geht vor Strich.`,
        ),
      ),
    });
  }
  return out;
}

/** The simplified result a student gets with this slip. */
function slipResult(items: LN[], rule: Slip["rule"]): LT[] {
  if (rule === "pbl") return simulate(pointBeforeLine(items) ?? items, "right");
  return simulate(items, rule);
}

function simplifyMistakes(items: LN[], right: string): Mistake[] {
  const out: Mistake[] = [];
  for (const s of slipsFor(items)) {
    const value = answerText(slipResult(items, s.rule));
    if (equivalentText(value, right) || out.some((m) => m.when.kind === "expr" && equivalentText(m.when.value, value))) continue;
    out.push({ when: { kind: "expr", value }, title: s.title, say: s.say });
  }
  return out;
}

function simplifyExercise(items: LN[], hint: Text): Exercise {
  const { frames, result } = solveLong(items);
  const value = answerText(result);
  return { instruction: SIMPLIFY, math: show(items, false), answer: { kind: "expr", value, form: "simplified" }, hint, solution: frames, mistakes: simplifyMistakes(items, value) };
}

// ---------------------------------------------------------------------------
// Task templates

const VARS = ["x", "x", "x", "a", "y", "b"];
const nz = (rng: Rng, m = 9) => rng.nonZero(-m, m);

/** A bracket with a variable term and a number, in either order. */
function inner(rng: Rng, ids: [string, string], v: string, maxB = 6, maxC = 9): LT[] {
  const b = lt(ids[0], rng.int(1, maxB), v);
  const c = lt(ids[1], nz(rng, maxC));
  return rng.chance(0.8) ? [b, c] : [c, { ...b, c: rng.sign() * b.c }];
}

const HINT_FACTOR = tx("Multiply the factor in front, **with its sign**, by every term in the bracket. Then combine like terms.", "Multipliziere den Faktor vor der Klammer **mit seinem Vorzeichen** mit jedem Term in der Klammer. Dann fasse gleichartige Terme zusammen.");
const HINT_PBL = tx("Point before line: the factor belongs to the bracket. Multiply first, then add or subtract.", "Punkt vor Strich: Der Faktor gehört zur Klammer. Erst multiplizieren, dann addieren oder subtrahieren.");
const HINT_NESTED = tx("Work from the inside out: inner bracket first, tidy up, then the factor in front of the square bracket.", "Arbeite von innen nach außen: erst die innere Klammer, dann zusammenfassen, dann der Faktor vor der eckigen Klammer.");
const HINT_TWO = tx("Only like terms go together. Keep the letters apart.", "Nur gleichartige Terme gehören zusammen. Halte die Buchstaben auseinander.");
const HINT_DEC = tx("Decimals work like whole numbers: $0.5 \\cdot 4 = 2$, $1.5 \\cdot 2 = 3$.", "Dezimalzahlen funktionieren wie ganze Zahlen: $0,5 \\cdot 4 = 2$, $1,5 \\cdot 2 = 3$.");

type Built = { items: LN[]; hint: Text; kind: "lead" | "number" | "two" | "nested" | "vars" | "dec" };

/** 4x − 2(3x − 5) (+ (x − 1)) */
function leadBracket(rng: Rng, tail = rng.chance(0.4)): Built {
  const v = rng.pick(VARS);
  const f = rng.chance(0.75) ? -rng.int(2, 6) : rng.int(2, 5);
  const items: LN[] = [lt("a", rng.int(2, 9), v), lg("g", f, inner(rng, ["b", "c"], v))];
  if (tail) items.push(lg("h", rng.sign(), inner(rng, ["d", "e"], v, 5)));
  return { items, hint: HINT_FACTOR, kind: "lead" };
}

/** 7 − 2(x + 3) (+ 4x) */
function numberBracket(rng: Rng): Built {
  const v = rng.pick(VARS);
  const items: LN[] = [lt("a", rng.int(5, 20)), lg("g", -rng.int(2, 5), inner(rng, ["b", "c"], v, 5))];
  if (rng.chance(0.4)) items.push(lt("d", rng.int(2, 9), v));
  return { items, hint: HINT_PBL, kind: "number" };
}

/** 3(2x − 1) − 4(x − 2) */
function twoBrackets(rng: Rng): Built {
  const v = rng.pick(VARS);
  const items: LN[] = [lg("g", rng.int(2, 6), inner(rng, ["a", "b"], v)), lg("h", -rng.int(2, 6), inner(rng, ["c", "d"], v))];
  if (rng.chance(0.3)) items.push(lt("e", nz(rng), v));
  return { items, hint: HINT_FACTOR, kind: "two" };
}

/** 3[2x − (x − 4)], 20 − 2[3x − (x + 4)], 2[5a − 3(a − 2)] */
function nested(rng: Rng): Built {
  const v = rng.pick(VARS);
  const shape = rng.int(0, 2);
  if (shape === 0) {
    const items: LN[] = [lg("o", rng.int(2, 5), [lt("a", rng.int(2, 9), v), lg("i", rng.chance(0.8) ? -1 : 1, inner(rng, ["b", "c"], v, 6, 6))], "[")];
    if (rng.chance(0.4)) items.push(lt("d", nz(rng), v));
    return { items, hint: HINT_NESTED, kind: "nested" };
  }
  if (shape === 1) {
    const items: LN[] = [lt("k", rng.int(5, 30)), lg("o", -rng.int(2, 4), [lt("a", rng.int(2, 9), v), lg("i", -1, inner(rng, ["b", "c"], v, 6, 6))], "[")];
    return { items, hint: HINT_NESTED, kind: "nested" };
  }
  const items: LN[] = [lg("o", rng.int(2, 4), [lt("a", rng.int(4, 9), v), lg("i", -rng.int(2, 4), [lt("b", rng.int(1, 3), v), lt("c", nz(rng, 5))])], "[")];
  return { items, hint: HINT_NESTED, kind: "nested" };
}

/** 2(a − 3b) − 3(a − 2b) + 4a */
function twoVars(rng: Rng): Built {
  const [p, q] = rng.pick([
    ["a", "b"],
    ["x", "y"],
    ["m", "n"],
  ]);
  const items: LN[] = [lg("g", rng.chance(0.3) ? 1 : rng.int(2, 5), [lt("a", rng.int(1, 6), p), lt("b", nz(rng, 6), q)]), lg("h", -rng.int(1, 5), [lt("c", rng.int(1, 6), p), lt("d", nz(rng, 6), q)])];
  if (rng.chance(0.4)) items.push(lt("e", nz(rng), rng.chance(0.5) ? p : q));
  return { items, hint: HINT_TWO, kind: "vars" };
}

/** 0,5(4x − 6) − 1,5(2x − 4), 4(0,5x − 1,5) + x */
function decimals(rng: Rng): Built {
  const v = rng.pick(VARS);
  const even = (lo: number, hi: number) => 2 * rng.int(lo, hi);
  if (rng.chance(0.6)) {
    const items: LN[] = [
      lg("g", rng.pick([0.5, 1.5, 2.5]), [lt("a", even(1, 6), v), lt("b", rng.sign() * even(1, 5))]),
      lg("h", -rng.pick([0.5, 1.5]), [lt("c", even(1, 5), v), lt("d", rng.sign() * even(1, 5))]),
    ];
    return { items, hint: HINT_DEC, kind: "dec" };
  }
  const half = () => rng.pick([0.5, 1.5, 2.5]);
  const items: LN[] = [lg("g", rng.pick([2, 4, 6]), [lt("a", half(), v), lt("b", -half())]), lt("c", nz(rng, 5), v)];
  if (rng.chance(0.5)) items.reverse();
  return { items, hint: HINT_DEC, kind: "dec" };
}

const ok = (items: LN[], result: LT[], maxLen = 16) => {
  const text = answerText(result);
  return result.some((x) => x.v) && text.length <= maxLen && result.every((x) => Math.abs(x.c) <= 80) && termsOf(items).every((x) => Math.abs(x.c) <= 40);
};

function build(rng: Rng, make: () => Built, maxLen = 16): Built {
  for (let i = 0; i < 40; i++) {
    const b = make();
    const { result } = solveLong(b.items);
    if (ok(b.items, result, maxLen)) return b;
  }
  return { items: [lt("a", 4, "x"), lg("g", -2, [lt("b", 3, "x"), lt("c", -5)])], hint: HINT_FACTOR, kind: "lead" };
}

// ---------------------------------------------------------------------------
// Practice shapes

function simplifyTask(rng: Rng): Exercise {
  const make = rng.pick([leadBracket, leadBracket, numberBracket, twoBrackets, nested, nested, twoVars, decimals]);
  const b = build(rng, () => make(rng));
  return simplifyExercise(b.items, b.hint);
}

/** Work out the value for x = n (with a check through the simplified term). */
function valueTask(rng: Rng): Exercise {
  const b = build(rng, () => rng.pick([leadBracket, numberBracket, twoBrackets])(rng), 14);
  const v = termsOf(b.items).find((x) => x.v)?.v ?? termsOf(groupsIn(b.items).flatMap((g) => g.items)).find((x) => x.v)?.v ?? "x";
  const x = rng.pick([-3, -2, -1, 2, 3, 4]);
  const env = { [v]: x };
  const value = valueAt(b.items, env);
  const { frames, result } = solveLong(b.items);
  const xs = (l: "en" | "de") => num(x, l);

  const mistakes: Mistake[] = [];
  const add = (w: number, title: Text, say: Text) => {
    if (w === value || mistakes.some((m) => m.when.kind === "number" && m.when.value === w)) return;
    mistakes.push({ when: { kind: "number", value: w }, title, say });
  };
  for (const s of slipsFor(b.items)) add(valueAt(slipResult(b.items, s.rule), env), s.title, s.say);
  const solution: Frame[] = [
    ...frames,
    {
      math: txMap((_, l) => `${insertedSrc(result, env, l)} = ${num(value, l)}`),
      note: tx(`Now insert $${v} = ${xs("en")}$ into the simplified term.`, `Jetzt setzt du $${v} = ${xs("de")}$ in den vereinfachten Term ein.`),
    },
    {
      math: txMap((_, l) => `${insertedSrc(b.items, env, l)} = ${num(value, l)}`),
      note: tx(`Inserting into the start term gives $${num(value, "en")}$ too. That's also the check for the simplification.`, `Setzt du in den Anfangsterm ein, kommt auch $${num(value, "de")}$ heraus. Das ist gleichzeitig die Probe für das Vereinfachen.`),
    },
  ];
  return {
    instruction: tx("Work out the value of the term", "Berechne den Wert des Terms"),
    text: tx(`Insert $${v} = ${xs("en")}$.`, `Setz $${v} = ${xs("de")}$ ein.`),
    math: show(b.items, false),
    answer: { kind: "number", value },
    hint: tx("Simplify first, then insert. Or insert straight away and work out the brackets first.", "Erst vereinfachen, dann einsetzen. Oder gleich einsetzen und zuerst die Klammern ausrechnen."),
    solution,
    mistakes,
  };
}

/** Which result is correct? Options from typical slips. */
function whichTask(rng: Rng): Exercise {
  for (;;) {
    const b = build(rng, () => rng.pick([leadBracket, numberBracket, twoBrackets, nested])(rng));
    const right = solveLong(b.items).result;
    const letter = right.find((x) => x.v)?.v ?? "x";
    const cands: { items: LT[]; title?: Text; say?: Text }[] = [{ items: right }, ...slipsFor(b.items).map((s) => ({ items: slipResult(b.items, s.rule), title: s.title, say: s.say }))];
    const at = right.findIndex((x) => !x.v);
    if (at >= 0) cands.push({ items: right.map((x, i) => (i === at ? { ...x, c: -x.c } : x)), title: tx("Sign slip when combining", "Vorzeichenfehler beim Zusammenfassen"), say: tx("The brackets are fine, but check the signs when you combine the like terms.", "Die Klammern stimmen, aber prüf die Vorzeichen beim Zusammenfassen.") });
    const opts: typeof cands = [];
    for (const c of cands) if (c.items.some((x) => x.v) && !opts.some((o) => equivalentText(answerText(o.items), answerText(c.items)))) opts.push(c);
    if (opts.length < 4) continue;
    const pick = [0, ...rng.shuffle(opts.slice(1).map((_, i) => i + 1)).slice(0, 3)];
    const order = rng.shuffle(pick);
    const options = order.map((i) => inline(opts[i].items));
    const mistakes: Mistake[] = [];
    order.forEach((i, k) => {
      const o = opts[i];
      if (i !== 0 && o.say) mistakes.push({ when: { kind: "choice", options, correct: k }, title: o.title, say: o.say });
    });
    return {
      instruction: tx("Which result is correct?", "Welches Ergebnis ist richtig?"),
      math: show(b.items, false),
      answer: { kind: "choice", options, correct: order.indexOf(0) },
      hint: tx(`Simplify it yourself, or insert a number like $${letter} = 2$ into the term and into each option.`, `Vereinfache selbst oder setz eine Zahl wie $${letter} = 2$ in den Term und in jede Antwort ein.`),
      solution: solveLong(b.items).frames,
      mistakes,
    };
  }
}

type MSlip = "onlyFirst" | "signSlip" | "pbl" | "combine" | "none";

const MSLIP_OPTION: Record<MSlip, Text> = {
  onlyFirst: tx("Step 1: the factor was not multiplied by every term.", "Schritt 1: Der Faktor wurde nicht mit jedem Term multipliziert."),
  // "the absolute value is right" keeps this apart from onlyFirst, where the unmultiplied term can have the wrong sign too.
  signSlip: tx("Step 1: a product has the wrong sign (its absolute value is right).", "Schritt 1: Ein Produkt hat das falsche Vorzeichen (der Betrag stimmt)."),
  pbl: tx("Step 1: point before line was ignored.", "Schritt 1: Punkt vor Strich wurde nicht beachtet."),
  combine: tx("Step 2: the like terms were combined wrongly.", "Schritt 2: Die gleichartigen Terme wurden falsch zusammengefasst."),
  none: tx("There is no mistake.", "Es gibt keinen Fehler."),
};

const NAMES = ["Tom", "Lea", "Mia", "Ben", "Emma", "Paul", "Finn", "Lena", "Noah", "Anna", "Jonas", "Elif"];

/** A student's two-step working with one typical slip (or none): find it. */
function mistakeTask(rng: Rng): Exercise {
  for (;;) {
    const slip = rng.pick<MSlip>(["onlyFirst", "signSlip", "signSlip", "pbl", "combine", "none"]);
    const b = slip === "pbl" ? numberBracket(rng) : rng.chance(0.7) ? leadBracket(rng, false) : numberBracket(rng);
    const items = b.items.slice(0, 2);
    const g = items[1] as LG;
    const right = solveLong(items).result;
    if (!right.some((x) => x.v) || right.length < 2) continue;
    let step1: LN[];
    if (slip === "pbl") {
      const p = pointBeforeLine(items);
      if (!p) continue;
      step1 = p;
    } else step1 = [items[0], ...termsOf(g.items).map((x, j) => ({ ...x, c: slip === "onlyFirst" && j > 0 ? x.c : slip === "signSlip" && x.c < 0 ? -Math.abs(round(x.c * g.f)) : round(x.c * g.f) }))];
    if (slip === "signSlip" && !(g.f < 0 && termsOf(g.items).some((x) => x.c < 0))) continue;
    let step2 = slip === "pbl" ? simulate(step1, "right") : combineLike(termsOf(step1));
    if (slip === "combine") {
      const at = step2.findIndex((x) => !x.v);
      if (at < 0) continue;
      step2 = step2.map((x, i) => (i === at ? { ...x, c: -x.c } : x));
    }
    if (slip !== "none" && equivalentText(answerText(step2), answerText(right))) continue;
    if (!step2.some((x) => x.v)) continue;

    const pool = (["onlyFirst", "signSlip", "pbl", "combine", "none"] as MSlip[]).filter((k) => k !== slip && (k !== "pbl" || isConst(items[0])));
    const keys = rng.shuffle([slip, ...rng.shuffle(pool).slice(0, 3)]);
    const options = keys.map((k) => MSLIP_OPTION[k]);
    const name = rng.pick(NAMES);
    // One step per line, as in an exercise book: on a phone the break never lands in the middle of a step.
    const work = (s1: LN[], s2: LN[], mark: 0 | 1 | 2) =>
      txMap((_, l) => {
        const a = src(s1, l, false, true);
        const c = src(s2, l, false, true);
        return `${src(items, l, false, true)} \\\\ = ${mark === 1 ? `\\red{${a}}` : a} \\\\ = ${mark === 2 ? `\\red{${c}}` : c}`;
      });
    const flat = [items[0], ...termsOf(g.items).map((x) => ({ ...x, c: round(x.c * g.f) }))];
    const why: Record<MSlip, Text> = {
      onlyFirst: txMap((t, l) => t(`In step 1 the factor $${num(g.f, l)}$ only reached the first term. It multiplies **every** term in the bracket.`, `In Schritt 1 hat der Faktor $${num(g.f, l)}$ nur den ersten Term erwischt. Er wird mit **jedem** Term in der Klammer multipliziert.`)),
      signSlip: tx("In step 1 a sign went wrong: a negative factor times a negative term gives **plus**.", "In Schritt 1 ist ein Vorzeichen falsch: Ein negativer Faktor mal ein negativer Term ergibt **Plus**."),
      pbl: tx("In step 1 the subtraction came first. But point before line: the factor is multiplied with the bracket first.", "In Schritt 1 wurde zuerst subtrahiert. Aber Punkt vor Strich: Zuerst wird der Faktor mit der Klammer multipliziert."),
      combine: tx("Step 1 is right. In step 2 a sign slipped while combining.", "Schritt 1 stimmt. In Schritt 2 ist beim Zusammenfassen ein Vorzeichen verrutscht."),
      none: tx("Every step is right: each term in the bracket was multiplied by the factor with its sign, then like terms were combined.", "Jeder Schritt stimmt: Jeder Term in der Klammer wurde mit dem Faktor samt Vorzeichen multipliziert, dann wurde zusammengefasst."),
    };
    const LOOK: Record<MSlip, Text> = {
      onlyFirst: tx("Look at step 1 again: was **every** term in the bracket multiplied by the factor?", "Schau dir Schritt 1 noch mal an: Wurde **jeder** Term in der Klammer mit dem Faktor multipliziert?"),
      signSlip: tx("Check the signs in step 1: what is a negative factor times a negative number?", "Prüf die Vorzeichen in Schritt 1: Was ergibt ein negativer Faktor mal eine negative Zahl?"),
      pbl: tx("Look at step 1: was something subtracted **before** multiplying?", "Schau dir Schritt 1 an: Wurde da **vor** dem Multiplizieren subtrahiert?"),
      combine: tx("Step 1 is fine. Work out step 2 again: add up the like terms with their signs.", "Schritt 1 stimmt. Rechne Schritt 2 noch mal nach: Fasse die gleichartigen Terme mit ihren Vorzeichen zusammen."),
      none: tx("Check it once more: every step is right here. The factor reached every term with its sign, and the adding up fits too.", "Prüf noch mal nach: Hier stimmt jeder Schritt. Der Faktor hat jeden Term samt Vorzeichen erwischt, und das Zusammenfassen passt auch."),
    };
    const sayFor = (): Text => LOOK[slip];
    const mistakes: Mistake[] = [];
    keys.forEach((k, at) => {
      if (k !== slip) mistakes.push({ when: { kind: "choice", options, correct: at }, title: slip === "none" ? tx("Everything is right", "Hier stimmt alles") : k === "none" ? tx("There is a mistake", "Da steckt ein Fehler") : tx("Look at the other steps", "Schau dir die anderen Schritte an"), say: sayFor() });
    });
    return {
      instruction: tx("Find the mistake", "Finde den Fehler"),
      text: tx(`${name} simplified the term in two steps. Is there a mistake? If so, where?`, `${name} hat den Term in zwei Schritten vereinfacht. Steckt ein Fehler drin? Wenn ja, wo?`),
      math: work(step1, step2, 0),
      answer: { kind: "choice", options, correct: keys.indexOf(slip) },
      hint: tx("Do the first step yourself: multiply the factor with its sign into every term.", "Mach den ersten Schritt selbst: Multipliziere den Faktor samt Vorzeichen mit jedem Term."),
      solution: [
        { math: work(step1, step2, slip === "combine" ? 2 : slip === "none" ? 0 : 1), note: why[slip] },
        ...(slip === "none" ? [] : [{ math: work(flat, right, 0), note: txMap((t, l) => t(`Correct: $${src(items, l, false)} = ${src(right, l, false)}$.`, `Richtig ist: $${src(items, l, false)} = ${src(right, l, false)}$.`)) }]),
      ],
      mistakes,
    };
  }
}

/** 4x ☐(3x − 5) = −2x + 10: find the factor with its sign. */
function factorTask(rng: Rng): Exercise {
  for (;;) {
    const v = rng.pick(VARS);
    const a = rng.int(2, 9);
    const f = rng.chance(0.7) ? -rng.int(2, 5) : rng.int(2, 5);
    const bb = rng.int(1, 5);
    const c = nz(rng, 7);
    const vc = a + f * bb;
    if (vc === 0) continue;
    const result: LT[] = [lt("r", vc, v), lt("s", f * c)];
    const lead = src([lt("a", a, v)], "en", false);
    // The term in front, the box and the bracket stay together on a phone: "3x ☐(4x − 5)".
    const task = `\\group{${src([lt("a", a, v)], "en", false, true)} \\box{\\,?\\,} (${src([lt("b", bb, v), lt("c", c)], "en", false, true)})} = ${src(result, "en", false, true)}`;
    const mistakes: Mistake[] = [
      {
        when: { kind: "number", value: -f },
        title: tx("Sign of the factor", "Vorzeichen des Faktors"),
        say: tx(
          `Look at the number on its own: $${num(f * c, "en")}$ comes from the factor times $${c < 0 ? `(${c})` : c}$. Which sign does the factor need for that?`,
          `Schau auf die Zahl ohne Variable: $${num(f * c, "de")}$ kommt vom Faktor mal $${c < 0 ? `(${c})` : c}$. Welches Vorzeichen braucht der Faktor dafür?`,
        ),
      },
    ];
    const noLead = vc / bb;
    if (Number.isInteger(noLead) && noLead !== f && noLead !== -f) {
      mistakes.push({
        when: { kind: "number", value: noLead },
        title: tx("The front term forgotten", "Den Term davor vergessen"),
        say: tx(`Don't forget the $${lead}$ in front: $${lead}$ plus the factor times $${bb === 1 ? "" : bb}${v}$ must give $${src([result[0]], "en", false)}$.`, `Vergiss die $${lead}$ davor nicht: $${lead}$ plus Faktor mal $${bb === 1 ? "" : bb}${v}$ muss $${src([result[0]], "de", false)}$ ergeben.`),
      });
    }
    const fs = f < 0 ? `(${f})` : `${f}`;
    return {
      instruction: tx("Find the factor", "Finde den Faktor"),
      text: tx("Which factor, with its sign, belongs in the box?", "Welcher Faktor gehört mit Vorzeichen in das Kästchen?"),
      math: task,
      answer: { kind: "number", value: f },
      hint: tx("Start with the number on its own: the factor times the number in the bracket gives the number on the right.", "Fang mit der Zahl ohne Variable an: Faktor mal Zahl in der Klammer ergibt die Zahl rechts."),
      solution: [
        { math: task, note: tx("The factor multiplies both terms in the bracket. Start with the number on its own.", "Der Faktor wird mit beiden Termen in der Klammer multipliziert. Fang mit der Zahl ohne Variable an.") },
        { math: `? \\cdot ${c < 0 ? `(${c})` : c} = ${f * c} \\quad \\Rightarrow \\quad ? = ${f}`, note: tx(`$${f} \\cdot ${c < 0 ? `(${c})` : c} = ${f * c}$, so the factor is $${f}$.`, `$${f} \\cdot ${c < 0 ? `(${c})` : c} = ${f * c}$, also ist der Faktor $${f}$.`) },
        {
          math: `${lead} + ${fs} \\cdot ${bb === 1 ? "" : bb}${v} = ${src([result[0]], "en", false)}`,
          note: tx(`Check the ${v}-terms: $${lead} ${f < 0 ? "-" : "+"} ${Math.abs(f * bb)}${v} = ${src([result[0]], "en", false)}$. It fits!`, `Probe mit den ${v}-Termen: $${lead} ${f < 0 ? "-" : "+"} ${Math.abs(f * bb)}${v} = ${src([result[0]], "de", false)}$. Passt!`),
        },
      ],
      mistakes,
    };
  }
}

/** Level 2 practice: long terms with factors, values, choices, mistakes and missing factors. */
export function generate2(rng: Rng): Exercise {
  const r = rng.next();
  if (r < 0.46) return simplifyTask(rng);
  if (r < 0.6) return valueTask(rng);
  if (r < 0.73) return whichTask(rng);
  if (r < 0.87) return mistakeTask(rng);
  return factorTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const factorFrames: Frame[] = [
  { math: "4#a x#ax -#p 2#f (3#b x#bx -#s 5#c)#g", note: tx("A long term with a factor in front of the bracket: $-2$. The minus belongs to the $2$.", "Ein langer Term mit einem Faktor vor der Klammer: $-2$. Das Minus gehört zur $2$."), highlight: ["p", "f"] },
  { math: "4#a x#ax -#p 2#f (3#b x#bx -#s 5#c)#g", note: tx("$-2$ multiplies **every** term in the bracket: the $3x$ and the $-5$.", "$-2$ wird mit **jedem** Term in der Klammer multipliziert: mit $3x$ und mit $-5$."), arrows: [["f", "b"], ["f", "c"]] },
  { math: "4#a x#ax -#p 6#b x#bx +#s 10#c", note: tx("$-2 \\cdot 3x = -6x$ and $-2 \\cdot (-5) = +10$. Minus times minus gives plus!", "$-2 \\cdot 3x = -6x$ und $-2 \\cdot (-5) = +10$. Minus mal Minus ergibt Plus!"), highlight: ["p", "b", "bx", "s", "c"] },
  { math: "-#p 2#a x#ax +#s 10#c", note: tx("Combine: $4x - 6x = -2x$. Result: $-2x + 10$.", "Zusammenfassen: $4x - 6x = -2x$. Ergebnis: $-2x + 10$.") },
];

const pblFrames: Frame[] = [
  { math: "7#n -#p 2#f (x#x +#s 3#c)#g", note: tx("Tempting: first $7 - 2 = 5$. But stop!", "Verlockend: erst $7 - 2 = 5$ rechnen. Aber Stopp!"), highlight: ["n", "p", "f"] },
  {
    math: "7#n -#p 2#f (x#x +#s 3#c)#g \\ne#ne \\red{5#w (x#x2 +#s2 3#c2)#g2}",
    note: tx("Between the $2$ and the bracket hides a times sign. **Point before line**: multiply first, then subtract.", "Zwischen der $2$ und der Klammer versteckt sich ein Malzeichen. **Punkt vor Strich**: erst multiplizieren, dann subtrahieren."),
    highlight: ["ne"],
  },
  { math: "7#n -#p 2#f x#x -#s 6#c", note: tx("So $-2$ multiplies the bracket: $-2 \\cdot x = -2x$ and $-2 \\cdot 3 = -6$.", "Also wird $-2$ mit der Klammer multipliziert: $-2 \\cdot x = -2x$ und $-2 \\cdot 3 = -6$."), highlight: ["p", "f", "x", "s", "c"] },
  { math: "1#n -#p 2#f x#x", note: tx("$7 - 6 = 1$. Result: $1 - 2x$.", "$7 - 6 = 1$. Ergebnis: $1 - 2x$.") },
  {
    math: "7 - 2 \\cdot (1 + 3) = -1 \\quad \\red{5 \\cdot (1 + 3) = 20}",
    note: tx("Test with $x = 1$: the term gives $-1$, but $5(x + 3)$ gives $20$. So $5(x + 3)$ really is wrong.", "Test mit $x = 1$: Der Term ergibt $-1$, aber $5(x + 3)$ ergibt $20$. $5(x + 3)$ ist also wirklich falsch."),
  },
];

const nestedFrames: Frame[] = [
  { math: "3#f [2#a x#ax -#p (x#bx -#s 4#c)#i]#o", note: tx("Brackets inside a bracket with a factor. Work from the inside out: inner bracket first.", "Klammern in einer Klammer mit Faktor. Arbeite von innen nach außen: erst die innere Klammer."), highlight: ["i(", "i)"] },
  { math: "3#f [2#a x#ax -#p x#bx +#s 4#c]#o", note: tx("Minus in front of $(x - 4)$: drop the brackets and flip both signs.", "Minus vor $(x - 4)$: Klammern weglassen und beide Vorzeichen umdrehen."), highlight: ["p", "s"] },
  { math: "3#f [x#ax +#s 4#c]#o", note: tx("Tidy up inside first: $2x - x = x$.", "Zuerst innen zusammenfassen: $2x - x = x$.") },
  { math: "3#f [x#ax +#s 4#c]#o", note: tx("Now the factor $3$ multiplies **every** term in the square bracket.", "Jetzt wird der Faktor $3$ mit **jedem** Term in der eckigen Klammer multipliziert."), arrows: [["f", "ax"], ["f", "c"]] },
  { math: "3#f x#ax +#s 12#c", note: tx("$3 \\cdot x = 3x$ and $3 \\cdot 4 = 12$. Result: $3x + 12$.", "$3 \\cdot x = 3x$ und $3 \\cdot 4 = 12$. Ergebnis: $3x + 12$.") },
];

const varsFrames: Frame[] = [
  {
    math: dec("0.5#f (4#a a#va -#sb 6#b b#vb)#g -#p (a#vc -#sd 2#d b#vd)#h"),
    note: tx("Two letters and a decimal factor. The rules stay the same.", "Zwei Buchstaben und ein Faktor mit Komma. Die Regeln bleiben gleich."),
    arrows: [["f", "a"], ["f", "b"]],
  },
  {
    math: dec("2#a a#va -#sb 3#b b#vb -#p (a#vc -#sd 2#d b#vd)#h"),
    note: tx("$0.5 \\cdot 4a = 2a$ and $0.5 \\cdot (-6b) = -3b$.", "$0,5 \\cdot 4a = 2a$ und $0,5 \\cdot (-6b) = -3b$."),
    highlight: ["a", "sb", "b"],
  },
  { math: "2#a a#va -#sb 3#b b#vb -#p a#vc +#sd 2#d b#vd", note: tx("Minus in front of the second bracket: flip both signs.", "Minus vor der zweiten Klammer: beide Vorzeichen umdrehen."), highlight: ["p", "sd"] },
  { math: "2#a a#va -#p a#vc -#sb 3#b b#vb +#sd 2#d b#vd", note: tx("Only like terms go together: $a$ with $a$, $b$ with $b$.", "Nur gleichartige Terme gehören zusammen: $a$ zu $a$, $b$ zu $b$.") },
  { math: "a#va -#sb b#vb", note: tx("$2a - a = a$ and $-3b + 2b = -b$. Result: $a - b$.", "$2a - a = a$ und $-3b + 2b = -b$. Ergebnis: $a - b$.") },
];

const checkA: LN[] = [lt("a", 5, "x"), lg("g", -3, [lt("b", 2, "x"), lt("c", -4)])];
const checkB: LN[] = [lg("o", 2, [lt("a", 3, "x"), lg("i", -1, [lt("b", 1, "x"), lt("c", 4)])], "["), lt("d", -1, "x")];
const checkC: LN[] = [lg("g", 0.5, [lt("a", 6, "x"), lt("b", -4, "y")]), lg("h", -1, [lt("c", 1, "x"), lt("d", -3, "y")])];
const checkD: LN[] = [lg("g", 3, [lt("a", 1, "x"), lt("b", 4)]), lg("h", -2, [lt("c", 1, "x"), lt("d", -1)])];

/** Lena's claim 3(x + 4) − 2(x − 1) = x + 10, checked with x = 2. */
function lenaCheck(): Exercise {
  const env = { x: 2 };
  const value = valueAt(checkD, env);
  return {
    instruction: tx("Check by inserting", "Mach die Einsetzprobe"),
    text: tx(
      "Lena says: $3(x + 4) - 2(x - 1) = x + 10$. Insert $x = 2$ into the **left** side. What value do you get?",
      "Lena sagt: $3(x + 4) - 2(x - 1) = x + 10$. Setz $x = 2$ in die **linke** Seite ein. Welchen Wert bekommst du?",
    ),
    answer: { kind: "number", value },
    hint: tx("Brackets first: $2 + 4 = 6$ and $2 - 1 = 1$. Then multiply.", "Zuerst die Klammern: $2 + 4 = 6$ und $2 - 1 = 1$. Dann multiplizieren."),
    solution: [
      { math: "3(2 + 4) - 2(2 - 1)", note: tx("Insert $x = 2$ into the left side.", "Setz $x = 2$ in die linke Seite ein.") },
      { math: "3 \\cdot 6 - 2 \\cdot 1", note: tx("Work out the brackets first.", "Rechne zuerst die Klammern aus.") },
      { math: "18 - 2 = 16", note: tx("Point before line: $18 - 2 = 16$.", "Punkt vor Strich: $18 - 2 = 16$.") },
      { math: "2 + 10 = 12 \\ne 16", note: tx("Lena's result gives $12$, not $16$. So Lena made a mistake: $-2 \\cdot (-1) = +2$, the right result is $x + 14$.", "Lenas Ergebnis ergibt $12$, nicht $16$. Lena hat sich also verrechnet: $-2 \\cdot (-1) = +2$, richtig ist $x + 14$.") },
    ],
    mistakes: [
      { when: { kind: "number", value: 12 }, title: tx("That's Lena's side", "Das ist Lenas Seite"), say: tx("$12$ is what Lena's result $x + 10$ gives. The question asks for the **left** side, the term with the brackets.", "$12$ ergibt Lenas Ergebnis $x + 10$. Gefragt ist aber die **linke** Seite, der Term mit den Klammern.") },
      { when: { kind: "number", value: 20 }, title: tx("Sign slip", "Vorzeichen verrutscht"), say: tx("Careful: it's $3 \\cdot 6$ **minus** $2 \\cdot 1$. Brackets first, then multiply, then subtract.", "Vorsicht: Es heißt $3 \\cdot 6$ **minus** $2 \\cdot 1$. Erst die Klammern, dann multiplizieren, dann subtrahieren.") },
      {
        when: { kind: "number", value: valueAt(simulate(checkD, "onlyFirst"), env) },
        title: tx("Only the first term multiplied", "Nur der erste Term multipliziert"),
        say: tx("Looks like the factors only reached the first term in each bracket. $3(x + 4)$ is $3x + 12$, not $3x + 4$.", "Sieht so aus, als hätten die Faktoren nur den ersten Term in jeder Klammer erwischt. $3(x + 4)$ ist $3x + 12$, nicht $3x + 4$."),
      },
    ],
  };
}

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("The factor takes its sign along", "Der Faktor nimmt sein Vorzeichen mit"),
      blob: tx("Long terms look scary, but they're just level 1 with a number in front. Let's go!", "Lange Terme sehen gruselig aus, sind aber nur Stufe 1 mit einer Zahl davor. Los geht's!"),
      body: tx(
        "A number right in front of a bracket means **times**. To remove the bracket, multiply that number, **including the sign in front of it**, by every term inside.",
        "Eine Zahl direkt vor einer Klammer bedeutet **mal**. Um die Klammer aufzulösen, multiplizierst du diese Zahl **samt dem Vorzeichen davor** mit jedem Term in der Klammer.",
      ),
      frames: factorFrames,
    },
    {
      type: "explain",
      title: tx("Point before line", "Punkt vor Strich"),
      blob: tx("Here's the trap almost everyone falls into once. Not you!", "Hier kommt die Falle, in die fast jeder einmal tappt. Du nicht!"),
      body: tx(
        "In $7 - 2(x + 3)$ the $2$ belongs to the bracket. Multiplying comes before subtracting, so you must **not** work out $7 - 2$ first.",
        "In $7 - 2(x + 3)$ gehört die $2$ zur Klammer. Multiplizieren kommt vor Subtrahieren, du darfst also **nicht** zuerst $7 - 2$ rechnen.",
      ),
      frames: pblFrames,
    },
    {
      type: "widget",
      title: tx("Multiply out a long term step by step", "Lange Terme Schritt für Schritt auflösen"),
      blob: tx("You're in charge now. Pick a bracket and I'll do the multiplying!", "Jetzt bestimmst du. Such dir eine Klammer aus, und ich rechne mit!"),
      body: tx(
        "Pick a bracket and watch its factor multiply every term inside. Inner brackets come first. At the end, combine like terms: the check with a number shows that nothing changed.",
        "Wähl eine Klammer und schau zu, wie ihr Faktor jeden Term darin multipliziert. Innere Klammern kommen zuerst. Zum Schluss fasst du gleichartige Terme zusammen: Die Probe mit einer Zahl zeigt, dass sich nichts verändert hat.",
      ),
      widget: BracketStepper,
    },
    {
      type: "check",
      blob: tx("Your turn! Watch the sign of the factor.", "Du bist dran! Achte auf das Vorzeichen des Faktors."),
      exercise: simplifyExercise(checkA, tx("$-3 \\cdot 2x = -6x$ and $-3 \\cdot (-4) = +12$.", "$-3 \\cdot 2x = -6x$ und $-3 \\cdot (-4) = +12$.")),
    },
    {
      type: "explain",
      title: tx("Nested brackets with a factor", "Verschachtelte Klammern mit Faktor"),
      blob: tx("Boxes in boxes again. Open the smallest one first!", "Wieder Kisten in Kisten. Mach die kleinste zuerst auf!"),
      body: tx(
        "If a bracket sits inside a bracket, start with the **inner** one. Tidy up inside, and only then multiply the factor in front of the outer bracket.",
        "Steckt eine Klammer in einer Klammer, fängst du mit der **inneren** an. Fasse innen zusammen und multipliziere erst dann mit dem Faktor vor der äußeren Klammer.",
      ),
      frames: nestedFrames,
    },
    {
      type: "check",
      blob: tx("Inside out, then the factor. You've got this.", "Von innen nach außen, dann der Faktor. Das schaffst du."),
      exercise: simplifyExercise(checkB, HINT_NESTED),
    },
    {
      type: "explain",
      title: tx("Two letters and decimals", "Zwei Buchstaben und Dezimalzahlen"),
      blob: tx("More letters, commas in the numbers: same rules, just more to keep track of.", "Mehr Buchstaben, Kommazahlen: gleiche Regeln, nur mehr im Blick behalten."),
      body: tx(
        "Decimal factors multiply like whole numbers. With two letters, only **like terms** can be combined: $a$ with $a$, $b$ with $b$. Simplify fully: no bracket left, no like terms left.",
        "Faktoren mit Komma multiplizierst du wie ganze Zahlen. Bei zwei Buchstaben fasst du nur **gleichartige Terme** zusammen: $a$ mit $a$, $b$ mit $b$. Vereinfache vollständig: keine Klammer mehr, keine gleichartigen Terme mehr.",
      ),
      frames: varsFrames,
    },
    {
      type: "widget",
      title: tx("The check by inserting a number", "Die Einsetzprobe"),
      blob: tx("Want to know if your result is right without asking anyone? Insert a number!", "Du willst wissen, ob dein Ergebnis stimmt, ohne jemanden zu fragen? Setz eine Zahl ein!"),
      body: tx(
        "Insert the same number into the start term and into the result. A different value proves a mistake. The same value is a good sign, but test numbers like $0$ and $1$ can let mistakes slip through.",
        "Setz dieselbe Zahl in den Anfangsterm und in das Ergebnis ein. Ein anderer Wert beweist einen Fehler. Derselbe Wert ist ein gutes Zeichen, aber Testzahlen wie $0$ und $1$ lassen Fehler leicht durchrutschen.",
      ),
      widget: InsertCheck,
    },
    {
      type: "check",
      blob: tx("Two letters, one decimal factor. Keep x and y apart!", "Zwei Buchstaben, ein Faktor mit Komma. Halte x und y auseinander!"),
      exercise: simplifyExercise(checkC, tx("$0.5 \\cdot 6x = 3x$ and $0.5 \\cdot (-4y) = -2y$. Then flip the signs of the second bracket.", "$0,5 \\cdot 6x = 3x$ und $0,5 \\cdot (-4y) = -2y$. Dann drehst du die Vorzeichen der zweiten Klammer um.")),
    },
    {
      type: "check",
      blob: tx("Last one: be the teacher and check Lena's work!", "Die letzte: Sei die Lehrkraft und prüf Lenas Rechnung!"),
      exercise: lenaCheck(),
    },
  ],
  summary: [
    {
      title: tx("Factor in front", "Faktor vor der Klammer"),
      body: tx("Multiply the factor **with its sign** by every term in the bracket.", "Multipliziere den Faktor **mit seinem Vorzeichen** mit jedem Term in der Klammer."),
      examples: ["4x - 2(3x - 5) = 4x - 6x + 10 = -2x + 10"],
      tone: "rule",
    },
    {
      title: tx("Point before line", "Punkt vor Strich"),
      body: tx("The factor belongs to the bracket. Never subtract it from the number in front first.", "Der Faktor gehört zur Klammer. Zieh ihn nie zuerst von der Zahl davor ab."),
      examples: ["7 - 2(x + 3) = 7 - 2x - 6 = 1 - 2x", "7 - 2(x + 3) \\ne 5(x + 3)"],
      tone: "warning",
    },
    {
      title: tx("Nested brackets", "Verschachtelte Klammern"),
      body: tx("Inside out: inner bracket, tidy up, then the factor in front of the outer bracket.", "Von innen nach außen: innere Klammer, zusammenfassen, dann der Faktor vor der äußeren Klammer."),
      examples: ["3[2x - (x - 4)] = 3[x + 4] = 3x + 12"],
      tone: "rule",
    },
    {
      title: tx("Two letters, decimals", "Zwei Buchstaben, Dezimalzahlen"),
      body: tx("Decimals multiply like whole numbers. Combine only like terms.", "Dezimalzahlen multiplizierst du wie ganze Zahlen. Fasse nur gleichartige Terme zusammen."),
      examples: [dec("0.5(4a - 6b) - (a - 2b) = a - b")],
      tone: "tip",
    },
    {
      title: tx("Check by inserting", "Einsetzprobe"),
      body: tx("Insert the same number (not $0$ or $1$) into the start term and the result. Different values: there's a mistake.", "Setz dieselbe Zahl (nicht $0$ oder $1$) in den Anfangsterm und ins Ergebnis ein. Verschiedene Werte: Da steckt ein Fehler."),
      examples: ["x = 2: \\quad 4 \\cdot 2 - 2(3 \\cdot 2 - 5) = 6 \\quad -2 \\cdot 2 + 10 = 6"],
      tone: "tip",
    },
  ],
};
