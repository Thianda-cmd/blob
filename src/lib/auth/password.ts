import type { Locale } from "@/i18n/config";
import { authText } from "@/i18n/messages/auth";
import { guessLocale } from "./locale";

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; hint: string };

/** A small, dependency-free password strength estimate, with its label and hint in `locale`. */
export function passwordStrength(pw: string, locale: Locale = guessLocale()): Strength {
  const t = authText[locale].strength;
  if (!pw) return { score: 0, label: "", hint: t.empty };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (/^(.)\1+$/.test(pw) || /^(password|passwort|12345678|qwerty|qwertz)/i.test(pw)) score = 0;
  if (pw.length < 8) score = Math.min(score, 1);

  const s = Math.min(4, score) as Strength["score"];
  return { score: s, label: t.labels[s], hint: t.hints[s] };
}
