import type { DeckContent, DeckTheme, Slide, SlideLayout } from "@/lib/types";

/**
 * Deck model helpers. Pure functions, safe to import from server components
 * (the presenter normalizes content on the server).
 */

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

export const LAYOUTS: { id: SlideLayout; label: string; hint: string }[] = [
  { id: "title", label: "Title", hint: "Big title and a subtitle" },
  { id: "bullets", label: "Bullets", hint: "A heading and a list" },
  { id: "split", label: "Split", hint: "Text beside an image or text" },
  { id: "quote", label: "Quote", hint: "A quote and who said it" },
  { id: "image", label: "Image", hint: "A picture with a caption" },
  { id: "big", label: "Big", hint: "One huge number or word" },
];

export const THEMES: { id: DeckTheme; label: string; hint: string }[] = [
  { id: "paper", label: "Paper", hint: "Light and calm" },
  { id: "ink", label: "Ink", hint: "Dark, high contrast" },
  { id: "blob", label: "Blob", hint: "Bold and orange" },
];

/** Fixed slide palettes. Slides are content, so they never follow the app's light/dark mode. */
export const THEME_COLORS: Record<
  DeckTheme,
  { bg: string; fg: string; fg2: string; fg3: string; accent: string; line: string; panel: string; title: string }
> = {
  paper: {
    bg: "#f8f6f0",
    title: "#1c1b18",
    fg: "#1c1b18",
    fg2: "#55534c",
    fg3: "#8b8981",
    accent: "#ff6a2b",
    line: "#e3e0d6",
    panel: "#eeebe2",
  },
  ink: {
    bg: "#161614",
    title: "#f6f4ee",
    fg: "#f1efe8",
    fg2: "#aeaca3",
    fg3: "#76746c",
    accent: "#ff7a3d",
    line: "#2e2d29",
    panel: "#22221f",
  },
  blob: {
    bg: "#ff6a2b",
    title: "#ffffff",
    fg: "#1c1b18",
    fg2: "#3b1d0e",
    fg3: "#8a3a14",
    accent: "#1c1b18",
    line: "#ff8a55",
    panel: "#f25c1d",
  },
};

const LAYOUT_IDS = new Set<SlideLayout>(LAYOUTS.map((l) => l.id));
const THEME_IDS = new Set<DeckTheme>(THEMES.map((t) => t.id));

function newId() {
  return crypto.randomUUID();
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** A fresh, empty slide. The editor shows placeholders until you type. */
export function newSlide(layout: SlideLayout = "bullets"): Slide {
  return { id: newId(), layout, title: "", body: "", image: null, notes: "" };
}

/**
 * Ids for repaired slides must be deterministic: the editor normalizes on the server
 * and again while hydrating, and both renders have to agree.
 */
function repairId(wanted: string, index: number, seen: Set<string>) {
  let id = wanted || `slide-${index + 1}`;
  for (let n = 2; seen.has(id); n++) id = `${wanted || "slide"}-${index + 1}-${n}`;
  return id;
}

function normalizeSlide(raw: unknown, index: number, seen: Set<string>): Slide | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = repairId(str(r.id).slice(0, 100), index, seen);
  seen.add(id);
  const layout = LAYOUT_IDS.has(r.layout as SlideLayout) ? (r.layout as SlideLayout) : "bullets";
  const image = typeof r.image === "string" ? cleanImageUrl(r.image) : null;
  return { id, layout, title: str(r.title), body: str(r.body), image, notes: str(r.notes) };
}

/** Turn whatever is stored in `pages.content` into a valid deck with at least one slide. */
export function normalizeDeck(raw: unknown): DeckContent {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const theme = THEME_IDS.has(r.theme as DeckTheme) ? (r.theme as DeckTheme) : "paper";
  const seen = new Set<string>();
  const slides = (Array.isArray(r.slides) ? r.slides : [])
    .slice(0, 500)
    .map((s, i) => normalizeSlide(s, i, seen))
    .filter((s): s is Slide => s !== null);
  if (slides.length === 0) slides.push({ ...newSlide("title"), id: "slide-1" });
  return { theme, slides };
}

/** Text used by search: every slide title and body. */
export function deckPlainText(deck: DeckContent) {
  return deck.slides
    .map((s) => [s.title, s.body].map((t) => t.trim()).filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 100_000);
}

/** Non-empty body lines, used for bullets. */
export function bodyLines(body: string) {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/** Rough talk time: ~20s per slide plus everything on it (and in the notes) spoken at 130 wpm. */
export function talkSeconds(deck: DeckContent) {
  return deck.slides.reduce((sum, s) => sum + 20 + ((words(s.title) + words(s.body) + words(s.notes)) / 130) * 60, 0);
}

export function formatTalkTime(seconds: number) {
  if (seconds < 60) return "under a minute";
  const min = Math.round(seconds / 60);
  return `about ${min} min`;
}

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Accept only http(s) image links. */
export function cleanImageUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
