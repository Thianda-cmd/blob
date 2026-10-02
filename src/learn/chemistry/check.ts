// Checking and diagnosing chemistry answers: formulas, balanced equations, names and
// select-all-that-apply. Like the maths checker, a wrong answer gets Blob's reading of
// what probably happened ("the 2 belongs to the whole OH group", "count the O atoms").

import { resolveText, tx, type Text } from "@/i18n/text";
import type { Feedback } from "@/learn/types";
import { gcdAll, parseEquation, parseFormula, sameCounts, unbalanced, type Counts } from "./formula";

// ---------------------------------------------------------------------------
// Formulas

const fmtCounts = (c: Counts) =>
  Object.entries(c)
    .map(([el, n]) => `${el}${n === 1 ? "" : n}`)
    .join("");

export function checkFormula(target: string, input: string): Feedback {
  const user = parseFormula(input);
  if (!user.ok) return { correct: false, message: user.error };
  const want = parseFormula(target);
  if (!want.ok) return { correct: false, message: tx("This exercise has a typo. Skip it.", "Diese Aufgabe hat einen Fehler. Überspring sie.") };
  const u = user.species;
  const w = want.species;
  if (sameCounts(u.counts, w.counts) && u.charge === w.charge) return { correct: true };
  return { correct: false, ...diagnoseFormula(target, input) };
}

function diagnoseFormula(target: string, input: string): Omit<Feedback, "correct"> {
  const u = parseFormula(input);
  const w = parseFormula(target);
  if (!u.ok || !w.ok) return {};
  const uc = u.species.counts;
  const wc = w.species.counts;
  const mark = `\\ce{${u.species.text}}`;
  const elsU = Object.keys(uc).sort().join();
  const elsW = Object.keys(wc).sort().join();

  if (sameCounts(uc, wc)) {
    return {
      title: tx("Check the charge", "Prüf die Ladung"),
      message: tx("The atoms are exactly right! Only the charge isn't. How many electrons were given or taken?", "Die Atome stimmen genau! Nur die Ladung nicht. Wie viele Elektronen wurden abgegeben oder aufgenommen?"),
      mark,
      partial: true,
    };
  }
  // Brackets forgotten: Ca(OH)2 typed as CaOH2.
  if (/\(/.test(target)) {
    const flat = parseFormula(target.replace(/[()]/g, ""));
    if (flat.ok && sameCounts(flat.species.counts, uc)) {
      return {
        title: tx("Brackets missing", "Klammern fehlen"),
        message: tx(
          "Brackets! The small number after a group belongs to the **whole** group, so the group needs brackets around it.",
          "Klammern! Die kleine Zahl hinter einer Gruppe gilt für die **ganze** Gruppe, also braucht die Gruppe Klammern drumherum.",
        ),
        mark,
        partial: true,
      };
    }
  }
  if (elsU === elsW) {
    // Same elements: a multiple of the right ratio?
    const ratios = Object.keys(wc).map((k) => uc[k] / wc[k]);
    if (ratios.every((r) => r === ratios[0]) && Number.isInteger(ratios[0]) && ratios[0] > 1) {
      return {
        title: tx("Not the smallest ratio", "Nicht das kleinste Verhältnis"),
        message: tx(
          `The ratio is right! But a formula uses the smallest whole numbers: all your numbers can be divided by ${ratios[0]}.`,
          `Das Verhältnis stimmt! Aber in einer Formel stehen die kleinsten ganzen Zahlen: Alle deine Zahlen lassen sich durch ${ratios[0]} teilen.`,
        ),
        mark,
        partial: true,
      };
    }
    return {
      title: tx("Ratio isn't right", "Verhältnis stimmt nicht"),
      message: tx(
        "The right elements, but the numbers don't fit. Think about the charges: in a salt the positive and negative charges add up to zero.",
        "Die richtigen Elemente, aber die Zahlen passen nicht. Denk an die Ladungen: In einem Salz gleichen sich positive und negative Ladungen genau aus.",
      ),
      mark,
    };
  }
  const missing = Object.keys(wc).filter((k) => !(k in uc));
  const extra = Object.keys(uc).filter((k) => !(k in wc));
  if (missing.length || extra.length) {
    return {
      title: missing.length ? tx("An element is missing", "Ein Element fehlt") : tx("One element too many", "Ein Element zu viel"),
      message: missing.length
        ? tx(`Something's missing: there's no ${missing.join(", ")} in your formula.`, `Da fehlt etwas: In deiner Formel kommt kein ${missing.join(", ")} vor.`)
        : tx(`Hmm, ${extra.join(", ")} doesn't belong in this formula.`, `Hm, ${extra.join(", ")} gehört nicht in diese Formel.`),
      mark,
    };
  }
  return { mark: `\\ce{${fmtCounts(uc)}}` };
}

// ---------------------------------------------------------------------------
// Balancing

/** Species texts of an equation, as written ("Fe", "O2", "Fe2O3"), without coefficients. */
export function equationParts(equation: string) {
  const [l, r] = equation.split(/->|→/);
  const side = (s: string) =>
    s
      .split(/\s\+\s/)
      .map((p) => p.trim().replace(/^[0-9]+\s*/, ""))
      .filter(Boolean);
  return { left: side(l), right: side(r ?? "") };
}

/** "\ce{4Fe + 3O2 -> 2Fe2O3}" (coefficient 1 left out, `blank` shows boxes instead). */
export function balanceSrc(equation: string, coefs: (number | null)[]): string {
  const { left, right } = equationParts(equation);
  const piece = (s: string, i: number) => {
    const k = coefs[i];
    return `${k && k !== 1 ? k : ""}${s}`;
  };
  return `\\ce{${left.map(piece).join(" + ")} -> ${right.map((s, i) => piece(s, left.length + i)).join(" + ")}}`;
}

export function readCoefficients(values: string[]): number[] | null {
  const out: number[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t) out.push(1);
    else if (/^[0-9]+$/.test(t) && Number(t) > 0) out.push(Number(t));
    else return null;
  }
  return out;
}

