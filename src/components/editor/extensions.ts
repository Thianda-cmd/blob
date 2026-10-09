import { Extension, type AnyExtension, type Editor, type Range } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import Typography from "@tiptap/extension-typography";
import { Selection } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import type { Locale } from "@/i18n/config";
import { editorText } from "@/i18n/messages/editor";
import { Callout } from "./Callout";
import { ImageUploadPlaceholder } from "./imageUpload";
import { PageLink } from "./PageLink";
import { BlobPlaceholder } from "./placeholder";
import { SlashCommand, type SlashController } from "./slash/SlashCommand";
import { filterSlashItems, type SlashItem } from "./slash/items";

/** True when the caret is in the very first line of text, with nothing (e.g. an image) above it. */
function inFirstTextblock(state: EditorState) {
  const { $from } = state.selection;
  if (!$from.parent.isTextblock || $from.depth < 1 || $from.index(0) !== 0) return false;
  let first = -1;
  state.doc.descendants((node, pos) => {
    if (first >= 0) return false;
    if (node.isTextblock) {
      first = pos + 1;
      return false;
    }
    return true;
  });
  return $from.start() === first;
}

/** Arrow-up from the first line (or Backspace in an empty note) jumps back to the title. */
const TitleBridge = Extension.create<{ onExitTop: () => void }>({
  name: "titleBridge",
  addOptions() {
    return { onExitTop: () => {} };
  },
  addKeyboardShortcuts() {
    return {
      ArrowUp: ({ editor }) => {
        const { state, view } = editor;
        if (!state.selection.empty || !inFirstTextblock(state) || !view.endOfTextblock("up")) return false;
        this.options.onExitTop();
        return true;
      },
      Backspace: ({ editor }) => {
        if (!editor.isEmpty || !inFirstTextblock(editor.state) || editor.state.selection.$from.parent.type.name !== "paragraph") return false;
        this.options.onExitTop();
        return true;
      },
    };
  },
});

/** German typing gets German quotes: "so" → „so“, 'so' → ‚so‘. */
const GERMAN_QUOTES = { openDoubleQuote: "„", closeDoubleQuote: "“", openSingleQuote: "‚", closeSingleQuote: "‘" };

export function buildExtensions({
  slash,
  runSlash,
  onExitTop,
  getLocale,
  readOnly = false,
}: {
  slash: SlashController;
  runSlash: (item: SlashItem, editor: Editor, range: Range) => void;
  onExitTop: () => void;
  /** The reader's language, read whenever text is shown (menus, placeholders, page links). */
  getLocale: () => Locale;
  /**
   * Viewers of a shared note: no empty paragraph appended at the end (it would be a change, and
   * viewers make none).
   */
  readOnly?: boolean;
}): AnyExtension[] {
  const text = () => editorText[getLocale()];
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
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight,
    getLocale() === "de" ? Typography.configure(GERMAN_QUOTES) : Typography,
    Image.configure({
      HTMLAttributes: { loading: "lazy" },
      resize: { enabled: true, directions: ["left", "right"], minWidth: 120, minHeight: 48, alwaysPreserveAspectRatio: true },
    }),
    Callout,
    PageLink.configure({ untitled: () => text().untitled }),
    Selection.configure({ className: "blob-selection" }),
    BlobPlaceholder.configure({ text: () => text().placeholder }),
    ImageUploadPlaceholder,
    SlashCommand.configure({
      controller: slash,
      run: runSlash,
      items: (query) => filterSlashItems(query, getLocale()),
      emptyHint: () => text().placeholder.slashQuery,
    }),
    TitleBridge.configure({ onExitTop }),
  ];
}
