import type { SubjectColor } from "./types";

/** Subject colours. Their names for people live in `subjectsText.colors` (src/i18n/messages/subjects.ts). */
export const SUBJECT_COLORS: Record<SubjectColor, { dot: string }> = {
  ink: { dot: "var(--subject-ink)" },
  clay: { dot: "var(--subject-clay)" },
  moss: { dot: "var(--subject-moss)" },
  sky: { dot: "var(--subject-sky)" },
  plum: { dot: "var(--subject-plum)" },
  sand: { dot: "var(--subject-sand)" },
  rose: { dot: "var(--subject-rose)" },
  teal: { dot: "var(--subject-teal)" },
};

export const SUBJECT_COLOR_KEYS = Object.keys(SUBJECT_COLORS) as SubjectColor[];

export function subjectColor(color: string | null | undefined) {
  return SUBJECT_COLORS[(color as SubjectColor) ?? "ink"]?.dot ?? SUBJECT_COLORS.ink.dot;
}

/** Suggestions offered during onboarding. `name` is English, `de` the German school name. */
export const SUBJECT_PRESETS: { name: string; de: string; emoji: string; color: SubjectColor }[] = [
  { name: "Math", de: "Mathe", emoji: "📐", color: "sky" },
  { name: "English", de: "Englisch", emoji: "📖", color: "clay" },
  { name: "Biology", de: "Biologie", emoji: "🌱", color: "moss" },
  { name: "Chemistry", de: "Chemie", emoji: "⚗️", color: "teal" },
  { name: "Physics", de: "Physik", emoji: "🧲", color: "plum" },
  { name: "History", de: "Geschichte", emoji: "🏛️", color: "sand" },
  { name: "Geography", de: "Erdkunde", emoji: "🗺️", color: "teal" },
  { name: "German", de: "Deutsch", emoji: "🥨", color: "rose" },
  { name: "French", de: "Französisch", emoji: "🥐", color: "sky" },
  { name: "Spanish", de: "Spanisch", emoji: "🌶️", color: "clay" },
  { name: "Computer Science", de: "Informatik", emoji: "💻", color: "ink" },
  { name: "Art", de: "Kunst", emoji: "🎨", color: "rose" },
  { name: "Music", de: "Musik", emoji: "🎵", color: "plum" },
  { name: "Economics", de: "Wirtschaft", emoji: "📈", color: "moss" },
  { name: "Philosophy", de: "Philosophie", emoji: "🦉", color: "sand" },
  { name: "Sports", de: "Sport", emoji: "🏃", color: "moss" },
];