export function checkBalance(equation: string, values: string[]): Feedback {
  const coefs = readCoefficients(values);
  if (!coefs) return { correct: false, message: tx("Use whole numbers like 1, 2 or 3 (empty means 1).", "Nimm ganze Zahlen wie 1, 2 oder 3 (leer heißt 1).") };
  const eq = parseEquation(equation);
  if (!eq) return { correct: false, message: tx("This exercise has a typo. Skip it.", "Diese Aufgabe hat einen Fehler. Überspring sie.") };
  const off = unbalanced(eq, coefs);
  const mark = balanceSrc(equation, coefs);
  if (!off.length) {
    const g = gcdAll(coefs);
    if (g > 1) {
      return {
        correct: false,
        partial: true,
        title: tx("Balanced, but not the smallest", "Ausgeglichen, aber nicht minimal"),
        message: tx(
          `It's balanced, nice! But all your numbers can be divided by ${g}. Equations use the smallest whole numbers.`,
          `Ausgeglichen, stark! Aber alle deine Zahlen lassen sich durch ${g} teilen. In Reaktionsgleichungen stehen die kleinsten ganzen Zahlen.`,
        ),
        mark,
      };
    }
    return { correct: true };
  }
  const [el, l, r] = off[0];
  const more = off.length > 1;
  return {
    correct: false,
    partial: off.length === 1,
    title: tx(`${el} isn't balanced`, `${el} ist nicht ausgeglichen`),
    message: tx(
      `Let's count the ${el} atoms: ${l} on the left, ${r} on the right. ${more ? `And ${off.slice(1).map((o) => o[0]).join(", ")} don't match either. ` : ""}Change the numbers in front, never the small ones inside the formulas.`,
      `Zählen wir die ${el}-Atome: links ${l}, rechts ${r}. ${more ? `Und auch ${off.slice(1).map((o) => o[0]).join(", ")} passen nicht. ` : ""}Ändere die Zahlen davor, nie die kleinen Zahlen in den Formeln.`,
    ),
    mark,
  };
}

// ---------------------------------------------------------------------------
// Words and names

export const normWord = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[\s\-–_.,'’]/g, "");

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Every accepted spelling in both languages. */
const variants = (accept: Text[]) => accept.flatMap((t) => (typeof t === "string" ? [t] : [t.en, t.de]));

export function checkWord(accept: Text[], input: string): Feedback {
  const u = normWord(input);
  if (!u) return { correct: false, message: tx("Type your answer first.", "Gib zuerst deine Antwort ein.") };
  const all = variants(accept).map(normWord);
  if (all.includes(u)) return { correct: true };
  // One small typo in a longer word still counts.
  if (all.some((w) => w.length >= 7 && distance(u, w) <= 1)) return { correct: true };
  const near = all.find((w) => distance(u, w) <= Math.max(2, Math.floor(w.length / 5)));
  if (near) {
    return {
      correct: false,
      partial: true,
      title: tx("Almost, check the spelling", "Fast, prüf die Schreibweise"),
      message: tx("You're really close! Just the spelling isn't quite right yet.", "Du bist ganz nah dran! Nur die Schreibweise stimmt noch nicht ganz."),
    };
  }
  return { correct: false };
}

export const wordDisplay = (accept: Text[], locale: "en" | "de") => `"${resolveText(accept[0], locale)}"`;

// ---------------------------------------------------------------------------
// Select all that apply

export function checkMulti(correct: number[], picked: number[]): Feedback {
  const want = new Set(correct);
  const got = new Set(picked);
  if (!got.size) return { correct: false, message: tx("Pick at least one answer.", "Wähle mindestens eine Antwort.") };
  const missing = [...want].filter((i) => !got.has(i)).length;
  const wrong = [...got].filter((i) => !want.has(i)).length;
  if (!missing && !wrong) return { correct: true };
  if (!wrong) {
    return {
      correct: false,
      partial: true,
      title: tx("Not all of them yet", "Noch nicht alle"),
      message: tx(
        `Everything you picked is right! But ${missing === 1 ? "one more belongs" : `${missing} more belong`} to the list.`,
        `Alles, was du gewählt hast, stimmt! Aber ${missing === 1 ? "eine Antwort gehört" : `${missing} Antworten gehören`} noch dazu.`,
      ),
    };
  }
  return {
    correct: false,
    partial: wrong === 1 && !missing,
    title: wrong === 1 ? tx("One doesn't fit", "Eine passt nicht") : tx("Some don't fit", "Einige passen nicht"),
    message: missing
      ? tx("Some of your picks don't fit, and some right ones are still missing. Go through them one by one.", "Manche deiner Antworten passen nicht, und ein paar richtige fehlen noch. Geh sie einzeln durch.")
      : tx(`Almost! ${wrong === 1 ? "One of your picks doesn't" : `${wrong} of your picks don't`} belong. Which one is the odd one out?`, `Fast! ${wrong === 1 ? "Eine deiner Antworten gehört" : `${wrong} deiner Antworten gehören`} nicht dazu. Welche passt nicht?`),
  };
}
