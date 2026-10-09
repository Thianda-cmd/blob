"use client";

import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Check,
  ChevronDown,
  Code,
  CornerDownLeft,
  ExternalLink,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Pilcrow,
  Sigma,
  Strikethrough,
  TextQuote,
  Underline,
  Unlink,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import { editorText } from "@/i18n/messages/editor";
import { cn } from "@/lib/utils";

const BUBBLE_KEY = "blobBubbleMenu";
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

type BlockId = "text" | "h1" | "h2" | "h3" | "bullet" | "numbered" | "todo" | "quote";

/** Labels come from `editorText.bubble.blocks[id]`. */
const BLOCKS: { id: BlockId; icon: LucideIcon; run: (e: Editor) => void }[] = [
  { id: "text", icon: Pilcrow, run: (e) => e.chain().focus().clearNodes().run() },
  { id: "h1", icon: Heading1, run: (e) => e.chain().focus().clearNodes().setHeading({ level: 1 }).run() },
  { id: "h2", icon: Heading2, run: (e) => e.chain().focus().clearNodes().setHeading({ level: 2 }).run() },
  { id: "h3", icon: Heading3, run: (e) => e.chain().focus().clearNodes().setHeading({ level: 3 }).run() },
  { id: "bullet", icon: List, run: (e) => e.chain().focus().clearNodes().toggleBulletList().run() },
  { id: "numbered", icon: ListOrdered, run: (e) => e.chain().focus().clearNodes().toggleOrderedList().run() },
  { id: "todo", icon: ListTodo, run: (e) => e.chain().focus().clearNodes().toggleTaskList().run() },
  { id: "quote", icon: TextQuote, run: (e) => e.chain().focus().clearNodes().toggleBlockquote().run() },
];

function currentBlock(editor: Editor): BlockId {
  for (const level of [1, 2, 3] as const) if (editor.isActive("heading", { level })) return `h${level}`;
  if (editor.isActive("taskList")) return "todo";
  if (editor.isActive("orderedList")) return "numbered";
  if (editor.isActive("bulletList")) return "bullet";
  if (editor.isActive("blockquote")) return "quote";
  return "text";
}

/** A non-empty text selection outside code blocks (not an image or other node). */
function hasFormattableSelection(editor: Editor) {
  const { state } = editor;
  const { selection } = state;
  if (!editor.isEditable || selection.empty || selection instanceof NodeSelection) return false;
  if (editor.isActive("codeBlock")) return false;
  return state.doc.textBetween(selection.from, selection.to, " ").trim().length > 0;
}

export function normalizeHref(raw: string) {
  const v = raw.trim();
  if (!v) return "";
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(v)) return v;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  return `https://${v}`;
}

