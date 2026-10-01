import type { Editor, Range } from "@tiptap/core";
import {
  CalendarDays,
  Code2,
  FilePlus2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Lightbulb,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Pilcrow,
  TextQuote,
  type LucideIcon,
} from "lucide-react";

export const SLASH_GROUPS = ["Basic blocks", "Lists", "Media", "Advanced"] as const;
export type SlashGroup = (typeof SLASH_GROUPS)[number];

/** Things a slash command needs from the app (uploads, page creation). */
export type SlashContext = {
  pickImage: (editor: Editor) => void;
  createSubPage: (editor: Editor) => Promise<void>;
};

export type SlashItem = {
  id: string;
  title: string;
  description: string;
  group: SlashGroup;
  icon: LucideIcon;
  keywords: string[];
  /** Markdown shortcut that does the same thing, shown as a hint. */
  hint?: string;
  run: (args: { editor: Editor; range: Range; ctx: SlashContext }) => void;
};

const chainAt = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: "text",
    title: "Text",
    description: "Just start writing plain text",
    group: "Basic blocks",
    icon: Pilcrow,
    keywords: ["paragraph", "plain", "body", "p"],
    run: ({ editor, range }) => chainAt(editor, range).setParagraph().run(),
  },
  {
    id: "h1",
    title: "Heading 1",
    description: "Big section heading",
    group: "Basic blocks",
    icon: Heading1,
    keywords: ["title", "big", "large", "h1"],
    hint: "#",
    run: ({ editor, range }) => chainAt(editor, range).setNode("heading", { level: 1 }).run(),
  },
  {
    id: "h2",
    title: "Heading 2",
    description: "Medium section heading",
    group: "Basic blocks",
    icon: Heading2,
    keywords: ["subtitle", "medium", "h2"],
    hint: "##",
    run: ({ editor, range }) => chainAt(editor, range).setNode("heading", { level: 2 }).run(),
  },
  {
    id: "h3",
    title: "Heading 3",
    description: "Small section heading",
    group: "Basic blocks",
    icon: Heading3,
    keywords: ["subheading", "small", "h3"],
    hint: "###",
    run: ({ editor, range }) => chainAt(editor, range).setNode("heading", { level: 3 }).run(),
  },
  {
    id: "quote",
    title: "Quote",
    description: "Capture a quotation",
    group: "Basic blocks",
    icon: TextQuote,
    keywords: ["blockquote", "citation", "cite"],
    hint: ">",
    run: ({ editor, range }) => chainAt(editor, range).setParagraph().toggleBlockquote().run(),
  },
  {
    id: "divider",
    title: "Divider",
    description: "Visually split sections",
    group: "Basic blocks",
    icon: Minus,
    keywords: ["hr", "horizontal", "rule", "line", "separator"],
    hint: "---",
    run: ({ editor, range }) => chainAt(editor, range).setHorizontalRule().run(),
  },
  {
    id: "bullet",
    title: "Bulleted list",
    description: "A simple list of points",
    group: "Lists",
    icon: List,
    keywords: ["unordered", "ul", "bullets", "points"],
    hint: "-",
    run: ({ editor, range }) => chainAt(editor, range).toggleBulletList().run(),
  },
  {
    id: "numbered",
    title: "Numbered list",
    description: "Steps in order",
    group: "Lists",
    icon: ListOrdered,
    keywords: ["ordered", "ol", "numbers", "steps"],
    hint: "1.",
    run: ({ editor, range }) => chainAt(editor, range).toggleOrderedList().run(),
  },
  {
    id: "todo",
    title: "To-do list",
    description: "Track homework with checkboxes",
    group: "Lists",
    icon: ListTodo,
    keywords: ["task", "checkbox", "checklist", "todo", "check"],
    hint: "[]",
    run: ({ editor, range }) => chainAt(editor, range).toggleTaskList().run(),
  },
  {
    id: "image",
    title: "Image",
    description: "Upload a picture or diagram",
    group: "Media",
    icon: ImagePlus,
    keywords: ["picture", "photo", "upload", "img", "diagram", "screenshot"],
    run: ({ editor, range, ctx }) => {
      chainAt(editor, range).run();
      ctx.pickImage(editor);
    },
  },
  {
    id: "code",
    title: "Code block",
    description: "Write a snippet of code",
    group: "Advanced",
    icon: Code2,
    keywords: ["snippet", "pre", "program", "monospace"],
    hint: "```",
    run: ({ editor, range }) => chainAt(editor, range).setCodeBlock().run(),
  },
  {
    id: "callout",
    title: "Callout",
    description: "Make a key idea stand out",
    group: "Advanced",
    icon: Lightbulb,
    keywords: ["note", "tip", "info", "important", "box", "highlight"],
    run: ({ editor, range }) => chainAt(editor, range).setParagraph().toggleCallout().run(),
  },
  {
    id: "subpage",
    title: "Sub-page",
    description: "Nest a new page inside this one",
    group: "Advanced",
    icon: FilePlus2,
    keywords: ["page", "child", "nested", "new", "link"],
    run: ({ editor, range, ctx }) => {
      chainAt(editor, range).run();
      void ctx.createSubPage(editor);
    },
  },
  {
    id: "date",
    title: "Today's date",
    description: "Insert the current date",
    group: "Advanced",
    icon: CalendarDays,
    keywords: ["today", "now", "time", "day"],
    run: ({ editor, range }) => {
      const label = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      chainAt(editor, range).insertContent(`${label} `).run();
    },
  },
];

function score(item: SlashItem, q: string) {
  const title = item.title.toLowerCase();
  if (title.startsWith(q)) return 4;
  if (title.split(/[\s-]+/).some((w) => w.startsWith(q))) return 3;
  if (item.keywords.some((k) => k.startsWith(q))) return 2;
  if (title.includes(q) || item.keywords.some((k) => k.includes(q))) return 1;
  return 0;
}

/** Filter by query; results stay grouped, with the best matching group first. */
export function filterSlashItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  const scored = SLASH_ITEMS.map((item, index) => ({ item, index, s: score(item, q) })).filter((x) => x.s > 0);
  const best = new Map<SlashGroup, number>();
  for (const x of scored) best.set(x.item.group, Math.max(best.get(x.item.group) ?? 0, x.s));
  return scored
    .sort(
      (a, b) =>
        best.get(b.item.group)! - best.get(a.item.group)! ||
        SLASH_GROUPS.indexOf(a.item.group) - SLASH_GROUPS.indexOf(b.item.group) ||
        b.s - a.s ||
        a.index - b.index,
    )
    .map((x) => x.item);
}
