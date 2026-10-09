import type { Editor, Range } from "@tiptap/core";
import {
  BookOpen,
  CalendarDays,
  ChartSpline,
  ChevronRight,
  Code2,
  FilePlus2,
  FlaskConical,
  GraduationCap,
  Layers,
  Link2,
  Network,
  Paperclip,
  PencilLine,
  PenTool,
  Pin,
  Presentation,
  Radical,
  Sigma,
  Table2,
  TriangleAlert,
  Workflow,
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
import type { Locale } from "@/i18n/config";
import { intlLocale } from "@/i18n/format";
import { editorText } from "@/i18n/messages/editor";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { insertBlock } from "../blocks/insert";
import { insertFlashcard } from "../blocks/Flashcard";
import { newTable } from "../blocks/Table";
import { insertToggle } from "../blocks/Toggle";

export const SLASH_GROUPS = ["basic", "lists", "school", "media", "advanced"] as const;
/** Label it with `editorText.slash.groups[group]`. */
export type SlashGroup = (typeof SLASH_GROUPS)[number];

/** Things a slash command needs from the app (uploads, page creation). */
export type SlashContext = {
  pickImage: (editor: Editor) => void;
  /** Attach any file (PDF, worksheet, audio…). */
  pickFile: (editor: Editor) => void;
  createSubPage: (editor: Editor) => Promise<void>;
};

export type SlashItem = {
  id: string;
  title: string;
  description: string;
  group: SlashGroup;
  icon: LucideIcon;
  /** Extra words that find it. German items also answer to their English names and keywords. */
  keywords: string[];
  /** Markdown shortcut that does the same thing, shown as a hint. */
  hint?: string;
  run: (args: { editor: Editor; range: Range; ctx: SlashContext }) => void;
};

type SlashId = keyof (typeof editorText)["en"]["slash"]["items"];
type SlashDef = Omit<SlashItem, "title" | "description" | "keywords" | "run"> & {
  id: SlashId;
  run: (args: { editor: Editor; range: Range; ctx: SlashContext; locale: Locale }) => void;
};

const chainAt = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

const DEFS: SlashDef[] = [
  {
    id: "text",
    group: "basic",
    icon: Pilcrow,
    run: ({ editor, range }) => chainAt(editor, range).setParagraph().run(),
  },
  {
    id: "h1",
    group: "basic",
    icon: Heading1,
    hint: "#",
    run: ({ editor, range }) => chainAt(editor, range).setNode("heading", { level: 1 }).run(),
  },
  {
    id: "h2",
    group: "basic",
    icon: Heading2,
    hint: "##",
    run: ({ editor, range }) => chainAt(editor, range).setNode("heading", { level: 2 }).run(),
  },
  {
    id: "h3",
    group: "basic",
    icon: Heading3,
    hint: "###",
    run: ({ editor, range }) => chainAt(editor, range).setNode("heading", { level: 3 }).run(),
  },
  {
    id: "quote",
    group: "basic",
    icon: TextQuote,
    hint: ">",
    run: ({ editor, range }) => chainAt(editor, range).setParagraph().toggleBlockquote().run(),
  },
  {
    id: "divider",
    group: "basic",
    icon: Minus,
    hint: "---",
    run: ({ editor, range }) => chainAt(editor, range).setHorizontalRule().run(),
  },
  {
    id: "bullet",
    group: "lists",
    icon: List,
    hint: "-",
    run: ({ editor, range }) => chainAt(editor, range).toggleBulletList().run(),
  },
  {
    id: "numbered",
    group: "lists",
    icon: ListOrdered,
    hint: "1.",
    run: ({ editor, range }) => chainAt(editor, range).toggleOrderedList().run(),
  },
  {
    id: "todo",
    group: "lists",
    icon: ListTodo,
    hint: "[]",
    run: ({ editor, range }) => chainAt(editor, range).toggleTaskList().run(),
  },
  {
    id: "toggle",
    group: "lists",
    icon: ChevronRight,
    hint: ">>",
    run: ({ editor, range }) => insertToggle(editor, range),
  },
  {
    id: "math",
    group: "school",
    icon: Sigma,
    hint: "$$",
    run: ({ editor, range }) => insertBlock(editor, range, { type: "mathBlock", attrs: { src: "" } }),
  },
  {
    id: "mathInline",
    group: "school",
    icon: Radical,
    hint: "$…$",
    run: ({ editor, range }) => insertBlock(editor, range, { type: "mathInline", attrs: { src: "" } }),
  },
  {
    id: "chem",
    group: "school",
    icon: FlaskConical,
    run: ({ editor, range }) => insertBlock(editor, range, { type: "mathBlock", attrs: { src: "\\ce{}" } }),
  },
  {
    id: "plot",
    group: "school",
    icon: ChartSpline,
    run: ({ editor, range }) => insertBlock(editor, range, { type: "plot", attrs: { fns: [] } }),
  },
  {
    id: "lesson",
    group: "school",
    icon: GraduationCap,
    run: ({ editor, range }) => insertBlock(editor, range, { type: "lessonLink" }),
  },
  {
    id: "flashcard",
    group: "school",
    icon: Layers,
    run: ({ editor, range }) => insertFlashcard(editor, range),
  },
  {
    id: "definition",
    group: "school",
    icon: BookOpen,
    run: ({ editor, range }) => chainAt(editor, range).setParagraph().toggleCallout("definition").run(),
  },
  {
    id: "rule",
    group: "school",
    icon: Pin,
    run: ({ editor, range }) => chainAt(editor, range).setParagraph().toggleCallout("rule").run(),
  },
  {
    id: "example",
    group: "school",
    icon: PencilLine,
    run: ({ editor, range }) => chainAt(editor, range).setParagraph().toggleCallout("example").run(),
  },
  {
    id: "image",
    group: "media",
    icon: ImagePlus,
    run: ({ editor, range, ctx }) => {
      chainAt(editor, range).run();
      ctx.pickImage(editor);
    },
  },
  {
    id: "file",
    group: "media",
    icon: Paperclip,
    run: ({ editor, range, ctx }) => {
      chainAt(editor, range).run();
      ctx.pickFile(editor);
    },
  },
  {
    id: "deck",
    group: "media",
    icon: Presentation,
    run: ({ editor, range }) => insertBlock(editor, range, { type: "deckEmbed" }),
  },
  {
    id: "table",
    group: "media",
    icon: Table2,
    run: ({ editor, range }) => chainAt(editor, range).insertTable(newTable).run(),
  },
  {
    id: "diagram",
    group: "media",
    icon: Workflow,
    run: ({ editor, range }) => insertBlock(editor, range, { type: "diagram", attrs: { src: "" } }),
  },
  {
    id: "sketch",
    group: "media",
    icon: PenTool,
    run: ({ editor, range }) => insertBlock(editor, range, { type: "sketch" }),
  },
  {
    id: "mindmap",
    group: "school",
    icon: Network,
    run: ({ editor, range, locale }) => insertBlock(editor, range, { type: "diagram", attrs: { src: noteBlocksText[locale].diagram.starters.mindmap } }),
  },
  {
    id: "code",
    group: "advanced",
    icon: Code2,
    hint: "```",
    run: ({ editor, range }) => chainAt(editor, range).setCodeBlock().run(),
  },
  {
    id: "callout",
    group: "advanced",
    icon: Lightbulb,
    run: ({ editor, range }) => chainAt(editor, range).setParagraph().toggleCallout().run(),
  },
  {
    id: "warning",
    group: "advanced",
    icon: TriangleAlert,
    run: ({ editor, range }) => chainAt(editor, range).setParagraph().toggleCallout("warning").run(),
  },
  {
    id: "subpage",
    group: "advanced",
    icon: FilePlus2,
    run: ({ editor, range, ctx }) => {
      chainAt(editor, range).run();
      void ctx.createSubPage(editor);
    },
  },
  {
    id: "pageRef",
    group: "advanced",
    icon: Link2,
    hint: "[[",
    // Opens the "[[" page search right where you are.
    run: ({ editor, range }) => chainAt(editor, range).insertContent("[[").run(),
  },
  {
    id: "date",
    group: "advanced",
    icon: CalendarDays,
    run: ({ editor, range, locale }) => {
      const label = new Date().toLocaleDateString(intlLocale(locale), { weekday: "long", month: "long", day: "numeric", year: "numeric" });
      chainAt(editor, range).insertContent(`${label} `).run();
    },
  },
];

function build(locale: Locale): SlashItem[] {
  const own = editorText[locale].slash.items;
  const en = editorText.en.slash.items;
  return DEFS.map((def) => ({
    ...def,
    title: own[def.id].title,
    description: own[def.id].description,
    // "/heading" keeps working in German: the English name and keywords come along.
    keywords: locale === "en" ? en[def.id].keywords : [...own[def.id].keywords, en[def.id].title.toLowerCase(), ...en[def.id].keywords],
    run: (args) => def.run({ ...args, locale }),
  }));
}

const BUILT: Record<Locale, SlashItem[]> = { en: build("en"), de: build("de") };

/** All "/" commands, in the reader's language. */
export function slashItems(locale: Locale): SlashItem[] {
  return BUILT[locale];
}

/** "Überschrift" is found by "/übers", "/ubers" and "/uebers". */
function forms(s: string) {
  const lower = s.toLowerCase();
  const plain = lower.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss");
  const spelled = lower.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  return plain === lower ? [lower] : [lower, plain, spelled];
}

function score(item: SlashItem, q: string) {
  const titles = forms(item.title);
  const keywords = item.keywords.flatMap(forms);
  if (titles.some((t) => t.startsWith(q))) return 4;
  if (titles.some((t) => t.split(/[\s-]+/).some((w) => w.startsWith(q)))) return 3;
  if (keywords.some((k) => k.startsWith(q))) return 2;
  if (titles.some((t) => t.includes(q)) || keywords.some((k) => k.includes(q))) return 1;
  return 0;
}

/** Filter by query; results stay grouped, with the best matching group first. */
export function filterSlashItems(query: string, locale: Locale): SlashItem[] {
  const items = slashItems(locale);
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const scored = items.map((item, index) => ({ item, index, s: score(item, q) })).filter((x) => x.s > 0);
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
