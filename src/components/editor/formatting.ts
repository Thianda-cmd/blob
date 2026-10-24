import { Extension, Mark, mergeAttributes, type CommandProps, type Editor } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import { TextSelection, type EditorState } from "@tiptap/pm/state";

// Text sizes, text colours and list looks: part of the note's document (schema.ts), so the server
// reads them too. Only what Blob itself wrote is read back (data-* attributes): text pasted from a
// web page or Word keeps its words, not its fonts and colours.

/** Text sizes in px a note offers (anything from MIN_SIZE to MAX_SIZE can be typed in). */
export const TEXT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64];
export const MIN_SIZE = 8;
export const MAX_SIZE = 96;
/** The note's own text size (globals.css, .prose-blob). */
export const BASE_SIZE = 16;

/** Text colours: the theme's own, so they stay readable in light and dark mode. */
export const TEXT_COLORS = ["ink-3", "blob", "sky", "teal", "moss", "sand", "clay", "rose", "plum"] as const;
export type TextColor = (typeof TEXT_COLORS)[number];

export const colorVar = (c: TextColor) => (c === "ink-3" ? "var(--ink-3)" : c === "blob" ? "var(--blob-ink)" : `var(--subject-${c})`);

/** Highlighter colours besides Blob's purple (null). */
export const HIGHLIGHTS = ["sand", "moss", "sky", "rose", "clay"] as const;
export type HighlightColor = (typeof HIGHLIGHTS)[number];
const readHighlight = (raw: unknown): HighlightColor | null => ((HIGHLIGHTS as readonly string[]).includes(raw as string) ? (raw as HighlightColor) : null);

/** Paragraph and heading alignment (left is the default and isn't stored). */
export const ALIGNS = ["center", "right", "justify"] as const;
export type TextAlign = (typeof ALIGNS)[number];
const readAlign = (raw: unknown): TextAlign | null => ((ALIGNS as readonly string[]).includes(raw as string) ? (raw as TextAlign) : null);

export const clampSize = (px: number) => Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, px)));

/** A size from the stored attribute (a number, or "18px" from older or hand-made content). */
function readSize(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? parseFloat(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? clampSize(n) : null;
}

const readColor = (raw: unknown): TextColor | null => ((TEXT_COLORS as readonly string[]).includes(raw as string) ? (raw as TextColor) : null);

/** The next size up or down from `px` (Ctrl+Shift+. and Ctrl+Shift+,). */
export function stepSize(px: number, dir: 1 | -1) {
  if (dir > 0) return TEXT_SIZES.find((s) => s > px) ?? clampSize(px + 8);
  return [...TEXT_SIZES].reverse().find((s) => s < px) ?? clampSize(px - 2);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blobTextStyle: {
      /** Text size in px for the selection (null: the size of its block again). */
      setTextSize: (px: number | null) => ReturnType;
      setTextColor: (color: TextColor | null) => ReturnType;
    };
    blobAlign: {
      /** Alignment of the paragraphs and headings in the selection (null: left again). */
      setTextAlign: (align: TextAlign | null) => ReturnType;
    };
    blobLists: {
      /** Size in px of the list around the caret, markers included (null: as the text around it). */
      setListSize: (px: number | null) => ReturnType;
      /** Bullets: disc, circle, square, dash, arrow, check. Numbers: 1, a, A, i, I (null: as deep lists go). */
      setListMarker: (marker: string | null) => ReturnType;
      setListStart: (start: number) => ReturnType;
      /** A new paragraph inside the list item, under its text and without a marker of its own. */
      textUnderItem: () => ReturnType;
      /** Leaves the list (all of it, nested or not): a new line of text right below it. */
      continueBelowList: () => ReturnType;
    };
  }
}

