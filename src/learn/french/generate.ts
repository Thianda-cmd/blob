import { createRng, type Rng } from "@/learn/engine/rng";
import { ALL_WORDS, wordsInSentence } from "./course";
import { fold, norm, spotTokens, tilesOf } from "./text";
import type { Dialogue, DialogueLine, Drill, Exercise, Lang, Sentence, Unit, Word } from "./types";

// Turning a unit's material into a lesson: first the new words (each shown, then checked), then
// sentences in ever-changing exercise types, with grammar gaps, le-or-la, spelling, spot-the-mistake
// and best-reply steps in between, and the unit's story in its lesson. Earlier material comes back
// a little in every lesson, so nothing is learned only once. No sound: everything is read and written.

export type GenOptions = {
  lang: Lang;
  seed: number;
};

/** About how many steps a lesson has (new-word cards don't count). */
const LESSON_SIZE = 15;

export const targetOf = (s: Sentence, dir: "toFr" | "fromFr", lang: Lang) => (dir === "toFr" ? s.fr : s[lang]);
export const acceptedOf = (s: Sentence, dir: "toFr" | "fromFr", lang: Lang) =>
  dir === "toFr" ? [s.fr, ...(s.alt?.fr ?? []).filter((a) => fitsPrompt(a, s, lang))] : [s[lang], ...(s.alt?.[lang] ?? [])];

