"use client";

import type { Editor } from "@tiptap/core";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { blob } from "@/components/blob/bus";
import { useMessages } from "@/i18n/client";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";
import { embedFromParam, readEmbedItem, sameItem, type SheetEmbedAttrs } from "@/sheet/embed";
import { privateSheets } from "./blocks/sheetEmbedData";

/** Requests already carried out in this tab (React may run the effect twice, a rebuilt editor again). */
const handled = new Set<string>();

/**
 * "Add to note" in a spreadsheet opens the note at /p/<id>?sheetEmbed=<attributes>. Once the note
 * can take changes, the chart, table or cells go at its end through the editor's own commands (a
 * normal edit: saved, and sent to the others when working together, like typing), the block is
 * scrolled to and selected, and the address loses the parameter. Each request is carried out once.
 *
 * `ready`: the note can be edited now (working together: once it has caught up). `blocked`: it
 * can't be at all (you only view it): a word says so and nothing is added.
 */
export function useSheetEmbedParam({ editor, pageId, ready, blocked, enabled }: { editor: Editor | null; pageId: string; ready: boolean; blocked: boolean; enabled: boolean }) {
  const params = useSearchParams();
  const t = useMessages(noteBlocksText).sheet;
  const raw = enabled ? params.get("sheetEmbed") : null;

  useEffect(() => {
    if (!raw || !editor || editor.isDestroyed) return;
    const key = `${pageId}\n${raw}`;
    // The address without the request. The History API keeps Next's router in step (useSearchParams
    // follows) without asking the server for the page again.
    const clean = () => {
      const rest = new URLSearchParams(params.toString());
      rest.delete("sheetEmbed");
      const query = rest.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    };
    if (handled.has(key)) {
      clean();
      return;
    }
    const attrs = embedFromParam(raw);
    if (!attrs) {
      handled.add(key);
      clean();
      return;
    }
    if (blocked) {
      handled.add(key);
      blob.say(t.viewOnly, { mood: "thinking", ms: 6000 });
      clean();
      return;
    }
    if (!ready) return;
    handled.add(key);
    const at = insertAtEnd(editor, attrs);
    clean();
    if (at === null) return;
    blob.say(t.added, { mood: "happy" });
    // The spreadsheet may still have been saving when its page closed: look again in a moment.
    const pageOfSheet = attrs.pageId;
    if (pageOfSheet) setTimeout(() => void privateSheets.ensure(pageOfSheet, 0), 2500);
    // Once the block has drawn: bring it into view.
    requestAnimationFrame(() => {
      if (editor.isDestroyed) return;
      const dom = editor.view.nodeDOM(at);
      if (dom instanceof HTMLElement) dom.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [raw, editor, ready, blocked, pageId, params, t]);
}

/**
 * Put the block at the end of the note (before the empty line kept there for typing) and select it.
 * When the note already ends with this very block (the page was reloaded before the address was
 * cleaned), that one is selected instead. Returns the block's position.
 */
function insertAtEnd(editor: Editor, attrs: SheetEmbedAttrs): number | null {
  const { doc } = editor.state;
  let lastIndex = doc.childCount - 1;
  let last = doc.lastChild;
  const emptyLine = (n: typeof last) => !!n && n.type.name === "paragraph" && n.content.size === 0;
  if (emptyLine(last) && lastIndex > 0) {
    lastIndex--;
    last = doc.child(lastIndex);
  }
  let end = doc.content.size;
  if (emptyLine(doc.lastChild)) end -= doc.lastChild!.nodeSize;
  if (last && last.type.name === "sheetEmbed" && last.attrs.pageId === attrs.pageId && sameItem(readEmbedItem(last.attrs.item), attrs.item)) {
    const pos = end - last.nodeSize;
    editor.commands.setNodeSelection(pos);
    return pos;
  }
  const ok = editor
    .chain()
    .insertContentAt(end, { type: "sheetEmbed", attrs: { pageId: attrs.pageId, item: attrs.item, size: "m", caption: "" } })
    .setNodeSelection(end)
    .run();
  if (!ok) return null;
  // Typing in the note goes on after it (no keyboard popping up on touch screens, though).
  if (!matchMedia("(hover: none) and (pointer: coarse)").matches) editor.view.focus();
  return end;
}
