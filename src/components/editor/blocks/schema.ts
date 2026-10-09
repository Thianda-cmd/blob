import { Node, mergeAttributes } from "@tiptap/core";
import { TableKit } from "@tiptap/extension-table";
import { editorText } from "@/i18n/messages/editor";
import { resolveText } from "@/i18n/text";
import { findTopicMeta } from "@/learn/catalog";
import { plainMath } from "@/learn/engine/display";
import "./sketchSteps";

// The note's own blocks as document schema only: their names, content, attributes and how they
// turn into HTML and text. Nothing here needs React or a browser, so the server builds exactly the
// editor's schema from it (src/components/editor/schema.ts). Each block's own file adds its node
// view, keys and commands on top (Callout.tsx extends CalloutSpec, and so on).

// Callouts ---------------------------------------------------------------------------------------

export const CALLOUT_KINDS = ["idea", "definition", "rule", "example", "warning"] as const;
/** idea: a plain callout. definition: "Begriff: Erklärung". rule: a Merksatz. */
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export const calloutKind = (raw: unknown): CalloutKind => (CALLOUT_KINDS.includes(raw as CalloutKind) ? (raw as CalloutKind) : "idea");

/** A soft box that makes something stand out: a key idea, a definition, a Merksatz, an example, a warning. */
export const CalloutSpec = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: "idea",
        parseHTML: (el) => calloutKind(el.getAttribute("data-kind")),
        renderHTML: (attrs) => ({ "data-kind": attrs.kind }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-callout": "", class: "blob-callout" }), 0];
  },
});

// Formulas ---------------------------------------------------------------------------------------

/**
 * Formulas are stored as the learning center's display language (engine/display.ts) and drawn by
 * its MathView. A few LaTeX habits are understood too (\dfrac, \leq, \left(…\right), \sum).
 */
export function toDisplay(src: string) {
  return fromTypography(src)
    .replace(/\r?\n/g, " \\\\ ")
    .replace(/\\[dt]frac(?![A-Za-z])/g, "\\frac")
    .replace(/\\(left|right)(?![A-Za-z])/g, "")
    .replace(/\\leq(?![A-Za-z])/g, "\\le")
    .replace(/\\geq(?![A-Za-z])/g, "\\ge")
    .replace(/\\neq(?![A-Za-z])/g, "\\ne")
    .replace(/\\(rightarrow|longrightarrow)(?![A-Za-z])/g, "\\to")
    .replace(/\\(mathrm|textrm|mathit)(?![A-Za-z])/g, "\\text")
    .replace(/\\(sum|Sigma)(?![A-Za-z])/g, "Σ")
    .replace(/\\prod(?![A-Za-z])/g, "∏")
    .replace(/\\int(?![A-Za-z])/g, "∫");
}

/** Undo what typing in text did to a formula ("r^2" became "r²", "1/2" became "½"). */
export function fromTypography(src: string) {
  return src
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/½/g, "\\frac12")
    .replace(/¼/g, "\\frac14")
    .replace(/¾/g, "\\frac34")
    .replace(/[–—]/g, "-")
    .replace(/[„“”]/g, '"');
}

/** A formula as plain text (search, previews, the note's plain text). */
export function mathText(src: string) {
  try {
    return plainMath(toDisplay(src));
  } catch {
    return src;
  }
}

const srcAttribute = {
  src: {
    default: "",
    parseHTML: (el: HTMLElement) => el.getAttribute("data-src") ?? el.textContent ?? "",
    renderHTML: (attrs: Record<string, unknown>) => ({ "data-src": attrs.src }),
  },
};

/** A formula inside a sentence. */
export const MathInlineSpec = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return srcAttribute;
  },

  parseHTML() {
    return [{ tag: "span[data-math-inline]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-math-inline": "" }), node.attrs.src as string];
  },

  renderText({ node }) {
    return mathText(node.attrs.src as string);
  },
});

/** A formula on its own line, centred. */
export const MathBlockSpec = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return srcAttribute;
  },

  parseHTML() {
    return [{ tag: "div[data-math-block]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-math-block": "" }), node.attrs.src as string];
  },

  renderText({ node }) {
    return mathText(node.attrs.src as string);
  },
});

// Toggles ----------------------------------------------------------------------------------------

/** A line that hides what's below it until you open it ("aufklappen"). */
export const ToggleSpec = Node.create({
  name: "toggle",
  group: "block",
  content: "toggleSummary toggleContent",
  defining: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-id"),
        renderHTML: (attrs) => (attrs.id ? { "data-id": attrs.id } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-toggle]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-toggle": "" }), 0];
  },
});

export const ToggleSummary = Node.create({
  name: "toggleSummary",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-toggle-summary]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-toggle-summary": "" }), 0];
  },
});

export const ToggleContent = Node.create({
  name: "toggleContent",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-toggle-content]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-toggle-content": "" }), 0];
  },
});

// Flashcards -------------------------------------------------------------------------------------

/** A question with its answer, learned in the study mode (its id keeps the learning progress). */
export const FlashcardSpec = Node.create({
  name: "flashcard",
  group: "block",
  content: "flashcardFront flashcardBack",
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-id"),
        renderHTML: (attrs) => (attrs.id ? { "data-id": attrs.id } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-flashcard]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-flashcard": "" }), 0];
  },
});

