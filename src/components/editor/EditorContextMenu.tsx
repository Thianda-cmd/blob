"use client";

import type { Editor, Range } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { NodeSelection, TextSelection, type Selection } from "@tiptap/pm/state";
import { ArrowLeft, ChevronRight, ClipboardPaste, Copy, CopyPlus, Link2, Redo2, Scissors, Sigma, SquarePlus, TextSelect, Trash2, Undo2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { blob } from "@/components/blob/bus";
import { ContextMenu, useContextMenu, useLastPointer, wantsOwnMenu } from "@/components/ui/ContextMenu";
import { MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/Menu";
import { useLocale, useMessages } from "@/i18n/client";
import { editorText } from "@/i18n/messages/editor";
import { BLOCKS, currentBlock } from "./BubbleToolbar";
import { SLASH_GROUPS, slashItems, type SlashItem } from "./slash/items";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Put the selection on the clipboard as the editor itself would (rich and plain text). */
async function copySelection(editor: Editor) {
  const { state, view } = editor;
  if (state.selection.empty) return false;
  const { dom, text } = view.serializeForClipboard(state.selection.content());
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": new Blob([dom.innerHTML], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) }),
      ]);
    } else await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // An older browser: let the editor's own copy run on the focused selection.
    view.focus();
    return document.execCommand("copy");
  }
}

/** Paste from the clipboard (the browser may ask first, or refuse: then the shortcut works). */
async function pasteClipboard(editor: Editor) {
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes("text/html")) return editor.view.pasteHTML(await (await item.getType("text/html")).text());
      }
      for (const item of items) {
        if (item.types.includes("text/plain")) return editor.view.pasteText(await (await item.getType("text/plain")).text());
      }
      return false;
    }
    if (navigator.clipboard?.readText) return editor.view.pasteText(await navigator.clipboard.readText());
  } catch {}
  return false;
}

/** The top-level block the selection is in: its range in the document. */
function blockRange(editor: Editor): { from: number; to: number } | null {
  const sel = editor.state.selection;
  if (sel instanceof NodeSelection) return { from: sel.from, to: sel.to };
  const $from = sel.$from;
  if ($from.depth < 1) return null;
  return { from: $from.before(1), to: $from.after(1) };
}

type Kind = "text" | "selection" | "node";
type Panel = "main" | "turn" | "insert";

/**
 * The note's own right-click menu: undo, cut, copy, paste, turn the block into another kind, insert
 * any block below, duplicate or delete. Shift + right-click (and a long press on touch screens)
 * still gets the browser's menu.
 */
