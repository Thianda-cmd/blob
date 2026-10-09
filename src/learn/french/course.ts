import { tx, type Text } from "@/i18n/text";
import type { TopicProgress } from "@/learn/progress";
import { learnCase, norm } from "./text";
import type { Unit, Word } from "./types";
import { u01 } from "./units/u01-bonjour";
import { u02 } from "./units/u02-qui-es-tu";
import { u03 } from "./units/u03-manger";
import { u04 } from "./units/u04-famille";
import { u05 } from "./units/u05-nombres";
import { u06 } from "./units/u06-ecole";
import { u07 } from "./units/u07-ville";
import { u08 } from "./units/u08-loisirs";
import { u09 } from "./units/u09-vetements";
import { u10 } from "./units/u10-cafe";

/** Every unit in order. */
export const UNITS: Unit[] = [u01, u02, u03, u04, u05, u06, u07, u08, u09, u10];

// Tiles keep names capitalised and German small words small, as the course writes them.
learnCase(UNITS.flatMap((u) => [...u.sentences, ...(u.dialogue?.lines ?? []), ...u.drills.map((d) => ({ ...d, fr: d.fr.replace("___", d.options[d.answer]) }))]));

export type Section = { n: number; cefr: string; title: Text; goal: Text; units: Unit[]; soon?: boolean };

/** The course is cut into sections (one CEFR stage each). Later ones come in later updates. */
export const SECTIONS: Section[] = [
  {
    n: 1,
    cefr: "A1",
    title: tx("First steps", "Erste Schritte"),
    goal: tx("Introduce yourself, order food, talk about family, school and free time", "Dich vorstellen, Essen bestellen, über Familie, Schule und Freizeit sprechen"),
    units: UNITS.filter((u) => u.cefr === "A1" && u.lessons.length > 0),
  },
  {
    n: 2,
    cefr: "A2",
    title: tx("Everyday life", "Alltag"),
    goal: tx("Your day, the past, plans, trips and shopping", "Dein Tag, die Vergangenheit, Pläne, Reisen und Einkaufen"),
    units: UNITS.filter((u) => u.cefr === "A2" && u.lessons.length > 0),
    soon: true,
  },
];

export const unitBySlug = (slug: string) => UNITS.find((u) => u.slug === slug);

/** The progress key of a lesson in learn_progress: "fr:bonjour:3". */
export const lessonKey = (unit: Pick<Unit, "slug">, n: number) => `fr:${unit.slug}:${n}`;

/** All words of the course, and of the units up to (and including) `unit`. */
export const ALL_WORDS: Word[] = UNITS.flatMap((u) => u.words);
const WORDS = new Map(ALL_WORDS.map((w) => [w.id, w]));
export const wordById = (id: string) => WORDS.get(id);

/** The unit a word is taught in. */
const WORD_UNIT = new Map(UNITS.flatMap((u) => u.words.map((w) => [w.id, u] as const)));
export const unitOfWord = (id: string) => WORD_UNIT.get(id);

/** A noun or phrase without its article: "la pomme" → "pomme". */
export const bare = (fr: string) => norm(fr).replace(/^(le|la|les|un|une)\s+/, "").replace(/^l'/, "").replace(/\s*\?$/, "");

/**
 * The course's words a French sentence uses (whole words, articles aside), for word strength
 * and the dictionary hints. "Je m'appelle Hugo, et toi ?" → je-m-appelle, et-toi.
 */
export function wordsInSentence(fr: string, words: Word[] = ALL_WORDS): Word[] {
  // Elided words count on their own ("de l'eau" uses l'eau, "je n'aime pas" uses ne … pas).
  const split = (x: string) => x.replace(/\bn'/g, "ne ").replace(/'/g, "' ");
  const text = ` ${split(norm(fr))} `;
  return words.filter((w) => {
    // "ne … pas": each part, in order.
    if (w.fr.includes("…")) {
      let at = 0;
      for (const part of w.fr.split("…").map((p) => split(norm(p)))) {
        at = part ? text.indexOf(` ${part} `, at) : at;
        if (at < 0) return false;
      }
      return true;
    }
    const b = split(bare(w.fr));
    // A word that is also an article (the number un) would count in every "un croissant".
    return b.length > 0 && !ARTICLE_FORMS.has(b) && text.includes(` ${b} `);
  });
}

const ARTICLE_FORMS = new Set(["un", "une", "le", "la", "les", "des", "du", "de"]);

export type LessonState = "done" | "current" | "open" | "locked";

export type UnitState = {
  unit: Unit;
  lessons: LessonState[];
  done: number;
  unlocked: boolean;
};

/**
 * Where the student is: a unit opens when the one before is finished, a lesson when the one before
 * it is done. Done lessons can always be played again. Exactly one lesson is "current" (the next).
 */
export function courseState(progress: Record<string, Pick<TopicProgress, "lesson_done">>): { units: UnitState[]; next: { unit: Unit; lesson: number } | null } {
  let next: { unit: Unit; lesson: number } | null = null;
  let open = true;
  // A unit still being written (no lessons yet) isn't on the path.
  const units = UNITS.filter((u) => u.lessons.length > 0).map((unit) => {
    const doneFlags = unit.lessons.map((_, i) => !!progress[lessonKey(unit, i + 1)]?.lesson_done);
    const unlocked = open;
    const lessons: LessonState[] = doneFlags.map((d, i) => {
      if (d) return "done";
      if (!unlocked || (i > 0 && !doneFlags[i - 1])) return "locked";
      if (!next) {
        next = { unit, lesson: i + 1 };
        return "current";
      }
      return "open";
    });
    const done = doneFlags.filter(Boolean).length;
    open = unlocked && done === unit.lessons.length;
    return { unit, lessons, done, unlocked };
  });
  return { units, next };
}

/** The units the student has started (for practice and the word list). */
export const startedUnits = (state: UnitState[]) => state.filter((s) => s.done > 0).map((s) => s.unit);

/** The part of a unit taught up to lesson `upTo`: its words, sentences and drills (for practice). */
export function learnedPart(unit: Unit, upTo: number): Unit {
  if (upTo >= unit.lessons.length) return unit;
  const ids = new Set(unit.lessons.slice(0, upTo).flatMap((l) => l.words));
  return {
    ...unit,
    words: unit.words.filter((w) => ids.has(w.id)),
    sentences: unit.sentences.filter((s) => s.lesson <= upTo),
    drills: unit.drills.filter((d) => d.lesson <= upTo),
  };
}
