import { Extension, type AnyExtension, type Editor, type Range } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import Typography from "@tiptap/extension-typography";
import { Selection } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { Callout } from "./Callout";
import { ImageUploadPlaceholder } from "./imageUpload";
import { PageLink } from "./PageLink";
import { BlobPlaceholder } from "./placeholder";
import { SlashCommand, type SlashController } from "./slash/SlashCommand";
import type { SlashItem } from "./slash/items";

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

export function buildExtensions({
  slash,
  runSlash,
  onExitTop,
}: {
  slash: SlashController;
  runSlash: (item: SlashItem, editor: Editor, range: Range) => void;
  onExitTop: () => void;
}): AnyExtension[] {
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
      trailingNode: { node: "paragraph" },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight,
    Typography,
    Image.configure({
      HTMLAttributes: { loading: "lazy" },
      resize: { enabled: true, directions: ["left", "right"], minWidth: 120, minHeight: 48, alwaysPreserveAspectRatio: true },
    }),
    Callout,
    PageLink,
    Selection.configure({ className: "blob-selection" }),
    BlobPlaceholder,
    ImageUploadPlaceholder,
    SlashCommand.configure({ controller: slash, run: runSlash }),
    TitleBridge.configure({ onExitTop }),
  ];
}
