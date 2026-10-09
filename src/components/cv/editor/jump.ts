import { cvId, newEntry, newSection, sectionHasContent, type CvCheck } from "@/cv/model";
import type { Cv, CvSection, CvSectionKind } from "@/cv/types";
import { OPEN_PART_EVENT, sectionInsertIndex } from "../form/edit";

// The checklist and the "too long" notice jump to a card of the form. Every card has an id:
// cv-part-person, cv-part-summary, cv-part-<section id>, cv-part-closing, cv-part-add.

/** Text fields a student types into (not the hidden photo input, checkboxes or colour wells). */
const TEXT_FIELDS = 'input:not([type="file"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="range"]), textarea';
/**
 * A list's "+ Schule hinzufügen" button, for a section with nothing to type in yet: the dashed
 * AddButton under a list (form/ui.tsx), or the button in an empty list's dashed box (EntryList).
 * Not the dashed suggestion chips, which are not full width.
 */
const ADD_BUTTON = "button.w-full.border-dashed:has(> svg.lucide-plus), div.border-dashed > button:has(> svg.lucide-plus)";

export type PartTarget = {
  /** The part after "cv-part-". */
  part: string;
  /** No such section yet: add one of this kind first. */
  add?: CvSectionKind;
  /** What to focus inside the card: the first empty match of the first selector that has one. */
  focus?: string[];
};

function sectionTarget(cv: Cv, kinds: CvSectionKind[]): PartTarget {
  const list = cv.sections.filter((s) => kinds.includes(s.kind));
  const s = list.find(sectionHasContent) ?? list.find((x) => !x.hidden) ?? list[0];
  // A section added from here comes with its first row: the focus goes into it.
  return { part: s?.id ?? "", add: s ? undefined : kinds[0], focus: [TEXT_FIELDS, ADD_BUTTON] };
}

/** Where a checklist point is filled in. */
export function checkTarget(cv: Cv, check: CvCheck): PartTarget {
  switch (check) {
    case "name":
      return { part: "person", focus: [TEXT_FIELDS] };
    case "contact":
      return { part: "person", focus: ['input[type="email"]', 'input[type="tel"]'] };
    case "address":
      return { part: "person", focus: ['input[autocomplete="address-level2"]', 'input[autocomplete="address-line1"]', 'input[autocomplete="postal-code"]'] };
    case "photo":
      return { part: "person", focus: ["[data-cv-photo-button]"] };
    case "summary":
      return { part: "summary", focus: ["textarea"] };
    case "signature":
      return { part: "closing", focus: ["[data-cv-signature-button]"] };
    case "education":
      return sectionTarget(cv, ["education"]);
    case "practice":
      return sectionTarget(cv, ["internships", "experience", "volunteering"]);
    case "skills":
      return sectionTarget(cv, ["skills"]);
    case "languages":
      return sectionTarget(cv, ["languages"]);
  }
}

/**
 * A new section with its first empty row, as the form's "add section" starts one (AddSectionCard),
 * so a jump there lands in a field. (An existing empty list is left alone: the jump goes to its
 * add button, since the form opens only the entries it adds itself.)
 */
function withFirstRow(s: CvSection): CvSection {
  if ("entries" in s) return { ...s, entries: [newEntry()] };
  if (s.kind === "skills") return { ...s, skills: [{ id: cvId(), name: "", level: 3 }] };
  if (s.kind === "languages") return { ...s, languages: [{ id: cvId(), name: "", level: "good", cefr: "" }] };
  return s;
}

/** Adds a section (with its first row) where the form would: school first, hobbies last. Returns the CV and the new id. */
export function addSection(cv: Cv, kind: CvSectionKind): { cv: Cv; id: string } {
  const section = withFirstRow(newSection(kind));
  const sections = [...cv.sections];
  sections.splice(sectionInsertIndex(sections, kind), 0, section);
  return { cv: { ...cv, sections }, id: section.id };
}

