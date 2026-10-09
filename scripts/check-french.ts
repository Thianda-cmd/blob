// Checks the French course (src/learn/french) before you commit.
//
//   npm run check:french                 every unit
//   npm run check:french -- bonjour      some units (slugs)
//   npm run check:french -- --strict     warnings fail too
//
// For every unit in course.ts it checks:
//   - unit: slug (URL-safe, unique, not a reserved route), its place n, bilingual title and goal
//   - words: ids unique in the whole course, fr/en/de filled in, nouns with gender and article
//   - lessons: 4 or 5, each word in exactly one lesson, 2 to 6 new words each (the last may have fewer)
//   - sentences: ids "uNN.MM" unique, lesson in range, at least 4 per lesson, a short length, every
//     sentence and alternative accepted by its own grading, no two sentences of a unit that share a
//     translation without accepting each other (the student would be marked wrong for a right answer)
//   - drills: exactly one "___", a valid answer, distinct options, Blob's bilingual why
//   - dialogue and tips: speakers, questions with a valid answer, examples, table widths
//   - tap-to-translate: every French word of sentences, drills and dialogues has a gloss from this unit
//     or an earlier one (a word only a later unit teaches isn't known yet) (warning)
//   - names: a capitalised word only ever at the start of sentences (its tile would start small)
//   - lessons and practice are generated for many seeds, both languages, with and without listening
//     and speaking, without throwing, with enough steps, and each step's right answer is possible
//
// Problems make the script exit with 1. Warnings don't, unless --strict.
import { resolveText, type Text } from "@/i18n/text";
import { learnedPart, UNITS } from "@/learn/french/course";
import { acceptedOf, lessonExercises, practiceExercises, targetOf, type GenOptions } from "@/learn/french/generate";
import { glossSegments } from "@/learn/french/glossary";
import { fold, grade, norm, tilesOf } from "@/learn/french/text";
import type { Lang, Unit } from "@/learn/french/types";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const only = args.filter((a) => !a.startsWith("--"));

const problems: string[] = [];
const warnings: string[] = [];
const bad = (where: string, msg: string) => problems.push(`${where}: ${msg}`);
const warn = (where: string, msg: string) => warnings.push(`${where}: ${msg}`);

