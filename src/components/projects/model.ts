import type { ChecklistItem, ProjectColumn, Task } from "@/lib/types";

// Pure helpers for project boards: colours, icons, fractional positions, priorities, labels and the
// starter templates. No React, no Supabase: used by the board, the /projects list, Home and the server.

/* ---------------------------------------------------------------------------
   Colours and icons
   --------------------------------------------------------------------------- */

/** Project and column colours: Blob's purple plus the subject palette (light and dark mode tokens). */
export const PROJECT_COLORS = ["blob", "sky", "teal", "moss", "sand", "clay", "rose", "plum", "ink"] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

/** A CSS colour for a project, column or label colour key (unknown keys fall back to ink). */
export function boardColor(color: string | null | undefined) {
  if (color === "blob") return "var(--blob)";
  return (PROJECT_COLORS as readonly string[]).includes(color ?? "") ? `var(--subject-${color})` : "var(--subject-ink)";
}

/** Emoji a project can wear (a short, school-friendly set; any emoji typed in works too). */
export const PROJECT_ICONS = ["📋", "🎤", "🤝", "🚌", "🧠", "🧪", "🌍", "🎨", "📚", "💡", "🏆", "🎬", "⚽", "🎵", "🧮", "🌱", "🚀", "🗳️"];

/* ---------------------------------------------------------------------------
   Positions: fractional ordering, so a move writes one row
   --------------------------------------------------------------------------- */

export const STEP = 1024;

/** A position between two neighbours (null: no neighbour on that side). */
export function positionBetween(before: number | null | undefined, after: number | null | undefined): number {
  const b = before ?? null;
  const a = after ?? null;
  if (b === null && a === null) return STEP;
  if (b === null) return a! - STEP;
  if (a === null) return b + STEP;
  return (b + a) / 2;
}

/** True when two neighbours are so close that a position between them would lose precision. */
export function tooClose(before: number | null | undefined, after: number | null | undefined) {
  return before != null && after != null && Math.abs(after - before) < 1e-6;
}

/** Fresh, evenly spaced positions for a list (when neighbours got too close). */
export function spacedPositions(count: number) {
  return Array.from({ length: count }, (_, i) => (i + 1) * STEP);
}

export const byPosition = <T extends { position: number; created_at?: string }>(a: T, b: T) =>
  a.position - b.position || (a.created_at ?? "").localeCompare(b.created_at ?? "");

/** Cards per column in board order. Cards without a (known) column go to the first column. */
export function cardsByColumn(columns: ProjectColumn[], cards: Task[]) {
  const map = new Map<string, Task[]>(columns.map((c) => [c.id, []]));
  const first = columns[0]?.id;
  for (const card of cards) {
    const key = card.column_id && map.has(card.column_id) ? card.column_id : first;
    if (key) map.get(key)!.push(card);
  }
  for (const list of map.values()) list.sort(byPosition);
  return map;
}

/* ---------------------------------------------------------------------------
   Priority
   --------------------------------------------------------------------------- */

export type Priority = 0 | 1 | 2 | 3;
/** Highest first, for menus. Labels live in the projects dictionary: `t.priority[p]`. */
export const PRIORITIES: Priority[] = [3, 2, 1, 0];

/* ---------------------------------------------------------------------------
   Labels: stored on the card as "Name" or "Name|colour" (tasks.labels is text[])
   --------------------------------------------------------------------------- */

export const LABEL_COLORS = ["sky", "teal", "moss", "sand", "clay", "rose", "plum", "blob"] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];
export type Label = { raw: string; name: string; color: LabelColor };

/** A colour for a label without one, picked by its name so it is the same everywhere. */
function hashColor(name: string): LabelColor {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.toLowerCase().charCodeAt(i)) >>> 0;
  return LABEL_COLORS[h % LABEL_COLORS.length];
}

export function parseLabel(raw: string): Label {
  const bar = raw.lastIndexOf("|");
  const name = (bar > 0 ? raw.slice(0, bar) : raw).trim();
  const color = bar > 0 ? raw.slice(bar + 1) : "";
  return { raw, name, color: (LABEL_COLORS as readonly string[]).includes(color) ? (color as LabelColor) : hashColor(name) };
}

export function formatLabel(name: string, color: LabelColor) {
  return `${name.replace(/\|/g, "/").trim().slice(0, 40)}|${color}`;
}

/** Labels compare by name, without case ("Recherche" and "recherche|sky" are the same label). */
export const labelKey = (raw: string) => parseLabel(raw).name.toLowerCase();

