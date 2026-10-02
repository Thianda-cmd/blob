// Blob reads the student's answer and works out what probably happened, so the feedback
// talks about *their* answer: "you expanded it, but 3x and 2x can still be combined",
// "one sign is off", "you swapped x and y". Works for every topic without extra data;
// topics add their own typical mistakes on top (Exercise.mistakes).

import { tx, type Text } from "@/i18n/text";
import type { AnswerSpec } from "@/learn/types";
import { equivalent, isExpanded, parse, toDisplay, type Ast } from "./expr";
import { difference, monoKey, monoSrc, nearly, toPoly, type Mono, type Poly } from "./poly";
import { gcd } from "./rng";

export type Diagnosis = {
  /** Short label for the feedback card, e.g. "Not simplified yet". */
  title: Text;
  /** What Blob says (rich text with $maths$). */
  say: Text;
  /** The student's own answer (display language) with the spots that matter highlighted. */
  mark?: string;
  /** Right idea, small slip: Blob is encouraging rather than puzzled. */
  close?: boolean;
};

// ---------------------------------------------------------------------------
// The student's expression, term by term, so single terms can be highlighted.

type SignedTerm = { sign: 1 | -1; ast: Ast };

function signedTerms(ast: Ast, sign: 1 | -1 = 1, out: SignedTerm[] = []): SignedTerm[] {
  if (ast.t === "add") {
    signedTerms(ast.l, sign, out);
    signedTerms(ast.r, sign, out);
  } else if (ast.t === "sub") {
    signedTerms(ast.l, sign, out);
    signedTerms(ast.r, (sign * -1) as 1 | -1, out);
  } else if (ast.t === "neg" && ast.e.t !== "add" && ast.e.t !== "sub") {
    signedTerms(ast.e, (sign * -1) as 1 | -1, out);
  } else out.push({ sign, ast });
  return out;
}

/** Variable part of a single term, or null when the term isn't a plain monomial (e.g. still has brackets). */
function termKey(term: SignedTerm): string | null {
  if (!isExpanded(term.ast)) return null;
  const p = toPoly(term.ast);
  if (!p || p.size !== 1) return p && p.size === 0 ? "" : null;
  return [...p.keys()][0];
}

type Style = "red" | "hl" | "blob";

