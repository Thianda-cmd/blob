"use client";

import { Extension, InputRule, Node, mergeAttributes, type Editor, type JSONContent, type Range } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { ChevronRight } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { cn } from "@/lib/utils";
import { suggestionOpen } from "../suggestKeys";
import { nearestOfType } from "./insert";

/**
 * Which toggles are open. Kept out of the document: opening one is just looking, it isn't an edit
 * (and viewers of a shared note can open them too). Toggles start closed, except the ones you make.
 */
const openState = {
  map: new Map<string, boolean>(),
  subs: new Set<() => void>(),
  get(id: string | null) {
    return id ? (this.map.get(id) ?? false) : true;
  },
  set(id: string | null, open: boolean) {
    if (!id || this.get(id) === open) return;
    this.map.set(id, open);
    this.subs.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    openState.subs.add(fn);
    return () => {
      openState.subs.delete(fn);
    };
  },
};

export const newBlockId = () => crypto.randomUUID();

/** A new toggle, open so you can fill it in. */
export function newToggle(): JSONContent {
  const id = newBlockId();
  openState.set(id, true);
  return { type: "toggle", attrs: { id }, content: [{ type: "toggleSummary" }, { type: "toggleContent", content: [{ type: "paragraph" }] }] };
}

/** Insert a new toggle (open) and put the caret in its summary line. */
export function insertToggle(editor: Editor, range: Range | null) {
  const chain = editor.chain().focus();
  if (range) chain.deleteRange(range);
  chain.insertContent(newToggle()).run();
  const pos = nearestOfType(editor.state, "toggle");
  if (pos !== null) editor.commands.setTextSelection(pos + 2);
}

function ToggleView({ node, editor, getPos }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText).toggle;
  const id = (node.attrs.id as string | null) ?? null;
  const open = useSyncExternalStore(
    openState.subscribe,
    () => openState.get(id),
    () => false,
  );
  return (
    <NodeViewWrapper className={cn("blob-toggle", open && "is-open")}>
      <button
        type="button"
        contentEditable={false}
        className="blob-toggle-chevron"
        aria-expanded={open}
        aria-label={open ? t.close : t.open}
        title={open ? t.close : t.open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const pos = getPos();
          // Closing with the caret inside: the caret moves up to the summary (it would open it again).
          if (open && typeof pos === "number" && !editor.isDestroyed) {
            const contentFrom = pos + 1 + node.firstChild!.nodeSize;
            const { from } = editor.state.selection;
            if (from > contentFrom && from < pos + node.nodeSize) {
              editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, contentFrom - 1)));
            }
          }
          openState.set(id, !open);
        }}
      >
        <ChevronRight className="size-[1.05em]" strokeWidth={2.2} />
      </button>
      <NodeViewContent className="blob-toggle-inner" />
    </NodeViewWrapper>
  );
}

/** The toggle around the caret, if the caret is in its summary line. */
function summaryAround(state: EditorState) {
  const { $from } = state.selection;
  if ($from.parent.type.name !== "toggleSummary" || $from.depth < 2) return null;
  const toggle = $from.node($from.depth - 1);
  return { toggle, pos: $from.before($from.depth - 1), $from };
}

function isOpen(node: PMNode) {
  return openState.get((node.attrs.id as string | null) ?? null);
}

