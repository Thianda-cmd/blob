import type {
  Deck,
  DeckBackdrop,
  DeckFont,
  DeckPreset,
  DeckTheme,
  DeckThemeSpec,
  Slide,
  SlideBackground,
  SlideBuild,
  SlideItem,
  SlideLayout,
  SlideTransition,
} from "@/lib/types";

/**
 * Deck model helpers. Pure functions, safe to import from server components
 * (the presenter and the deck previews normalize content on the server).
 */

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

// Layouts ---------------------------------------------------------------------

export type LayoutGroup = "essentials" | "images" | "structure" | "emphasis";

/** Group order in the add-slide menu. Names and hints live in `deckText` (src/i18n/messages/deck.ts). */
export const LAYOUT_GROUPS: LayoutGroup[] = ["essentials", "images", "structure", "emphasis"];

export const LAYOUTS: { id: SlideLayout; group: LayoutGroup }[] = [
  { id: "title", group: "essentials" },
  { id: "section", group: "essentials" },
  { id: "agenda", group: "essentials" },
  { id: "bullets", group: "essentials" },
  { id: "closing", group: "essentials" },
  { id: "split", group: "images" },
  { id: "media", group: "images" },
  { id: "image", group: "images" },
  { id: "cover", group: "images" },
  { id: "columns", group: "structure" },
  { id: "compare", group: "structure" },
  { id: "steps", group: "structure" },
  { id: "timeline", group: "structure" },
  { id: "stats", group: "emphasis" },
  { id: "big", group: "emphasis" },
  { id: "quote", group: "emphasis" },
  { id: "formula", group: "emphasis" },
];

/** Layouts built from items (cards), and how many cards they take. */
export const ITEM_LAYOUTS: Partial<Record<SlideLayout, { min: number; max: number; start: number }>> = {
  columns: { min: 2, max: 3, start: 2 },
  compare: { min: 2, max: 2, start: 2 },
  steps: { min: 2, max: 5, start: 3 },
  timeline: { min: 2, max: 6, start: 4 },
  stats: { min: 1, max: 4, start: 3 },
};

/** Layouts with an image slot. */
export const IMAGE_LAYOUTS = new Set<SlideLayout>(["split", "media", "image", "cover"]);

/** Layouts whose content can appear one click at a time. */
export const BUILD_LAYOUTS = new Set<SlideLayout>(["bullets", "agenda", "columns", "compare", "steps", "timeline", "stats", "formula"]);

// Motion ----------------------------------------------------------------------

/** Transition and build ids in menu order. Names and hints live in `deckText`. */
export const TRANSITIONS: SlideTransition[] = ["none", "fade", "slide", "push", "zoom", "morph"];

export const BUILDS: SlideBuild[] = ["none", "fade-up", "pop", "wipe"];

export const DEFAULT_TRANSITION: SlideTransition = "slide";

// Fonts -----------------------------------------------------------------------

export type FontSpec = {
  label: string;
  /** CSS font-family. The --deck-* variables come from fonts.ts, the others from the root layout. */
  family: string;
  kind: "Sans" | "Serif" | "Mono";
  /** Weights for medium, semibold (headings) and bold. Single-weight fonts repeat theirs. */
  weights: [number, number, number];
  /** Multiplier for the tight heading letter-spacing (serifs and monos need less). */
  track: number;
};

const SANS = "ui-sans-serif, system-ui, sans-serif";
const SERIF = "ui-serif, Georgia, serif";