export function EditorContextMenu({
  editor,
  canEdit,
  pageId,
  runSlash,
}: {
  editor: Editor;
  canEdit: boolean;
  pageId: string;
  runSlash: (item: SlashItem, editor: Editor, range: Range) => void;
}) {
  const t = useMessages(editorText);
  const m = t.menu;
  const locale = useLocale();
  const mod = isMac ? "⌘" : t.bubble.ctrl;
  const shift = isMac ? "⇧" : t.bubble.shift;
  const { at, open, close } = useContextMenu();
  const last = useLastPointer();
  const [panel, setPanel] = useState<Panel>("main");
  const [kind, setKind] = useState<Kind>("text");

  useEffect(() => {
    const dom = editor.view.dom;
    // The selection as it was when the right button went down: the browser moves it on its own
    // right after (onto the word, or the line break, under the pointer).
    let before: { sel: Selection; doc: Node } | null = null;
    const onDown = (e: MouseEvent) => {
      if (e.button !== 2 || !wantsOwnMenu(e, last.current)) return;
      before = { sel: editor.state.selection, doc: editor.state.doc };
      e.preventDefault();
    };
    const onMenu = (e: MouseEvent) => {
      if (!wantsOwnMenu(e, last.current)) return;
      const { state } = editor;
      const kept = before && before.doc === state.doc ? before.sel : null;
      before = null;
      const sel = kept ?? state.selection;
      // Like the browser: a right-click outside the selection moves the caret (or picks the block) there.
      if (e.clientX || e.clientY) {
        const hit = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
        const inSelection = hit && !sel.empty && hit.pos >= sel.from && hit.pos <= sel.to;
        if (inSelection) {
          if (!state.selection.eq(sel)) editor.view.dispatch(state.tr.setSelection(sel));
        } else if (hit) {
          const node = hit.inside >= 0 ? state.doc.nodeAt(hit.inside) : null;
          const next =
            node && node.isAtom && NodeSelection.isSelectable(node)
              ? NodeSelection.create(state.doc, hit.inside)
              : TextSelection.near(state.doc.resolve(hit.pos));
          editor.view.dispatch(state.tr.setSelection(next));
        }
      }
      const now = editor.state.selection;
      setKind(now instanceof NodeSelection ? "node" : now.empty ? "text" : "selection");
      setPanel("main");
      open(e);
    };
    dom.addEventListener("mousedown", onDown, true);
    dom.addEventListener("contextmenu", onMenu);
    return () => {
      dom.removeEventListener("mousedown", onDown, true);
      dom.removeEventListener("contextmenu", onMenu);
    };
  }, [editor, open, last]);

  /** Run a menu action and close the menu. */
  const act = (fn: () => unknown) => () => {
    close();
    void fn();
  };

  // (Undo needs the history extension; a note being edited together may not have it.)
  const can = editor.can() as unknown as { undo?: () => boolean; redo?: () => boolean };
  const canUndo = canEdit && !!at && typeof can.undo === "function" && can.undo();
  const canRedo = canEdit && !!at && typeof can.redo === "function" && can.redo();
  const hasText = kind !== "text";
  const block = at && canEdit ? currentBlock(editor) : "text";

  const insertBelow = (item: SlashItem) => {
    // Into an empty line where the caret is, or a new line under the block.
    const sel = editor.state.selection;
    const empty = sel.empty && sel.$from.parent.isTextblock && sel.$from.parent.content.size === 0 && sel.$from.depth === 1;
    if (!empty) {
      const range = blockRange(editor);
      const after = range ? range.to : sel.to;
      editor.chain().focus().insertContentAt(after, { type: "paragraph" }).setTextSelection(after + 1).run();
    } else editor.commands.focus();
    const pos = editor.state.selection.from;
    runSlash(item, editor, { from: pos, to: pos });
  };

  const items = panel === "insert" ? slashItems(locale) : [];

  return (
    <ContextMenu at={at} onClose={close} label={m.label} className={panel === "main" ? "w-[248px]" : "w-[264px]"}>
      {panel === "main" && (
        <>
          {canEdit && (
            <>
              <MenuItem icon={<Undo2 />} shortcut={`${mod}Z`} disabled={!canUndo} onSelect={act(() => editor.chain().focus().undo().run())}>
                {m.undo}
              </MenuItem>
              <MenuItem icon={<Redo2 />} shortcut={`${mod}${shift}Z`} disabled={!canRedo} onSelect={act(() => editor.chain().focus().redo().run())}>
                {m.redo}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<Scissors />}
                shortcut={`${mod}X`}
                disabled={!hasText}
                onSelect={act(async () => {
                  if (await copySelection(editor)) editor.chain().focus().deleteSelection().run();
                })}
              >
                {m.cut}
              </MenuItem>
            </>
          )}
          <MenuItem icon={<Copy />} shortcut={`${mod}C`} disabled={!hasText} onSelect={act(() => copySelection(editor))}>
            {m.copy}
          </MenuItem>
          {canEdit && (
            <MenuItem
              icon={<ClipboardPaste />}
              shortcut={`${mod}V`}
              onSelect={act(async () => {
                editor.commands.focus();
                if (!(await pasteClipboard(editor))) blob.say(m.pasteHint(mod), { mood: "thinking" });
              })}
            >
              {m.paste}
            </MenuItem>
          )}
          <MenuItem icon={<TextSelect />} shortcut={`${mod}A`} onSelect={act(() => editor.chain().focus().selectAll().run())}>
            {m.selectAll}
          </MenuItem>

          {canEdit && (
            <>
              <MenuSeparator />
              {kind === "selection" && (
                <MenuItem icon={<Sigma />} shortcut={`${mod}${shift}M`} onSelect={act(() => editor.commands.selectionToMath())}>
                  {m.formula}
                </MenuItem>
              )}
              {kind !== "node" && (
                <MenuItem icon={<Wand2 />} shortcut={<ChevronRight className="size-3.5" />} onSelect={() => setPanel("turn")}>
                  {m.turnInto}
                </MenuItem>
              )}
              <MenuItem icon={<SquarePlus />} shortcut={<ChevronRight className="size-3.5" />} onSelect={() => setPanel("insert")}>
                {m.insert}
              </MenuItem>
              <MenuItem
                icon={<CopyPlus />}
                onSelect={act(() => {
                  const range = blockRange(editor);
                  if (!range) return;
                  const slice = editor.state.doc.slice(range.from, range.to);
                  editor.chain().focus().insertContentAt(range.to, slice.content.toJSON()).run();
                })}
              >
                {m.duplicate}
              </MenuItem>
              <MenuItem
                icon={<Trash2 />}
                danger
                onSelect={act(() => {
                  if (kind !== "text") return editor.chain().focus().deleteSelection().run();
                  const range = blockRange(editor);
                  if (range) editor.chain().focus().deleteRange(range).run();
                })}
              >
                {m.remove}
              </MenuItem>
            </>
          )}

          <MenuSeparator />
          <MenuItem
            icon={<Link2 />}
            onSelect={act(async () => {
              try {
                await navigator.clipboard.writeText(`${window.location.origin}/p/${pageId}`);
                blob.say(m.linkCopied, { mood: "happy" });
              } catch {}
            })}
          >
            {m.copyLink}
          </MenuItem>
          <p className="px-2 pb-1 pt-1.5 text-[11px] leading-snug text-ink-3 [@media(hover:none)]:hidden">{m.browserMenu}</p>
        </>
      )}

      {panel === "turn" && (
        <>
          <BackRow label={m.back} title={m.turnInto} onBack={() => setPanel("main")} />
          {BLOCKS.map((b) => {
            const Icon = b.icon;
            return (
              <MenuItem key={b.id} icon={<Icon />} active={block === b.id} onSelect={act(() => b.run(editor))}>
                {t.bubble.blocks[b.id]}
              </MenuItem>
            );
          })}
        </>
      )}

      {panel === "insert" && (
        <>
          <BackRow label={m.back} title={m.insert} onBack={() => setPanel("main")} />
          {SLASH_GROUPS.map((group) => {
            const list = items.filter((i) => i.group === group);
            if (!list.length) return null;
            return (
              <div key={group}>
                <MenuLabel>{t.slash.groups[group]}</MenuLabel>
                {list.map((item) => {
                  const Icon = item.icon;
                  return (
                    <MenuItem key={item.id} icon={<Icon />} onSelect={act(() => insertBelow(item))}>
                      {item.title}
                    </MenuItem>
                  );
                })}
              </div>
            );
          })}
        </>
      )}
    </ContextMenu>
  );
}

function BackRow({ label, title, onBack }: { label: string; title: string; onBack: () => void }) {
  return (
    <div className="mb-0.5 flex items-center gap-1 border-b border-line pb-1">
      <button
        type="button"
        role="menuitem"
        onClick={onBack}
        aria-label={label}
        title={label}
        className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink [@media(hover:none)]:size-8"
      >
        <ArrowLeft className="size-4" />
      </button>
      <span className="text-[12px] font-medium text-ink-2">{title}</span>
    </div>
  );
}
