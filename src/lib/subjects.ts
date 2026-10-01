import type { SubjectColor } from "./types";

export const SUBJECT_COLORS: Record<SubjectColor, { label: string; dot: string }> = {
  ink: { label: "Ink", dot: "var(--subject-ink)" },
  clay: { label: "Clay", dot: "var(--subject-clay)" },
  moss: { label: "Moss", dot: "var(--subject-moss)" },
  sky: { label: "Sky", dot: "var(--subject-sky)" },
  plum: { label: "Plum", dot: "var(--subject-plum)" },
  sand: { label: "Sand", dot: "var(--subject-sand)" },
  rose: { label: "Rose", dot: "var(--subject-rose)" },
  teal: { label: "Teal", dot: "var(--subject-teal)" },
};

export const SUBJECT_COLOR_KEYS = Object.keys(SUBJECT_COLORS) as SubjectColor[];

export function subjectColor(color: string | null | undefined) {
  return SUBJECT_COLORS[(color as SubjectColor) ?? "ink"]?.dot ?? SUBJECT_COLORS.ink.dot;
}

/** Suggestions offered during onboarding. */
export const SUBJECT_PRESETS: { name: string; emoji: string; color: SubjectColor }[] = [
  { name: "Math", emoji: "📐", color: "sky" },
  { name: "English", emoji: "📖", color: "clay" },
  { name: "Biology", emoji: "🌱", color: "moss" },
  { name: "Chemistry", emoji: "⚗️", color: "teal" },
  { name: "Physics", emoji: "🧲", color: "plum" },
  { name: "History", emoji: "🏛️", color: "sand" },
  { name: "Geography", emoji: "🗺️", color: "teal" },
  { name: "German", emoji: "🥨", color: "rose" },
  { name: "French", emoji: "🥐", color: "sky" },
  { name: "Spanish", emoji: "🌶️", color: "clay" },
  { name: "Computer Science", emoji: "💻", color: "ink" },
  { name: "Art", emoji: "🎨", color: "rose" },
  { name: "Music", emoji: "🎵", color: "plum" },
  { name: "Economics", emoji: "📈", color: "moss" },
  { name: "Philosophy", emoji: "🦉", color: "sand" },
  { name: "Sports", emoji: "🏃", color: "moss" },
];
