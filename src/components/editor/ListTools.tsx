"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { ArrowDownToLine, CornerDownRight, IndentDecrease, IndentIncrease, List, ListOrdered, ListTodo, RotateCcw, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import { editorText } from "@/i18n/messages/editor";
import { noteToolsText } from "@/i18n/messages/noteTools";
import { cn } from "@/lib/utils";
import { BASE_SIZE, LIST_MARKERS, listAround } from "./formatting";
import { SizeStepper } from "./TextTools";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

type ListKind = "bulletList" | "orderedList" | "taskList";
const KINDS: { kind: ListKind; icon: LucideIcon; toggle: (e: Editor) => void }[] = [
  { kind: "bulletList", icon: List, toggle: (e) => e.chain().focus().toggleBulletList().run() },
  { kind: "orderedList", icon: ListOrdered, toggle: (e) => e.chain().focus().toggleOrderedList().run() },
  { kind: "taskList", icon: ListTodo, toggle: (e) => e.chain().focus().toggleTaskList().run() },
];

/** What each marker looks like, for its button. */
const GLYPHS: Record<string, string> = { disc: "•", circle: "◦", square: "▪", dash: "–", arrow: "→", check: "✓", "1": "1.", a: "a.", A: "A.", i: "i.", I: "I." };

/** The list element (ul/ol) around the caret. */
function listElement(editor: Editor): HTMLElement | null {
  if (editor.isDestroyed) return null;
  const list = listAround(editor.state);
  if (!list) return null;
  try {
    const dom = editor.view.nodeDOM(list.pos);
    return dom instanceof HTMLElement ? dom : null;
  } catch {
    return null;
  }
}

/** The list around the caret, as the tools need it. */
export function useListState(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const list = e.isEditable ? listAround(e.state) : null;
      if (!list) return null;
      const a = list.node.attrs;
      return {
        kind: list.node.type.name as ListKind,
        marker: ((list.node.type.name === "orderedList" ? a.numbers : a.marker) as string | null) ?? null,
        start: (a.start as number | undefined) ?? 1,
        size: (a.size as number | null) ?? null,
        item: e.isActive("taskItem") ? "taskItem" : "listItem",
      };
    },
  });
}

/** Everything about the list around the caret: kind, markers, numbering, size, and where to write next. */
export function ListPanel({ editor, state, typing = true }: { editor: Editor; state: NonNullable<ReturnType<typeof useListState>>; typing?: boolean }) {
  const { list: t, size: ts } = useMessages(noteToolsText);
  const bubble = useMessages(editorText).bubble;
  const shift = isMac ? "⇧" : bubble.shift;
  const mod = isMac ? "⌘" : bubble.ctrl;
  const markers = state.kind === "taskList" ? null : LIST_MARKERS[state.kind];
  const shown = state.size ?? (() => {
    const el = listElement(editor);
    const px = el ? parseFloat(getComputedStyle(el).fontSize) : NaN;
    return Number.isFinite(px) ? Math.round(px) : BASE_SIZE;
  })();

  return (
    <div className="w-[260px] space-y-3 p-2.5 text-[12.5px]">
      <Section label={t.kind}>
        <div className="grid grid-cols-3 gap-1">
          {KINDS.map(({ kind, icon: Icon, toggle }) => (
            <button
              key={kind}
              type="button"
              onClick={() => state.kind !== kind && toggle(editor)}
              aria-pressed={state.kind === kind}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-lg border text-[12px] font-medium transition-colors",
                state.kind === kind ? "border-blob/40 bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
              )}
            >
              <Icon className="size-3.5" /> {t.kinds[kind]}
            </button>
          ))}
        </div>
      </Section>

      {markers && (
        <Section label={t.style}>
          <div className="flex flex-wrap gap-1">
            <Chip on={state.marker === null} onClick={() => editor.chain().focus().setListMarker(null).run()} title={t.auto}>
              {t.auto}
            </Chip>
            {markers.map((m) => (
              <Chip key={m} on={state.marker === m} onClick={() => editor.chain().focus().setListMarker(m).run()} title={t.markers[m]}>
                <span className="min-w-[1.1em] text-center font-semibold">{GLYPHS[m]}</span>
              </Chip>
            ))}
          </div>
        </Section>
      )}

      {state.kind === "orderedList" && typing && (
        <Section label={t.start}>
          <input
            key={state.start}
            type="number"
            min={0}
            max={9999}
            defaultValue={state.start}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (Number.isFinite(n)) editor.commands.setListStart(n);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editor.commands.focus();
              }
            }}
            aria-label={t.start}
            className="h-8 w-20 rounded-lg border border-line bg-surface px-2 text-[12.5px] tabular-nums text-ink outline-none focus:border-blob"
          />
        </Section>
      )}

      <Section label={t.size}>
        <div className="flex items-center gap-1.5">
          <SizeStepper value={shown} onChange={(px) => editor.chain().focus().setListSize(px).run()} label={t.size} typing={typing} />
          {state.size !== null && (
            <button type="button" onClick={() => editor.chain().focus().setListSize(null).run()} className="blob-tool-btn" aria-label={ts.reset} title={ts.reset}>
              <RotateCcw />
            </button>
          )}
        </div>
      </Section>

      <div className="-mx-1 space-y-0.5 border-t border-line pt-2">
        <Action icon={CornerDownRight} label={t.textUnder} keys={`${shift}↵`} onClick={() => editor.chain().focus().textUnderItem().run()} />
        <Action icon={ArrowDownToLine} label={t.continueBelow} keys={`${mod}↵`} onClick={() => editor.chain().focus().continueBelowList().run()} />
        <div className="grid grid-cols-2 gap-0.5">
          <Action icon={IndentDecrease} label={t.outdent} title={`${t.outdent}  ${shift}Tab`} onClick={() => editor.chain().focus().liftListItem(state.item).run()} />
          <Action icon={IndentIncrease} label={t.indent} title={`${t.indent}  Tab`} onClick={() => editor.chain().focus().sinkListItem(state.item).run()} />
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-ink-3">{label}</div>
      {children}
    </div>
  );
}

