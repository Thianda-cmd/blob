import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { newBlockId } from "./Toggle";

/** Blocks with an `id` that must stay unique (flashcards: their learning progress is stored by it). */
const WITH_IDS = new Set(["flashcard", "toggle"]);

/**
 * Gives flashcards and toggles an id when they have none, and a new one when a copy (paste,
 * duplicate) repeats an id. Only for our own edits: the others' steps already carry their ids.
 */
export const BlockIds = Extension.create({
  name: "blockIds",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("blockIds"),
        appendTransaction: (transactions, _old, state) => {
          if (!transactions.some((tr) => tr.docChanged) || transactions.some((tr) => tr.getMeta("collab$"))) return null;
          const seen = new Set<string>();
          const fix: { pos: number; attrs: Record<string, unknown> }[] = [];
          state.doc.descendants((node, pos) => {
            if (node.isTextblock) return false;
            if (!WITH_IDS.has(node.type.name)) return true;
            const id = node.attrs.id as string | null;
            if (!id || seen.has(id)) fix.push({ pos, attrs: { ...node.attrs, id: newBlockId() } });
            else seen.add(id);
            return true;
          });
          if (!fix.length) return null;
          const tr = state.tr;
          for (const f of fix) tr.setNodeMarkup(f.pos, undefined, f.attrs);
          return tr.setMeta("addToHistory", false);
        },
      }),
    ];
  },
});