const TU = /(^|[\s«(-])(tu|toi|te|ton|ta|tes|t')(?=[\s,.!?;:»)]|$)|\bt'/i;
const VOUS = /(^|[\s«(-])(vous|votre|vos)(?=[\s,.!?;:»)]|$)/i;
// German "you": du-forms and ihr/Sie-forms, small or (at the start) capitalised. "Sie" only counts
// inside a sentence, where it can't be "she" or "they" starting it.
const DU = /\b([Dd]u|[Dd]ir|[Dd]ich|[Dd]ein\w*)\b/;
const IHR = /\b([Ii]hr|[Ee]uch|[Ee]uer\w*|[Ee]ure\w*|Ihnen)\b|(?<!^)\bSie\b/;

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

type Kind = "tiles-from" | "tiles-to" | "type-from" | "type-to" | "choice-from" | "choice-to";

/** Which exercise types a lesson uses, from easy (first lesson of a unit) to harder (later ones). */
function kindsFor(stage: number): Kind[] {
  if (stage <= 1) return ["tiles-from", "choice-from", "tiles-to", "tiles-from", "choice-to"];
  if (stage === 2) return ["tiles-from", "tiles-to", "type-from", "choice-from", "tiles-to"];
  if (stage === 3) return ["tiles-to", "type-from", "type-to", "tiles-from", "choice-to"];
  // The unit review: mostly writing.
  return ["type-to", "type-from", "tiles-to", "type-to", "choice-to"];
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

/** Nouns where le/la can't be told from the word (either gender) or "un/une" sounds wrong (mass nouns). */
const EITHER_GENDER = new Set(["eleve", "enfant", "camarade", "artiste"]);
const MASS = new Set(["eau", "lait", "pain", "fromage", "chocolat", "sport", "musique", "argent"]);

/** Le or la? For "l'…" nouns (where the article hides the gender) it's un or une. */
function articleFor(w: Word, rng: Rng, i: number): Exercise | null {
  if (w.kind !== "noun" || !w.g || EITHER_GENDER.has(w.id)) return null;
  // Singular nouns only: "le pain", "la pomme", "l'eau" (not "les frites").
  const m = /^(?:(le|la)\s+|(l'))(.+)$/i.exec(w.fr);
  if (!m) return null;
  const elided = !!m[2];
  if (elided && MASS.has(w.id)) return null;
  // Countries: "la France", never "une France"; "l'Allemagne" has nothing to choose.
  const proper = /^[A-ZÀ-Ý]/.test(m[3]);
  if (proper && elided) return null;
  const indefinite = !proper && (elided || rng.chance(0.4));
  const options = indefinite ? ["un", "une"] : ["le", "la"];
  return { kind: "article", key: `article:${w.id}:${i}`, word: w, options, answer: w.g === "m" ? 0 : 1 };
}

/** Write the French (with its article) for a meaning. Short words and phrases only. */
function spellFor(w: Word, i: number): Exercise | null {
  if (tilesOf(w.fr, "fr").length > 4 || w.fr.includes("…")) return null;
  return { kind: "spell", key: `spell:${w.id}:${i}`, word: w };
}

/** A drill's sentence with one of its wrong options in the gap: find the mistake. */
function spotFor(d: Drill, rng: Rng): Exercise | null {
  // Only wrong options that leave a word to tap (not an empty option, not one that reads the same).
  const right = fold(d.fr.replace("___", d.options[d.answer]), "fr");
  const wrongs = d.options
    .map((_, i) => i)
    .filter((i) => i !== d.answer && spotTokens(d.fr, d.options[i]).some((t) => t.wrong && t.word) && fold(d.fr.replace("___", d.options[i]), "fr") !== right);
  if (!wrongs.length) return null;
  return { kind: "spot", key: `spot:${d.id}`, drill: d, wrong: rng.pick(wrongs) };
}

/** Question-and-answer pairs from stories: a question by one person, the answer by the next. */
type Exchange = { line: DialogueLine; reply: DialogueLine; story: string };
function exchangesOf(dialogues: Dialogue[]): Exchange[] {
  return dialogues.flatMap((d) =>
    d.lines.slice(0, -1).flatMap((line, i) => {
      const reply = d.lines[i + 1];
      return reply.who !== line.who && /\?\s*»?$/.test(line.fr.trim()) && !/\?\s*»?$/.test(reply.fr.trim()) ? [{ line, reply, story: d.id }] : [];
    }),
  );
}

/** Which reply fits? The real answer and two answers from other stories. */
function replyFor(x: Exchange, pool: Exchange[], rng: Rng): Exercise | null {
  const right = norm(x.reply.fr);
  const others = rng
    .shuffle(pool.filter((o) => o.story !== x.story && norm(o.reply.fr) !== right))
    .map((o) => o.reply.fr)
    .filter((fr, i, all) => all.findIndex((y) => norm(y) === norm(fr)) === i)
    .slice(0, 2);
  if (others.length < 2) return null;
  const options = rng.shuffle([x.reply.fr, ...others]);
  return {
    kind: "reply",
    key: `reply:${x.story}:${norm(x.line.fr).slice(0, 24)}`,
    line: x.line,
    options,
    answer: options.indexOf(x.reply.fr),
    meaning: { en: `${x.line.en} — ${x.reply.en}`, de: `${x.line.de} — ${x.reply.de}` },
  };
}

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
  const spec = unit.lessons[n - 1];
  if (spec.review) return reviewExercises(unit, earlier, opts);
  const rng = createRng(opts.seed);
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

  // 3. Between the sentences: grammar gaps, a mistake to spot, le or la, a word to spell, a reply.
  const ownDrills = rng.shuffle(unit.drills.filter((d) => d.lesson === n));
  const oldDrills = rng.shuffle(unit.drills.filter((d) => d.lesson < n));
  const extras: Exercise[] = [...ownDrills.slice(0, 2), ...oldDrills.slice(0, 1)].map((d) => blankOf(d, rng));
  const forSpot = n > 1 ? [...ownDrills.slice(2), ...oldDrills.slice(1), ...ownDrills][0] : undefined;
  const spot = forSpot && spotFor(forSpot, rng);
  if (spot) extras.push(spot);
  const article = [...rng.shuffle(fresh), ...rng.shuffle(introduced)].map((w, i) => articleFor(w, rng, i)).find(Boolean);
  if (article) extras.push(article);
  const spell = n > 1 ? rng.shuffle(introduced.filter((w) => !fresh.includes(w))).map((w, i) => spellFor(w, i)).find(Boolean) : undefined;
  if (spell) extras.push(spell);
  if (n > 1) {
    const own = exchangesOf(unit.dialogues.filter((d) => d.lesson <= n));
    const all = [...own, ...exchangesOf(earlier.flatMap((u) => u.dialogues))];
    const reply = rng.shuffle(own.length ? own : all).map((x) => replyFor(x, all, rng)).find(Boolean);
    if (reply) extras.push(reply);
  }

  // The lesson's own sentences come first; the room left after the extras decides how many.
  const room = Math.max(9, LESSON_SIZE - out.filter((e) => e.kind !== "intro").length);
  const chosen = picked.slice(0, Math.max(6, room - extras.length));
  const kinds = kindSequence(kindsFor(Math.min(3, n)), chosen.length, rng);
  const steps: Exercise[] = chosen.map((s, i) => sentenceExercise(s, kinds[i], pool, opts, rng, i));
  spreadIn(steps, rng.shuffle(extras));
  out.push(...steps);

  // 4. The unit's story, near the end of its lesson.
  for (const d of unit.dialogues.filter((d) => d.lesson === n)) out.splice(Math.max(out.length - 2, 1), 0, dialogueOf(d, rng));
  return out;
}

/** The unit review: no new words, the whole unit mixed, mostly writing. */
function reviewExercises(unit: Unit, earlier: Unit[], opts: GenOptions): Exercise[] {
  const rng = createRng(opts.seed);
  const words = unit.words;
  const pool = [...unit.sentences, ...earlier.flatMap((u) => u.sentences)];
  const matchable = rng.shuffle(words).filter((w, i, all) => all.findIndex((x) => norm(x.fr) === norm(w.fr) || norm(x[opts.lang]) === norm(w[opts.lang])) === i);
  const out: Exercise[] = [];
  if (matchable.length >= 4) out.push({ kind: "match", key: `match:${unit.slug}:review`, words: matchable.slice(0, 5) });

  const picked = rng.shuffle(unit.sentences).slice(0, 8);
  const kinds = kindSequence(kindsFor(4), picked.length, rng);
  const steps: Exercise[] = picked.map((s, i) => sentenceExercise(s, kinds[i], pool, opts, rng, i));

  const drills = rng.shuffle(unit.drills);
  const extras: Exercise[] = drills.slice(0, 2).map((d) => blankOf(d, rng));
  drills
    .slice(2, 4)
    .map((d) => spotFor(d, rng))
    .forEach((e) => e && extras.push(e));
  rng
    .shuffle(words)
    .map((w, i) => articleFor(w, rng, i))
    .filter(Boolean)
    .slice(0, 2)
    .forEach((e) => extras.push(e!));
  rng
    .shuffle(words)
    .map((w, i) => spellFor(w, i))
    .filter(Boolean)
    .slice(0, 2)
    .forEach((e) => extras.push(e!));
  const own = exchangesOf(unit.dialogues);
  const all = [...own, ...exchangesOf(earlier.flatMap((u) => u.dialogues))];
  rng
    .shuffle(own)
    .map((x) => replyFor(x, all, rng))
    .filter(Boolean)
    .slice(0, 2)
    .forEach((e) => extras.push(e!));
  spreadIn(steps, rng.shuffle(extras));
  return [...out, ...steps];
}

/**
 * A practice round over what the student has learned: sentences with their weakest words first,
 * mixed exercise types, a match, grammar gaps, le or la, spelling, a mistake to spot and a reply.
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
  const sequence = kindSequence(kindsFor(3), picked.length, rng);
  const out: Exercise[] = picked.map((s, i) => sentenceExercise(s, sequence[i], sentences, opts, rng, i));
  const weakWords = rng.shuffle(words.filter((w) => weakSet.has(w.id)));
  const otherWords = rng.shuffle(words.filter((w) => !weakSet.has(w.id)));
  const forMatch = [...weakWords, ...otherWords].filter((w, i, all) => all.findIndex((x) => norm(x.fr) === norm(w.fr) || norm(x[opts.lang]) === norm(w[opts.lang])) === i).slice(0, 5);
  if (forMatch.length >= 4) out.splice(2, 0, { kind: "match", key: "match:practice", words: forMatch });
  const pics = weakWords.map((w, i) => pictureFor(w, words, rng, i)).filter((e): e is Exercise => !!e).slice(0, 2);
  pics.forEach((p) => out.splice(rng.int(0, out.length), 0, p));
  const drills = rng.shuffle(units.flatMap((u) => u.drills));
  const extras: Exercise[] = drills.slice(0, 2).map((d) => blankOf(d, rng));
  const spot = drills[2] && spotFor(drills[2], rng);
  if (spot) extras.push(spot);
  const article = [...weakWords, ...otherWords].map((w, i) => articleFor(w, rng, i)).find(Boolean);
  if (article) extras.push(article);
  const spell = [...weakWords, ...otherWords].map((w, i) => spellFor(w, i)).find(Boolean);
  if (spell) extras.push(spell);
  const all = exchangesOf(units.flatMap((u) => u.dialogues));
  const reply = rng.shuffle(all).map((x) => replyFor(x, all, rng)).find(Boolean);
  if (reply) extras.push(reply);
  spreadIn(out, rng.shuffle(extras));
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
    case "article":
    case "spell":
      return [ex.word];
    case "tiles":
    case "type":
    case "choice":
      return wordsInSentence(ex.sentence.fr, ALL_WORDS);
    case "blank":
    case "spot":
      return wordsInSentence(ex.drill.fr.replace("___", ex.drill.options[ex.drill.answer]), ALL_WORDS);
    case "reply":
      return wordsInSentence(`${ex.line.fr} ${ex.options[ex.answer]}`, ALL_WORDS);
    case "dialogue":
      return [];
  }
}