export const FlashcardFront = Node.create({
  name: "flashcardFront",
  content: "paragraph+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "div[data-flashcard-front]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-flashcard-front": "" }), 0];
  },
});

export const FlashcardBack = Node.create({
  name: "flashcardBack",
  content: "(paragraph | bulletList | orderedList)+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "div[data-flashcard-back]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-flashcard-back": "" }), 0];
  },
});

// Tables -----------------------------------------------------------------------------------------

/** Tables: a header row, cells with any blocks, columns you can widen; they scroll sideways on phones. */
export const Tables = TableKit.configure({
  table: { resizable: true, cellMinWidth: 72, renderWrapper: true, HTMLAttributes: { class: "blob-table" } },
});

// Diagrams, sketches and plots -------------------------------------------------------------------

/** A Mermaid diagram, stored as its source. */
export const DiagramSpec = Node.create({
  name: "diagram",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-src") ?? el.textContent ?? "",
        renderHTML: (attrs) => ({ "data-src": attrs.src }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-diagram]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-diagram": "" }), ["pre", {}, node.attrs.src as string]];
  },

  renderText() {
    return "";
  },
});

export const SKETCH_DEFAULT_HEIGHT = 420;

/**
 * A hand-drawn sketch (pen, mouse or finger), stored as SVG paths. Strokes change only through the
 * steps in sketchSteps.ts (by id), the height as an attribute of its own.
 */
export const SketchSpec = Node.create({
  name: "sketch",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      paths: {
        default: [],
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute("data-paths") ?? "[]");
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({ "data-paths": JSON.stringify(attrs.paths ?? []) }),
      },
      height: {
        default: SKETCH_DEFAULT_HEIGHT,
        parseHTML: (el) => Number(el.getAttribute("data-height")) || SKETCH_DEFAULT_HEIGHT,
        renderHTML: (attrs) => ({ "data-height": attrs.height }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-sketch]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-sketch": "" })];
  },

  renderText() {
    return "";
  },
});

/** Names of a plot's functions, in order. */
export const PLOT_NAMES = ["f", "g", "h", "k", "p", "q"];

/** Function graphs in a coordinate system. */
export const PlotSpec = Node.create({
  name: "plot",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      fns: {
        default: [],
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute("data-fns") ?? "[]");
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({ "data-fns": JSON.stringify(attrs.fns ?? []) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-plot]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-plot": "" })];
  },

  renderText({ node }) {
    const fns = Array.isArray(node.attrs.fns) ? (node.attrs.fns as string[]) : [];
    return fns
      .filter(Boolean)
      .map((f, i) => `${PLOT_NAMES[i]}(x) = ${f}`)
      .join(", ");
  },
});

// Files, presentations, lessons and pages --------------------------------------------------------

/** An attached file (worksheet, PDF …) stored in the note's folder. */
export const FileSpec = Node.create({
  name: "file",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    const attr = (name: string, fallback: unknown) => ({
      default: fallback,
      parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) ?? fallback,
      renderHTML: (attrs: Record<string, unknown>) => ({ [`data-${name}`]: attrs[name] }),
    });
    return { path: attr("path", ""), name: attr("name", ""), size: attr("size", 0), mime: attr("mime", "") };
  },

  parseHTML() {
    return [{ tag: "div[data-file]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-file": "" }), node.attrs.name as string];
  },

  renderText({ node }) {
    return (node.attrs.name as string) ?? "";
  },
});

/** One of your presentations, shown in the note. */
export const DeckEmbedSpec = Node.create({
  name: "deckEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-deck-id"),
        renderHTML: (attrs) => (attrs.id ? { "data-deck-id": attrs.id } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-deck-embed]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-deck-embed": "" })];
  },

  renderText() {
    return "";
  },
});

/** A lesson of the learning center, with your progress, to jump into from the note. */
export const LessonLinkSpec = Node.create({
  name: "lessonLink",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      slug: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-topic"),
        renderHTML: (attrs) => (attrs.slug ? { "data-topic": attrs.slug } : {}),
      },
      level: {
        default: null,
        parseHTML: (el) => Number(el.getAttribute("data-level")) || null,
        renderHTML: (attrs) => (attrs.level ? { "data-level": attrs.level } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-lesson-link]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-lesson-link": "" })];
  },

  renderText({ node }) {
    const meta = node.attrs.slug ? findTopicMeta(node.attrs.slug as string) : undefined;
    return meta ? resolveText(meta.title, "de") : "";
  },
});

/** A link block to another page (a sub-page): the page's live title, opened on click. */
export const PageLinkSpec = Node.create<{ untitled: () => string }>({
  name: "pageLink",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { untitled: () => editorText.en.untitled };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-page-id"),
        renderHTML: (attrs) => ({ "data-page-id": attrs.id }),
      },
      title: {
        default: "",
        parseHTML: (el) => el.textContent ?? "",
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-page-link]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, { "data-page-link": "", href: `/p/${node.attrs.id}` }), (node.attrs.title as string) || this.options.untitled()];
  },

  renderText({ node }) {
    return (node.attrs.title as string) || this.options.untitled();
  },
});