/** Every label used in a project, one per name (the most common colour wins), sorted by name. */
export function projectLabels(cards: Pick<Task, "labels">[]): Label[] {
  const seen = new Map<string, Map<string, number>>();
  for (const card of cards) {
    for (const raw of card.labels) {
      const key = labelKey(raw);
      if (!key) continue;
      const counts = seen.get(key) ?? new Map<string, number>();
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
      seen.set(key, counts);
    }
  }
  return [...seen.values()]
    .map((counts) => parseLabel([...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ---------------------------------------------------------------------------
   Checklist and progress
   --------------------------------------------------------------------------- */

export function checklistProgress(list: ChecklistItem[]) {
  return { done: list.filter((i) => i.done).length, total: list.length };
}

/**
 * One change to a card's checklist. Each is saved on its own (rpc task_checklist, migration 0012),
 * so two people changing different items at once don't overwrite each other. A move names the item
 * it goes after (null: to the top), so it lands in the right place even if others changed the list
 * meanwhile; `index` is the fallback when that item is gone.
 */
export type ChecklistChange =
  | { op: "add"; item: ChecklistItem }
  | { op: "set"; id: string; text?: string; done?: boolean }
  | { op: "remove"; id: string }
  | { op: "move"; id: string; after: string | null; index: number };

/** Where a moved item goes, counted in the list without it. */
export function checklistMoveIndex(list: ChecklistItem[], change: Extract<ChecklistChange, { op: "move" }>) {
  const rest = list.filter((i) => i.id !== change.id);
  if (change.after === null) return 0;
  const at = rest.findIndex((i) => i.id === change.after);
  return at < 0 ? Math.max(0, Math.min(change.index, rest.length)) : at + 1;
}

/** The checklist after a change, the way the database makes it (adding twice or changing a removed item does nothing). */
export function applyChecklist(list: ChecklistItem[], change: ChecklistChange): ChecklistItem[] {
  if (change.op === "add") {
    if (list.length >= 100 || list.some((i) => i.id === change.item.id)) return list;
    return [...list, { ...change.item, text: change.item.text.slice(0, 500) }];
  }
  const item = list.find((i) => i.id === change.id);
  if (!item) return list;
  if (change.op === "set") {
    const next = { ...item, ...(change.text !== undefined && { text: change.text.slice(0, 500) }), ...(change.done !== undefined && { done: change.done }) };
    return list.map((i) => (i.id === change.id ? next : i));
  }
  const rest = list.filter((i) => i.id !== change.id);
  if (change.op === "remove") return rest;
  const at = checklistMoveIndex(list, change);
  return [...rest.slice(0, at), item, ...rest.slice(at)];
}

/** Done cards and all cards of a project (cards in a "done" column count as done). */
export function projectProgress(columns: Pick<ProjectColumn, "id" | "done">[], cards: Pick<Task, "column_id" | "done">[]) {
  const doneColumns = new Set(columns.filter((c) => c.done).map((c) => c.id));
  const done = cards.filter((c) => c.done || (c.column_id && doneColumns.has(c.column_id))).length;
  return { done, total: cards.length };
}

/* ---------------------------------------------------------------------------
   Templates: the structure lives here, the words in projectsText.templates
   --------------------------------------------------------------------------- */

export const TEMPLATE_IDS = ["blank", "referat", "group", "trip", "study"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

type TemplateCard = {
  /** Key of the card's words in the dictionary. */
  key: string;
  /** Index of its column. */
  column: number;
  priority?: Priority;
  /** Label keys with their colour. */
  labels?: { key: string; color: LabelColor }[];
  /** Number of checklist items (their words are in the dictionary). */
  checklist?: number;
  /** Due on the project's due date (when it has one). */
  dueWithProject?: boolean;
};

export type TemplateSpec = {
  icon: string;
  color: ProjectColor;
  columns: { key: string; color: ProjectColor; done?: boolean }[];
  cards: TemplateCard[];
};

export const TEMPLATES: Record<TemplateId, TemplateSpec> = {
  blank: {
    icon: "📋",
    color: "blob",
    columns: [
      { key: "todo", color: "ink" },
      { key: "doing", color: "sky" },
      { key: "done", color: "moss", done: true },
    ],
    cards: [],
  },
  referat: {
    icon: "🎤",
    color: "sky",
    columns: [
      { key: "research", color: "sand" },
      { key: "build", color: "sky" },
      { key: "practice", color: "plum" },
      { key: "done", color: "moss", done: true },
    ],
    cards: [
      { key: "topic", column: 0, priority: 3 },
      { key: "sources", column: 0, labels: [{ key: "research", color: "sand" }] },
      { key: "outline", column: 1 },
      { key: "slides", column: 1, labels: [{ key: "slides", color: "sky" }] },
      { key: "handout", column: 1 },
      { key: "rehearse", column: 2, checklist: 3, dueWithProject: true },
    ],
  },
  group: {
    icon: "🤝",
    color: "teal",
    columns: [
      { key: "ideas", color: "sand" },
      { key: "todo", color: "ink" },
      { key: "doing", color: "sky" },
      { key: "done", color: "moss", done: true },
    ],
    cards: [
      { key: "kickoff", column: 1, priority: 3, checklist: 3 },
      { key: "notes", column: 0 },
      { key: "checkin", column: 1 },
      { key: "merge", column: 1 },
      { key: "submit", column: 1, priority: 2, labels: [{ key: "deadline", color: "rose" }], dueWithProject: true },
    ],
  },
  trip: {
    icon: "🚌",
    color: "clay",
    columns: [
      { key: "decide", color: "sand" },
      { key: "organise", color: "sky" },
      { key: "done", color: "moss", done: true },
    ],
    cards: [
      { key: "destination", column: 0, labels: [{ key: "vote", color: "plum" }] },
      { key: "stay", column: 0 },
      { key: "costs", column: 1, labels: [{ key: "money", color: "sand" }] },
      { key: "letter", column: 1 },
      { key: "programme", column: 1 },
      { key: "packing", column: 1, checklist: 5, dueWithProject: true },
    ],
  },
  study: {
    icon: "🧠",
    color: "plum",
    columns: [
      { key: "topics", color: "ink" },
      { key: "learning", color: "sky" },
      { key: "review", color: "sand" },
      { key: "known", color: "moss", done: true },
    ],
    cards: [
      { key: "collect", column: 0, priority: 3 },
      { key: "summary", column: 0 },
      { key: "flashcards", column: 0 },
      { key: "exercises", column: 0 },
      { key: "mock", column: 0, labels: [{ key: "test", color: "rose" }], dueWithProject: true },
    ],
  },
};
