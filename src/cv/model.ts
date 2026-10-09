import { isLocale, type Locale } from "@/i18n/config";
import { templateMeta, CV_TEMPLATES } from "./catalog";
import { CV_FONT_IDS } from "./fonts";
import { CV_LABELS } from "./labels";
import type {
  Cv,
  CvCefr,
  CvDate,
  CvDesign,
  CvEntry,
  CvEntryKind,
  CvLanguage,
  CvLanguageLevel,
  CvPerson,
  CvSection,
  CvSectionKind,
  CvSignature,
  CvSkill,
  CvTemplateId,
} from "./types";

/** Short id for entries and sections (unique within one CV). */
export const cvId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);

export const ENTRY_KINDS: CvEntryKind[] = ["education", "internships", "experience", "volunteering", "courses", "awards", "custom"];
/** Every kind of section, in the order the "add section" menu lists them. */
export const SECTION_KINDS: CvSectionKind[] = ["education", "internships", "experience", "volunteering", "courses", "awards", "skills", "languages", "interests", "custom"];
export const LANGUAGE_LEVELS: CvLanguageLevel[] = ["native", "fluent", "good", "basic", "school"];
export const CEFR_LEVELS: CvCefr[] = ["", "A1", "A2", "B1", "B2", "C1", "C2"];

export const isEntryKind = (kind: CvSectionKind): kind is CvEntryKind => (ENTRY_KINDS as string[]).includes(kind);

// --- Reading stored CVs ----------------------------------------------------------------------

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const hex = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback);
const date = (v: unknown): CvDate => (typeof v === "string" && /^\d{4}(-(0[1-9]|1[0-2]))?$/.test(v) ? v : "");
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const id = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : cvId());

const TEMPLATE_IDS = CV_TEMPLATES.map((t) => t.id);

function design(raw: unknown): CvDesign {
  const o = obj(raw);
  const template = pick<CvTemplateId>(o.template, TEMPLATE_IDS, "classic");
  const meta = templateMeta(template);
  return {
    template,
    accent: hex(o.accent, meta.accent),
    fonts: pick(o.fonts, CV_FONT_IDS, meta.fonts),
    portrait: pick(o.portrait, ["photo", "initials", "none"] as const, "photo"),
    photoShape: pick(o.photoShape, ["circle", "rounded", "square"] as const, "rounded"),
    size: pick(o.size, ["s", "m", "l"] as const, "m"),
    dates: pick(o.dates, ["numeric", "long"] as const, "numeric"),
  };
}

function person(raw: unknown): CvPerson {
  const o = obj(raw);
  const crop = obj(o.photoCrop);
  const photo = str(o.photo, 600);
  return {
    firstName: str(o.firstName, 80),
    lastName: str(o.lastName, 80),
    headline: str(o.headline, 160),
    photo: /^https:\/\//.test(photo) ? photo : null,
    photoCrop: { x: num(crop.x, 0, 100, 50), y: num(crop.y, 0, 100, 40), zoom: num(crop.zoom, 1, 4, 1) },
    email: str(o.email, 120),
    phone: str(o.phone, 60),
    street: str(o.street, 120),
    postalCode: str(o.postalCode, 20),
    city: str(o.city, 80),
    birthDate: day(o.birthDate),
    birthPlace: str(o.birthPlace, 80),
    nationality: str(o.nationality, 80),
    links: arr(o.links)
      .slice(0, 6)
      .map((l) => obj(l))
      .map((l) => ({ id: id(l.id), label: str(l.label, 60), url: str(l.url, 300) })),
  };
}

function entry(raw: unknown): CvEntry {
  const o = obj(raw);
  return {
    id: id(o.id),
    title: str(o.title, 200),
    org: str(o.org, 200),
    place: str(o.place, 120),
    start: date(o.start),
    end: date(o.end),
    current: bool(o.current, false),
    text: str(o.text, 3000),
  };
}

function section(raw: unknown): CvSection | null {
  const o = obj(raw);
  const kind = pick<CvSectionKind | "">(o.kind, SECTION_KINDS, "");
  if (!kind) return null;
  const base = { id: id(o.id), title: str(o.title, 80), hidden: bool(o.hidden, false) };
  if (kind === "skills") {
    const skills = arr(o.skills)
      .slice(0, 60)
      .map((s) => obj(s))
      .map((s): CvSkill => ({ id: id(s.id), name: str(s.name, 80), level: Math.round(num(s.level, 0, 5, 0)) }));
    return { ...base, kind, skills, showLevels: bool(o.showLevels, true) };
  }
  if (kind === "languages") {
    const languages = arr(o.languages)
      .slice(0, 20)
      .map((l) => obj(l))
      .map((l): CvLanguage => ({ id: id(l.id), name: str(l.name, 60), level: pick(l.level, LANGUAGE_LEVELS, "good"), cefr: pick(l.cefr, CEFR_LEVELS, "") }));
    return { ...base, kind, languages };
  }
  if (kind === "interests") return { ...base, kind, text: str(o.text, 1000) };
  return { ...base, kind, entries: arr(o.entries).slice(0, 40).map(entry) };
}