/** A run of text with its own size and/or colour. */
export const TextStyle = Mark.create({
  name: "textStyle",
  priority: 101,
  // Typing at its end keeps the size and colour, like in any word processor.
  inclusive: true,

  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (el) => readSize(el.getAttribute("data-size")),
        renderHTML: (attrs) => {
          const px = readSize(attrs.size);
          return px ? { "data-size": String(px), style: `font-size: ${px}px` } : {};
        },
      },
      color: {
        default: null,
        parseHTML: (el) => readColor(el.getAttribute("data-color")),
        renderHTML: (attrs) => {
          const c = readColor(attrs.color);
          return c ? { "data-color": c, style: `color: ${colorVar(c)}` } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-size]" }, { tag: "span[data-color]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    /** Sets one attribute and drops the mark where nothing is left of it. */
    const apply =
      (key: "size" | "color", value: unknown) =>
      ({ chain, editor }: CommandProps) => {
        const other = key === "size" ? "color" : "size";
        const keep = editor.getAttributes(this.name)[other] ?? null;
        if (value === null && keep === null) return chain().unsetMark(this.name, { extendEmptyMarkRange: true }).run();
        return chain().setMark(this.name, { [key]: value }).run();
      };
    return {
      setTextSize: (px) => (props) => apply("size", px === null ? null : clampSize(px))(props),
      setTextColor: (color) => (props) => apply("color", color)(props),
    };
  },

  addKeyboardShortcuts() {
    const step = (dir: 1 | -1) => () => this.editor.commands.setTextSize(stepSize(sizeAtSelection(this.editor), dir));
    return { "Mod-Shift-.": step(1), "Mod-Shift-,": step(-1) };
  },
});

/** The highlighter in more colours (purple stays the default, so older notes look the same). */
export const ColoredHighlight = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el) => readHighlight(el.getAttribute("data-highlight")),
        renderHTML: (attrs) => (readHighlight(attrs.color) ? { "data-highlight": attrs.color as string } : {}),
      },
    };
  },
});

/** Centred, right-aligned or justified paragraphs and headings. */
export const TextAlignment = Extension.create({
  name: "blobAlign",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          align: {
            default: null,
            parseHTML: (el) => readAlign(el.getAttribute("data-align")),
            renderHTML: (attrs) => {
              const a = readAlign(attrs.align);
              return a ? { "data-align": a, style: `text-align: ${a}` } : {};
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setTextAlign:
        (align) =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection;
          let changed = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name !== "paragraph" && node.type.name !== "heading") return true;
            if (node.attrs.align !== align) {
              tr.setNodeAttribute(pos, "align", align);
              changed = true;
            }
            return false;
          });
          if (changed) dispatch?.(tr);
          return changed;
        },
    };
  },
});

/** The size the text at the selection shows in, in px (its own, its list's or its block's). */
export function sizeAtSelection(editor: Editor): number {
  const own = readSize(editor.getAttributes("textStyle").size);
  if (own) return own;
  try {
    const { node } = editor.view.domAtPos(editor.state.selection.from);
    const el = node instanceof HTMLElement ? node : node.parentElement;
    const px = el ? parseFloat(getComputedStyle(el).fontSize) : NaN;
    if (Number.isFinite(px)) return Math.round(px);
  } catch {}
  return BASE_SIZE;
}

/** Bullet and number styles, as CSS list-style-type (inline, so it beats the nesting defaults). */
const BULLETS: Record<string, string> = { disc: "disc", circle: "circle", square: "square", dash: '"–  "', arrow: '"→  "', check: '"✓  "' };
const NUMBERS: Record<string, string> = { "1": "decimal", a: "lower-alpha", A: "upper-alpha", i: "lower-roman", I: "upper-roman" };
export const LIST_MARKERS = { bulletList: Object.keys(BULLETS), orderedList: Object.keys(NUMBERS) } as const;
const LIST_TYPES = ["bulletList", "orderedList", "taskList"];
const ITEM_TYPES = ["listItem", "taskItem"];

/** The innermost list around the selection: its node, position and type name. */
export function listAround(state: EditorState) {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (LIST_TYPES.includes(node.type.name)) return { node, pos: $from.before(d), depth: d };
  }
  return null;
}

