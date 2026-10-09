"use client";

import type { Editor } from "@tiptap/core";
import { TableKit } from "@tiptap/extension-table";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Grid2x2X,
  PanelTop,
  Rows3,
  Columns3,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { cn } from "@/lib/utils";

/** Tables: a header row, cells with any blocks, columns you can widen; they scroll sideways on phones. */
export const Tables = TableKit.configure({
  table: { resizable: true, cellMinWidth: 72, renderWrapper: true, HTMLAttributes: { class: "blob-table" } },
});

/** A 3 × 3 table with a header row. */
export const newTable = { rows: 3, cols: 3, withHeaderRow: true };

/** The <div class="tableWrapper"> (or <table>) around the caret. */
function tableElement(editor: Editor): HTMLElement | null {
  if (editor.isDestroyed) return null;
  try {
    const { node } = editor.view.domAtPos(editor.state.selection.from);
    const el = node instanceof HTMLElement ? node : node.parentElement;
    return (el?.closest(".tableWrapper") as HTMLElement | null) ?? (el?.closest("table") as HTMLElement | null) ?? null;
  } catch {
    return null;
  }
}

type Tool = { id: string; icon: LucideIcon; label: string; run: () => void; danger?: boolean; active?: boolean };

/** The table's tools, floating above it while the caret is in a table. */
export function TableMenu({ editor }: { editor: Editor }) {
  const t = useMessages(noteBlocksText).table;
  const header = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e.isActive("table")) return false;
      const { $from } = e.state.selection;
      for (let d = $from.depth; d > 0; d--) {
        const n = $from.node(d);
        if (n.type.name === "table") return n.firstChild?.firstChild?.type.name === "tableHeader";
      }
      return false;
    },
  });

  const shouldShow = useCallback(
    ({ editor: e, element }: { editor: Editor; element: HTMLElement }) =>
      e.isEditable && e.isActive("table") && (e.view.hasFocus() || element.contains(document.activeElement)) && e.state.selection.empty,
    [],
  );
  const options = useMemo(() => ({ placement: "top-start" as const, offset: 8, flip: false as const, shift: { padding: 8 } }), []);
  const anchor = useCallback(() => tableElement(editor), [editor]);

  const run = (fn: (e: Editor) => void) => () => fn(editor);
  const groups: Tool[][] = [
    [
      { id: "rowAbove", icon: BetweenHorizontalStart, label: t.rowAbove, run: run((e) => e.chain().focus().addRowBefore().run()) },
      { id: "rowBelow", icon: BetweenHorizontalEnd, label: t.rowBelow, run: run((e) => e.chain().focus().addRowAfter().run()) },
      { id: "colLeft", icon: BetweenVerticalStart, label: t.colLeft, run: run((e) => e.chain().focus().addColumnBefore().run()) },
      { id: "colRight", icon: BetweenVerticalEnd, label: t.colRight, run: run((e) => e.chain().focus().addColumnAfter().run()) },
    ],
    [{ id: "header", icon: PanelTop, label: t.header, active: !!header, run: run((e) => e.chain().focus().toggleHeaderRow().run()) }],
    [
      { id: "deleteRow", icon: Rows3, label: t.deleteRow, danger: true, run: run((e) => e.chain().focus().deleteRow().run()) },
      { id: "deleteCol", icon: Columns3, label: t.deleteCol, danger: true, run: run((e) => e.chain().focus().deleteColumn().run()) },
      { id: "deleteTable", icon: Grid2x2X, label: t.deleteTable, danger: true, run: run((e) => e.chain().focus().deleteTable().run()) },
    ],
  ];

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="blobTableMenu"
      updateDelay={60}
      shouldShow={shouldShow}
      getReferencedVirtualElement={anchor}
      options={options}
      className="z-30"
    >
      <div
        role="toolbar"
        aria-label={t.label}
        className="flex items-center gap-0.5 rounded-xl border border-line bg-raised p-1 text-ink-2 shadow-pop"
        onMouseDown={(e) => e.preventDefault()}
      >
        {groups.map((group, gi) => (
          <div key={gi} className="flex items-center gap-0.5">
            {gi > 0 && <span className="mx-0.5 h-4 w-px bg-line" aria-hidden />}
            {group.map(({ id, icon: Icon, label, run, danger, active }) => (
              <button
                key={id}
                type="button"
                onClick={run}
                aria-label={label}
                aria-pressed={active}
                title={label}
                className={cn(
                  "grid size-7 place-items-center rounded-lg transition-colors [&_svg]:size-[15px] [@media(hover:none)]:size-8",
                  active ? "bg-blob-soft text-blob-ink" : danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-hover hover:text-ink",
                )}
              >
                <Icon strokeWidth={1.9} />
              </button>
            ))}
          </div>
        ))}
      </div>
    </BubbleMenu>
  );
}