function Chip({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={on}
      className={cn(
        "flex h-7 items-center rounded-lg border px-2 text-[12px] transition-colors [@media(hover:none)]:h-8",
        on ? "border-blob/40 bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Action({ icon: Icon, label, keys, title, onClick }: { icon: LucideIcon; label: string; keys?: string; title?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={title} className="flex h-8 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left text-ink-2 transition-colors hover:bg-hover hover:text-ink">
      <Icon className="size-3.5 shrink-0 text-ink-3" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {keys && <span className="shrink-0 text-[11px] text-ink-3">{keys}</span>}
    </button>
  );
}

/** Computers: a small button beside the list the caret is in; it opens the list's options. */
export function ListMenu({ editor }: { editor: Editor }) {
  const t = useMessages(noteToolsText).list;
  const state = useListState(editor);
  const [open, setOpen] = useState(false);

  const shouldShow = useCallback(
    ({ editor: e, element }: { editor: Editor; element: HTMLElement }) =>
      e.isEditable && !!listAround(e.state) && e.state.selection.empty && (e.view.hasFocus() || element.contains(document.activeElement)),
    [],
  );
  const options = useMemo(
    () => ({
      placement: "left-start" as const,
      offset: 8,
      flip: { fallbackPlacements: ["top-start" as const] },
      shift: { padding: 8 },
      onHide: () => setOpen(false),
    }),
    [],
  );
  const anchor = useCallback(() => listElement(editor), [editor]);
  const Icon = KINDS.find((k) => k.kind === state?.kind)?.icon ?? List;

  return (
    <BubbleMenu editor={editor} pluginKey="blobListMenu" updateDelay={80} shouldShow={shouldShow} getReferencedVirtualElement={anchor} options={options} className="z-30">
      <div
        className="relative"
        onMouseDown={(e) => {
          if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={t.label}
          aria-expanded={open}
          title={t.label}
          className={cn(
            "grid size-7 place-items-center rounded-lg border border-line bg-raised text-ink-3 shadow-card transition-colors hover:text-ink",
            open && "border-blob/40 text-blob-ink",
          )}
        >
          <Icon className="size-3.5" />
        </button>
        <AnimatePresence>
          {open && state && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -2, scale: 0.98, transition: { duration: 0.1 } }}
              transition={{ type: "spring", stiffness: 600, damping: 32 }}
              style={{ transformOrigin: "top left" }}
              className="absolute left-0 top-full z-10 mt-1.5 rounded-xl border border-line bg-raised shadow-pop"
              role="dialog"
              aria-label={t.label}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                  editor.commands.focus();
                }
              }}
            >
              <ListPanel editor={editor} state={state} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BubbleMenu>
  );
}
