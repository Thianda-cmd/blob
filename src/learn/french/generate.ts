import { createRng, type Rng } from "@/learn/engine/rng";
import { ALL_WORDS, wordsInSentence } from "./course";
import { norm, tilesOf } from "./text";
import type { Dialogue, Drill, Exercise, Lang, Sentence, Unit, Word } from "./types";

// Turning a unit's material into a lesson: first the new words (each shown, then checked), then
// sentences in ever-changing exercise types, the unit's grammar gaps, and the dialogue in its
// lesson. Earlier material comes back a little in every lesson, so nothing is learned only once.

export type GenOptions = {
  lang: Lang;
  seed: number;
  /** A French voice is available (listening exercises). */
  listening: boolean;
  /** Speaking exercises are on (microphone and speech recognition, not switched off). */
  speaking: boolean;
};

/** About how many steps a lesson has (new-word cards don't count). */
const LESSON_SIZE = 13;

export const targetOf = (s: Sentence, dir: "toFr" | "fromFr", lang: Lang) => (dir === "toFr" ? s.fr : s[lang]);
export const acceptedOf = (s: Sentence, dir: "toFr" | "fromFr", lang: Lang) =>
  dir === "toFr" ? [s.fr, ...(s.alt?.fr ?? []).filter((a) => fitsPrompt(a, s, lang))] : [s[lang], ...(s.alt?.[lang] ?? [])];