/** A list-style attribute: stored as its short name, drawn as CSS. */
function markerAttr(styles: Record<string, string>, data: string) {
  const known = (v: unknown): v is string => typeof v === "string" && Object.hasOwn(styles, v);
  return {
    default: null,
    parseHTML: (el: HTMLElement) => {
      const v = el.getAttribute(data);
      return known(v) ? v : null;
    },
    renderHTML: (attrs: Record<string, unknown>) => {
      const v = attrs[data === "data-marker" ? "marker" : "numbers"];
      return known(v) ? { [data]: v, style: `list-style-type: ${styles[v]}` } : {};
    },
  };
}

/**
 * Lists with a size (their markers grow with them) and markers of their own: bullets (marker) and
 * numbers (numbers: "1", "a", "A", "i", "I").
 */
export const ListLook = Extension.create({
  name: "blobLists",

  addGlobalAttributes() {
    return [
      {
        types: LIST_TYPES,
        attributes: {
          size: {
            default: null,
            parseHTML: (el) => readSize(el.getAttribute("data-size")),
            renderHTML: (attrs) => {
              const px = readSize(attrs.size);
              return px ? { "data-size": String(px), style: `font-size: ${px}px` } : {};
            },
          },
        },
      },
      { types: ["bulletList"], attributes: { marker: markerAttr(BULLETS, "data-marker") } },
      { types: ["orderedList"], attributes: { numbers: markerAttr(NUMBERS, "data-numbers") } },
    ];
  },

  addCommands() {
    return {
      setListSize:
        (px) =>
        ({ state, tr, dispatch }) => {
          const list = listAround(state);
          if (!list) return false;
          dispatch?.(tr.setNodeAttribute(list.pos, "size", px === null ? null : clampSize(px)));
          return true;
        },
      setListMarker:
        (marker) =>
        ({ state, tr, dispatch }) => {
          const list = listAround(state);
          if (!list) return false;
          const name = list.node.type.name;
          const styles = name === "bulletList" ? BULLETS : name === "orderedList" ? NUMBERS : null;
          if (!styles || (marker !== null && !Object.hasOwn(styles, marker))) return false;
          dispatch?.(tr.setNodeAttribute(list.pos, name === "bulletList" ? "marker" : "numbers", marker));
          return true;
        },
      setListStart:
        (start) =>
        ({ state, tr, dispatch }) => {
          const list = listAround(state);
          if (!list || list.node.type.name !== "orderedList") return false;
          dispatch?.(tr.setNodeAttribute(list.pos, "start", Math.max(0, Math.min(9999, Math.round(start)))));
          return true;
        },
      textUnderItem:
        () =>
        ({ state, commands }) => {
          const { $from } = state.selection;
          if ($from.parent.type.name !== "paragraph" || $from.depth < 2 || !ITEM_TYPES.includes($from.node(-1).type.name)) return false;
          return commands.splitBlock({ keepMarks: true });
        },
      continueBelowList:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          if ($from.depth < 2 || !ITEM_TYPES.includes($from.node(-1).type.name)) return false;
          let depth = -1;
          for (let d = $from.depth; d > 0; d--) if (LIST_TYPES.includes($from.node(d).type.name)) depth = d;
          if (depth < 0) return false;
          const after = $from.after(depth);
          const next = state.doc.resolve(after).nodeAfter;
          if (!dispatch) return true;
          // An empty line already waiting below the list is used as it is.
          if (!(next?.type.name === "paragraph" && next.content.size === 0)) tr.insert(after, state.schema.nodes.paragraph.create());
          dispatch(tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView());
          return true;
        },
    };
  },
});

/**
 * In a list: Shift+Enter writes text under the item (a paragraph of its own, no marker), Ctrl/Cmd+
 * Enter goes on below the list. Elsewhere both keep their usual meaning (a line break).
 */
export const ListKeys = Extension.create({
  name: "blobListKeys",
  // Before the line break (StarterKit) gets these keys.
  priority: 120,
  addKeyboardShortcuts() {
    return {
      "Shift-Enter": ({ editor }) => editor.commands.textUnderItem(),
      "Mod-Enter": ({ editor }) => editor.commands.continueBelowList(),
    };
  },
});
