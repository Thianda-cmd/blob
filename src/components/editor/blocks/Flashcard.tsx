"use client";

import { Node, mergeAttributes, type Editor, type Range } from "@tiptap/core";
import { TextSelection, type EditorState } from "@tiptap/pm/state";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditorState, type ReactNodeViewProps } from "@tiptap/react";
import { Layers, RotateCw } from "lucide-react";
import { useState } from "react";
import { useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { cn } from "@/lib/utils";
import { useNoteBlocks } from "./context";
import { suggestionOpen } from "../suggestKeys";
import { nearestOfType } from "./insert";
import { newBlockId } from "./Toggle";

/** A new, empty flashcard. */
export function newFlashcard() {
  return {
    type: "flashcard",
    attrs: { id: newBlockId() },
    content: [
      { type: "flashcardFront", content: [{ type: "paragraph" }] },
      { type: "flashcardBack", content: [{ type: "paragraph" }] },
    ],
  };
}

/** Insert a new flashcard and put the caret on its front. */
export function insertFlashcard(editor: Editor, range: Range | null) {
  const chain = editor.chain().focus();
  if (range) chain.deleteRange(range);
  chain.insertContent(newFlashcard()).run();
  const pos = nearestOfType(editor.state, "flashcard");
  if (pos !== null) editor.commands.setTextSelection(pos + 3);
}

/** Which side of the card at `pos` holds the caret, if any. */
function caretSide(state: EditorState, pos: number): "front" | "back" | null {
  const card = state.doc.nodeAt(pos);
  if (!card || card.type.name !== "flashcard") return null;
  const { from } = state.selection;
  const backStart = pos + 1 + card.firstChild!.nodeSize;
  if (from <= pos || from >= pos + card.nodeSize) return null;
  return from < backStart ? "front" : "back";
}

/** Move the caret to the end of a side of the card at `pos`. */
function goToSide(editor: Editor, pos: number, side: "front" | "back") {
  const card = editor.state.doc.nodeAt(pos);
  if (!card) return false;
  const front = card.firstChild!;
  const target = side === "front" ? pos + front.nodeSize : pos + front.nodeSize + card.lastChild!.nodeSize;
  const tr = editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(target), -1));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

function FlashcardView({ editor, getPos, node }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText).flashcard;
  const { canEdit } = useNoteBlocks();
  // While you write, the card shows the side with the caret; otherwise it flips on demand.
  const caret = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const pos = getPos();
      return typeof pos === "number" && e.isEditable ? caretSide(e.state, pos) : null;
    },
  });
  const [manual, setManual] = useState<"front" | "back">("front");
  const side = caret ?? manual;
  const backEmpty = node.lastChild?.textContent.trim() === "" && node.lastChild?.childCount === 1;

  const flip = () => {
    const next = side === "front" ? "back" : "front";
    setManual(next);
    const pos = getPos();
    if (canEdit && caret && typeof pos === "number") goToSide(editor, pos, next);
  };

  return (
    <NodeViewWrapper
      className={cn("blob-flashcard", side === "back" && "is-flipped", !canEdit && "is-readonly")}
      onClick={(e: React.MouseEvent) => {
        // Reading a shared note: a tap anywhere turns the card.
        if (!canEdit && !(e.target as HTMLElement).closest("a,button")) flip();
      }}
    >
      <div className="blob-flashcard-head" contentEditable={false}>
        <span className="blob-flashcard-pill">
          <Layers className="size-3.5" strokeWidth={2} />
          {t.label}
        </span>
        <span className="blob-flashcard-sides" aria-hidden>
          <span className={cn(side === "front" && "is-on")}>{t.front}</span>
          <span className={cn(side === "back" && "is-on")}>{t.back}</span>
        </span>
        <button
          type="button"
          className="blob-flashcard-flip"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            flip();
          }}
          aria-label={side === "front" ? t.showBack : t.showFront}
          title={t.flip}
        >
          <RotateCw className="size-3.5" strokeWidth={2} />
          <span className="max-sm:sr-only">{side === "front" ? t.showBack : t.showFront}</span>
        </button>
      </div>
      <div className="blob-flashcard-stage">
        <NodeViewContent className="blob-flashcard-faces" />
      </div>
      {!canEdit && <div className="blob-flashcard-hint" contentEditable={false}>{t.tapToFlip}</div>}
      {canEdit && backEmpty && side === "front" && caret === "front" && (
        <div className="blob-flashcard-hint" contentEditable={false}>
          Tab → {t.back}
        </div>
      )}
    </NodeViewWrapper>
  );
}

/** The card around the caret: its position and the side the caret is on. */
function cardAround(state: EditorState) {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "flashcard") {
      const pos = $from.before(d);
      return { pos, node: $from.node(d), side: caretSide(state, pos)! };
    }
  }
  return null;
}

/** A card to learn with: a question on the front, the answer on the back (Blob's study mode reads them). */
export const Flashcard = Node.create({
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

  addNodeView() {
    return ReactNodeViewRenderer(FlashcardView);
  },

  addKeyboardShortcuts() {
    return {
      // Tab: from the question to the answer (lists in the answer keep their own Tab).
      Tab: ({ editor }) => {
        if (suggestionOpen(editor.state)) return false;
        const at = cardAround(editor.state);
        if (!at || at.side !== "front") return false;
        return goToSide(editor, at.pos, "back");
      },
      "Shift-Tab": ({ editor }) => {
        if (suggestionOpen(editor.state)) return false;
        const at = cardAround(editor.state);
        if (!at || at.side !== "back" || editor.isActive("listItem")) return false;
        return goToSide(editor, at.pos, "front");
      },
      // Backspace in an empty card removes it.
      Backspace: ({ editor }) => {
        const at = cardAround(editor.state);
        if (!at || !editor.state.selection.empty || at.node.textContent.trim() !== "") return false;
        if (at.side === "back" && editor.state.selection.$from.parentOffset === 0) return goToSide(editor, at.pos, "front");
        if (at.side !== "front" || editor.state.selection.$from.parentOffset !== 0) return false;
        return editor
          .chain()
          .command(({ tr, state }) => {
            tr.replaceWith(at.pos, at.pos + at.node.nodeSize, state.schema.nodes.paragraph.create());
            tr.setSelection(TextSelection.create(tr.doc, at.pos + 1));
            return true;
          })
          .run();
      },
    };
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