export const FONTS: Record<DeckFont, FontSpec> = {
  bricolage: { label: "Bricolage", family: `var(--font-bricolage), var(--font-geist), ${SANS}`, kind: "Sans", weights: [500, 600, 700], track: 1 },
  geist: { label: "Geist", family: `var(--font-geist), ${SANS}`, kind: "Sans", weights: [500, 600, 700], track: 1 },
  inter: { label: "Inter", family: `var(--deck-inter), ${SANS}`, kind: "Sans", weights: [500, 650, 750], track: 0.85 },
  "dm-sans": { label: "DM Sans", family: `var(--deck-dm-sans), ${SANS}`, kind: "Sans", weights: [500, 650, 750], track: 0.8 },
  space: { label: "Space Grotesk", family: `var(--deck-space), ${SANS}`, kind: "Sans", weights: [500, 600, 700], track: 0.7 },
  fraunces: { label: "Fraunces", family: `var(--deck-fraunces), ${SERIF}`, kind: "Serif", weights: [500, 600, 700], track: 0.55 },
  instrument: { label: "Instrument Serif", family: `var(--deck-instrument), ${SERIF}`, kind: "Serif", weights: [400, 400, 400], track: 0.3 },
  playfair: { label: "Playfair", family: `var(--deck-playfair), ${SERIF}`, kind: "Serif", weights: [500, 600, 700], track: 0.45 },
  "source-serif": { label: "Source Serif", family: `var(--font-serif-math), ${SERIF}`, kind: "Serif", weights: [500, 600, 700], track: 0.45 },
  lora: { label: "Lora", family: `var(--deck-lora), ${SERIF}`, kind: "Serif", weights: [500, 600, 700], track: 0.45 },
  mono: { label: "JetBrains Mono", family: `var(--deck-mono), ui-monospace, monospace`, kind: "Mono", weights: [500, 600, 750], track: 0.25 },
};

export const FONT_IDS = Object.keys(FONTS) as DeckFont[];

// Colour ----------------------------------------------------------------------

type RGB = [number, number, number];

/** "#abc", "abc", "#AABBCC" → "#aabbcc". Anything else → null. */
export function cleanHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let s = value.trim().toLowerCase().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/.test(s)) s = s.replace(/./g, (c) => c + c);
  return /^[0-9a-f]{6}$/.test(s) ? `#${s}` : null;
}

function toRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: RGB) {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Blend: `t` of `a` and the rest of `b`. */
export function mix(a: string, b: string, t: number) {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([x[0] * t + y[0] * (1 - t), x[1] * t + y[1] * (1 - t), x[2] * t + y[2] * (1 - t)]);
}

export function rgba(hex: string, alpha: number) {
  const [r, g, b] = toRgb(hex);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

function channel(v: number) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string) {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export const LIGHT_TEXT = "#ffffff";
export const DARK_TEXT = "#1c1b18";

/** White or ink, whichever reads better on `bg`. */
export function readableOn(bg: string) {
  return contrast(LIGHT_TEXT, bg) >= contrast(DARK_TEXT, bg) ? LIGHT_TEXT : DARK_TEXT;
}

/** Nudge `color` toward white or black until it reaches `min` contrast on `bg`. */
export function ensureContrast(color: string, bg: string, min: number) {
  if (contrast(color, bg) >= min) return color;
  const target = readableOn(bg) === LIGHT_TEXT ? "#ffffff" : "#000000";
  for (let t = 0.9; t >= 0; t -= 0.05) {
    const c = mix(color, target, t);
    if (contrast(c, bg) >= min) return c;
  }
  return readableOn(bg);
}

// Themes ----------------------------------------------------------------------

/** Everything a slide needs to paint itself. */
export type Palette = {
  bg: string;
  /** CSS background-image over `bg` (gradient or pattern), in slide pixels. */
  backdrop: string | null;
  backdropSize: string | null;
  title: string;
  fg: string;
  fg2: string;
  fg3: string;
  accent: string;
  /** Text colour on an accent fill. */
  onAccent: string;
  line: string;
  panel: string;
  heading: DeckFont;
  body: DeckFont;
  dark: boolean;
};

/** A built-in theme. Its name and hint live in `deckText.presetNames`. */
type Preset = {
  id: DeckPreset;
  spec: DeckThemeSpec;
  /** Hand-tuned secondary colours (the first three presets predate derived palettes). */
  tune?: Partial<Pick<Palette, "fg" | "fg2" | "fg3" | "line" | "panel">>;
};

export const PRESETS: Preset[] = [
  {
    id: "paper",
    spec: { bg: "#f8f6f0", bg2: "#ece8dc", backdrop: "solid", text: "#1c1b18", title: "#1c1b18", accent: "#6d3df5", headingFont: "bricolage", bodyFont: "geist" },
    tune: { fg2: "#55534c", fg3: "#8b8981", line: "#e3e0d6", panel: "#eeebe2" },
  },
  {
    id: "ink",
    spec: { bg: "#161614", bg2: "#24231f", backdrop: "solid", text: "#f1efe8", title: "#f6f4ee", accent: "#9a78ff", headingFont: "bricolage", bodyFont: "geist" },
    tune: { fg2: "#aeaca3", fg3: "#76746c", line: "#2e2d29", panel: "#22221f" },
  },
  {
    id: "blob",
    spec: { bg: "#6d3df5", bg2: "#4f22d0", backdrop: "glow", text: "#f7f4ff", title: "#ffffff", accent: "#dacdff", headingFont: "bricolage", bodyFont: "geist" },
    tune: { fg2: "#e2d9ff", fg3: "#b9a3fd", line: "#8a64f8", panel: "#5d2fe2" },
  },
  {
    id: "studio",
    spec: { bg: "#ffffff", bg2: "#eef1f6", backdrop: "solid", text: "#1b1e24", title: "#0d0f13", accent: "#2b59e8", headingFont: "inter", bodyFont: "inter" },
  },
  {
    id: "editorial",
    spec: { bg: "#f5f0e6", bg2: "#e9e1d0", backdrop: "solid", text: "#2a2620", title: "#1b1814", accent: "#a2322a", headingFont: "instrument", bodyFont: "geist" },
  },
  {
    id: "sage",
    spec: { bg: "#eff2ea", bg2: "#dde5d4", backdrop: "gradient", text: "#25302a", title: "#18221c", accent: "#357049", headingFont: "fraunces", bodyFont: "dm-sans" },
  },
  {
    id: "midnight",
    spec: { bg: "#0e1322", bg2: "#1b2546", backdrop: "glow", text: "#dde3f0", title: "#f5f7fc", accent: "#8aaaff", headingFont: "space", bodyFont: "inter" },
  },
  {
    id: "chalk",
    spec: { bg: "#1f2a26", bg2: "#28362f", backdrop: "grid", text: "#e6ece6", title: "#f5f8f3", accent: "#f0cd68", headingFont: "dm-sans", bodyFont: "dm-sans" },
  },
  {
    id: "mono",
    spec: { bg: "#f3f2ee", bg2: "#e6e5df", backdrop: "dots", text: "#161616", title: "#0b0b0b", accent: "#161616", headingFont: "mono", bodyFont: "inter" },
  },
  {
    id: "dusk",
    spec: { bg: "#1d1233", bg2: "#3d1746", backdrop: "gradient", text: "#f1eaff", title: "#ffffff", accent: "#ff9fc8", headingFont: "playfair", bodyFont: "dm-sans" },
  },
];

const PRESET_BY_ID = new Map(PRESETS.map((p) => [p.id, p]));
const THEME_IDS = new Set<string>([...PRESETS.map((p) => p.id), "custom"]);

/** Backdrop styles for custom themes. Names live in `deckText.backdrops`. */
export const BACKDROPS: DeckBackdrop[] = ["solid", "gradient", "glow", "dots", "grid"];
const BACKDROP_IDS = new Set<string>(BACKDROPS);

function backdropCss(spec: Pick<DeckThemeSpec, "backdrop" | "bg" | "bg2" | "text" | "accent">, dark: boolean): [string | null, string | null] {
  switch (spec.backdrop) {
    case "gradient":
      return [`linear-gradient(135deg, ${spec.bg} 0%, ${spec.bg} 18%, ${spec.bg2} 100%)`, null];
    case "glow":
      return [
        `radial-gradient(80% 110% at 100% 0%, ${rgba(spec.accent, dark ? 0.2 : 0.14)} 0%, transparent 62%), radial-gradient(70% 90% at 0% 100%, ${rgba(spec.bg2, 0.9)} 0%, transparent 70%)`,
        null,
      ];
    case "dots":
      return [`radial-gradient(${rgba(spec.text, dark ? 0.2 : 0.17)} 1.7px, transparent 2.2px)`, "32px 32px"];
    case "grid":
      return [
        `linear-gradient(${rgba(spec.text, dark ? 0.075 : 0.065)} 1.5px, transparent 1.5px), linear-gradient(90deg, ${rgba(spec.text, dark ? 0.075 : 0.065)} 1.5px, transparent 1.5px)`,
        "64px 64px",
      ];
    default:
      return [null, null];
  }
}

/** The backdrop drawn for small previews (cards, swatches), where slide-sized patterns would be too coarse. */
export function miniBackdrop(spec: DeckThemeSpec): { backgroundImage?: string; backgroundSize?: string } {
  const dark = readableOn(spec.bg) === LIGHT_TEXT;
  if (spec.backdrop === "dots") return { backgroundImage: `radial-gradient(${rgba(spec.text, dark ? 0.24 : 0.2)} 0.6px, transparent 0.9px)`, backgroundSize: "7px 7px" };
  if (spec.backdrop === "grid") {
    const c = rgba(spec.text, dark ? 0.08 : 0.07);
    return { backgroundImage: `linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px)`, backgroundSize: "12px 12px" };
  }
  const [image] = backdropCss(spec, dark);
  return image ? { backgroundImage: image } : {};
}

/** Build a full palette from a theme spec. */
export function specPalette(spec: DeckThemeSpec, tune?: Preset["tune"]): Palette {
  const dark = readableOn(spec.bg) === LIGHT_TEXT;
  const [backdrop, backdropSize] = backdropCss(spec, dark);
  return {
    bg: spec.bg,
    backdrop,
    backdropSize,
    title: spec.title,
    fg: tune?.fg ?? spec.text,
    fg2: tune?.fg2 ?? mix(spec.text, spec.bg, 0.74),
    fg3: tune?.fg3 ?? mix(spec.text, spec.bg, 0.5),
    accent: spec.accent,
    onAccent: readableOn(spec.accent),
    line: tune?.line ?? mix(spec.text, spec.bg, 0.14),
    panel: tune?.panel ?? mix(spec.text, spec.bg, 0.065),
    heading: spec.headingFont,
    body: spec.bodyFont,
    dark,
  };
}

const PRESET_PALETTES = new Map(PRESETS.map((p) => [p.id, specPalette(p.spec, p.tune)]));

export function presetSpec(id: DeckPreset): DeckThemeSpec {
  return { ...(PRESET_BY_ID.get(id) ?? PRESETS[0]).spec };
}

export function presetPalette(id: DeckPreset): Palette {
  return PRESET_PALETTES.get(id) ?? PRESET_PALETTES.get("paper")!;
}

/** The palette a deck paints with. Unknown or broken themes fall back to Paper. */
export function deckPalette(theme: DeckTheme, custom: DeckThemeSpec | null): Palette {
  if (theme === "custom") return custom ? specPalette(custom) : presetPalette("paper");
  return presetPalette(theme);
}

/** The spec behind a deck's theme, for previews. Accepts raw JSON values. */
export function themeSpecOf(theme: unknown, custom: unknown): DeckThemeSpec {
  if (theme === "custom") return normalizeSpec(custom) ?? presetSpec("paper");
  return presetSpec(THEME_IDS.has(theme as string) ? (theme as DeckPreset) : "paper");
}

/** Colours for one slide, after its background override. */
export function slidePalette(p: Palette, background: SlideBackground | null): Palette {
  if (!background) return p;
  if (background === "accent") {
    const on = p.onAccent;
    return {
      ...p,
      bg: p.accent,
      backdrop: null,
      backdropSize: null,
      title: on,
      fg: on,
      fg2: mix(on, p.accent, 0.84),
      fg3: mix(on, p.accent, 0.6),
      accent: on,
      onAccent: p.accent,
      line: mix(on, p.accent, 0.26),
      panel: mix(on, p.accent, 0.12),
      dark: on === LIGHT_TEXT,
    };
  }
  const bg = background === "inverse" ? p.fg : (cleanHex(background) ?? p.bg);
  const candidates = [p.fg, p.bg, p.title, LIGHT_TEXT, DARK_TEXT];
  const best = (min: number, prefer: string) => (contrast(prefer, bg) >= min ? prefer : candidates.reduce((a, b) => (contrast(b, bg) > contrast(a, bg) ? b : a)));
  const fg = background === "inverse" ? p.bg : best(4.5, p.fg);
  const title = background === "inverse" ? (contrast(p.bg, bg) >= 4.5 ? p.bg : fg) : best(4.5, p.title);
  const accent = ensureContrast(p.accent, bg, 3);
  return {
    ...p,
    bg,
    backdrop: null,
    backdropSize: null,
    title,
    fg,
    fg2: mix(fg, bg, 0.74),
    fg3: mix(fg, bg, 0.5),
    accent,
    onAccent: readableOn(accent),
    line: mix(fg, bg, 0.14),
    panel: mix(fg, bg, 0.065),
    dark: readableOn(bg) === LIGHT_TEXT,
  };
}

export function normalizeSpec(raw: unknown): DeckThemeSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const base = PRESETS[0].spec;
  const bg = cleanHex(r.bg) ?? base.bg;
  const text = cleanHex(r.text) ?? readableOn(bg);
  return {
    bg,
    bg2: cleanHex(r.bg2) ?? mix(bg, text, 0.9),
    backdrop: BACKDROP_IDS.has(r.backdrop as string) ? (r.backdrop as DeckBackdrop) : "solid",
    text,
    title: cleanHex(r.title) ?? text,
    accent: cleanHex(r.accent) ?? base.accent,
    headingFont: r.headingFont && (r.headingFont as string) in FONTS ? (r.headingFont as DeckFont) : base.headingFont,
    bodyFont: r.bodyFont && (r.bodyFont as string) in FONTS ? (r.bodyFont as DeckFont) : base.bodyFont,
  };
}

// Slides ----------------------------------------------------------------------

const LAYOUT_IDS = new Set<SlideLayout>(LAYOUTS.map((l) => l.id));
const TRANSITION_IDS = new Set<SlideTransition>(TRANSITIONS);
const BUILD_IDS = new Set<SlideBuild>(BUILDS);

function newId() {
  return crypto.randomUUID();
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** A fresh, empty slide. The editor shows placeholders until you type. */
export function newSlide(layout: SlideLayout = "bullets"): Slide {
  return { id: newId(), layout, title: "", body: "", image: null, notes: "", items: [], math: "", transition: null, build: "none", background: null };
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

function cleanBackground(v: unknown): SlideBackground | null {
  if (v === "accent" || v === "inverse") return v;
  const hex = cleanHex(v);
  return hex ? (hex as SlideBackground) : null;
}

function normalizeItem(raw: unknown): SlideItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return { head: str(r.head).slice(0, 400), text: str(r.text).slice(0, 4000) };
}

function normalizeSlide(raw: unknown, index: number, seen: Set<string>): Slide | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = repairId(str(r.id).slice(0, 100), index, seen);
  seen.add(id);
  const layout = LAYOUT_IDS.has(r.layout as SlideLayout) ? (r.layout as SlideLayout) : "bullets";
  const image = typeof r.image === "string" ? cleanImageUrl(r.image) : null;
  const items = (Array.isArray(r.items) ? r.items : [])
    .slice(0, 8)
    .map(normalizeItem)
    .filter((it): it is SlideItem => it !== null);
  return {
    id,
    layout,
    title: str(r.title),
    body: str(r.body),
    image,
    notes: str(r.notes),
    items,
    math: str(r.math).slice(0, 4000),
    transition: TRANSITION_IDS.has(r.transition as SlideTransition) ? (r.transition as SlideTransition) : null,
    build: BUILD_IDS.has(r.build as SlideBuild) ? (r.build as SlideBuild) : "none",
    background: cleanBackground(r.background),
  };
}

/** Turn whatever is stored in `pages.content` into a valid deck with at least one slide. */
export function normalizeDeck(raw: unknown): Deck {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const custom = normalizeSpec(r.custom);
  let theme: DeckTheme = THEME_IDS.has(r.theme as string) ? (r.theme as DeckTheme) : "paper";
  if (theme === "custom" && !custom) theme = "paper";
  const transition = TRANSITION_IDS.has(r.transition as SlideTransition) ? (r.transition as SlideTransition) : DEFAULT_TRANSITION;
  const seen = new Set<string>();
  const slides = (Array.isArray(r.slides) ? r.slides : [])
    .slice(0, 500)
    .map((s, i) => normalizeSlide(s, i, seen))
    .filter((s): s is Slide => s !== null);
  if (slides.length === 0) slides.push({ ...newSlide("title"), id: "slide-1" });
  return { theme, custom, transition, slides };
}

/** Non-empty body lines, used for bullets. */
export function bodyLines(body: string) {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Formula lines (one equation each). */
export const mathLines = bodyLines;

/** The cards a slide shows: its items, or empty ones to type into. */
export function slideItems(slide: Slide): SlideItem[] {
  const spec = ITEM_LAYOUTS[slide.layout];
  if (!spec) return [];
  if (slide.items.length) return slide.items.slice(0, spec.max);
  return Array.from({ length: spec.start }, () => ({ head: "", text: "" }));
}

/** Cards with something in them (what an audience sees). */
export function filledItems(slide: Slide) {
  return slideItems(slide).filter((it) => it.head.trim() || it.text.trim());
}

/** How many clicks it takes to reveal everything on a slide (0 when it has no build). */
export function buildUnits(slide: Slide) {
  if (slide.build === "none") return 0;
  switch (slide.layout) {
    case "bullets":
    case "agenda":
      return bodyLines(slide.body).length;
    case "formula":
      return mathLines(slide.math).length;
    case "columns":
    case "compare":
    case "steps":
    case "timeline":
    case "stats":
      return filledItems(slide).length;
    default:
      return 0;
  }
}

/** The transition used when moving onto slide `to` (forward) or back off slide `from`. */
export function transitionFor(deck: Pick<Deck, "transition">, slide: Slide | undefined): SlideTransition {
  return slide?.transition ?? deck.transition;
}

/** Section slides are numbered 1, 2, 3… in deck order. */
export function sectionNumbers(slides: Slide[]) {
  const map = new Map<string, number>();
  let n = 0;
  for (const s of slides) if (s.layout === "section") map.set(s.id, ++n);
  return map;
}

/**
 * Switch layout and carry the content across when the new layout reads other fields.
 * Nothing is thrown away: fields the new layout ignores stay on the slide.
 */
export function switchLayout(slide: Slide, layout: SlideLayout): Slide {
  if (slide.layout === layout) return slide;
  const next = { ...slide, layout };
  const lines = bodyLines(slide.body);
  const toItems = ITEM_LAYOUTS[layout];
  if (toItems && !slide.items.some((it) => it.head.trim() || it.text.trim()) && lines.length) {
    next.items =
      layout === "compare"
        ? [
            { head: "", text: lines.slice(0, Math.ceil(lines.length / 2)).join("\n") },
            { head: "", text: lines.slice(Math.ceil(lines.length / 2)).join("\n") },
          ]
        : lines.slice(0, toItems.max).map((l) => ({ head: l, text: "" }));
  }
  if ((layout === "bullets" || layout === "agenda") && !slide.body.trim() && ITEM_LAYOUTS[slide.layout]) {
    next.body = slide.items
      .flatMap((it) => (slide.layout === "compare" ? bodyLines(it.text) : [it.head.trim() || it.text.trim()]))
      .filter(Boolean)
      .join("\n");
  }
  return next;
}

/** The text fields a layout shows, for search and talk time. */
function slideText(s: Slide) {
  const parts = [s.title];
  if (ITEM_LAYOUTS[s.layout]) for (const it of s.items) parts.push(it.head, it.text);
  else parts.push(s.body);
  if (s.layout === "formula") parts.push(s.math);
  return parts.map((t) => t.trim()).filter(Boolean);
}

/** Text used by search: every slide's visible text. */
export function deckPlainText(deck: Pick<Deck, "slides">) {
  return deck.slides
    .map((s) => slideText(s).join("\n"))
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 100_000);
}

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

/** Rough talk time: ~20s per slide plus everything on it (and in the notes) spoken at 130 wpm. */
export function talkSeconds(deck: Pick<Deck, "slides">) {
  return deck.slides.reduce((sum, s) => sum + 20 + ((slideText(s).reduce((n, t) => n + words(t), 0) + words(s.notes)) / 130) * 60, 0);
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
