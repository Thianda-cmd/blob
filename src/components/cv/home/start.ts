import { newCv } from "@/cv/model";
import { sampleCv } from "@/cv/samples";
import type { Cv, CvTemplateId } from "@/cv/types";
import type { Locale } from "@/i18n/config";

export type CvStart = "blank" | "example";

/** "Lena Marie Schneider" → first names "Lena Marie", last name "Schneider". */
export function splitName(full: string | null | undefined) {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

/** What a new CV starts with: Lena's example, or an empty CV with the student's name and email. */
export function startCv(start: CvStart, lang: Locale, template: CvTemplateId, me: { name: string | null; email: string }): Cv {
  if (start === "example") return sampleCv(lang, template);
  const cv = newCv(lang, template);
  return { ...cv, person: { ...cv.person, ...splitName(me.name), email: me.email.slice(0, 120) } };
}

const SAMPLE = sampleCv("de").person;

/**
 * Whether the CV still has Lena's contact details from the example (her email, phone or address).
 * Such a CV counts as complete, but it isn't the student's yet, so it must not say "ready to send".
 */
export function isSampleCv(cv: Pick<Cv, "person">) {
  const p = cv.person;
  return p.email.trim() === SAMPLE.email || p.phone.trim() === SAMPLE.phone || (p.street.trim() === SAMPLE.street && p.postalCode.trim() === SAMPLE.postalCode);
}
