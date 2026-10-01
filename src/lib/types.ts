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

export type SlideLayout = "title" | "bullets" | "split" | "quote" | "image" | "big";

export type Slide = {
  id: string;
  layout: SlideLayout;
  title: string;
  body: string;
  image: string | null;
  notes: string;
};

export type DeckTheme = "paper" | "ink" | "blob";

export type DeckContent = {
  theme: DeckTheme;
  slides: Slide[];
};