/** A line that hides what's below it until you open it ("aufklappen"). */
export const Toggle = Node.create({
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

  addNodeView() {
    return ReactNodeViewRenderer(ToggleView);
  },

  addInputRules() {
    return [
      // ">> " at the start of an empty line.
      new InputRule({
        find: /^>>\s$/,
        handler: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.name !== "paragraph" || $from.parent.textContent !== ">>") return null;
          const node = state.schema.nodeFromJSON(newToggle());
          const at = $from.before();
          state.tr.replaceWith(at, $from.after(), node);
          state.tr.setSelection(TextSelection.create(state.tr.doc, at + 2));
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      // Enter in the summary opens the toggle and starts a line at the top of its content.
      Enter: ({ editor }) => {
        if (suggestionOpen(editor.state)) return false;
        const { $from, empty } = editor.state.selection;
        // An empty last line in the content: leave the toggle (the line moves out below it).
        if (
          empty &&
          $from.depth >= 3 &&
          $from.parent.type.name === "paragraph" &&
          $from.parent.content.size === 0 &&
          $from.node($from.depth - 1).type.name === "toggleContent" &&
          $from.index($from.depth - 1) === $from.node($from.depth - 1).childCount - 1 &&
          $from.node($from.depth - 1).childCount > 1
        ) {
          const togglePos = $from.before($from.depth - 2);
          const toggle = $from.node($from.depth - 2);
          return editor
            .chain()
            .command(({ tr, state }) => {
              const line = $from.parent.nodeSize;
              tr.delete($from.before(), $from.after());
              const after = togglePos + toggle.nodeSize - line;
              tr.insert(after, state.schema.nodes.paragraph.create());
              tr.setSelection(TextSelection.create(tr.doc, after + 1));
              return true;
            })
            .run();
        }
        const at = summaryAround(editor.state);
        if (!at || !empty) return false;
        const { toggle, pos } = at;
        openState.set(toggle.attrs.id, true);
        const contentPos = pos + 1 + toggle.firstChild!.nodeSize;
        const first = toggle.lastChild!.firstChild;
        return editor
          .chain()
          .command(({ tr, state }) => {
            if (!(first?.type.name === "paragraph" && first.content.size === 0)) tr.insert(contentPos + 1, state.schema.nodes.paragraph.create());
            tr.setSelection(TextSelection.create(tr.doc, contentPos + 2));
            return true;
          })
          .run();
      },
      // Backspace at the very start of the summary turns the toggle back into normal lines.
      Backspace: ({ editor }) => {
        const at = summaryAround(editor.state);
        if (!at || !editor.state.selection.empty || at.$from.parentOffset !== 0) return false;
        const { toggle, pos } = at;
        return editor
          .chain()
          .command(({ tr, state }) => {
            const para = state.schema.nodes.paragraph.create(null, toggle.firstChild!.content);
            const blocks: PMNode[] = [para];
            toggle.lastChild!.forEach((b) => {
              if (!(b.type.name === "paragraph" && b.content.size === 0)) blocks.push(b);
            });
            tr.replaceWith(pos, pos + toggle.nodeSize, blocks);
            tr.setSelection(TextSelection.create(tr.doc, pos + 1));
            return true;
          })
          .run();
      },
      // A closed toggle is skipped by the arrow keys.
      ArrowDown: ({ editor }) => skipClosed(editor, "down"),
      ArrowUp: ({ editor }) => skipClosed(editor, "up"),
      "Mod-Enter": ({ editor }) => {
        const at = summaryAround(editor.state);
        if (!at) return false;
        openState.set(at.toggle.attrs.id, !isOpen(at.toggle));
        return true;
      },
    };
  },
});

function skipClosed(editor: Editor, dir: "up" | "down") {
  const { state, view } = editor;
  if (suggestionOpen(state) || !state.selection.empty || !view.endOfTextblock(dir)) return false;
  const { $from } = state.selection;
  if (dir === "down") {
    const at = summaryAround(state);
    if (!at || isOpen(at.toggle)) return false;
    const after = at.pos + at.toggle.nodeSize;
    view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(after))).scrollIntoView());
    return true;
  }
  // Up from the line right below a closed toggle: into its summary.
  if ($from.depth < 1) return false;
  const before = $from.before($from.depth);
  const $before = state.doc.resolve(before);
  const prev = $before.nodeBefore;
  if (!prev || prev.type.name !== "toggle" || isOpen(prev)) return false;
  const summaryEnd = before - prev.nodeSize + 1 + prev.firstChild!.nodeSize - 1;
  view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, summaryEnd)).scrollIntoView());
  return true;
}

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

/** When the caret ends up inside a closed toggle (a click, search, undo), the toggle opens. */
export const ToggleReveal = Extension.create({
  name: "toggleReveal",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("toggleReveal"),
        view: () => ({
          update: (view) => {
            const { $from } = view.state.selection;
            for (let d = $from.depth; d > 0; d--) {
              const n = $from.node(d);
              if (n.type.name === "toggleContent") {
                const toggle = $from.node(d - 1);
                if (!isOpen(toggle)) setTimeout(() => openState.set(toggle.attrs.id, true));
              }
            }
          },
        }),
      }),
    ];
  },
});