/** Formatting bubble that appears over a text selection. */
export function BubbleToolbar({ editor }: { editor: Editor }) {
  const t = useMessages(editorText).bubble;
  const mod = isMac ? "⌘" : t.ctrl;
  const shift = isMac ? "⇧" : t.shift;
  const [mode, setMode] = useState<"tools" | "link">("tools");
  const [blocksOpen, setBlocksOpen] = useState(false);
  const pointerDown = useRef(false);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      highlight: e.isActive("highlight"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      block: currentBlock(e),
    }),
  });

  const shouldShow = useCallback(
    ({ editor: e, element }: { editor: Editor; element: HTMLElement }) =>
      !pointerDown.current && (e.view.hasFocus() || element.contains(document.activeElement)) && hasFormattableSelection(e),
    [],
  );

  const options = useMemo(
    () => ({
      placement: "top" as const,
      offset: 10,
      flip: { padding: 12 },
      shift: { padding: 12 },
      onHide: () => {
        setMode("tools");
        setBlocksOpen(false);
      },
    }),
    [],
  );

  // Notion-style: stay hidden while the mouse is still selecting, appear on release.
  useEffect(() => {
    const dom = editor.view.dom;
    const down = (e: MouseEvent) => {
      if (e.button === 0) pointerDown.current = true;
    };
    const up = () => {
      if (!pointerDown.current) return;
      pointerDown.current = false;
      requestAnimationFrame(() => {
        if (editor.isDestroyed || !editor.view.hasFocus() || !hasFormattableSelection(editor)) return;
        editor.view.dispatch(editor.state.tr.setMeta(BUBBLE_KEY, "show"));
        editor.view.dispatch(editor.state.tr.setMeta(BUBBLE_KEY, "updatePosition"));
      });
    };
    dom.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    return () => {
      dom.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
    };
  }, [editor]);

  // Escape closes the "Turn into" list first, then the bubble itself.
  useEffect(() => {
    const dom = editor.view.dom;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || editor.state.selection.empty) return;
      e.preventDefault();
      if (blocksOpen) setBlocksOpen(false);
      else editor.view.dispatch(editor.state.tr.setMeta(BUBBLE_KEY, "hide"));
    };
    dom.addEventListener("keydown", onKey);
    return () => dom.removeEventListener("keydown", onKey);
  }, [editor, blocksOpen]);

  return (
    <BubbleMenu editor={editor} pluginKey={BUBBLE_KEY} updateDelay={120} shouldShow={shouldShow} options={options} className="z-40">
      <div
        className="blob-bubble relative"
        onMouseDown={(e) => {
          // Keep the editor's selection while clicking tools (the link input still takes focus).
          if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
        }}
      >
        {mode === "link" ? (
          <LinkForm
            editor={editor}
            initial={s?.href ?? ""}
            hasLink={!!s?.link}
            onDone={() => {
              setMode("tools");
              editor.commands.focus();
            }}
          />
        ) : (
          <div className="flex items-center gap-0.5 rounded-xl border border-line bg-raised p-1 text-ink-2 shadow-pop">
            <button
              type="button"
              onClick={() => setBlocksOpen((o) => !o)}
              className={cn(
                "flex h-7 items-center gap-1 rounded-lg pl-2 pr-1.5 text-[12.5px] font-medium transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:h-8",
                blocksOpen && "bg-hover text-ink",
              )}
              aria-haspopup="menu"
              aria-expanded={blocksOpen}
              title={t.turnInto}
            >
              <BlockLabel block={s?.block ?? "text"} label={t.blocks[s?.block ?? "text"]} />
              <ChevronDown className={cn("size-3.5 text-ink-3 transition-transform duration-200", blocksOpen && "rotate-180")} />
            </button>
            <Divider />
            <Tool label={t.bold} shortcut={`${mod}B`} active={s?.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold />
            </Tool>
            <Tool label={t.italic} shortcut={`${mod}I`} active={s?.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic />
            </Tool>
            <Tool label={t.underline} shortcut={`${mod}U`} active={s?.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
              <Underline />
            </Tool>
            <Tool label={t.strike} shortcut={`${mod}${shift}S`} active={s?.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
              <Strikethrough />
            </Tool>
            <Tool label={t.code} shortcut={`${mod}E`} active={s?.code} onClick={() => editor.chain().focus().toggleCode().run()}>
              <Code />
            </Tool>
            <Tool label={t.highlight} shortcut={`${mod}${shift}H`} active={s?.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()}>
              <Highlighter />
            </Tool>
            <Tool label={t.formula} shortcut={`${mod}${shift}M`} onClick={() => editor.commands.selectionToMath()}>
              <Sigma />
            </Tool>
            <Divider />
            <Tool label={s?.link ? t.editLink : t.addLink} active={s?.link} onClick={() => setMode("link")}>
              <Link2 />
            </Tool>
          </div>
        )}

        <AnimatePresence>
          {blocksOpen && mode === "tools" && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -2, scale: 0.98, transition: { duration: 0.1 } }}
              transition={{ type: "spring", stiffness: 600, damping: 32 }}
              style={{ transformOrigin: "top left" }}
              className="absolute left-0 top-full z-10 mt-1.5 w-[188px] rounded-xl border border-line bg-raised p-1 shadow-pop"
              role="menu"
            >
              <div className="px-2 pb-1 pt-1 text-[11px] font-medium text-ink-3">{t.turnInto}</div>
              {BLOCKS.map((b) => {
                const Icon = b.icon;
                const on = s?.block === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      b.run(editor);
                      setBlocksOpen(false);
                    }}
                    className={cn(
                      "flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-ink-2 transition-colors hover:bg-hover hover:text-ink",
                      on && "text-ink",
                    )}
                  >
                    <Icon className="size-4 text-ink-3" strokeWidth={1.8} />
                    <span className="flex-1">{t.blocks[b.id]}</span>
                    {on && <Check className="size-3.5 text-blob-ink" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BubbleMenu>
  );
}

/** The current block's name; phones show its icon instead, so the bubble fits beside the tools. */
function BlockLabel({ block, label }: { block: BlockId; label: string }) {
  const Icon = BLOCKS.find((b) => b.id === block)?.icon ?? Pilcrow;
  return (
    <>
      <Icon className="size-[15px] sm:hidden" strokeWidth={1.9} aria-hidden />
      <span className="max-sm:sr-only">{label}</span>
    </>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-line" aria-hidden />;
}

function Tool({ label, shortcut, active, onClick, children }: { label: string; shortcut?: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={!!active}
      title={shortcut ? `${label}  ${shortcut}` : label}
      className={cn(
        "grid size-7 place-items-center rounded-lg transition-colors duration-100 [&_svg]:size-[15px] [@media(hover:none)]:size-8",
        active ? "bg-blob-soft text-blob-ink" : "hover:bg-hover hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function LinkForm({ editor, initial, hasLink, onDone }: { editor: Editor; initial: string; hasLink: boolean; onDone: () => void }) {
  const t = useMessages(editorText).bubble;
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
    // Keep the selected text visibly highlighted while focus is in this input.
    const dom = editor.view.dom;
    dom.classList.add("is-linking");
    return () => dom.classList.remove("is-linking");
  }, [editor]);

  const apply = () => {
    const href = normalizeHref(value);
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href) chain.setLink({ href }).run();
    else chain.unsetLink().run();
    onDone();
  };

  return (
    <form
      className="flex items-center gap-1 rounded-xl border border-line bg-raised p-1 shadow-pop"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <Link2 className="ml-1.5 size-[15px] shrink-0 text-ink-3" />
      <input
        ref={input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onDone();
          }
        }}
        placeholder={t.linkPlaceholder}
        className="h-7 w-[min(232px,calc(100vw-180px))] min-w-0 bg-transparent px-1.5 text-[13px] text-ink outline-none placeholder:text-ink-3"
        aria-label={t.linkAddress}
        spellCheck={false}
        autoComplete="off"
      />
      <button type="submit" className="grid size-7 place-items-center rounded-lg text-ink-2 hover:bg-hover hover:text-ink" aria-label={t.applyLink} title={t.apply}>
        <CornerDownLeft className="size-[15px]" />
      </button>
      {hasLink && (
        <>
          <a
            href={initial}
            target={initial.startsWith("/") ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="grid size-7 place-items-center rounded-lg text-ink-2 hover:bg-hover hover:text-ink"
            aria-label={t.openLink}
            title={t.openLink}
          >
            <ExternalLink className="size-[15px]" />
          </a>
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              onDone();
            }}
            className="grid size-7 place-items-center rounded-lg text-ink-2 hover:bg-danger/10 hover:text-danger"
            aria-label={t.removeLink}
            title={t.removeLink}
          >
            <Unlink className="size-[15px]" />
          </button>
        </>
      )}
    </form>
  );
}
