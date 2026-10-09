"use client";

import { InputRule, Node, mergeAttributes, type Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Sigma, Trash2 } from "lucide-react";
import { Component, useRef, useState, type ReactNode } from "react";
import { Kbd } from "@/components/ui/Kbd";
import { useMessages } from "@/i18n/client";
import { noteBlocksText, type NoteBlocksText } from "@/i18n/messages/noteBlocks";
import { MathView } from "@/learn/components/MathView";
import { plainMath } from "@/learn/engine/display";
import { cn } from "@/lib/utils";
import { useNoteBlocks } from "./context";
import { Floating } from "./Floating";
import { caretAfter, insertBlock, openEditorAt } from "./insert";
import { MathBlockSpec, MathInlineSpec, fromTypography, toDisplay } from "./schema";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    math: {
      /** Turn the selected text into a formula in the line (or insert an empty one). */
      selectionToMath: () => ReturnType;
    };
  }
}

/** Never let an odd formula take the note down: show its source instead. */
class SafeMath extends Component<{ src: string; children: ReactNode }, { failed: string | null }> {
  state = { failed: null as string | null };
  static getDerivedStateFromError() {
    return { failed: "yes" };
  }
  componentDidUpdate(prev: { src: string }) {
    if (prev.src !== this.props.src && this.state.failed) this.setState({ failed: null });
  }
  render() {
    return this.state.failed ? <code className="text-[0.85em]">{this.props.src}</code> : this.props.children;
  }
}

/** Snippets for the formula editor. `select` marks the part to type over. */
type Template = { id: keyof NoteBlocksText["math"]["t"]; insert: string; show: string; select?: [number, number] };
const TEMPLATES: Template[] = [
  { id: "fraction", insert: "\\frac{a}{b}", show: "\\frac{a}{b}", select: [6, 7] },
  { id: "root", insert: "\\sqrt{x}", show: "\\sqrt{x}", select: [6, 7] },
  { id: "power", insert: "^{2}", show: "x^2", select: [2, 3] },
  { id: "index", insert: "_{1}", show: "x_1", select: [2, 3] },
  { id: "sum", insert: "\\sum_{k=1}^{n} ", show: "Σ" },
  { id: "chem", insert: "\\ce{H2O}", show: "\\ce{H2O}", select: [4, 7] },
  { id: "arrow", insert: " -> ", show: "\\to" },
  { id: "pm", insert: " \\pm ", show: "\\pm" },
  { id: "times", insert: " \\cdot ", show: "\\cdot" },
  { id: "le", insert: " \\le ", show: "\\le" },
  { id: "ge", insert: " \\ge ", show: "\\ge" },
  { id: "ne", insert: " \\ne ", show: "\\ne" },
  { id: "approx", insert: " \\approx ", show: "\\approx" },
  { id: "implies", insert: " \\Rightarrow ", show: "\\Rightarrow" },
  { id: "pi", insert: "\\pi", show: "\\pi" },
  { id: "delta", insert: "\\Delta", show: "\\Delta" },
  { id: "alpha", insert: "\\alpha", show: "\\alpha" },
  { id: "degree", insert: "\\deg", show: "90\\deg" },
  { id: "infinity", insert: "\\infty", show: "\\infty" },
];

function MathPanel({
  anchor,
  initial,
  block,
  onDone,
  onRemove,
}: {
  anchor: HTMLElement;
  initial: string;
  block: boolean;
  /** `keyboard`: finished with Enter or "Done" (the caret goes after the formula); otherwise a click elsewhere. */
  onDone: (src: string, keyboard: boolean) => void;
  onRemove: () => void;
}) {
  const t = useMessages(noteBlocksText);
  const [draft, setDraft] = useState(initial);
  const area = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const finish = (keyboard: boolean) => {
    if (done.current) return;
    done.current = true;
    onDone(draft.trim(), keyboard);
  };

  const insert = (tpl: Template) => {
    const el = area.current;
    const at = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? at;
    const next = draft.slice(0, at) + tpl.insert + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const [a, b] = tpl.select ?? [tpl.insert.length, tpl.insert.length];
      el.setSelectionRange(at + a, at + b);
    });
  };

  return (
    <Floating anchor={anchor} onClose={() => finish(false)} label={t.math.edit} align={block ? "center" : "start"} className="w-[min(400px,calc(100vw-16px))] p-2">
      <label className="sr-only" htmlFor="blob-math-src">
        {t.math.source}
      </label>
      <textarea
        id="blob-math-src"
        ref={(el) => {
          area.current = el;
          if (el && !el.dataset.ready) {
            el.dataset.ready = "1";
            el.focus();
            // "\ce{}" starts with the caret between the braces.
            const at = draft.endsWith("{}") ? draft.length - 1 : draft.length;
            el.setSelectionRange(at, at);
          }
        }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            finish(true);
          }
        }}
        rows={Math.min(5, Math.max(2, draft.split("\n").length))}
        placeholder={t.math.placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="block w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-2 font-mono text-[13.5px] leading-relaxed text-ink outline-none transition-[border,box-shadow] placeholder:text-ink-3/70 focus:border-blob focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_16%,transparent)]"
      />
      <div className="mt-2 flex min-h-[64px] items-center justify-center overflow-x-auto rounded-lg bg-paper px-3 py-3 text-ink" aria-live="polite">
        {draft.trim() ? (
          <SafeMath src={draft}>
            <MathView src={toDisplay(draft)} size="md" />
          </SafeMath>
        ) : (
          <span className="text-center text-[12.5px] text-ink-3">{t.math.previewEmpty}</span>
        )}
      </div>
      <div className="mt-2 px-0.5 text-[11px] font-medium text-ink-3">{t.math.templates}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            title={t.math.t[tpl.id]}
            aria-label={t.math.t[tpl.id]}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(tpl)}
            className="grid h-9 min-w-9 place-items-center overflow-hidden rounded-md border border-line bg-surface px-1.5 text-ink-2 transition-colors hover:border-line-2 hover:bg-hover hover:text-ink"
          >
            <span className="pointer-events-none">
              <MathView src={toDisplay(tpl.show)} size="sm" animate={false} className={tpl.id === "fraction" ? "text-[12.5px]" : undefined} />
            </span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-line pt-2">
        <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-[11.5px] text-ink-3 [@media(hover:none)]:hidden">
          <Kbd>↵</Kbd> {t.done}
          <span className="ml-2" />
          <Kbd>⇧↵</Kbd> {t.math.newLine}
        </span>
        <span className="flex-1 [@media(hover:hover)]:hidden" />
        <button
          type="button"
          onClick={() => {
            done.current = true;
            onRemove();
          }}
          className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-danger/10 hover:text-danger"
          aria-label={t.math.remove}
          title={t.math.remove}
        >
          <Trash2 className="size-4" />
        </button>
        <button type="button" onClick={() => finish(true)} className="h-8 rounded-lg bg-ink px-3 text-[13px] font-medium text-paper transition-colors hover:bg-ink/88">
          {t.done}
        </button>
      </div>
    </Floating>
  );
}

