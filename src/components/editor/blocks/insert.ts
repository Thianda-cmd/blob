import type { Editor, JSONContent, Range } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";

/** The node of `type` closest before the caret (just inserted ones end where the caret is). */
export function nearestOfType(state: EditorState, type: string): number | null {
  const caret = state.selection.from;
  let best: number | null = null;
  let distance = Infinity;
  state.doc.descendants((node, pos) => {
    if (node.type.name !== type) return true;
    const d = Math.abs(caret - (pos + node.nodeSize));
    if (d < distance) {
      distance = d;
      best = pos;
    }
    return false;
  });
  return best;
}

/** Click the "edit" trigger inside the node view at `pos` once it has rendered. */
export function openEditorAt(editor: Editor, pos: number, tries = 8) {
  requestAnimationFrame(() => {
    if (editor.isDestroyed) return;
    const dom = editor.view.nodeDOM(pos);
    const trigger = dom instanceof HTMLElement ? dom.querySelector<HTMLElement>("[data-open-editor]") : null;
    if (trigger) trigger.click();
    else if (tries > 0) openEditorAt(editor, pos, tries - 1);
  });
}

/**
 * Insert a block (or inline atom) from the "/" menu or a toolbar, select it and, with `open`, open
 * its editor right away (an empty formula, a new diagram…).
 */
export function insertBlock(editor: Editor, range: Range | null, content: JSONContent, open = true) {
  const chain = editor.chain().focus();
  if (range) chain.deleteRange(range);
  chain.insertContent(content).run();
  const pos = nearestOfType(editor.state, content.type!);
  if (pos === null) return;
  editor.commands.setNodeSelection(pos);
  if (open) openEditorAt(editor, pos);
}

/** Put the caret right after the node at `pos` (into the next line of text), and focus the editor. */
export function caretAfter(editor: Editor, pos: number) {
  if (editor.isDestroyed) return;
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;
  const after = Math.min(pos + node.nodeSize, editor.state.doc.content.size);
  const tr = editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(after)));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
}