const TU = /(^|[\s«(-])(tu|toi|te|ton|ta|tes|t')(?=[\s,.!?;:»)]|$)|\bt'/i;
const VOUS = /(^|[\s«(-])(vous|votre|vos)(?=[\s,.!?;:»)]|$)/i;
const DU = /\b(du|dir|dich|dein\w*)\b/;
const IHR = /\b(ihr|euch|euer\w*|eure\w*|Ihnen)\b|(?<!^)\bSie\b/;

/**
 * French alternatives are written for both prompts, but "you" in English leaves tu and vous open
 * where German doesn't: for „Bist du Hugo?“ the vous form isn't right, for „Habt ihr …?“ the tu form isn't.
 */
function fitsPrompt(alt: string, s: Sentence, lang: Lang) {
  if (lang !== "de") return true;
  const du = DU.test(s.de);
  const ihr = IHR.test(s.de);
  if (du && !ihr && VOUS.test(alt) && !VOUS.test(s.fr)) return false;
  if (ihr && !du && TU.test(alt) && !TU.test(s.fr)) return false;
  return true;
}

const wordCount = (s: string) => tilesOf(s, "fr").length;

/** Tiles: the words of the answer and a few that don't belong, shuffled. */
function makeTiles(answer: string, lang: "fr" | Lang, others: string[], rng: Rng): string[] {
  const own = tilesOf(answer, lang);
  const taken = new Set(own.map((t) => t.toLowerCase()));
  const pool = rng.shuffle(others.flatMap((s) => tilesOf(s, lang))).filter((t) => {
    const k = t.toLowerCase();
    if (taken.has(k)) return false;
    taken.add(k);
    return true;
  });
  const extra = Math.min(pool.length, Math.max(2, Math.min(5, Math.round(own.length * 0.6))));
  return rng.shuffle([...own, ...pool.slice(0, extra)]);
}

/** Two other sentences of about the same length, as wrong options (never one that would also be right). */
function closeOptions(s: Sentence, pool: Sentence[], pick: (x: Sentence) => string, rng: Rng, accepted: string[]): string[] {
  const right = pick(s);
  const len = wordCount(s.fr);
  const alsoRight = new Set(accepted.map(norm));
  const others = rng
    .shuffle(pool.filter((x) => x.id !== s.id && !alsoRight.has(norm(pick(x)))))
    .sort((a, b) => Math.abs(wordCount(a.fr) - len) - Math.abs(wordCount(b.fr) - len))
    .slice(0, 2)
    .map(pick);
  return rng.shuffle([right, ...others]);
}

type Kind = "tiles-from" | "tiles-to" | "type-from" | "type-to" | "choice-from" | "choice-to" | "listen-tiles" | "listen-type" | "speak";

/** Which exercise types a lesson uses, from easy (first lesson of a unit) to harder (later ones). */
function kindsFor(stage: number, opts: GenOptions): Kind[] {
  const easy: Kind[] = ["tiles-from", "choice-from", "tiles-to", "tiles-from", "choice-to"];
  const mid: Kind[] = ["tiles-from", "tiles-to", "type-from", "choice-from", "tiles-to"];
  const hard: Kind[] = ["tiles-to", "type-from", "type-to", "tiles-from", "choice-to"];
  const base = stage <= 1 ? easy : stage === 2 ? mid : hard;
  const listen: Kind[] = opts.listening ? (stage <= 1 ? ["listen-tiles"] : ["listen-tiles", "listen-type"]) : [];
  return [...base, ...listen];
}

function sentenceExercise(s: Sentence, kind: Kind, pool: Sentence[], opts: GenOptions, rng: Rng, i: number): Exercise {
  const key = `${kind}:${s.id}:${i}`;
  const { lang } = opts;
  const others = pool.filter((x) => x.id !== s.id);
  // One-word answers make poor tiles: pick or type them instead.
  const single = wordCount(s.fr) < 2 || tilesOf(s[lang], lang).length < 2;
  switch (kind) {
    case "tiles-from":
      if (single) return { kind: "choice", key, sentence: s, dir: "fromFr", options: closeOptions(s, pool, (x) => x[lang], rng, acceptedOf(s, "fromFr", lang)) };
      return { kind: "tiles", key, sentence: s, dir: "fromFr", tiles: makeTiles(s[lang], lang, others.map((x) => x[lang]), rng) };
    case "tiles-to":
      if (single) return { kind: "choice", key, sentence: s, dir: "toFr", options: closeOptions(s, pool, (x) => x.fr, rng, acceptedOf(s, "toFr", lang)) };
      return { kind: "tiles", key, sentence: s, dir: "toFr", tiles: makeTiles(s.fr, "fr", others.map((x) => x.fr), rng) };
    case "type-from":
      return { kind: "type", key, sentence: s, dir: "fromFr" };
    case "type-to":
      return { kind: "type", key, sentence: s, dir: "toFr" };
    case "choice-from":
      return { kind: "choice", key, sentence: s, dir: "fromFr", options: closeOptions(s, pool, (x) => x[lang], rng, acceptedOf(s, "fromFr", lang)) };
    case "choice-to":
      return { kind: "choice", key, sentence: s, dir: "toFr", options: closeOptions(s, pool, (x) => x.fr, rng, acceptedOf(s, "toFr", lang)) };
    case "listen-tiles":
      return { kind: "listen", key, sentence: s, mode: "tiles", tiles: makeTiles(s.fr, "fr", others.map((x) => x.fr), rng) };
    case "listen-type":
      return { kind: "listen", key, sentence: s, mode: "type", tiles: [] };
    case "speak":
      return { kind: "speak", key, sentence: s };
  }
}

/** `count` exercise types from `kinds`, evenly mixed, never the same type twice in a row. */
function kindSequence(kinds: Kind[], count: number, rng: Rng): Kind[] {
  const out: Kind[] = [];
  while (out.length < count) {
    const round = rng.shuffle(kinds);
    if (out.length && round[0] === out[out.length - 1]) round.push(round.shift()!);
    out.push(...round);
  }
  return out.slice(0, count);
}

/** Put `extra` into `list` at evenly spread places (not first). */
function spreadIn<T>(list: T[], extra: T[]) {
  if (!extra.length) return;
  const gap = (list.length + extra.length) / (extra.length + 1);
  extra.forEach((x, i) => list.splice(Math.min(list.length, Math.max(1, Math.round(gap * (i + 1)))), 0, x));
}

/** Options in a new order, so the right one isn't always in the same place. */
function shuffled<T extends { options: O[]; answer: number }, O>(item: T, rng: Rng): T {
  const order = rng.shuffle(item.options.map((_, i) => i));
  return { ...item, options: order.map((i) => item.options[i]), answer: order.indexOf(item.answer) };
}
const blankOf = (d: Drill, rng: Rng): Exercise => ({ kind: "blank", key: `blank:${d.id}`, drill: shuffled(d, rng) });
const dialogueOf = (d: Dialogue, rng: Rng): Exercise => ({ kind: "dialogue", key: `dialogue:${d.id}`, dialogue: { ...d, questions: d.questions.map((q) => shuffled(q, rng)) } });

/** A picture question for a word with an emoji, when there are enough other pictures to choose from. */
function pictureFor(w: Word, pool: Word[], rng: Rng, i: number): Exercise | null {
  if (!w.emoji) return null;
  const others = rng.shuffle(pool.filter((x) => x.emoji && x.id !== w.id && x.emoji !== w.emoji)).slice(0, 3);
  if (others.length < 2) return null;
  return { kind: "picture", key: `picture:${w.id}:${i}`, word: w, options: rng.shuffle([w, ...others]) };
}

/**
 * The steps of lesson `n` (1-based) of `unit`. `earlier`: the units before it, for a little review
 * and for wrong options and tiles.
 */
export function lessonExercises(unit: Unit, n: number, earlier: Unit[], opts: GenOptions): Exercise[] {
  const rng = createRng(opts.seed);
  const spec = unit.lessons[n - 1];
  const unitWords = new Map(unit.words.map((w) => [w.id, w]));
  const fresh = spec.words.map((id) => unitWords.get(id)).filter((w): w is Word => !!w);
  const introduced = unit.lessons.slice(0, n).flatMap((l) => l.words).map((id) => unitWords.get(id)).filter((w): w is Word => !!w);
  const knownWords = [...earlier.flatMap((u) => u.words), ...introduced];

  const current = unit.sentences.filter((s) => s.lesson === n);
  const before = unit.sentences.filter((s) => s.lesson < n);
  const review = earlier.flatMap((u) => u.sentences);
  const pool = [...unit.sentences.filter((s) => s.lesson <= n), ...review];

  const out: Exercise[] = [];

  // 1. New words: each one shown, then (where it has a picture) picked out of a few.
  const checks: Exercise[] = [];
  fresh.forEach((w, i) => {
    out.push({ kind: "intro", key: `intro:${w.id}`, word: w });
    const pic = pictureFor(w, knownWords, rng, i);
    if (pic) checks.push(pic);
    // Show the next word, then check the one before: a little spacing helps it stick.
    if (checks.length && (i % 2 === 1 || i === fresh.length - 1)) out.push(checks.shift()!);
  });
  out.push(...checks);
  const matchable = rng.shuffle([...fresh, ...introduced.filter((w) => !fresh.includes(w)), ...earlier.flatMap((u) => u.words)]).filter(
    (w, i, all) => all.findIndex((x) => norm(x.fr) === norm(w.fr) || norm(x[opts.lang]) === norm(w[opts.lang])) === i,
  );
  if (matchable.length >= 4) out.push({ kind: "match", key: `match:${unit.slug}:${n}`, words: matchable.slice(0, 5) });

  // 2. Sentences: this lesson's, some from earlier lessons and units.
  const picked = [
    ...rng.shuffle(current),
    ...rng.shuffle(before).slice(0, n > 1 ? 3 : 0),
    ...rng.shuffle(review).slice(0, earlier.length ? 2 : 0),
  ];
  const stage = Math.min(3, n);
  const kinds = kindSequence(kindsFor(stage, opts), picked.length, rng);
  let speakLeft = opts.speaking && n >= 2 ? 1 : 0;
  const steps: Exercise[] = [];
  picked.forEach((s, i) => {
    let kind = kinds[i];
    if (speakLeft && wordCount(s.fr) <= 6 && i > 1 && rng.chance(0.35)) {
      kind = "speak";
      speakLeft--;
    }
    steps.push(sentenceExercise(s, kind, pool, opts, rng, i));
  });

  // 3. Grammar gaps of this lesson (and one from before), spread out between the sentences.
  const drills = [...rng.shuffle(unit.drills.filter((d) => d.lesson === n)).slice(0, 3), ...rng.shuffle(unit.drills.filter((d) => d.lesson < n)).slice(0, 1)];
  spreadIn(steps, drills.map((d) => blankOf(d, rng)));

  const room = Math.max(6, LESSON_SIZE - out.filter((e) => e.kind !== "intro").length);
  out.push(...steps.slice(0, room));

  // 4. The unit's story, near the end of its lesson.
  if (unit.dialogue && unit.dialogue.lesson === n) out.splice(Math.max(out.length - 2, 1), 0, dialogueOf(unit.dialogue, rng));
  return out;
}

/**
 * A practice round over what the student has learned: sentences with their weakest words first,
 * mixed exercise types, a match and a couple of grammar gaps.
 */
export function practiceExercises(units: Unit[], weak: string[], opts: GenOptions): Exercise[] {
  const rng = createRng(opts.seed);
  const words = units.flatMap((u) => u.words);
  const sentences = units.flatMap((u) => u.sentences);
  if (!sentences.length) return [];
  const weakSet = new Set(weak);
  const score = (s: Sentence) => wordsInSentence(s.fr, words).filter((w) => weakSet.has(w.id)).length;
  const ordered = rng.shuffle(sentences).sort((a, b) => score(b) - score(a));
  const picked = [...ordered.slice(0, 7), ...rng.shuffle(ordered.slice(7)).slice(0, 3)];
  const kinds = kindsFor(3, opts);
  const sequence = kindSequence(kinds, picked.length, rng);
  const out: Exercise[] = picked.map((s, i) => sentenceExercise(s, sequence[i], sentences, opts, rng, i));
  const weakWords = rng.shuffle(words.filter((w) => weakSet.has(w.id)));
  const forMatch = [...weakWords, ...rng.shuffle(words.filter((w) => !weakSet.has(w.id)))].filter((w, i, all) => all.findIndex((x) => norm(x.fr) === norm(w.fr) || norm(x[opts.lang]) === norm(w[opts.lang])) === i).slice(0, 5);
  if (forMatch.length >= 4) out.splice(2, 0, { kind: "match", key: "match:practice", words: forMatch });
  const pics = weakWords.map((w, i) => pictureFor(w, words, rng, i)).filter((e): e is Exercise => !!e).slice(0, 2);
  pics.forEach((p) => out.splice(rng.int(0, out.length), 0, p));
  spreadIn(
    out,
    rng
      .shuffle(units.flatMap((u) => u.drills))
      .slice(0, 2)
      .map((d) => blankOf(d, rng)),
  );
  return out;
}

/** The course's words an exercise practises, for word strength. */
export function wordsOf(ex: Exercise): Word[] {
  switch (ex.kind) {
    case "intro":
    case "picture":
      return [ex.word];
    case "match":
      return ex.words;
    case "tiles":
    case "type":
    case "choice":
    case "listen":
    case "speak":
      return wordsInSentence(ex.sentence.fr, ALL_WORDS);
    case "blank":
      return wordsInSentence(ex.drill.fr.replace("___", ex.drill.options[ex.drill.answer]), ALL_WORDS);
    case "dialogue":
      return [];
  }
}
