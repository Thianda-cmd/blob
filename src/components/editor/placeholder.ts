import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const NESTED: Record<string, string> = {
  listItem: "List",
  taskItem: "To-do",
  blockquote: "Quote",
  callout: "Key idea…",
};

/**
 * Placeholders, computed from the state that is being rendered (cheap: top-level scan only).
 * - empty note: "Start writing…" (CSS swaps in the slash hint while focused)
 * - every empty heading: "Heading 1/2/3"
 * - the empty line holding the caret: "Type '/' for commands…" (hidden by CSS when blurred)
 */
export const BlobPlaceholder = Extension.create({
  name: "blobPlaceholder",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("blobPlaceholder"),
        props: {
          decorations(state) {
            if (!editor.isEditable) return null;
            const { doc, selection } = state;
            const decos: Decoration[] = [];
            const first = doc.firstChild;
            if (doc.childCount === 1 && first && first.type.name === "paragraph" && first.content.size === 0) {
              decos.push(
                Decoration.node(0, first.nodeSize, {
                  class: "is-empty is-editor-empty",
                  "data-placeholder": "Start writing, or type '/' for commands…",
                }),
              );
              return DecorationSet.create(doc, decos);
            }

            doc.forEach((node, offset) => {
              if (node.type.name === "heading" && node.content.size === 0) {
                decos.push(Decoration.node(offset, offset + node.nodeSize, { class: "is-empty", "data-placeholder": `Heading ${node.attrs.level}` }));
              }
            });

            const { $from, empty } = selection;
            const parent = $from.parent;
            if (empty && $from.depth > 0 && parent.isTextblock && parent.type.name === "paragraph" && parent.content.size === 0) {
              const container = $from.depth > 1 ? $from.node($from.depth - 1).type.name : "doc";
              const pos = $from.before();
              decos.push(
                Decoration.node(pos, pos + parent.nodeSize, {
                  class: "is-empty is-current",
                  "data-placeholder": NESTED[container] ?? "Type '/' for commands…",
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