const LANGS: Lang[] = ["en", "de"];
const SPEAKERS = new Set(["blob", "lea", "hugo", "madame", "serveur", "maman", "papa", "prof", "vendeur"]);
const RESERVED = new Set(["words", "practice"]);
const ARTICLE = /^(le|la|les|un|une|l')\s*/i;

function bilingual(where: string, t: Text | undefined) {
  if (t === undefined) return bad(where, "missing");
  for (const l of LANGS) if (!resolveText(t, l).trim()) bad(where, `empty ${l} text`);
}

// Read the PROPER names from text.ts through tilesOf: a proper name keeps its capital at the start.
const isProper = (word: string) => tilesOf(`${word} x`, "fr")[0] === word;

// Words ids across the course.
const wordIds = new Map<string, string>();
for (const u of UNITS) for (const w of u.words) {
  if (wordIds.has(w.id)) bad(`${u.slug} word ${w.id}`, `id also used in ${wordIds.get(w.id)}`);
  wordIds.set(w.id, u.slug);
}
const slugs = new Set<string>();
const sentenceIds = new Set<string>();

for (const [i, unit] of UNITS.entries()) {
  if (only.length && !only.includes(unit.slug)) continue;
  checkUnit(unit, i);
}

function checkUnit(u: Unit, index: number) {
  const at = `${u.slug}`;
  if (!/^[a-z0-9-]+$/.test(u.slug)) bad(at, "slug must be lowercase letters, digits and dashes");
  if (RESERVED.has(u.slug)) bad(at, "slug is a reserved route");
  if (slugs.has(u.slug)) bad(at, "slug used twice");
  slugs.add(u.slug);
  if (u.n !== index + 1) bad(at, `n is ${u.n}, but it is unit ${index + 1} in UNITS`);
  bilingual(`${at} title`, u.title);
  bilingual(`${at} goal`, u.goal);
  if (!u.emoji) bad(at, "no emoji");

  // Words.
  for (const w of u.words) {
    const wat = `${at} word ${w.id}`;
    if (!/^[a-z0-9.-]+$/.test(w.id)) bad(wat, "id must be lowercase letters, digits, dots and dashes");
    for (const k of ["fr", "en", "de"] as const) if (!w[k]?.trim()) bad(wat, `empty ${k}`);
    if (w.kind === "noun") {
      if (!w.g) bad(wat, "noun without gender g");
      if (!ARTICLE.test(w.fr)) warn(wat, `noun without its article: "${w.fr}"`);
    }
    if (w.note) bilingual(`${wat} note`, w.note);
  }

  // Lessons.
  if (u.lessons.length < 4 || u.lessons.length > 5) warn(at, `${u.lessons.length} lessons (4 or 5 is the plan)`);
  const inLesson = new Map<string, number>();
  u.lessons.forEach((l, li) => {
    const lat = `${at} lesson ${li + 1}`;
    bilingual(`${lat} title`, l.title);
    const last = li === u.lessons.length - 1;
    if (l.words.length > 7 || (!last && l.words.length < 2)) warn(lat, `${l.words.length} new words (2 to 6, numbers up to 7)`);
    for (const id of l.words) {
      if (!u.words.some((w) => w.id === id)) bad(lat, `word ${id} is not a word of this unit`);
      if (inLesson.has(id)) bad(lat, `word ${id} is already taught in lesson ${inLesson.get(id)}`);
      inLesson.set(id, li + 1);
    }
  });
  for (const w of u.words) if (!inLesson.has(w.id)) bad(`${at} word ${w.id}`, "is in no lesson");

  // Sentences.
  const prefix = `u${String(u.n).padStart(2, "0")}.`;
  for (const s of u.sentences) {
    const sat = `${at} ${s.id}`;
    if (!s.id.startsWith(prefix) || !/^u\d\d\.\d\d$/.test(s.id)) bad(sat, `id should look like ${prefix}01`);
    if (sentenceIds.has(s.id)) bad(sat, "id used twice");
    sentenceIds.add(s.id);
    if (s.lesson < 1 || s.lesson > u.lessons.length) bad(sat, `lesson ${s.lesson} out of range`);
    for (const k of ["fr", "en", "de"] as const) if (!s[k]?.trim()) bad(sat, `empty ${k}`);
    const n = tilesOf(s.fr, "fr").length;
    if (n > 10) warn(sat, `${n} words is long for A1 (2 to 9)`);
    // Grading accepts the sentence and its alternatives.
    for (const dir of ["toFr", "fromFr"] as const)
      for (const lang of LANGS)
        for (const a of acceptedOf(s, dir, lang)) {
          const g = grade(a, acceptedOf(s, dir, lang), dir === "toFr" ? "fr" : lang);
          if (g.verdict !== "correct") bad(sat, `"${a}" is not accepted by its own grading (${g.verdict})`);
        }
    for (const lang of ["fr", ...LANGS] as const) {
      const main = lang === "fr" ? s.fr : s[lang];
      for (const a of s.alt?.[lang] ?? []) if (norm(a) === norm(main)) warn(sat, `alternative "${a}" repeats the main ${lang} form`);
    }
  }
  for (let l = 1; l <= u.lessons.length; l++) {
    const count = u.sentences.filter((s) => s.lesson === l).length;
    if (count < 4) bad(`${at} lesson ${l}`, `only ${count} sentences (at least 4, better 6)`);
  }
  // Same translation, different French: each must accept the other (and the other way round).
  for (const dir of ["toFr", "fromFr"] as const)
    for (const lang of LANGS)
      for (const a of u.sentences)
        for (const b of u.sentences) {
          // Both ways: (a, b) and (b, a) each come up in this double loop.
          if (a.id === b.id) continue;
          const promptA = dir === "toFr" ? a[lang] : a.fr;
          const promptB = dir === "toFr" ? b[lang] : b.fr;
          if (fold(promptA, dir === "toFr" ? lang : "fr") !== fold(promptB, dir === "toFr" ? lang : "fr")) continue;
          const answer = targetOf(b, dir, lang);
          if (grade(answer, acceptedOf(a, dir, lang), dir === "toFr" ? "fr" : lang).verdict === "wrong")
            bad(`${at} ${a.id}/${b.id}`, `same prompt "${promptA}" but "${answer}" is not accepted for ${a.id} (${dir}, ${lang})`);
        }

  // Drills.
  for (const d of u.drills) {
    const dat = `${at} ${d.id}`;
    if (d.fr.split("___").length !== 2) bad(dat, 'needs exactly one "___"');
    if (d.answer < 0 || d.answer >= d.options.length) bad(dat, "answer index out of range");
    if (d.options.length < 2) bad(dat, "fewer than 2 options");
    if (new Set(d.options.map((o) => o.toLowerCase())).size !== d.options.length) bad(dat, "options repeat");
    if (d.lesson < 1 || d.lesson > u.lessons.length) bad(dat, `lesson ${d.lesson} out of range`);
    if (!d.en?.trim() || !d.de?.trim()) bad(dat, "missing en/de sentence");
    bilingual(`${dat} why`, d.why);
  }
  if (u.drills.length < 6) warn(at, `only ${u.drills.length} drills (8 to 12 is the plan)`);

  // Dialogue.
  if (!u.dialogue) warn(at, "no dialogue");
  else {
    const dl = u.dialogue;
    const dat = `${at} dialogue`;
    bilingual(`${dat} title`, dl.title);
    if (dl.lesson < 1 || dl.lesson > u.lessons.length) bad(dat, `lesson ${dl.lesson} out of range`);
    if (dl.lines.length < 6 || dl.lines.length > 10) warn(dat, `${dl.lines.length} lines (6 to 10)`);
    for (const [i, line] of dl.lines.entries()) {
      if (!SPEAKERS.has(line.who)) bad(`${dat} line ${i + 1}`, `unknown speaker ${line.who}`);
      if (!line.fr.trim() || !line.en.trim() || !line.de.trim()) bad(`${dat} line ${i + 1}`, "empty text");
    }
    if (dl.questions.length < 2) warn(dat, `${dl.questions.length} questions (2 or 3)`);
    for (const [i, q] of dl.questions.entries()) {
      bilingual(`${dat} question ${i + 1}`, q.q);
      if (q.answer < 0 || q.answer >= q.options.length) bad(`${dat} question ${i + 1}`, "answer index out of range");
      q.options.forEach((o, j) => bilingual(`${dat} question ${i + 1} option ${j + 1}`, o));
    }
  }

  // Tips.
  if (u.tips.length < 2) warn(at, `only ${u.tips.length} tips (2 to 4)`);
  for (const [i, tip] of u.tips.entries()) {
    const tat = `${at} tip ${i + 1}`;
    bilingual(`${tat} title`, tip.title);
    bilingual(`${tat} body`, tip.body);
    if (tip.examples.length < 2) warn(tat, "fewer than 2 examples");
    for (const ex of tip.examples) if (!ex.fr.trim() || !ex.en.trim() || !ex.de.trim()) bad(tat, "example with empty text");
    if (tip.table) {
      tip.table.head.forEach((h, j) => bilingual(`${tat} table head ${j + 1}`, h));
      for (const row of tip.table.rows) if (row.length !== tip.table.head.length) bad(tat, "table row width differs from the head");
    }
  }
  for (const g of u.gloss ?? []) if (!g.fr.trim() || !g.en.trim() || !g.de.trim()) bad(`${at} gloss ${g.fr}`, "empty text");

  // Tap-to-translate coverage.
  const missing = new Set<string>();
  const french = [...u.sentences.map((s) => s.fr), ...u.drills.map((d) => d.fr.replace("___", d.options[d.answer])), ...(u.dialogue?.lines.map((l) => l.fr) ?? [])];
  for (const text of french)
    // Only what this unit and the ones before teach: a word from a later unit isn't known yet.
    for (const seg of glossSegments(text, index + 1)) {
      const word = seg.text.replace(/^[«"(—–-]+|[.,!?;:»")…]+$/g, "");
      if (!seg.gloss && word && /[a-zà-ÿ]/i.test(word) && !isProper(word) && !/^\d/.test(word)) missing.add(word);
    }
  const names = [...missing].filter((w) => /^[A-ZÀ-Ý]/.test(w));
  const words = [...missing].filter((w) => !/^[A-ZÀ-Ý]/.test(w));
  if (words.length) warn(at, `no gloss for: ${words.join(", ")} (add to the unit's gloss)`);
  if (names.length) warn(at, `unknown capitalised words: ${names.join(", ")} (a name must also come up inside a sentence, else its tile starts small)`);

  // Generation.
  const earlier = UNITS.slice(0, index);
  for (let seed = 1; seed <= 40; seed++)
    for (const lang of LANGS) {
      const opts: GenOptions = { lang, seed, listening: seed % 2 === 0, speaking: seed % 3 === 0 };
      for (let n = 1; n <= u.lessons.length; n++) {
        const lat = `${at} lesson ${n} (seed ${seed}, ${lang})`;
        let list;
        try {
          list = lessonExercises(u, n, earlier, opts);
        } catch (e) {
          bad(lat, `generation throws: ${(e as Error).message}`);
          continue;
        }
        const steps = list.filter((e) => e.kind !== "intro").length;
        if (steps < 8) bad(lat, `only ${steps} steps`);
        checkSteps(lat, list, lang);
      }
      try {
        checkSteps(`${at} practice (seed ${seed}, ${lang})`, practiceExercises([...earlier, learnedPart(u, 2)], [], opts), lang);
      } catch (e) {
        bad(`${at} practice (seed ${seed})`, `generation throws: ${(e as Error).message}`);
      }
    }
}

