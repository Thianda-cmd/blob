import type { Text } from "@/i18n/text";

// The French course: units of words, sentences, grammar drills, stories and tips, turned into
// short Duolingo-style lessons by generate.ts. Students translate between French and their own
// language (English or German), so every sentence carries both translations.

/** The student's own language: what French is translated into and from. */
export type Lang = "en" | "de";

/** Accepted alternatives per language. The first form (fr / en / de) is the one shown. */
export type Alts = { fr?: string[]; en?: string[]; de?: string[] };

/** A word or set phrase taught in a unit. Nouns carry their article: "la pomme", "l'eau". */
export type Word = {
  /** Unique in the whole course: "pomme", "bonjour", "être.suis". Lowercase, no spaces. */
  id: string;
  fr: string;
  en: string;
  de: string;
  alt?: Alts;
  /** Grammatical gender of a noun (also for "l'eau": f). */
  g?: "m" | "f";
  kind: "noun" | "verb" | "adj" | "adv" | "phrase" | "word";
  /** A picture for picture exercises (only for things you can show). */
  emoji?: string;
  /** Blob's memory hook, shown on the new-word card. */
  note?: Text;
};

/** A sentence to translate, listen to or say. Short: 2 to 9 words, A1 level. */
export type Sentence = {
  /** "u01.03": unit and number. */
  id: string;
  fr: string;
  en: string;
  de: string;
  alt?: Alts;
  /** The lesson (1-based) it first comes up in. Later lessons repeat earlier sentences. */
  lesson: number;
};

/** Pick the word that fills the gap: grammar practice (articles, verb forms, agreement). */
export type Drill = {
  id: string;
  /** The French sentence with "___" for the gap: "Je ___ Blob." */
  fr: string;
  options: string[];
  /** Index of the right option. */
  answer: number;
  /** The whole sentence in English and German, shown after answering. */
  en: string;
  de: string;
  /** Why this option (Blob explains it after a wrong answer). */
  why: Text;
  lesson: number;
};

/** People in the course's little stories. */
export type Speaker = "blob" | "lea" | "hugo" | "madame" | "serveur" | "maman" | "papa" | "prof" | "vendeur";

export type DialogueLine = { who: Speaker; fr: string; en: string; de: string };

/** A short scene (6 to 10 lines) with questions about it: read, listen, understand. */
export type Dialogue = {
  id: string;
  title: Text;
  lines: DialogueLine[];
  questions: { q: Text; options: Text[]; answer: number }[];
  lesson: number;
};

/** A page of the unit's guidebook: one idea, explained simply, with examples. */
export type Tip = {
  title: Text;
  /** Short paragraphs; **bold** allowed. */
  body: Text;
  examples: { fr: string; en: string; de: string }[];
  /** An optional small table, e.g. a conjugation. Cells are French or bilingual text. */
  table?: { head: Text[]; rows: Text[][] };
};

export type LessonSpec = {
  title: Text;
  /** Word ids introduced in this lesson (2 to 6). */
  words: string[];
  /** The unit's closing review: no new words, everything of the unit mixed (added by course.ts). */
  review?: boolean;
};

export type Unit = {
  /** URL slug: "bonjour". */
  slug: string;
  /** 1-based position in the course. */
  n: number;
  cefr: "A1" | "A2" | "B1";
  title: Text;
  /** What you can do after it ("Greet people and say your name"). */
  goal: Text;
  emoji: string;
  words: Word[];
  sentences: Sentence[];
  drills: Drill[];
  /** Little stories, each in its `lesson` (one in lesson 5, one in lesson 7). */
  dialogues: Dialogue[];
  tips: Tip[];
  /** 7 lessons; course.ts adds the unit review as the 8th. */
  lessons: LessonSpec[];
  /**
   * Forms used in the sentences that aren't words of their own (verb forms, plurals), so tapping
   * them shows a meaning: { fr: "mange", en: "eat / eats", de: "esse / isst" }.
   */
  gloss?: { fr: string; en: string; de: string }[];
};

/** One step of a lesson. */
export type Exercise =
  /** A new word: picture, word, sound, translation. Nothing to answer. */
  | { kind: "intro"; key: string; word: Word }
  /** Which picture is "la pomme"? */
  | { kind: "picture"; key: string; word: Word; options: Word[] }
  /** Tap the pairs that belong together. */
  | { kind: "match"; key: string; words: Word[] }
  /** Build the translation from word tiles. */
  | { kind: "tiles"; key: string; sentence: Sentence; dir: "toFr" | "fromFr"; tiles: string[] }
  /** Type the translation. */
  | { kind: "type"; key: string; sentence: Sentence; dir: "toFr" | "fromFr" }
  /** Pick the right translation. */
  | { kind: "choice"; key: string; sentence: Sentence; dir: "toFr" | "fromFr"; options: string[] }
  /** Fill the gap. */
  | { kind: "blank"; key: string; drill: Drill }
  /** Le or la (un or une)? The article of a noun. */
  | { kind: "article"; key: string; word: Word; options: string[]; answer: number }
  /** Write the French word (with its article) for a picture and meaning. */
  | { kind: "spell"; key: string; word: Word }
  /** A drill's sentence with a wrong option in the gap: tap the word that's wrong. */
  | { kind: "spot"; key: string; drill: Drill; wrong: number }
  /** A line from a story: pick the reply that fits. */
  | { kind: "reply"; key: string; line: DialogueLine; options: string[]; answer: number; meaning: { en: string; de: string } }
  /** Read a short scene and answer questions about it. */
  | { kind: "dialogue"; key: string; dialogue: Dialogue };

export type ExerciseKind = Exercise["kind"];
