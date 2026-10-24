"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { AnimatePresence, motion } from "motion/react";
import { ALargeSmall, Bold, ExternalLink, Heading2, IndentDecrease, IndentIncrease, Italic, KeyboardOff, List, ListTodo, Plus, Redo2, SlidersHorizontal, Strikethrough, Undo2, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useKeyboard } from "@/components/ui/useKeyboard";
import { useMessages } from "@/i18n/client";
import { editorText } from "@/i18n/messages/editor";
import { noteToolsText } from "@/i18n/messages/noteTools";
import { cn } from "@/lib/utils";
import { sizeAtSelection, type TextColor } from "./formatting";
import { ListPanel, useListState } from "./ListTools";
import { TextColorPanel, TextSizePanel } from "./TextTools";

/**
 * Phones and tablets: the editing tools on a bar right above the keyboard (like Notes or Notion on a
 * phone), instead of a bubble over the selection that fights the system's own menu. "+" opens the
 * block menu; on a link, "Open" opens it (a tap on a link while editing only puts the caret there).
 */
/** The block menu at the caret: "/" there, with a space before it after a word (the menu only opens at a word's start). */
function openBlockMenu(editor: Editor) {
  const { $from, empty } = editor.state.selection;
  const before = empty ? $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset, undefined, "\ufffc") : "";
  editor.chain().focus().insertContent(before && !/\s/.test(before) ? " /" : "/").run();
}

export function KeyboardBar({ editor, onOpenLink }: { editor: Editor; onOpenLink: (href: string) => void }) {
  const t = useMessages(editorText).keyboard;
  const tt = useMessages(noteToolsText);
  const keyboard = useKeyboard();
  const list = useListState(editor);
  /** The panel above the bar: text size and colour, or the list's options. */
  const [panel, setPanel] = useState<"text" | "list" | null>(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      focused: e.isFocused,
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      heading: e.isActive("heading"),
      bullet: e.isActive("bulletList"),
      todo: e.isActive("taskList"),
      inList: e.isActive("listItem") || e.isActive("taskItem"),
      href: e.isActive("link") ? ((e.getAttributes("link").href as string | undefined) ?? "") : "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      ownSize: (e.getAttributes("textStyle").size as number | null | undefined) ?? null,
      color: (e.getAttributes("textStyle").color as TextColor | null | undefined) ?? null,
    }),
  });
  const show = keyboard.open && s.focused && editor.isEditable;
  const open = show ? (panel === "list" && !list ? null : panel) : null;
  const item = editor.isActive("taskItem") ? "taskItem" : "listItem";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="bar"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0, transition: { duration: 0.12 } }}
          transition={{ type: "spring", stiffness: 560, damping: 40 }}
          className="fixed inset-x-0 z-[45] border-t border-line bg-raised/95 shadow-[0_-6px_18px_-12px_rgb(0_0_0/0.25)] backdrop-blur-md"
          style={{ bottom: keyboard.height }}
          role="toolbar"
          aria-label={t.label}
          // Taps on the bar keep the text focused (and the keyboard up).
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) e.preventDefault();
          }}
        >
          <AnimatePresence>
            {open && (
              <motion.div
                key={open}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 6, opacity: 0, transition: { duration: 0.1 } }}
                transition={{ type: "spring", stiffness: 560, damping: 40 }}
                className="absolute bottom-full left-1.5 mb-1.5 max-h-[45vh] overflow-y-auto rounded-xl border border-line bg-raised shadow-pop"
              >
                {open === "text" ? (
                  <div className="divide-y divide-line">
                    <TextSizePanel editor={editor} size={sizeAtSelection(editor)} own={s.ownSize} typing={false} />
                    <TextColorPanel editor={editor} color={s.color} />
                  </div>
                ) : (
                  list && <ListPanel editor={editor} state={list} typing={false} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex h-11 items-center gap-0.5 overflow-x-auto px-1.5 [scrollbar-width:none]">
            <Tool icon={Plus} label={t.insert} onClick={() => openBlockMenu(editor)} strong />
            <Sep />
            <Tool icon={Bold} label={t.bold} on={s.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
            <Tool icon={Italic} label={t.italic} on={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
            <Tool icon={Strikethrough} label={t.strike} on={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()} />
            <Tool icon={ALargeSmall} label={tt.size.label} on={open === "text" || !!s.ownSize || !!s.color} onClick={() => setPanel((p) => (p === "text" ? null : "text"))} />
            <Tool icon={Heading2} label={t.heading} on={s.heading} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
            <Tool icon={List} label={t.bullet} on={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()} />
            <Tool icon={ListTodo} label={t.todo} on={s.todo} onClick={() => editor.chain().focus().toggleTaskList().run()} />
            {s.inList && (
              <>
                <Tool icon={SlidersHorizontal} label={tt.list.label} on={open === "list"} onClick={() => setPanel((p) => (p === "list" ? null : "list"))} />
                <Tool icon={IndentDecrease} label={t.outdent} onClick={() => editor.chain().focus().liftListItem(item).run()} />
                <Tool icon={IndentIncrease} label={t.indent} onClick={() => editor.chain().focus().sinkListItem(item).run()} />
              </>
            )}
            {s.href && (
              <button
                type="button"
                onClick={() => onOpenLink(s.href)}
                className="ml-0.5 flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-blob-soft px-2.5 text-[13px] font-medium text-blob-ink"
              >
                <ExternalLink className="size-4" /> {t.openLink}
              </button>
            )}
            <span className="flex-1" />
            <Tool icon={Undo2} label={t.undo} disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()} />
            <Tool icon={Redo2} label={t.redo} disabled={!s.canRedo} onClick={() => editor.chain().focus().redo().run()} />
            <Sep />
            <Tool icon={KeyboardOff} label={t.hide} onClick={() => editor.commands.blur()} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden />;
}

function Tool({ icon: Icon, label, onClick, on, disabled, strong }: { icon: LucideIcon; label: string; onClick: () => void; on?: boolean; disabled?: boolean; strong?: boolean; children?: ReactNode }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={on}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-35",
        on ? "bg-blob-soft text-blob-ink" : strong ? "text-blob-ink" : "text-ink-2 active:bg-hover",
      )}
    >
      <Icon className="size-[18px]" strokeWidth={on || strong ? 2.4 : 2} />
    </motion.button>
  );
}