function checkSteps(at: string, list: ReturnType<typeof lessonExercises>, lang: Lang) {
  const keys = new Set<string>();
  for (const ex of list) {
    if (keys.has(ex.key)) bad(at, `key ${ex.key} used twice`);
    keys.add(ex.key);
    if (ex.kind === "tiles" || (ex.kind === "listen" && ex.mode === "tiles")) {
      const dir = ex.kind === "tiles" ? ex.dir : "toFr";
      const target = targetOf(ex.sentence, dir, lang);
      const pool = ex.tiles.map((t) => t.toLowerCase());
      for (const t of tilesOf(target, dir === "toFr" ? "fr" : lang)) {
        const i = pool.indexOf(t.toLowerCase());
        if (i < 0) bad(at, `${ex.key}: tile "${t}" of the answer is missing`);
        else pool.splice(i, 1);
      }
    }
    if (ex.kind === "choice") {
      const accepted = acceptedOf(ex.sentence, ex.dir, lang).map(norm);
      const right = ex.options.filter((o) => accepted.includes(norm(o))).length;
      if (right !== 1) bad(at, `${ex.key}: ${right} options are right`);
    }
    if (ex.kind === "picture" && new Set(ex.options.map((w) => w.emoji)).size !== ex.options.length) bad(at, `${ex.key}: two pictures look the same`);
    if (ex.kind === "match" && new Set(ex.words.map((w) => norm(w[lang]))).size !== ex.words.length) bad(at, `${ex.key}: two cards with the same ${lang} meaning`);
  }
}

const dedupe = (list: string[]) => [...new Set(list)];
const p = dedupe(problems);
// Generation warnings repeat per seed: show each once.
const w = dedupe(warnings);
for (const x of w) console.log(`warning  ${x}`);
for (const x of p.slice(0, 200)) console.log(`PROBLEM  ${x}`);
if (p.length > 200) console.log(`… and ${p.length - 200} more problems`);
const units = only.length ? only.length : UNITS.length;
console.log(`\n${units} unit(s), ${UNITS.reduce((n, u) => n + u.sentences.length, 0)} sentences: ${p.length} problem(s), ${w.length} warning(s)`);
process.exit(p.length || (strict && w.length) ? 1 : 0);
