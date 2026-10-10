export type Theme = "system" | "light" | "dark";

export type Profile = {
  id: string;
  full_name: string | null;
  school: string | null;
  grade: string | null;
  avatar_url: string | null;
  theme: Theme;
  blob_tips: boolean;
  /** What Blob wears (migration 0015): see components/blob/look.tsx. */
  blob_look: Record<string, unknown> | null;
  onboarded: boolean;
  created_at: string;
};

export type SubjectColor = "ink" | "clay" | "moss" | "sky" | "plum" | "sand" | "rose" | "teal";

/** A school subject, or a notebook for anything else ("Privat", "Fahrschule"). */
export type SubjectKind = "subject" | "notebook";

export type Subject = {
  id: string;
  user_id: string;
  kind: SubjectKind;
  name: string;
  color: SubjectColor;
  emoji: string | null;
  position: number;
  created_at: string;
};

/** A folder only holds pages (no text of its own). */
export type PageKind = "note" | "deck" | "cv" | "folder";

/** Page metadata used by the sidebar and lists (no content). */
export type PageMeta = {
  id: string;
  /** Who owns the page (someone else for pages shared with you). */
  user_id: string;
  kind: PageKind;
  title: string;
  icon: string | null;
  subject_id: string | null;
  parent_id: string | null;
  is_favorite: boolean;
  position: number;
  trashed_at: string | null;
  /** Free tags ("Prüfung", "Zusammenfassung"); compared without case. */
  tags: string[];
  /** Learning-center topics the page belongs to: catalog slugs ("fractions"), optionally "@level" ("fractions@2"). */
  topics: string[];
  created_at: string;
  updated_at: string;
};

export type Page = PageMeta & {
  content: unknown;
  plain_text: string;
  /** Pages this one links to (page links, [[links]]), for backlinks. Saved with the content. */
  links: string[];
  /** Presentations: revision for saving together (save_deck). */
  rev: number;
  /** Notes edited together: the step version pages.content is at (push_steps / save_note_snapshot). */
  doc_version: number;
};

export const PAGE_META_COLUMNS =
  "id, user_id, kind, title, icon, subject_id, parent_id, is_favorite, position, trashed_at, tags, topics, created_at, updated_at";

// Working together ------------------------------------------------------------------------------

export type MemberRole = "editor" | "viewer";
/** Your role on a page or project. */
export type AccessRole = "owner" | MemberRole;

/** Someone on a shared page or project (from member_profiles). */
export type Member = { user_id: string; full_name: string; avatar_url: string | null; role: AccessRole };

export type Invite = {
  token: string;
  target_type: "page" | "project";
  target_id: string;
  role: MemberRole;
  created_by: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  uses: number;
  max_uses: number | null;
};

// Projects (kanban boards) ------------------------------------------------------------------------

export type Project = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  icon: string | null;
  color: string;
  subject_id: string | null;
  due_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectColumn = {
  id: string;
  project_id: string;
  title: string;
  color: string;
  position: number;
  /** Cards here count as done. */
  done: boolean;
  created_at: string;
};

/** One item of a card's checklist. */
export type ChecklistItem = { id: string; text: string; done: boolean };

/** Something attached to a card or note: a Blob page, a file in the files bucket, or a web link. */
export type Attachment =
  | { id: string; type: "page"; page_id: string; title: string; kind: PageKind }
  | { id: string; type: "file"; path: string; name: string; size: number; mime: string }
  | { id: string; type: "link"; url: string; title: string };

export type TaskKind = "homework" | "exam" | "project" | "reminder";

export type TaskStatus = "todo" | "doing" | "done";

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
  /** The personal board's column; always "done" when done is true (kept in sync by the database). */
  status: TaskStatus;
  /** Project cards: their project and column. Personal tasks have neither. */
  project_id: string | null;
  column_id: string | null;
  /** Order inside a column (personal board or project). */
  position: number;
  /** 0 none, 1 low, 2 medium, 3 high. */
  priority: 0 | 1 | 2 | 3;
  assignees: string[];
  labels: string[];
  checklist: ChecklistItem[];
  attachments: Attachment[];
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
