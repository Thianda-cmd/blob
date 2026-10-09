import { Extension, getSchema, getText, getTextSerializersFromSchema, type AnyExtension, type JSONContent } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import type { Locale } from "@/i18n/config";
import { editorText } from "@/i18n/messages/editor";
import {
  CalloutSpec,
  DeckEmbedSpec,
  DiagramSpec,
  FileSpec,
  FlashcardBack,
  FlashcardFront,
  FlashcardSpec,
  LessonLinkSpec,
  MathBlockSpec,
  MathInlineSpec,
  PageLinkSpec,
  PlotSpec,
  SketchSpec,
  Tables,
  ToggleContent,
  ToggleSpec,
  ToggleSummary,
} from "./blocks/schema";

// What a note's document is made of, in one place for the editor (extensions.ts adds the node
// views and everything interactive) and for the server, which builds the same schema without a
// browser to replay steps nobody stored yet (src/notes/settle.ts). The two must never differ: a
// step means the same thing to both only on the same schema.

export const PLAIN_TEXT_LIMIT = 20_000;

/** The note's own blocks, by name: the editor passes its versions with node views, the server these. */
export const BLOCK_SPECS = {
  callout: CalloutSpec,
  mathInline: MathInlineSpec,
  mathBlock: MathBlockSpec,
  toggle: ToggleSpec,
  toggleSummary: ToggleSummary,
  toggleContent: ToggleContent,
  flashcard: FlashcardSpec,
  flashcardFront: FlashcardFront,
  flashcardBack: FlashcardBack,
  diagram: DiagramSpec,
  sketch: SketchSpec,
  plot: PlotSpec,
  file: FileSpec,
  deckEmbed: DeckEmbedSpec,
  lessonLink: LessonLinkSpec,
  pageLink: PageLinkSpec,
};

export type NoteBlocks = Record<keyof typeof BLOCK_SPECS, AnyExtension>;

/**
 * "[[" links remember the title of the page they were made with (data-page-title), so their text
 * can follow when the page is renamed, unless you changed the words yourself (knowledge/linkTitles.ts).
 */
const PageRefTitle = Extension.create({
  name: "pageRefTitle",
  addGlobalAttributes() {
    return [
      {
        types: ["link"],
        attributes: {
          pageTitle: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-page-title"),
            renderHTML: (attrs) => (typeof attrs.pageTitle === "string" ? { "data-page-title": attrs.pageTitle } : {}),
          },
        },
      },
    ];
  },
});

/**
 * Everything that shapes the document, in the editor's order. `readOnly`: viewers of a shared note
 * get no empty paragraph appended at the end (it would be a change, and viewers make none).
 */
export function documentExtensions(blocks: NoteBlocks, readOnly = false): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: { enableTabIndentation: true, tabSize: 2, HTMLAttributes: { spellcheck: "false" } },
      dropcursor: { color: false, width: 2, class: "blob-dropcursor" },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: null },
      },
      trailingNode: readOnly ? false : { node: "paragraph" },
    }),
    PageRefTitle,
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight,
    Image.configure({
      HTMLAttributes: { loading: "lazy" },
      resize: { enabled: true, directions: ["left", "right"], minWidth: 120, minHeight: 48, alwaysPreserveAspectRatio: true },
    }),
    blocks.callout,
    blocks.mathInline,
    blocks.mathBlock,
    blocks.toggle,
    blocks.toggleSummary,
    blocks.toggleContent,
    blocks.flashcard,
    blocks.flashcardFront,
    blocks.flashcardBack,
    Tables,
    blocks.diagram,
    blocks.sketch,
    blocks.plot,
    blocks.file,
    blocks.deckEmbed,
    blocks.lessonLink,
    blocks.pageLink,
  ];
}

const schemas = new Map<Locale, Schema>();

/** The note schema without the editor (on the server). `locale` names untitled page links in the text. */
export function noteSchema(locale: Locale): Schema {
  let schema = schemas.get(locale);
  if (!schema) {
    schema = getSchema(documentExtensions({ ...BLOCK_SPECS, pageLink: PageLinkSpec.configure({ untitled: () => editorText[locale].untitled }) }));
    schemas.set(locale, schema);
  }
  return schema;
}

/** A note made of its plain text, one paragraph per line. */
export function plainDoc(plain: string): JSONContent {
  return {
    type: "doc",
    content: plain.split("\n").map((line) => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] })),
  };
}

/** The note's plain text (search, previews, study tools), as the editor writes it. */
export function plainTextOf(doc: PMNode) {
  return getText(doc, { blockSeparator: "\n", textSerializers: getTextSerializersFromSchema(doc.type.schema) })
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, PLAIN_TEXT_LIMIT);
}
