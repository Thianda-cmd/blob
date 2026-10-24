"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { ArrowDown, ArrowUp, CaseSensitive, ChevronRight, Regex, Replace, ReplaceAll, TextSearch, WholeWord, X, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { blob } from "@/components/blob/bus";
import { MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { useIsMac } from "@/components/ui/useMediaQuery";
import { useLocale, useMessages } from "@/i18n/client";
import { findText } from "@/i18n/messages/find";
import { cn } from "@/lib/utils";
import { NO_OPTIONS, clearFind, findState, replaceAll, replaceCurrent, selectCurrent, setFind, stepFind, type FindOptions } from "./find";

const MAX_SHOWN = 2000;
const NOTHING = { count: 0, current: -1, invalid: false };

/**
 * Find and replace in one note: the bar (top right of the note, staying in sight while it scrolls)
 * and an entry for the note's menu. Ctrl/Cmd+F opens it while the focus is in this note (the
 * browser's own find works everywhere else); Ctrl+H, or Cmd+Option+F on a Mac, opens it with
 * Replace. Notes side by side each have their own: the keys only count inside `root`.
 */
export function useFindBar({ editor, root, canEdit }: { editor: Editor | null; root: RefObject<HTMLElement | null>; canEdit: boolean }) {
  const t = useMessages(findText);
  const locale = useLocale();
  const mac = useIsMac();
  const [open, setOpen] = useState(false);
  const [withReplace, setWithReplace] = useState(false);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [options, setOptions] = useState<FindOptions>(NO_OPTIONS);
  const input = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e || e.isDestroyed) return NOTHING;
      const f = findState(e.state);
      return { count: f.matches.length, current: f.current, invalid: f.invalid };
    },
  }) ?? NOTHING;

  /** Opens the bar, with the selected words as the search (when they fit on a line). */
  const show = useCallback(
    (replace = false) => {
      if (editor && !editor.isDestroyed) {
        const { from, to, empty } = editor.state.selection;
        const picked = empty ? "" : editor.state.doc.textBetween(from, to, " ");
        if (picked && picked.length <= 200 && !picked.includes("\n")) setQuery(picked);
      }
      setOpen(true);
      if (replace && canEdit) setWithReplace(true);
      requestAnimationFrame(() => {
        const target = replace && canEdit && query ? replaceInput.current : input.current;
        target?.focus();
        target?.select();
      });
    },
    [editor, canEdit, query],
  );

  // The search follows what is typed and the toggles.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (!open) {
      if (findState(editor.state).query) clearFind(editor.view);
      return;
    }
    setFind(editor.view, query, options);
  }, [editor, open, query, options]);

  const close = useCallback(
    (select: boolean) => {
      setOpen(false);
      if (!editor || editor.isDestroyed) return;
      // The caret goes to the match you were on.
      if (select) selectCurrent(editor.view);
      clearFind(editor.view);
      if (select) editor.view.focus();
    },
    [editor],
  );

  // The keys, inside this note only.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = mac ? e.metaKey : e.ctrlKey;
      if (!mod || e.shiftKey) return;
      const key = e.key.toLowerCase();
      const find = key === "f" && !e.altKey;
      const replace = (!mac && key === "h" && !e.altKey) || (e.altKey && e.code === "KeyF");
      if (!find && !replace) return;
      e.preventDefault();
      e.stopPropagation();
      show(replace);
    };
    el.addEventListener("keydown", onKey, true);
    return () => el.removeEventListener("keydown", onKey, true);
  }, [root, mac, show]);

  const step = (dir: 1 | -1) => editor && !editor.isDestroyed && stepFind(editor.view, dir);
  const toggle = (key: keyof FindOptions) => setOptions((o) => ({ ...o, [key]: !o[key] }));

  const doReplace = () => {
    if (!editor || editor.isDestroyed || !canEdit) return;
    replaceCurrent(editor.view, replacement);
  };
  const doReplaceAll = () => {
    if (!editor || editor.isDestroyed || !canEdit) return;
    const n = replaceAll(editor.view, replacement);
    if (n) blob.say(t.replaced(n), { mood: "happy" });
  };

  const keys = (k: string) => (mac ? `⌘${k}` : `${locale === "de" ? "Strg" : "Ctrl"}+${k}`);
  const status = !query ? "" : s.invalid ? t.invalid : !s.count ? t.none : s.count >= MAX_SHOWN ? t.many(s.count) : t.count(Math.max(1, s.current + 1), s.count);

  const onKeys = (e: React.KeyboardEvent, inReplace: boolean) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (inReplace) {
        if (e.metaKey || e.ctrlKey) doReplaceAll();
        else doReplace();
      } else step(e.shiftKey ? -1 : 1);
    } else if (e.key === "ArrowDown" && !inReplace && (e.altKey || e.metaKey)) {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowUp" && !inReplace && (e.altKey || e.metaKey)) {
      e.preventDefault();
      step(-1);
    }
  };

  const bar: ReactNode = (
    // Takes no room in the note: a sticky line at the top of its scrolling box.
    <div className="pointer-events-none sticky top-0 z-30 h-0">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 560, damping: 36 }}
            style={{ transformOrigin: "top right" }}
            className="pointer-events-auto absolute inset-x-2 top-2 rounded-xl border border-line bg-raised p-1.5 text-ink-2 shadow-pop sm:left-auto sm:right-3 sm:w-[420px]"
            role="search"
            aria-label={t.label}
          >
            <div className="flex items-center gap-1">
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setWithReplace((r) => !r)}
                  className="blob-tool-btn"
                  aria-expanded={withReplace}
                  aria-label={withReplace ? t.hideReplace : t.showReplace}
                  title={`${withReplace ? t.hideReplace : t.showReplace}  ${mac ? "⌘⌥F" : keys("H")}`}
                >
                  <ChevronRight className={cn("transition-transform duration-200", withReplace && "rotate-90")} />
                </button>
              ) : (
                <span className="grid size-7 shrink-0 place-items-center text-ink-3" aria-hidden>
                  <TextSearch className="size-[15px]" />
                </span>
              )}
              <label className={cn("flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-lg border bg-surface pl-2.5 pr-2 focus-within:border-blob", s.invalid && query ? "border-danger/60" : "border-line")}>
                <input
                  ref={input}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => onKeys(e, false)}
                  placeholder={t.placeholder}
                  aria-label={t.find}
                  spellCheck={false}
                  autoComplete="off"
                  className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
                />
                <span role="status" className={cn("shrink-0 text-[11.5px] tabular-nums", s.invalid && query ? "text-danger" : "text-ink-3")}>
                  {status}
                </span>
              </label>
              <Toggle icon={CaseSensitive} label={t.matchCase} on={options.caseSensitive} onClick={() => toggle("caseSensitive")} />
              <Toggle icon={WholeWord} label={t.wholeWord} on={options.wholeWord} onClick={() => toggle("wholeWord")} />
              <Toggle icon={Regex} label={t.regex} on={options.regex} onClick={() => toggle("regex")} />
              <span className="mx-0.5 h-4 w-px shrink-0 bg-line max-sm:hidden" aria-hidden />
              <button type="button" onClick={() => step(-1)} disabled={!s.count} className="blob-tool-btn max-sm:hidden" aria-label={t.previous} title={`${t.previous}  ⇧↵`}>
                <ArrowUp />
              </button>
              <button type="button" onClick={() => step(1)} disabled={!s.count} className="blob-tool-btn" aria-label={t.next} title={`${t.next}  ↵`}>
                <ArrowDown />
              </button>
              <button type="button" onClick={() => close(true)} className="blob-tool-btn" aria-label={t.close} title={`${t.close}  Esc`}>
                <X />
              </button>
            </div>
            {canEdit && withReplace && (
              <div className="mt-1.5 flex items-center gap-1 pl-8">
                <label className="flex h-8 min-w-0 flex-1 items-center rounded-lg border border-line bg-surface px-2.5 focus-within:border-blob">
                  <input
                    ref={replaceInput}
                    value={replacement}
                    onChange={(e) => setReplacement(e.target.value)}
                    onKeyDown={(e) => onKeys(e, true)}
                    placeholder={t.replacePlaceholder}
                    aria-label={t.replacePlaceholder}
                    spellCheck={false}
                    autoComplete="off"
                    className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
                  />
                </label>
                <button type="button" onClick={doReplace} disabled={!s.count} className="blob-tool-btn" aria-label={t.replace} title={`${t.replace}  ↵`}>
                  <Replace />
                </button>
                <button type="button" onClick={doReplaceAll} disabled={!s.count} className="blob-tool-btn" aria-label={t.replaceAll} title={`${t.replaceAll}  ${keys("↵")}`}>
                  <ReplaceAll />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  /** "Find and replace" in the note's "…" menu (phones have no Ctrl+F). */
  const menuItem = (closeMenu: () => void) => (
    <>
      <MenuItem
        icon={<TextSearch />}
        shortcut={keys("F")}
        onSelect={() => {
          closeMenu();
          show(canEdit);
        }}
      >
        {canEdit ? t.menu : t.label}
      </MenuItem>
      <MenuSeparator />
    </>
  );

  return { bar, menuItem };
}

function Toggle({ icon: Icon, label, on, onClick }: { icon: LucideIcon; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={cn("blob-tool-btn", on && "bg-blob-soft! text-blob-ink!")}
    >
      <Icon />
    </button>
  );
}
