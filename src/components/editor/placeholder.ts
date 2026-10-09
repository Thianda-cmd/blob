import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { editorText, type EditorText } from "@/i18n/messages/editor";
import { noteBlocksText, type NoteBlocksText } from "@/i18n/messages/noteBlocks";
import { calloutKind } from "./blocks/schema";

type PlaceholderText = EditorText["placeholder"];

/** Blocks whose empty lines always say what goes in them (not only while the caret is there). */
const ALWAYS = new Set(["flashcardFront", "flashcardBack", "toggleSummary"]);

/**
 * Placeholders, computed from the state that is being rendered (cheap: a scan of the blocks only).
 * - empty note: "Start writing…" (with the slash hint while focused; the idle text comes from
 *   `data-placeholder-idle`, see globals.css)
 * - every empty heading: "Heading 1/2/3"
 * - flashcard sides and toggle summaries: what goes there
 * - the empty line holding the caret: "Type '/' for commands…" (hidden by CSS when blurred), or what
 *   the block around it is for (a definition, a toggle's content…)
 */
export const BlobPlaceholder = Extension.create<{ text: () => PlaceholderText; blocks: () => NoteBlocksText }>({
  name: "blobPlaceholder",
  addOptions() {
    return { text: () => editorText.en.placeholder, blocks: () => noteBlocksText.en };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;
    return [
      new Plugin({
        key: new PluginKey("blobPlaceholder"),
        props: {
          decorations(state) {
            if (!editor.isEditable) return null;
            const t = options.text();
            const b = options.blocks();
            const inside = (container: PMNode | null) => {
              switch (container?.type.name) {
                case "listItem":
                  return t.list;
                case "taskItem":
                  return t.todo;
                case "blockquote":
                  return t.quote;
                case "callout":
                  return b.callout.placeholder[calloutKind(container.attrs.kind)];
                case "toggleContent":
                  return b.toggle.body;
                default:
                  return null;
              }
            };
            const { doc, selection } = state;
            const decos: Decoration[] = [];
            const first = doc.firstChild;
            if (doc.childCount === 1 && first && first.type.name === "paragraph" && first.content.size === 0) {
              decos.push(
                Decoration.node(0, first.nodeSize, {
                  class: "is-empty is-editor-empty",
                  "data-placeholder": t.empty,
                  "data-placeholder-idle": t.emptyIdle,
                }),
              );
              return DecorationSet.create(doc, decos);
            }

            doc.forEach((node, offset) => {
              if (node.type.name === "heading" && node.content.size === 0) {
                decos.push(Decoration.node(offset, offset + node.nodeSize, { class: "is-empty", "data-placeholder": t.heading(node.attrs.level as number) }));
              }
            });

            const always: Record<string, string> = { flashcardFront: b.flashcard.frontPlaceholder, flashcardBack: b.flashcard.backPlaceholder, toggleSummary: b.toggle.summary };
            doc.descendants((node, pos) => {
              if (node.isTextblock) return false;
              if (node.type.name === "toggle") {
                const summary = node.firstChild;
                if (summary && summary.content.size === 0) decos.push(Decoration.node(pos + 1, pos + 1 + summary.nodeSize, { class: "is-empty is-always", "data-placeholder": always.toggleSummary }));
                return true;
              }
              if (ALWAYS.has(node.type.name) && node.childCount === 1 && node.firstChild!.isTextblock && node.firstChild!.content.size === 0) {
                decos.push(Decoration.node(pos + 1, pos + 1 + node.firstChild!.nodeSize, { class: "is-empty is-always", "data-placeholder": always[node.type.name] }));
                return false;
              }
              return true;
            });

            const { $from, empty } = selection;
            const parent = $from.parent;
            if (empty && $from.depth > 0 && parent.isTextblock && parent.type.name === "paragraph" && parent.content.size === 0) {
              const container = $from.depth > 1 ? $from.node($from.depth - 1) : null;
              if (container && ALWAYS.has(container.type.name)) return decos.length ? DecorationSet.create(doc, decos) : null;
              const pos = $from.before();
              decos.push(
                Decoration.node(pos, pos + parent.nodeSize, {
                  class: "is-empty is-current",
                  "data-placeholder": inside(container) ?? t.line,
                }),
              );
            }
            return decos.length ? DecorationSet.create(doc, decos) : null;
          },
        },
      }),
    ];
  },
});
