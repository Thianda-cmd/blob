import type { Locale } from "@/i18n/config";

// A CV (Lebenslauf) as stored in `pages.content` for pages of kind "cv".
// Stored CVs may be older or hand-edited: always read them through normalizeCv (src/cv/model.ts).

export type CvTemplateId = "classic" | "modern" | "minimal" | "creative" | "compact" | "elegant";

/** Heading and body typeface, chosen as a pair (src/cv/fonts.ts). */
export type CvFontPair = "clean" | "friendly" | "modern" | "classic" | "elegant" | "editorial";

export type CvDesign = {
  template: CvTemplateId;
  /** #rrggbb */
  accent: string;
  fonts: CvFontPair;
  /** The picture by the name: the photo (initials until one is added), always the initials, or nothing. */
  portrait: "photo" | "initials" | "none";
  photoShape: "circle" | "rounded" | "square";
  /** Text size: small fits more on a page. */
  size: "s" | "m" | "l";
  /** "08/2019 – 07/2025" or "August 2019 – Juli 2025". */
  dates: "numeric" | "long";
};

/** Which part of the photo shows: focus point in % (0–100) and zoom (1 = cover the frame exactly). */
export type CvPhotoCrop = { x: number; y: number; zoom: number };

export type CvLink = { id: string; label: string; url: string };

export type CvPerson = {
  firstName: string;
  lastName: string;
  /** One line under the name: "Schülerin, 10. Klasse" or "Bewerbung um einen Ausbildungsplatz als …". */
  headline: string;
  /** Public URL in the uploads bucket. */
  photo: string | null;
  photoCrop: CvPhotoCrop;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  /** "YYYY-MM-DD" or "". */
  birthDate: string;
  birthPlace: string;
  nationality: string;
  links: CvLink[];
};

/** "YYYY", "YYYY-MM" or "" (not given). */
export type CvDate = string;

/** One line in a timeline section: a school, an internship, a job, a course… */
export type CvEntry = {
  id: string;
  /** What: "Praktikum als Tiermedizinische Fachangestellte", "Mittlerer Schulabschluss (angestrebt)". */
  title: string;
  /** Where: school, company or organisation. */
  org: string;
  place: string;
  start: CvDate;
  end: CvDate;
  /** Still going ("seit 09/2024" / "09/2024 – heute"); `end` is ignored. */
  current: boolean;
  /** Details. Lines starting with "- " or "• " are bullet points, other lines are paragraphs. */
  text: string;
};

/** A skill with an optional level from 1 to 5 (0 = no level shown). */
export type CvSkill = { id: string; name: string; level: number };

export type CvLanguageLevel = "native" | "fluent" | "good" | "basic" | "school";
export type CvCefr = "" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type CvLanguage = { id: string; name: string; level: CvLanguageLevel; cefr: CvCefr };

/** Sections made of timeline entries. */
export type CvEntryKind = "education" | "internships" | "experience" | "volunteering" | "courses" | "awards" | "custom";
export type CvSectionKind = CvEntryKind | "skills" | "languages" | "interests";

type SectionBase = {
  id: string;
  /** "" shows the default heading for the kind in the CV's language. */
  title: string;
  hidden: boolean;
};

export type CvEntrySection = SectionBase & { kind: CvEntryKind; entries: CvEntry[] };
export type CvSkillSection = SectionBase & { kind: "skills"; skills: CvSkill[]; showLevels: boolean };
export type CvLanguageSection = SectionBase & { kind: "languages"; languages: CvLanguage[] };
/** Hobbies and interests: one per line or separated by commas. */
export type CvInterestSection = SectionBase & { kind: "interests"; text: string };

export type CvSection = CvEntrySection | CvSkillSection | CvLanguageSection | CvInterestSection;

/** A handwritten signature: SVG path data in a box of w × h units. */
export type CvSignature = { d: string; w: number; h: number };

/** "Ort, Datum" and signature at the end, as German CVs usually have. */
export type CvClosing = {
  show: boolean;
  place: string;
  /** "YYYY-MM-DD", or "" for the day it is shown or printed. */
  date: string;
  signature: CvSignature | null;
};

export type Cv = {
  version: 1;
  /** The language the CV itself is written in (headings, dates). The app's language can differ. */
  lang: Locale;
  design: CvDesign;
  person: CvPerson;
  /** Short profile ("Kurzprofil"); empty hides it. */
  summary: string;
  sections: CvSection[];
  closing: CvClosing;
};