function MathNodeView({ node, updateAttributes, editor, getPos, selected }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText).math;
  const { canEdit } = useNoteBlocks();
  const block = node.type.name === "mathBlock";
  const src = (node.attrs.src as string) ?? "";
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const close = (next: string | null, keyboard: boolean) => {
    setOpen(false);
    const pos = getPos();
    if (typeof pos !== "number" || editor.isDestroyed) return;
    if (!next) {
      // An empty formula isn't kept.
      editor.chain().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
      if (keyboard) editor.commands.focus();
      return;
    }
    if (next !== src) updateAttributes({ src: next });
    if (keyboard) caretAfter(editor, pos);
  };

  const Wrapper = block ? "div" : "span";
  return (
    <NodeViewWrapper as={Wrapper} className={cn(block ? "blob-math-block" : "blob-math-inline", selected && "is-selected", !canEdit && "is-readonly")}>
      <Wrapper
        ref={setAnchor}
        role={canEdit ? "button" : undefined}
        tabIndex={-1}
        data-open-editor
        title={canEdit ? t.edit : undefined}
        aria-label={canEdit ? t.edit : undefined}
        contentEditable={false}
        onClick={() => canEdit && setOpen(true)}
        className="blob-math-face"
      >
        {src ? (
          <SafeMath src={src}>
            <MathView src={toDisplay(src)} size={block ? "md" : "inline"} animate={false} />
          </SafeMath>
        ) : (
          <span className="blob-math-empty">
            <Sigma className="size-[0.95em]" />
            {block ? t.add : t.empty}
          </span>
        )}
      </Wrapper>
      {open && anchor && <MathPanel anchor={anchor} initial={src} block={block} onDone={close} onRemove={() => close(null, true)} />}
    </NodeViewWrapper>
  );
}

/** Open the formula editor of a selected formula with Enter. */
function enterOpens(editor: Editor, name: string) {
  const sel = editor.state.selection;
  if (!(sel instanceof NodeSelection) || sel.node.type.name !== name || !editor.isEditable) return false;
  openEditorAt(editor, sel.from, 0);
  return true;
}

/** A formula inside a line of text: type $a^2$ (or press Ctrl+Shift+M). */
export const MathInline = MathInlineSpec.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView, { as: "span" });
  },

  addCommands() {
    return {
      selectionToMath:
        () =>
        ({ editor, state }) => {
          const { from, to, empty } = state.selection;
          const text = empty ? "" : state.doc.textBetween(from, to, " ");
          if (empty) {
            insertBlock(editor, null, { type: this.name, attrs: { src: "" } });
            return true;
          }
          editor.chain().focus().insertContentAt({ from, to }, { type: this.name, attrs: { src: text } }).run();
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => enterOpens(editor, this.name),
      "Mod-Shift-m": ({ editor }) => editor.commands.selectionToMath(),
    };
  },

  addInputRules() {
    return [
      // "$x^2$" becomes a formula as the closing $ is typed (not "5$ and 10$": no spaces inside the ends).
      new InputRule({
        find: /(^|[\s([„"'])\$([^\s$](?:[^$]*?[^\s$])?)\$$/,
        handler: ({ state, range, match }) => {
          const start = range.from + match[1].length;
          state.tr.replaceWith(start, range.to, this.type.create({ src: fromTypography(match[2]) }));
        },
      }),
    ];
  },
});

/** A formula on its own line, centred: type $$ and a space at the start of a line. */
export const MathBlock = MathBlockSpec.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },

  addKeyboardShortcuts() {
    return { Enter: ({ editor }) => enterOpens(editor, this.name) };
  },

  addInputRules() {
    const editor = this.editor;
    return [
      new InputRule({
        find: /^\$\$\s$/,
        handler: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.name !== "paragraph" || $from.parent.textContent !== "$$") return null;
          state.tr.replaceWith($from.before(), $from.after(), this.type.create({ src: "" }));
          const pos = $from.before();
          requestAnimationFrame(() => {
            if (editor.isDestroyed) return;
            editor.commands.setNodeSelection(pos);
            openEditorAt(editor, pos);
          });
        },
      }),
    ];
  },
});