function blobColour(alpha: number) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--blob").trim();
  const m = /^#([0-9a-f]{6})$/i.exec(raw);
  const n = m ? parseInt(m[1], 16) : 0x6d3df5;
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha})`;
}

/** A soft ring that pulses once around the card, so the eye finds it after the scroll. */
function glow(el: HTMLElement, delay: number) {
  if (typeof el.animate !== "function") return;
  el.animate(
    [
      { boxShadow: `0 0 0 0px ${blobColour(0)}` },
      { boxShadow: `0 0 0 4px ${blobColour(0.5)}`, offset: 0.18 },
      { boxShadow: `0 0 0 4px ${blobColour(0.38)}`, offset: 0.6 },
      { boxShadow: `0 0 0 10px ${blobColour(0)}` },
    ],
    { duration: 1700, delay, easing: "ease-out" },
  );
}

const isEmpty = (f: HTMLElement) => (f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement) && !f.value.trim();

/**
 * Where to go inside a card: the first empty field of the first selector that has one, else the
 * first match of the first selector that matches at all (a filled field, or the add button).
 */
function findTarget(card: HTMLElement, selectors: string[]): HTMLElement | null {
  // Not the section's own heading field in the card header.
  const find = (selector: string) => {
    try {
      return Array.from(card.querySelectorAll<HTMLElement>(selector)).filter((f) => f.getClientRects().length > 0 && !f.id.endsWith("-title"));
    } catch {
      return []; // a browser without :has()
    }
  };
  for (const selector of selectors) {
    const empty = find(selector).find(isEmpty);
    if (empty) return empty;
  }
  for (const selector of selectors) {
    const [first] = find(selector);
    if (first) return first;
  }
  return null;
}

/** Unfolds one entry of a card (the form folds entries to a one-line summary) and shows its details. */
function revealEntry(card: HTMLElement, entry: { id: string; heading: string }, smooth: boolean) {
  const textId = `cvf-${entry.id}-text`;
  if (!document.getElementById(textId) && entry.heading) {
    const toggle = Array.from(card.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]')).find((b) => b.textContent?.trim().startsWith(entry.heading));
    toggle?.click();
  }
  window.setTimeout(() => {
    const text = document.getElementById(textId);
    if (!text) return;
    text.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
    if (window.matchMedia("(pointer: fine)").matches) text.focus({ preventScroll: true });
  }, 120);
}

/**
 * Scrolls the form to a card, opens it if it is folded and makes it glow for a moment. Waits a
 * little for cards that are about to appear (a section just added, the form just switched to).
 * With `entry`, it also unfolds that entry and goes to its details.
 */
export function revealPart(part: string, focus?: string[], entry?: { id: string; heading: string }) {
  const id = `cv-part-${part}`;
  let tries = 0;
  const run = () => {
    const el = document.getElementById(id);
    if (!el || !el.getClientRects().length) {
      if (tries++ < 25) window.setTimeout(run, 40);
      return;
    }
    // A folded card unfolds when it hears this (FormCard).
    el.dispatchEvent(new CustomEvent(OPEN_PART_EVENT));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior = reduced ? "auto" : "smooth";
    glow(el, reduced ? 0 : 280);
    if (entry) {
      el.scrollIntoView({ behavior, block: "start" });
      // A card that was folded draws its entries a moment later.
      window.setTimeout(() => revealEntry(el, entry, !reduced), 60);
      return;
    }
    // A folded card needs a frame or two to draw its fields.
    let frames = 0;
    const land = () => {
      const target = focus ? findTarget(el, focus) : null;
      if (focus && !target && frames++ < 8) return void window.requestAnimationFrame(land);
      // The field itself in the middle of the view: the top of a tall card can leave it below the fold.
      if (target) target.scrollIntoView({ behavior, block: "center" });
      else el.scrollIntoView({ behavior, block: "start" });
      // Only with a mouse: on a phone a keyboard popping up after a jump is more confusing than helpful.
      if (target && window.matchMedia("(pointer: fine)").matches) window.setTimeout(() => target.focus({ preventScroll: true }), reduced ? 0 : 480);
    };
    window.requestAnimationFrame(land);
  };
  window.requestAnimationFrame(run);
}
