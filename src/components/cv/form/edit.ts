import type { KeyboardEvent } from "react";
import type { Cv, CvEntry, CvPerson, CvSection, CvSectionKind } from "@/cv/types";
import { BLANK } from "./examples";

// Small immutable updaters for the form: every edit is a function Cv → Cv handed to change().

export const setPerson = (patch: Partial<CvPerson>) => (cv: Cv): Cv => ({ ...cv, person: { ...cv.person, ...patch } });

export const setClosing = (patch: Partial<Cv["closing"]>) => (cv: Cv): Cv => ({ ...cv, closing: { ...cv.closing, ...patch } });

/** Change one section (by id); the function gets and returns the section. */
export function updateSection<S extends CvSection>(id: string, fn: (s: S) => S) {
  return (cv: Cv): Cv => ({ ...cv, sections: cv.sections.map((s) => (s.id === id ? fn(s as S) : s)) });
}

/** Change one entry of an entry section. */
export function updateEntry(sectionId: string, entryId: string, patch: Partial<CvEntry>) {
  return updateSection<Extract<CvSection, { entries: CvEntry[] }>>(sectionId, (s) => ({
    ...s,
    entries: s.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
  }));
}

/** A copy of `list` with item `i` moved by `by` places (clamped). */
export function move<T>(list: T[], i: number, by: number): T[] {
  const j = Math.max(0, Math.min(list.length - 1, i + by));
  if (i === j || i < 0) return list;
  const next = list.slice();
  const [item] = next.splice(i, 1);
  next.splice(j, 0, item);
  return next;
}

export const insertAt = <T>(list: T[], i: number, item: T) => [...list.slice(0, i), item, ...list.slice(i)];

export const removeAt = <T>(list: T[], i: number) => [...list.slice(0, i), ...list.slice(i + 1)];

/** School first, then the practical sections in this order (the usual order of a German CV). */
const TIMELINE_RANK: Partial<Record<CvSectionKind, number>> = { education: 0, internships: 1, experience: 2, volunteering: 3 };

/**
 * Where a new section of this kind goes, so the printed CV keeps a sensible order without the
 * student moving it: school first, practical experience after school (placements before jobs before
 * volunteering), everything else before the hobbies, which close the CV.
 */
export function sectionInsertIndex(sections: CvSection[], kind: CvSectionKind) {
  if (kind === "education") return 0;
  const rank = TIMELINE_RANK[kind];
  if (rank !== undefined) {
    let at = 0;
    sections.forEach((s, i) => {
      const r = TIMELINE_RANK[s.kind];
      if (r !== undefined && r <= rank) at = i + 1;
    });
    return at;
  }
  const hobbies = sections.findIndex((s) => s.kind === "interests");
  return hobbies >= 0 && kind !== "interests" ? hobbies : sections.length;
}

/** Entries still blank (nothing typed or picked): removing them needs no undo, new ones open. */
export const blankEntry = (e: CvEntry) => !e.title.trim() && !e.org.trim() && !e.place.trim() && !e.start && !e.end && !e.current && !e.text.trim();

/** For sorting "newest first": an entry still going counts as now. */
export const entryKey = (e: CvEntry) => (e.current ? "9999-99" : e.end || e.start || "");

// --- Focus and scrolling ---------------------------------------------------------------------

/** Focuses the field with this id once it is on the page (after the change that adds it renders). */
export function focusSoon(id: string, opts: { select?: boolean; caret?: "end" } = {}) {
  let tries = 0;
  const run = () => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement | null;
    if (!el) {
      if (tries++ < 8) requestAnimationFrame(run);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (opts.select) el.select();
      else if (opts.caret === "end") el.setSelectionRange(el.value.length, el.value.length);
    }
  };
  requestAnimationFrame(run);
}

/** The event a form card listens for to unfold itself (see openCvPart). */
export const OPEN_PART_EVENT = "cv-open-part";

/**
 * Unfolds a form card and scrolls it into view: `openCvPart("cv-part-person")`, `"cv-part-summary"`,
 * `"cv-part-" + section.id`, `"cv-part-closing"`, `"cv-part-add"`. Returns false if it isn't on the page.
 */
export function openCvPart(partId: string) {
  const el = document.getElementById(partId);
  if (!el) return false;
  el.dispatchEvent(new CustomEvent(OPEN_PART_EVENT));
  requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  return true;
}

/** Selects the next "…" gap after the caret (wrapping around). Returns false if there is none. */
export function selectNextBlank(el: HTMLInputElement | HTMLTextAreaElement, from = el.selectionEnd ?? 0) {
  const text = el.value;
  let i = text.indexOf(BLANK, from);
  if (i < 0) i = text.indexOf(BLANK);
  if (i < 0) return false;
  el.focus({ preventScroll: true });
  el.setSelectionRange(i, i + BLANK.length);
  return true;
}

/**
 * Enter in a one-line field moves on to the next field of the form (like the "next" key on a phone
 * keyboard) instead of submitting anything.
 */
export function enterToNext(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter" || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey || e.nativeEvent.isComposing) return;
  e.preventDefault();
  focusNextField(e.currentTarget);
}

export function focusNextField(from: HTMLElement) {
  const root = from.closest("[data-cv-form]");
  if (!root) return;
  const fields = Array.from(
    root.querySelectorAll<HTMLElement>("input:not([type=checkbox]):not([type=file]):not([disabled]), select:not([disabled]), textarea:not([disabled])"),
  ).filter((el) => el.offsetParent !== null && el.tabIndex >= 0);
  const next = fields[fields.indexOf(from) + 1];
  if (next) {
    next.focus();
    next.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } else from.blur();
}