function signature(raw: unknown): CvSignature | null {
  const o = obj(raw);
  const d = str(o.d, 40000);
  if (!d || !/^[MLQCZmlqcz0-9.,\s-]+$/.test(d)) return null;
  return { d, w: num(o.w, 1, 4000, 400), h: num(o.h, 1, 2000, 120) };
}

/** A CV as stored (possibly old, partial or hand-edited) with every field present and valid. */
export function normalizeCv(raw: unknown, fallbackLang: Locale = "de"): Cv {
  const o = obj(raw);
  const closing = obj(o.closing);
  const sections = arr(o.sections).slice(0, 30).map(section).filter((s): s is CvSection => s !== null);
  return {
    version: 1,
    lang: isLocale(o.lang) ? o.lang : fallbackLang,
    design: design(o.design),
    person: person(o.person),
    summary: str(o.summary, 1500),
    sections: Object.keys(o).length ? sections : defaultSections(),
    closing: { show: bool(closing.show, true), place: str(closing.place, 80), date: day(closing.date), signature: signature(closing.signature) },
  };
}

// --- New CVs ----------------------------------------------------------------------------------

export function newSection(kind: CvSectionKind): CvSection {
  const base = { id: cvId(), title: "", hidden: false };
  if (kind === "skills") return { ...base, kind, skills: [], showLevels: true };
  if (kind === "languages") return { ...base, kind, languages: [] };
  if (kind === "interests") return { ...base, kind, text: "" };
  return { ...base, kind, entries: [] };
}

export const newEntry = (): CvEntry => ({ id: cvId(), title: "", org: "", place: "", start: "", end: "", current: false, text: "" });

/** The sections a new CV starts with: what most school students fill in. */
const defaultSections = () => (["education", "internships", "experience", "skills", "languages", "interests"] as CvSectionKind[]).map(newSection);

/** An empty CV in `lang`, with the usual sections ready to fill. */
export function newCv(lang: Locale, template: CvTemplateId = "classic"): Cv {
  return {
    ...normalizeCv({}, lang),
    lang,
    design: design({ template }),
    sections: defaultSections(),
  };
}

// --- Formatting ---------------------------------------------------------------------------------

/** "2024-03" → "03/2024" (numeric) or "März 2024" (long); "2024" → "2024". */
export function formatMonth(value: CvDate, lang: Locale, style: CvDesign["dates"]): string {
  if (!value) return "";
  const [y, m] = value.split("-");
  if (!m) return y;
  return style === "long" ? `${CV_LABELS[lang].months[Number(m) - 1]} ${y}` : `${m}/${y}`;
}

/** The date column of an entry: "08/2019 – 07/2025", "seit 09/2024", "bis 07/2025", "2023". */
export function formatRange(e: Pick<CvEntry, "start" | "end" | "current">, lang: Locale, style: CvDesign["dates"]): string {
  const l = CV_LABELS[lang];
  const a = formatMonth(e.start, lang, style);
  const b = e.current ? "" : formatMonth(e.end, lang, style);
  if (e.current) return a ? (lang === "de" ? l.since(a) : `${a} – ${l.present}`) : l.present;
  if (a && b) return a === b ? a : `${a} – ${b}`;
  if (b) return l.until(b);
  return a;
}

/** "2009-03-12" → "12.03.2009" / "12 March 2009". */
export function formatDay(value: string, lang: Locale): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return "";
  const [, y, mo, d] = m;
  return lang === "de" ? `${d}.${mo}.${y}` : `${Number(d)} ${CV_LABELS.en.months[Number(mo) - 1]} ${y}`;
}

/** Today as "YYYY-MM-DD" in the browser's time zone. */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const fullName = (p: Pick<CvPerson, "firstName" | "lastName">) => `${p.firstName} ${p.lastName}`.trim();

export const sectionTitle = (s: CvSection, lang: Locale) => s.title.trim() || CV_LABELS[lang].headings[s.kind];

/** A language's level as written on the CV: "Englisch – Gute Kenntnisse (B1)". */
export const languageLevel = (l: CvLanguage, lang: Locale) => `${CV_LABELS[lang].languageLevels[l.level]}${l.cefr ? ` (${l.cefr})` : ""}`;

/** Hobbies typed one per line or separated by commas. */
export const interestList = (text: string) =>
  text
    .split(/\n|,|;|·/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Entry details as paragraphs and bullet points ("- " or "• " at the start of a line). */
export function textBlocks(text: string): ({ type: "p"; text: string } | { type: "ul"; items: string[] })[] {
  const out: ({ type: "p"; text: string } | { type: "ul"; items: string[] })[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-•*–]\s+(.*)$/.exec(line);
    const last = out[out.length - 1];
    if (bullet) {
      if (last?.type === "ul") last.items.push(bullet[1]);
      else out.push({ type: "ul", items: [bullet[1]] });
    } else out.push({ type: "p", text: line });
  }
  return out;
}

// --- What shows on the page --------------------------------------------------------------------

const filled = (e: CvEntry) => Boolean(e.title.trim() || e.org.trim() || e.text.trim());