/** Display source of the terms, with some wrapped in a highlight style. */
function renderTerms(terms: SignedTerm[], style: (t: SignedTerm, i: number) => Style | null): string {
  return terms
    .map((t, i) => {
      const body = toDisplay(t.ast, 2);
      const sign = t.sign < 0 ? "-" : i === 0 ? "" : "+";
      const s = style(t, i);
      if (s) return `${i === 0 ? "" : " \\; "}\\${s}{${sign}${body}}`;
      return i === 0 ? `${sign}${body}` : ` ${sign} ${body}`;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Wording helpers

const term = (m: Mono) => `$${monoSrc(m)}$`;

/** "the x-term" / "the number on its own". */
function partName(key: string, kase: "nom" | "acc" = "nom"): Text {
  if (key === "") return tx("the number on its own", "die Zahl ohne Variable");
  const v = key.replace(/·/g, "");
  return tx(`the $${v}$-term`, `${kase === "acc" ? "den" : "der"} $${v}$-Term`);
}

function list(items: string[], and: [string, string]): Text {
  if (items.length <= 1) return items.join("");
  const head = items.slice(0, -1).join(", ");
  return tx(`${head} ${and[0]} ${items.at(-1)}`, `${head} ${and[1]} ${items.at(-1)}`);
}
const en = (t: Text) => (typeof t === "string" ? t : t.en);
const de = (t: Text) => (typeof t === "string" ? t : t.de);

// ---------------------------------------------------------------------------
// Expressions

function diagnoseExpr(spec: Extract<AnswerSpec, { kind: "expr" }>, input: string): Diagnosis | null {
  const user = parse(input);
  const target = parse(spec.value);
  if (!user.ok || !target.ok) return null;
  const terms = signedTerms(user.ast);
  const plain = renderTerms(terms, () => null);

  if (equivalent(user.ast, target.ast, { positive: spec.positive })) {
    // Right value, wrong form.
    if (!isExpanded(user.ast)) {
      return {
        title: tx("Brackets still there", "Noch Klammern drin"),
        say: tx(
          "The value is right, nice! But there are still brackets in there. Multiply them out and you're done.",
          "Der Wert stimmt, stark! Aber da sind noch Klammern drin. Multiplizier sie aus, dann bist du fertig.",
        ),
        mark: renderTerms(terms, (t) => (isExpanded(t.ast) ? null : "hl")),
        close: true,
      };
    }
    // Like terms not combined: find the groups.
    const groups = new Map<string, SignedTerm[]>();
    for (const t of terms) {
      const k = termKey(t);
      if (k === null) continue;
      groups.set(k, [...(groups.get(k) ?? []), t]);
    }
    const repeated = [...groups.entries()].filter(([, g]) => g.length > 1);
    if (repeated.length) {
      const styleOf = new Map<SignedTerm, Style>();
      repeated.forEach(([, g], i) => g.forEach((t) => styleOf.set(t, i % 2 === 0 ? "hl" : "blob")));
      const [, first] = repeated[0];
      const shown = first.map((t) => `$${t.sign < 0 ? "-" : ""}${toDisplay(t.ast, 2)}$`);
      const names = list(shown, ["and", "und"]);
      const more = repeated.length > 1;
      return {
        title: tx("Not combined yet", "Noch nicht zusammengefasst"),
        say: tx(
          `Ooh, you multiplied it all out, nice work! But ${en(names)} are like terms, they can still team up.${more ? " And there's another pair like that." : ""}`,
          `Ooh, ausmultipliziert hast du schon, stark! Aber ${de(names)} sind gleichartig, die kannst du noch zusammenfassen.${more ? " Und da ist noch so ein Paar." : ""}`,
        ),
        mark: renderTerms(terms, (t) => styleOf.get(t) ?? null),
        close: true,
      };
    }
    return null;
  }

  // Wrong value: compare term by term.
  const U = toPoly(user.ast);
  const T = toPoly(target.ast);
  if (!U || !T) return null;
  const D = difference(U, T);
  const markKeys = (keys: Set<string>) => renderTerms(terms, (t) => (keys.has(termKey(t) ?? "\u0000") ? "red" : null));

  // Every sign flipped.
  if (U.size === T.size && [...T].every(([k, m]) => U.has(k) && nearly(U.get(k)!.c, -m.c))) {
    return {
      title: tx("Every sign flipped", "Alle Vorzeichen andersrum"),
      say: tx(
        "Whoa, every single sign is the other way round! Did a minus get applied twice somewhere?",
        "Huch, jedes Vorzeichen ist genau andersrum! Hast du irgendwo ein Minus doppelt angewendet?",
      ),
      mark: renderTerms(terms, () => "red"),
    };
  }

  // Off by a constant factor.
  const ratio = scaledBy(U, T);
  if (ratio !== null) {
    const k = Math.round(ratio * 1000) / 1000;
    const kText = String(k).replace(".", ",");
    return {
      title: tx("Off by a factor", "Um einen Faktor daneben"),
      say: tx(
        `Interesting: your answer is exactly ${String(k)} times the right one. Did you multiply or divide once too often?`,
        `Spannend: Deine Antwort ist genau das ${kText}-Fache der richtigen. Hast du einmal zu viel multipliziert oder geteilt?`,
      ),
      mark: plain,
    };
  }

  const diffs = [...D.entries()];
  const flipped = diffs.filter(([k]) => T.has(k) && U.has(k) && nearly(U.get(k)!.c, -T.get(k)!.c));

  if (diffs.length === 1) {
    const [k] = diffs[0];
    const t = T.get(k);
    const u = U.get(k);
    if (t && u && nearly(u.c, -t.c)) {
      return {
        title: tx("One sign is off", "Ein Vorzeichen stimmt nicht"),
        say: tx(
          `So close! Everything is right except one sign: look at ${term(u)} again.`,
          `Ganz knapp! Alles stimmt bis auf ein Vorzeichen: Schau dir ${term(u)} noch mal an.`,
        ),
        mark: markKeys(new Set([k])),
        close: true,
      };
    }
    if (t && !u) {
      return {
        title: tx("A term went missing", "Ein Term fehlt"),
        say: tx(
          `Almost! But ${en(partName(k))} got lost on the way. Go through your steps again and find where it went.`,
          `Fast! Aber ${de(partName(k))} ist unterwegs verloren gegangen. Geh deine Schritte noch mal durch und such ihn.`,
        ),
        mark: plain,
        close: true,
      };
    }
    if (!t && u) {
      return {
        title: tx("One term too many", "Ein Term zu viel"),
        say: tx(
          `Hmm, where does ${term(u)} come from? That one doesn't belong in the result.`,
          `Hm, woher kommt ${term(u)}? Der gehört nicht ins Ergebnis.`,
        ),
        mark: markKeys(new Set([k])),
        close: true,
      };
    }
    if (t && u) {
      return {
        title: tx("One number is off", "Eine Zahl stimmt nicht"),
        say: tx(
          `Your terms are the right ones, only the number in ${term(u)} isn't. Work out ${en(partName(k))} once more.`,
          `Deine Terme sind die richtigen, nur die Zahl bei ${term(u)} nicht. Rechne ${de(partName(k, "acc"))} noch mal nach.`,
        ),
        mark: markKeys(new Set([k])),
        close: true,
      };
    }
  }

  if (flipped.length === diffs.length && flipped.length >= 2) {
    return {
      title: tx("Some signs are off", "Ein paar Vorzeichen stimmen nicht"),
      say: tx(
        `The numbers are right, but ${flipped.length} signs aren't. Check the signs of the highlighted terms.`,
        `Die Zahlen stimmen, aber ${flipped.length} Vorzeichen nicht. Prüf die Vorzeichen der markierten Terme.`,
      ),
      mark: markKeys(new Set(flipped.map(([k]) => k))),
      close: true,
    };
  }

  const missing = diffs.filter(([k]) => T.has(k) && !U.has(k));
  if (missing.length && missing.length === diffs.length) {
    const names = missing.map(([k]) => (k === "" ? tx("the number", "die Zahl") : tx(`$${k.replace(/·/g, "")}$`, `$${k.replace(/·/g, "")}$`)));
    return {
      title: tx("Some terms are missing", "Da fehlen Terme"),
      say: tx(
        `What you have is right, but some terms are missing: ${en(list(names.map(en), ["and", "und"]))}. Did one of the products get skipped?`,
        `Was da steht, stimmt, aber es fehlen Terme: ${de(list(names.map(de), ["and", "und"]))}. Ist ein Produkt unter den Tisch gefallen?`,
      ),
      mark: plain,
    };
  }

  // Same terms everywhere, several numbers off.
  const sameShape = U.size === T.size && [...T.keys()].every((k) => U.has(k));
  if (sameShape) {
    const off = new Set(diffs.map(([k]) => k));
    return {
      title: tx("Some numbers are off", "Ein paar Zahlen stimmen nicht"),
      say: tx(
        "The shape is right, every term is there! But the numbers in the highlighted ones aren't. Recalculate those.",
        "Der Aufbau stimmt, alle Terme sind da! Aber die Zahlen in den markierten stimmen nicht. Rechne die noch mal nach.",
      ),
      mark: markKeys(off),
    };
  }
  return null;
}

/** U = k·T for a constant k ≠ ±1? */
function scaledBy(U: Poly, T: Poly): number | null {
  if (U.size !== T.size || T.size === 0) return null;
  let k: number | null = null;
  for (const [key, m] of T) {
    const u = U.get(key);
    if (!u) return null;
    const r = u.c / m.c;
    if (k === null) k = r;
    else if (!nearly(r, k)) return null;
  }
  if (k === null || nearly(k, 1) || nearly(k, -1) || nearly(k, 0)) return null;
  return k;
}

// ---------------------------------------------------------------------------
// Numbers

const fmtNum = (v: number) => String(Math.round(v * 1e6) / 1e6).replace(".", ",");

export function diagnoseNumber(value: number, target: number): Diagnosis | null {
  if (target !== 0 && nearly(value, -target)) {
    return {
      title: tx("Wrong sign", "Falsches Vorzeichen"),
      say: tx("So close! The number is right, just the sign isn't.", "Ganz knapp! Die Zahl stimmt, nur das Vorzeichen nicht."),
      close: true,
    };
  }
  for (const k of [1, 2, 3, -1, -2, -3]) {
    if (target !== 0 && nearly(value, target * 10 ** k)) {
      const hundred = Math.abs(k) === 2;
      return {
        title: tx("Decimal point slipped", "Komma verrutscht"),
        say: hundred
          ? tx(
              "Your digits are right, but it's 100 times off. Percent means per hundred: did you forget to divide (or multiply) by 100?",
              "Deine Ziffern stimmen, aber es ist 100-mal daneben. Prozent heißt „von Hundert“: Hast du vergessen, durch 100 zu teilen (oder mal 100 zu rechnen)?",
            )
          : tx("Your digits are right, but the decimal point slipped. Check the place value.", "Deine Ziffern stimmen, aber das Komma ist verrutscht. Prüf die Stellenwerte."),
        close: true,
      };
    }
  }
  if (target !== 0 && Math.abs(target) !== 1 && nearly(value * target, 1)) {
    return {
      title: tx("Upside down", "Kehrwert erwischt"),
      say: tx(
        "Looks like you got it upside down: that's 1 divided by the answer. Did you divide the wrong way round?",
        "Sieht so aus, als hättest du es umgedreht: Das ist 1 geteilt durch die Lösung. Hast du andersrum geteilt?",
      ),
    };
  }
  const rel = Math.abs(value - target) / Math.max(1e-9, Math.abs(target));
  if (rel < 0.02 && !nearly(value, target)) {
    return {
      title: tx("Very close", "Ganz nah dran"),
      say: tx(
        `Really close! ${fmtNum(value)} is almost it. Did you round too early? Keep more decimals until the very end.`,
        `Echt nah dran! ${fmtNum(value)} ist fast richtig. Hast du zu früh gerundet? Rechne bis zum Schluss mit mehr Nachkommastellen.`,
      ),
      close: true,
    };
  }
  if (Number.isInteger(value) && Number.isInteger(target) && Math.abs(target) >= 3 && Math.abs(value - target) === 1) {
    return {
      title: tx("Just one off", "Um eins daneben"),
      say: tx("Just 1 away! Count once more, carefully.", "Nur 1 daneben! Zähl noch mal ganz in Ruhe nach."),
      close: true,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fractions, solutions, inequalities, pairs

export function diagnoseFraction(n: number, d: number, spec: Extract<AnswerSpec, { kind: "fraction" }>): Diagnosis | null {
  const target = spec.n / spec.d;
  const value = n / d;
  if (nearly(value, target) && spec.mustReduce) {
    const g = Math.abs(gcd(n, d));
    return {
      title: tx("Can still be simplified", "Lässt sich noch kürzen"),
      say: tx(
        `Right value, well done! But $\\frac{${n}}{${d}}$ can still be simplified: top and bottom are both divisible by ${g}.`,
        `Richtiger Wert, gut gemacht! Aber $\\frac{${n}}{${d}}$ kannst du noch kürzen: Zähler und Nenner sind beide durch ${g} teilbar.`,
      ),
      mark: `\\frac{\\hl{${n}}}{\\hl{${d}}}`,
      close: true,
    };
  }
  if (nearly(d / n, target)) {
    return {
      title: tx("Top and bottom swapped", "Zähler und Nenner vertauscht"),
      say: tx("Ha, the right numbers, but upside down! Swap numerator and denominator.", "Ha, die richtigen Zahlen, aber auf dem Kopf! Tausch Zähler und Nenner."),
      mark: `\\frac{\\red{${n}}}{\\red{${d}}}`,
      close: true,
    };
  }
  if (target !== 0 && nearly(value, -target)) {
    return {
      title: tx("Wrong sign", "Falsches Vorzeichen"),
      say: tx("The size is right, but the sign isn't. Positive or negative?", "Der Betrag stimmt, aber das Vorzeichen nicht. Positiv oder negativ?"),
      close: true,
    };
  }
  return diagnoseNumber(value, target) ?? null;
}

export function diagnoseSolutions(got: number[], want: number[], variable: string): Diagnosis | null {
  const has = (list: number[], v: number) => list.some((x) => nearly(x, v) || Math.abs(x - v) < 1e-4);
  const right = got.filter((g) => has(want, g));
  const wrong = got.filter((g) => !has(want, g));
  if (want.length && got.length === want.length && got.every((g) => has(want, -g)) && !got.every((g) => has(want, g))) {
    return {
      title: tx("Signs flipped", "Vorzeichen vertauscht"),
      say: tx(
        "The numbers are right, but the signs aren't. Look for the step where a minus got lost.",
        "Die Zahlen stimmen, aber die Vorzeichen nicht. Such den Schritt, in dem ein Minus verloren gegangen ist.",
      ),
      close: true,
    };
  }
  if (right.length && wrong.length) {
    const w = wrong[0];
    return {
      title: tx("One value doesn't fit", "Ein Wert passt nicht"),
      say: tx(
        `$${variable} = ${fmtNum(right[0])}$ works, nice! But try putting $${variable} = ${fmtNum(w)}$ back in: it doesn't come out right.`,
        `$${variable} = ${fmtNum(right[0])}$ passt, super! Aber setz mal $${variable} = ${fmtNum(w)}$ ein: Das geht nicht auf.`,
      ),
      close: true,
    };
  }
  if (want.length === 1 && got.length === 2 && right.length === 2) {
    return {
      title: tx("Only one solution", "Nur eine Lösung"),
      say: tx("Both your values are the same number here: there's just one solution.", "Deine beiden Werte sind hier dieselbe Zahl: Es gibt nur eine Lösung."),
      close: true,
    };
  }
  if (right.length && right.length < want.length && !wrong.length) {
    return {
      title: tx("One more to find", "Eine fehlt noch"),
      say: tx(
        `$${variable} = ${fmtNum(right[0])}$ is right! But there's a second solution hiding. Don't forget the $\\pm$.`,
        `$${variable} = ${fmtNum(right[0])}$ stimmt! Aber da versteckt sich noch eine zweite Lösung. Denk an das $\\pm$.`,
      ),
      close: true,
    };
  }
  if (want.length === 1 && got.length === 1) return diagnoseNumber(got[0], want[0]);
  return null;
}

const MIRROR: Record<string, string> = { "<": ">", ">": "<", "≤": "≥", "≥": "≤" };
const STRICT: Record<string, string> = { "<": "≤", "≤": "<", ">": "≥", "≥": ">" };

export function diagnoseInequality(op: string, value: number, spec: Extract<AnswerSpec, { kind: "inequality" }>): Diagnosis | null {
  const v = spec.variable;
  if (nearly(value, spec.value)) {
    if (op === MIRROR[spec.op]) {
      return {
        title: tx("Sign points the wrong way", "Zeichen zeigt falsch herum"),
        say: tx(
          "The boundary is right! But the sign points the wrong way. Did you multiply or divide by a negative number? Then it has to flip.",
          "Die Grenze stimmt! Aber das Zeichen zeigt in die falsche Richtung. Hast du mit einer negativen Zahl multipliziert oder durch sie geteilt? Dann muss es sich umdrehen.",
        ),
        mark: `${v} \\red{${op}} ${fmtNum(value)}`,
        close: true,
      };
    }
    if (op === STRICT[spec.op]) {
      return {
        title: tx("Boundary in or out?", "Grenze dabei oder nicht?"),
        say: tx(
          "Nearly! Does the boundary itself belong to the solution? That's the difference between $<$ and $\\le$.",
          "Fast! Gehört die Grenze selbst zur Lösung? Das ist der Unterschied zwischen $<$ und $\\le$.",
        ),
        mark: `${v} \\red{${op}} ${fmtNum(value)}`,
        close: true,
      };
    }
  }
  if (spec.value !== 0 && nearly(value, -spec.value)) {
    return {
      title: tx("Boundary has the wrong sign", "Grenze mit falschem Vorzeichen"),
      say: tx("The boundary number has the wrong sign. Check your last step.", "Die Grenzzahl hat das falsche Vorzeichen. Prüf deinen letzten Schritt."),
      mark: `${v} ${op} \\red{${fmtNum(value)}}`,
      close: true,
    };
  }
  return null;
}

export function diagnosePair(a: number, b: number, spec: Extract<AnswerSpec, { kind: "pair" }>): Diagnosis | null {
  const [x, y] = spec.values;
  const [n0, n1] = spec.names;
  const name = (t: Text, lang: "en" | "de") => {
    const s = lang === "en" ? en(t) : de(t);
    return s.length <= 2 ? `$${s}$` : s;
  };
  if (nearly(a, y) && nearly(b, x) && !nearly(x, y)) {
    return {
      title: tx("Swapped", "Vertauscht"),
      say: tx(
        `Ha, the right numbers, just swapped! ${name(n0, "en")} and ${name(n1, "en")} are the other way round.`,
        `Ha, die richtigen Zahlen, nur vertauscht! ${name(n0, "de")} und ${name(n1, "de")} sind genau andersrum.`,
      ),
      close: true,
    };
  }
  if (nearly(a, x) !== nearly(b, y)) {
    const [ok, notOk] = nearly(a, x) ? [n0, n1] : [n1, n0];
    return {
      title: tx("One is right", "Einer stimmt"),
      say: tx(
        `${name(ok, "en")} is right! Now check ${name(notOk, "en")} once more, e.g. by putting both back in.`,
        `${name(ok, "de")} stimmt! Jetzt prüf ${name(notOk, "de")} noch mal, z. B. indem du beide wieder einsetzt.`,
      ),
      close: true,
    };
  }
  return null;
}

export { diagnoseExpr };
