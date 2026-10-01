export type Theme = "system" | "light" | "dark";

export type Profile = {
  id: string;
  full_name: string | null;
  school: string | null;
  grade: string | null;
  avatar_url: string | null;
  theme: Theme;
  blob_tips: boolean;
  onboarded: boolean;
  created_at: string;
};

export type SubjectColor = "ink" | "clay" | "moss" | "sky" | "plum" | "sand" | "rose" | "teal";

export type Subject = {
  id: string;
  user_id: string;
  name: string;
  color: SubjectColor;
  emoji: string | null;
  position: number;
  created_at: string;
};

export type PageKind = "note" | "deck";

/** Page metadata used by the sidebar and lists (no content). */
export type PageMeta = {
  id: string;
  kind: PageKind;
  title: string;
  icon: string | null;
  subject_id: string | null;
  parent_id: string | null;
  is_favorite: boolean;
  position: number;
  trashed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Page = PageMeta & {
  user_id: string;
  content: unknown;
  plain_text: string;
};

export const PAGE_META_COLUMNS =
  "id, kind, title, icon, subject_id, parent_id, is_favorite, position, trashed_at, created_at, updated_at";

export type TaskKind = "homework" | "exam" | "project" | "reminder";

export type Task = {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  details: string | null;
  kind: TaskKind;
  due_at: string | null;
  done: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

// Presentations ---------------------------------------------------------------

export type SlideLayout =
  | "title"
  | "section"
  | "agenda"
  | "bullets"
  | "split"
  | "media"
  | "image"
  | "cover"
  | "columns"
  | "compare"
  | "steps"
  | "timeline"
  | "stats"
  | "big"
  | "quote"
  | "formula"
  | "closing";

/** One card in a structured layout: a column, a step, a stat or a timeline event. */
export type SlideItem = { head: string; text: string };

/** How a slide appears. "morph" glides matching elements (title, image, …) from the previous slide. */
export type SlideTransition = "none" | "fade" | "slide" | "push" | "zoom" | "morph";

/** How list items, steps, stats and formula lines appear one click at a time. */
export type SlideBuild = "none" | "fade-up" | "pop" | "wipe";

/** Per-slide background: the accent colour, the theme inverted, or any #rrggbb colour. */
export type SlideBackground = "accent" | "inverse" | `#${string}`;

export type Slide = {
  id: string;
  layout: SlideLayout;
  title: string;
  body: string;
  image: string | null;
  notes: string;
  /** Columns, compare, steps, timeline and stats. */
  items: SlideItem[];
  /** Formula slides: one equation per line, in the learning center's display language. */
  math: string;
  /** null follows the deck default. */
  transition: SlideTransition | null;
  build: SlideBuild;
  /** null follows the theme. */
  background: SlideBackground | null;
};

export type DeckPreset = "paper" | "ink" | "blob" | "studio" | "editorial" | "sage" | "midnight" | "chalk" | "mono" | "dusk";
export type DeckTheme = DeckPreset | "custom";

export type DeckFont =
  | "bricolage"
  | "geist"
  | "inter"
  | "dm-sans"
  | "space"
  | "fraunces"
  | "instrument"
  | "playfair"
  | "source-serif"
  | "lora"
  | "mono";

export type DeckBackdrop = "solid" | "gradient" | "glow" | "dots" | "grid";

/** A complete theme. Presets are specs too; a custom theme is stored on the deck. Colours are #rrggbb. */
export type DeckThemeSpec = {
  bg: string;
  /** Second colour for the gradient backdrop. */
  bg2: string;
  backdrop: DeckBackdrop;
  text: string;
  title: string;
  accent: string;
  headingFont: DeckFont;
  bodyFont: DeckFont;
};

/**
 * What is stored in `pages.content`. Version 1 decks only had `theme` and slides with the
 * first six fields, so everything added later is optional here; normalizeDeck fills it in.
 */
export type StoredSlide = Pick<Slide, "id" | "layout" | "title" | "body" | "image" | "notes"> & Partial<Slide>;

export type DeckContent = {
  theme: DeckTheme;
  /** The deck's own theme, used when `theme` is "custom" (kept when you switch back to a preset). */
  custom?: DeckThemeSpec | null;
  /** Default transition for slides that don't pick their own. */
  transition?: SlideTransition;
  slides: StoredSlide[];
};

/** A deck after normalizeDeck: every field present and valid. */
export type Deck = {
  theme: DeckTheme;
  custom: DeckThemeSpec | null;
  transition: SlideTransition;
  slides: Slide[];
};
