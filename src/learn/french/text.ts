import { tx, type Text } from "@/i18n/text";
import type { Lang, Word } from "./types";

// Reading what a student wrote: forgiving where it doesn't matter (case, punctuation, spaces,
// "don't" or "do not"), clear where it does (accents, articles, j'/je). Blob explains the
// difference instead of just saying "wrong".

type Target = "fr" | Lang;

const QUOTES = /[’‘`´ʼ]/g;
const MARKS = /[«»"“”„.,!?;:¡¿…()]/g;

/** Lowercase, plain apostrophes, no punctuation, single spaces; hyphens count as spaces. */
export function norm(s: string): string {
  return s
    .normalize("NFC")
    .replace(QUOTES, "'")
    .toLowerCase()
    .replace(MARKS, " ")
    .replace(/\s*'\s*/g, "'")
    .replace(/[-‐–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EN_CONTRACTIONS: [RegExp, string][] = [
  [/\bi'm\b/g, "i am"],
  [/\b(you|we|they)'re\b/g, "$1 are"],
  [/\b(he|she|it|that|what|where|who|there|here)'s\b/g, "$1 is"],
  [/\blet's\b/g, "let us"],
  [/\b(i|you|we|they)'ve\b/g, "$1 have"],
  [/\b(i|you|he|she|it|we|they)'ll\b/g, "$1 will"],
  [/\b(i|you|he|she|it|we|they)'d\b/g, "$1 would"],
  [/\bcan't\b/g, "can not"],
  [/\bcannot\b/g, "can not"],
  [/\bwon't\b/g, "will not"],
  [/\b(is|are|was|were|do|does|did|has|have|had|could|would|should)n't\b/g, "$1 not"],
  [/\bokay\b/g, "ok"],
];

/** The form answers are compared in: norm, plus English contractions written out. */
export function canon(s: string, lang: Target): string {
  let out = norm(s);
  if (lang === "en") for (const [re, to] of EN_CONTRACTIONS) out = out.replace(re, to);
  return out;
}

/**
 * Without accents and apostrophes (German umlauts as ae/oe/ue, so "Aepfel" matches "Äpfel";
 * "m appelle" matches "m'appelle", "gehts" matches "geht's").
 */
export function fold(s: string, lang: Target): string {
  let out = canon(s, lang);
  if (lang === "de") out = out.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  out = lang === "fr" ? out.replace(/'/g, " ").replace(/\s+/g, " ") : out.replace(/'/g, "");
  return out
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Edit distance between two short strings. */
export function lev(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const keep = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = keep;
    }
  }
  return prev[b.length];
}

export type Verdict = "correct" | "accent" | "typo" | "wrong";

export type Grade = {
  verdict: Verdict;
  /** The accepted answer closest to what was written (shown as the solution). */
  best: string;
  /** For each word of `best` (split at spaces, as shown): whether to highlight it. */
  marks: boolean[];
};

const words = (s: string) => (s ? s.split(" ") : []);

/** Small typos only: same number of words, at most one or two letters off in longer words. */
function typoOnly(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  let budget = Math.max(1, Math.floor(b.join("").length / 14));
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const d = lev(a[i], b[i]);
    // Short words ("le", "la", "un", "mon") are grammar, not typos.
    if (b[i].length < 4 || d > (b[i].length >= 8 ? 2 : 1)) return false;
    budget -= d;
    if (budget < 0) return false;
  }
  return true;
}

/**
 * Which words of `best` (as shown: split at spaces) the answer doesn't have. `exact`: compare with
 * accents and apostrophes (for spelling notes); otherwise ignore them.
 */
export function tokenMarks(answer: string, best: string, lang: Target, exact: boolean): boolean[] {
  const key = (t: string) => (exact ? canon(t, lang) : fold(t, lang)).replace(/\s/g, "");
  const have = new Set(answer.split(/\s+/).map(key));
  // "m appelle" written as two words still counts for "m'appelle".
  const joined = key(answer);
  return best.split(/\s+/).map((t) => {
    const k = key(t);
    return k.length > 0 && !have.has(k) && !(exact ? false : joined.includes(k));
  });
}

/** Grade a written (or tile-built) answer against the accepted ones. The first accepted is the main one. */
export function grade(answer: string, accepted: string[], lang: Target): Grade {
  const a = canon(answer, lang);
  const af = fold(answer, lang);
  for (const acc of accepted) if (canon(acc, lang) === a) return { verdict: "correct", best: acc, marks: [] };
  for (const acc of accepted) if (fold(acc, lang) === af) return { verdict: "accent", best: acc, marks: tokenMarks(answer, acc, lang, true) };
  const aw = words(af);
  for (const acc of accepted) {
    if (typoOnly(aw, words(fold(acc, lang)))) return { verdict: "typo", best: acc, marks: tokenMarks(answer, acc, lang, true) };
  }
  // Wrong: show the accepted answer that is closest, with what was missing highlighted.
  let best = accepted[0];
  let bestScore = Infinity;
  for (const acc of accepted) {
    const score = lev(af, fold(acc, lang));
    if (score < bestScore) {
      bestScore = score;
      best = acc;
    }
  }
  return { verdict: "wrong", best, marks: tokenMarks(answer, best, lang, false) };
}

/* -------------------------------------------------------------------------------------------
   Tiles
   ------------------------------------------------------------------------------------------- */

/** Names and words that keep their capital letter on a tile. */
const PROPER = new Set([
  "Blob", "Léa", "Hugo", "Martin", "Paris", "Lyon", "Marseille", "Nice", "France", "Berlin", "Allemagne", "Madame", "Monsieur",
  "I", "French", "German", "English", "France", "Germany", "Mrs", "Mr", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
]);

/** German words that start sentences but are written small inside them. */
const DE_SMALL = new Set(
  "ich du er sie es wir ihr das der die den dem des ein eine einen einem einer wie was wo woher wohin wer wann warum ja nein hallo guten gute gut danke bitte tschüss auf und aber oder mein meine dein deine sein seine ihre unser euer ist bin bist sind seid hat habe hast haben heißt heiße heißen kommst komme kommt magst mag mögen isst esse trinke trinkst trinkt gibt nicht kein keine sehr zum im am um in mit für aus zu von bei nach sehr schon noch hier dort heute morgen jetzt man was's".split(" "),
);

/** The words of a sentence as tiles: no punctuation, the first word small unless it's a name. */
export function tilesOf(sentence: string, lang: Target): string[] {
  const parts = sentence.replace(QUOTES, "'").replace(MARKS, " ").split(/\s+/).filter(Boolean);
  return parts.map((t, i) => {
    if (i > 0 || PROPER.has(t)) return t;
    const small = t.charAt(0).toLowerCase() + t.slice(1);
    if (lang === "de") return DE_SMALL.has(small.toLowerCase()) ? small : t;
    return small;
  });
}

/* -------------------------------------------------------------------------------------------
   What Blob says about a mistake
   ------------------------------------------------------------------------------------------- */

const ELIDE: Record<string, string> = { je: "j'", le: "l'", la: "l'", ne: "n'", de: "d'", que: "qu'", me: "m'", te: "t'", se: "s'" };
const VOWEL = /^[aeiouyhàâéèêëîïôûœ]/;
const ARTICLES = new Set(["le", "la", "l'", "les", "un", "une", "du", "des", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "ce", "cette"]);

/** Nouns of the course by their bare form ("pomme" → the word), for gender hints. */
export function nounIndex(words: Word[]): Map<string, Word> {
  const map = new Map<string, Word>();
  for (const w of words) {
    if (w.kind !== "noun") continue;
    const bare = norm(w.fr).replace(/^(le|la|les|un|une|l')\s*/, "").replace(/^l'/, "");
    map.set(fold(bare, "fr"), w);
  }
  return map;
}

/**
 * Blob's explanation of a wrong French answer, when there is a typical reason: a missing
 * elision (je ai → j'ai), the wrong article for a noun's gender, half a negation. Null otherwise.
 */
export function explainFrench(answer: string, best: string, nouns: Map<string, Word>): Text | null {
  const a = words(canon(answer, "fr"));
  const b = words(canon(best, "fr"));

  // je ai, le ami, ne est…: French drops the vowel before another vowel.
  for (let i = 0; i < a.length - 1; i++) {
    const short = ELIDE[a[i]];
    if (short && VOWEL.test(a[i + 1])) {
      const right = `${short}${a[i + 1]}`;
      return tx(
        `Before a vowel, **${a[i]}** shrinks to **${short}**: it's **${right}**, not "${a[i]} ${a[i + 1]}".`,
        `Vor einem Vokal wird **${a[i]}** zu **${short}**: Es heißt **${right}**, nicht „${a[i]} ${a[i + 1]}“.`,
      );
    }
  }

  // ne … pas: both parts.
  const neg = (w: string[]) => ({ ne: w.some((x) => x === "ne" || x.startsWith("n'")), pas: w.includes("pas") });
  const na = neg(a);
  const nb = neg(b);
  if (nb.ne && nb.pas && na.ne !== na.pas) {
    return tx(
      "French says no in two parts that go around the verb: **ne** … **pas**. Je **ne** parle **pas**.",
      "Französisch verneint mit zwei Teilen um das Verb herum: **ne** … **pas**. Je **ne** parle **pas**.",
    );
  }

  // One article or possessive swapped (la/le, un/une, mon/ma): the noun's gender.
  if (a.length === b.length) {
    const diffs = b.map((w, i) => (w !== a[i] ? i : -1)).filter((i) => i >= 0);
    if (diffs.length === 1) {
      const i = diffs[0];
      if (ARTICLES.has(a[i]) && ARTICLES.has(b[i])) {
        const noun = nouns.get(fold(b[i + 1] ?? "", "fr")) ?? nouns.get(fold(b[i].replace(/^l'/, ""), "fr"));
        if (noun?.g) {
          const name = norm(noun.fr).replace(/^(le|la|les|un|une)\s+/, "").replace(/^l'/, "");
          return noun.g === "f"
            ? tx(`**${name}** is feminine, so it's **${b[i]}**, not "${a[i]}".`, `**${name}** ist weiblich, darum **${b[i]}** und nicht „${a[i]}“.`)
            : tx(`**${name}** is masculine, so it's **${b[i]}**, not "${a[i]}".`, `**${name}** ist männlich, darum **${b[i]}** und nicht „${a[i]}“.`);
        }
        return tx(`Check the little word in front: **${b[i]}**, not "${a[i]}".`, `Achte auf das kleine Wort davor: **${b[i]}**, nicht „${a[i]}“.`);
      }
    }
  }
  return null;
}

/** The words whose accents or apostrophes were missing or wrong, for "watch the spelling: été, m'appelle". */
export function accentWords(answer: string, best: string, lang: Target = "fr"): string[] {
  const a = new Set(words(canon(answer, lang)));
  return words(canon(best, lang)).filter((w) => !a.has(w));
}
