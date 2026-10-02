import type { Locale } from "@/i18n/config";
import { SUBJECT_PRESETS } from "@/lib/subjects";
import type { SubjectColor } from "@/lib/types";
import type { Picked } from "./SubjectChip";

type Preset = { name: string; de: string; emoji: string; color: SubjectColor };

/** Common at German schools but not in the English list. */
const GERMAN_ONLY: Preset[] = [{ name: "Latin", de: "Latein", emoji: "🏺", color: "sand" }];
const ALL: Preset[] = [...SUBJECT_PRESETS, ...GERMAN_ONLY];

/** German order: Mathe, Deutsch, Englisch first, Latein after the other languages. */
const GERMAN_ORDER = ["Math", "German", "English", "Biology", "Chemistry", "Physics", "History", "Geography", "French", "Spanish", "Latin"];

/** In German, Deutsch is the home language (📖) and Englisch the foreign one. */
const GERMAN_EMOJI: Record<string, string> = { German: "📖", English: "🫖" };

const byKey = new Map(ALL.map((p) => [p.name, p]));

/** A suggestion as a chip in `locale` ("Mathe" in German), remembering which preset it is. */
export function presetChip(key: string, locale: Locale): Picked {
  const p = byKey.get(key)!;
  return locale === "de"
    ? { name: p.de, emoji: GERMAN_EMOJI[key] ?? p.emoji, color: p.color, preset: key }
    : { name: p.name, emoji: p.emoji, color: p.color, preset: key };
}

/** The onboarding suggestions in `locale`, in the order a student there would expect. */
export function presetChips(locale: Locale): Picked[] {
  if (locale === "en") return SUBJECT_PRESETS.map((p) => presetChip(p.name, locale));
  const rest = ALL.map((p) => p.name).filter((key) => !GERMAN_ORDER.includes(key));
  return [...GERMAN_ORDER, ...rest].map((key) => presetChip(key, locale));
}

/** The preset a typed or saved name refers to, in either language ("Mathe" or "math" → "Math"). */
export function findPreset(name: string): string | undefined {
  const n = name.trim().toLowerCase();
  return ALL.find((p) => p.name.toLowerCase() === n || p.de.toLowerCase() === n)?.name;
}

/** Every name a preset goes by, to spot it among existing subjects. */
export function presetNames(key: string): string[] {
  const p = byKey.get(key);
  return p ? [p.name, p.de] : [key];
}