/** A section with something to show (empty ones are left off the page, but stay in the editor). */
export function sectionHasContent(s: CvSection) {
  if (s.hidden) return false;
  switch (s.kind) {
    case "skills":
      return s.skills.some((k) => k.name.trim());
    case "languages":
      return s.languages.some((l) => l.name.trim());
    case "interests":
      return interestList(s.text).length > 0;
    default:
      return s.entries.some(filled);
  }
}

/** The sections that appear on the page, with empty entries and items left out. */
export function visibleSections(cv: Cv): CvSection[] {
  return cv.sections.filter(sectionHasContent).map((s) => {
    switch (s.kind) {
      case "skills":
        return { ...s, skills: s.skills.filter((k) => k.name.trim()) };
      case "languages":
        return { ...s, languages: s.languages.filter((l) => l.name.trim()) };
      case "interests":
        return s;
      default:
        return { ...s, entries: s.entries.filter(filled) };
    }
  });
}

/** Contact and personal lines, in the order designs show them. Empty ones are left out. */
export function contactLines(cv: Cv) {
  const p = cv.person;
  const l = CV_LABELS[cv.lang];
  const address = [p.street, [p.postalCode, p.city].filter(Boolean).join(" ")].filter((s) => s.trim()).join(", ");
  const lines: { kind: "email" | "phone" | "address" | "birth" | "nationality" | "link"; label: string; value: string; href?: string }[] = [];
  if (p.phone.trim()) lines.push({ kind: "phone", label: l.phone, value: p.phone.trim(), href: `tel:${p.phone.replace(/[^\d+]/g, "")}` });
  if (p.email.trim()) lines.push({ kind: "email", label: l.email, value: p.email.trim(), href: `mailto:${p.email.trim()}` });
  if (address) lines.push({ kind: "address", label: l.address, value: address });
  if (p.birthDate || p.birthPlace.trim()) lines.push({ kind: "birth", label: l.birth, value: l.bornOn(formatDay(p.birthDate, cv.lang), p.birthPlace.trim()) });
  if (p.nationality.trim()) lines.push({ kind: "nationality", label: l.nationality, value: p.nationality.trim() });
  for (const link of p.links) {
    const url = link.url.trim();
    if (!url) continue;
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    lines.push({ kind: "link", label: link.label.trim() || l.links, value: url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""), href });
  }
  return lines;
}

/** Everything written in the CV as one string, for search. */
export function cvPlainText(cv: Cv) {
  const p = cv.person;
  const parts = [fullName(p), p.headline, p.city, cv.summary];
  for (const s of cv.sections) {
    parts.push(s.title);
    if (s.kind === "skills") parts.push(...s.skills.map((k) => k.name));
    else if (s.kind === "languages") parts.push(...s.languages.map((l) => l.name));
    else if (s.kind === "interests") parts.push(s.text);
    else for (const e of s.entries) parts.push(e.title, e.org, e.place, e.text);
  }
  return parts
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 20000);
}

/** A page title for a CV: "Lebenslauf – Lena Schneider" (or just "Lebenslauf"). */
export function cvTitle(cv: Pick<Cv, "lang" | "person">) {
  const name = fullName(cv.person);
  return name ? `${CV_LABELS[cv.lang].document} – ${name}` : CV_LABELS[cv.lang].document;
}

/** A file name for the PDF: "Lebenslauf_Lena_Schneider". */
export function cvFileName(cv: Pick<Cv, "lang" | "person">) {
  return cvTitle(cv)
    .replace(/\s*–\s*/g, "_")
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .replace(/_+/g, "_");
}

// --- How complete is it? ------------------------------------------------------------------------

export type CvCheck = "name" | "contact" | "address" | "photo" | "summary" | "education" | "practice" | "skills" | "languages" | "signature";

/** What a good school CV has. The editor shows these as a checklist with tips. `optional` ones don't count against 100 %. */
export function cvChecklist(cv: Cv): { id: CvCheck; done: boolean; optional?: boolean }[] {
  const p = cv.person;
  const has = (kind: CvSectionKind) => cv.sections.some((s) => s.kind === kind && sectionHasContent(s));
  return [
    { id: "name", done: Boolean(p.firstName.trim() && p.lastName.trim()) },
    { id: "contact", done: Boolean(p.email.trim() && p.phone.trim()) },
    { id: "address", done: Boolean(p.city.trim()) },
    { id: "education", done: has("education") },
    { id: "practice", done: has("internships") || has("experience") || has("volunteering") },
    { id: "skills", done: has("skills") },
    { id: "languages", done: has("languages") },
    { id: "summary", done: cv.summary.trim().length >= 40 },
    { id: "photo", done: Boolean(p.photo), optional: true },
    { id: "signature", done: !cv.closing.show || Boolean(cv.closing.signature), optional: true },
  ];
}

/** 0–100: the share of required checklist items that are done. */
export function cvProgress(cv: Cv) {
  const required = cvChecklist(cv).filter((c) => !c.optional);
  return Math.round((required.filter((c) => c.done).length / required.length) * 100);
}
