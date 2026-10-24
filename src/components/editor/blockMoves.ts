import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection, Selection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { suggestionOpen } from "./suggestKeys";

// Moving blocks from the keyboard, like Notion: Ctrl/Cmd+Shift+↑/↓ moves the block the caret is in
// (or the list item, among its list's items) one place up or down, Ctrl/Cmd+D puts a copy of it
// right below. The caret moves along.

const ITEMS = new Set(["listItem", "taskItem"]);

/** What moves: the innermost list item around the selection, else its top-level block. */
function unitAt(state: EditorState): { node: PMNode; pos: number; depth: number } | null {
  const sel = state.selection;
  if (sel instanceof NodeSelection && sel.$from.depth === 0) return { node: sel.node, pos: sel.from, depth: 1 };
  const $from = sel.$from;
  for (let d = $from.depth; d > 0; d--) {
    if (ITEMS.has($from.node(d).type.name)) return { node: $from.node(d), pos: $from.before(d), depth: d };
  }
  if ($from.depth < 1) return null;
  return { node: $from.node(1), pos: $from.before(1), depth: 1 };
}

/** The selection again, shifted by `delta` (it moved with its block). */
function shifted(tr: Transaction, sel: Selection, delta: number) {
  if (sel instanceof NodeSelection) return NodeSelection.create(tr.doc, sel.from + delta);
  const size = tr.doc.content.size;
  return TextSelection.create(tr.doc, Math.min(size, Math.max(0, sel.anchor + delta)), Math.min(size, Math.max(0, sel.head + delta)));
}

function move(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, dir: -1 | 1) {
  const unit = unitAt(state);
  if (!unit) return false;
  const $pos = state.doc.resolve(unit.pos);
  const index = $pos.index();
  const parent = $pos.parent;
  const sibling = dir < 0 ? (index > 0 ? parent.child(index - 1) : null) : index + 1 < parent.childCount ? parent.child(index + 1) : null;
  // At the top or the bottom: nothing to move past (the empty line kept at the end stays last).
  if (!sibling || (dir > 0 && unit.depth === 1 && index + 2 === parent.childCount && sibling.type.name === "paragraph" && !sibling.content.size)) return false;
  if (!dispatch) return true;
  const tr = state.tr;
  if (dir < 0) {
    const from = unit.pos - sibling.nodeSize;
    tr.replaceWith(from, unit.pos + unit.node.nodeSize, [unit.node, sibling]);
    tr.setSelection(shifted(tr, state.selection, -sibling.nodeSize));
  } else {
    const to = unit.pos + unit.node.nodeSize + sibling.nodeSize;
    tr.replaceWith(unit.pos, to, [sibling, unit.node]);
    tr.setSelection(shifted(tr, state.selection, sibling.nodeSize));
  }
  dispatch(tr.scrollIntoView());
  return true;
}

function duplicate(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined) {
  const unit = unitAt(state);
  if (!unit) return false;
  if (!dispatch) return true;
  const after = unit.pos + unit.node.nodeSize;
  const tr = state.tr.insert(after, unit.node.copy(unit.node.content));
  tr.setSelection(shifted(tr, state.selection, unit.node.nodeSize));
  dispatch(tr.scrollIntoView());
  return true;
}

export const BlockMoves = Extension.create({
  name: "blobBlockMoves",
  addKeyboardShortcuts() {
    const run = (fn: (state: EditorState, dispatch: (tr: Transaction) => void) => boolean) => () => {
      const { state, view } = this.editor;
      if (!this.editor.isEditable || suggestionOpen(state)) return false;
      return fn(state, view.dispatch);
    };
    return {
      "Mod-Shift-ArrowUp": run((s, d) => move(s, d, -1)),
      "Mod-Shift-ArrowDown": run((s, d) => move(s, d, 1)),
      "Mod-d": run(duplicate),
    };
  },
});
